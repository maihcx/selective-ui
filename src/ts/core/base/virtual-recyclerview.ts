import { ModelContract } from "src/ts/types/core/base/model.type";
import { RecyclerView } from "./recyclerview";
import { AdapterContract } from "src/ts/types/core/base/adapter.type";
import { Libs } from "src/ts/utils/libs";
import { VirtualOptions, VirtualRecyclerViewTags } from "src/ts/types/core/base/virtual-recyclerview.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";
import { Fenwick } from "./fenwick";

/**
 * Virtualized RecyclerView with windowing and dynamic-height support.
 *
 * This recycler only keeps the **visible window** mounted in the DOM, plus an overscan buffer,
 * while simulating the full scroll height using top/bottom padding elements.
 *
 * ### Responsibility
 * - Maintain a viewport window `[start..end]` over adapter items and mount/unmount DOM accordingly.
 * - Support **variable row heights** using measured outer heights (including vertical margins).
 * - Provide stable scrolling under height changes via an **anchor correction** strategy.
 * - Integrate with item visibility (filtering): invisible items are treated as height `0` and are not mounted.
 *
 * ### Virtualization strategy
 * - **Prefix sums** over heights are maintained in a {@link Fenwick} tree:
 *   - `offsetTopOf(i)` → prefix sum for heights before item `i`
 *   - `findFirstVisibleIndex(scrollTop)` → lower-bound over prefix sums (then forward-scan to visible)
 * - **Overscan** is expressed in item multiples and converted to pixels using the current estimate:
 *   `overscanPx = overscan * estimate`.
 * - **Adaptive estimate** can be enabled to use the running average of measured items as the estimate.
 *
 * ### Dynamic heights (measurement)
 * - When enabled, visible items are measured using `getBoundingClientRect()` + computed margins.
 * - A {@link ResizeObserver} observes the host container and schedules re-measurement on the next animation frame.
 * - Height updates are applied incrementally to the Fenwick tree in **O(log n)** per item.
 *
 * ### Anchor correction (scroll stability)
 * - An "anchor index" (first visible item) is derived from the current scroll position.
 * - After re-render and potential height changes, scrollTop is adjusted so the anchor remains visually stable,
 *   preventing "jumping" during measurement-driven reflows.
 *
 * ### Lifecycle / idempotency
 * - Mounted scaffold elements are created when an adapter is set via {@link setAdapter}.
 * - `refresh()` is safe to call repeatedly; it rebuilds internal structures and schedules a window update.
 * - `destroy()` is idempotent once in {@link LifecycleState.DESTROYED} and removes scaffold DOM nodes.
 *
 * ### DOM side effects
 * - Mutates DOM under `viewElement` by creating three nodes:
 *   - `PadTop`, `ItemsHost`, `PadBottom`
 * - Mounts/unmounts item nodes inside `ItemsHost`
 * - Attaches/removes a scroll listener on the resolved scroll container
 * - Uses `scrollIntoView`/scrollTop assignments when asked to bring an item into view
 *
 * @template TItem - Model type for list items.
 * @template TAdapter - Adapter providing view holders and binding logic.
 *
 * @extends {RecyclerView<TItem, TAdapter>}
 * @see {@link VirtualOptions}
 * @see {@link RecyclerView}
 */
export class VirtualRecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> extends RecyclerView<TItem, TAdapter> {
    /**
     * Virtualization settings (materialized to `Required<VirtualOptions>`).
     *
     * - `scrollEl`           : External scroll container (if omitted, inferred from DOM)
     * - `estimateItemHeight` : Initial/fallback item height in pixels
     * - `overscan`           : Extra viewport height (in item multiples) rendered above/below
     * - `dynamicHeights`     : Enable measuring items with ResizeObserver
     * - `adaptiveEstimate`   : Use average of measured items as the running estimate
     */
    private opts: Required<VirtualOptions> = {
        scrollEl: undefined as HTMLElement,
        estimateItemHeight: 36,
        overscan: 8,
        dynamicHeights: true,
        adaptiveEstimate: true,
    };

    /** Top padding element (simulates offscreen items above). */
    private PadTop!: HTMLDivElement;
    /** Host container where visible item elements are mounted. */
    private ItemsHost!: HTMLDivElement;
    /** Bottom padding element (simulates offscreen items below). */
    private PadBottom!: HTMLDivElement;
    /** Scroll container used for viewport calculations. */
    private scrollEl!: HTMLElement;

    /** Cache of measured heights per item index (undefined when not measured). */
    private heightCache: Array<number | undefined> = [];
    /**
     * Fenwick tree storing current height values (in pixels).
     * Invisible items are encoded as height 0.
     */
    private fenwick = new Fenwick(0);
    /**
     * Map of currently mounted DOM elements keyed by item index.
     * Used to avoid re-creating nodes and to manage ordering within the host.
     */
    private created = new Map<number, HTMLElement>();

    /** Whether an initial height probe has been performed. */
    private firstMeasured = false;
    /** Current window bounds (inclusive) in item index space. */
    private start = 0;
    /** Current window end (inclusive). -1 means not initialized. */
    private end = -1;
    /** Observer used to detect resize events that may change item heights. */
    private resizeObs?: ResizeObserver;

    /** Pending animation frame ids for window and measurement. */
    private rafId: number | null = null;
    private measureRaf: number | null = null;

    /** Re-entrancy/suspension flags used to prevent feedback loops. */
    private updating = false;
    private suppressResize = false;
    private lastRenderCount = 0;
    private suspended = false;
    private boundOnScroll?: () => void;
    private resumeResizeAfter = false;

    /** Small cache for sticky header height (≈16ms TTL) to limit layout reads. */
    private stickyCacheTick = 0;
    private stickyCacheVal = 0;

    /** Stats for adaptive estimator (sum of measured heights / count of measured items). */
    private measuredSum = 0;
    private measuredCount = 0;

    /** Epsilon threshold for height-change significance (px). */
    private static readonly EPS = 0.5;
    /** Attribute stored on each mounted element indicating its item index. */
    private static readonly ATTR_INDEX = "data-vindex";

    /**
     * Creates a virtual recycler view.
     *
     * Note: The virtualization scaffold is built when an adapter is set via {@link setAdapter}.
     *
     * @param {HTMLDivElement | null} [viewElement=null] - Optional root container for the recycler view.
     */
    constructor(viewElement: HTMLDivElement | null = null) {
        super(viewElement);
    }

    /**
     * Updates virtualization settings (overscan, estimates, dynamic heights, etc.).
     *
     * This only updates internal configuration; consumers should call {@link refresh}
     * to apply changes immediately if needed.
     *
     * @param {Partial<VirtualOptions>} opts - Partial configuration merged into current options.
     * @returns {void}
     */
    public configure(opts: Partial<VirtualOptions>): void {
        this.opts = { ...this.opts, ...opts } as Required<VirtualOptions>;
    }

    /**
     * Binds an adapter and initializes the virtualization scaffold.
     *
     * ### Flow
     * 1) Dispose previous listeners/observers if an adapter was already attached
     * 2) Call `super.setAdapter(adapter)` to wire base recycler state
     * 3) Build the scaffold elements (PadTop, ItemsHost, PadBottom)
     * 4) Resolve `scrollEl` (configured `opts.scrollEl` → nearest popup → parentElement)
     * 5) Attach scroll listener, perform initial refresh, attach resize observer
     * 6) Subscribe to adapter visibility updates (if supported) to hard-refresh windowing state
     *
     * DOM side effects:
     * - Clears `viewElement` children and replaces with scaffold nodes.
     * - Attaches a `scroll` listener to `scrollEl` (`passive: true`).
     *
     * @param {TAdapter} adapter - Adapter that provides items and view binding.
     * @returns {void}
     * @throws {Error} If no scroll container can be resolved.
     * @override
     */
    public override setAdapter(adapter: TAdapter): void {
        if (this.adapter) this.dispose();

        super.setAdapter(adapter);
        adapter.recyclerView = this;

        if (!this.viewElement) return;

        this.viewElement.replaceChildren();

        const nodeMounted = Libs.mountNode({
            PadTop:   { tag: { node: "div", classList: "seui-virtual-pad-top" } },
            ItemsHost:{ tag: { node: "div", classList: "seui-virtual-items" } },
            PadBottom:{ tag: { node: "div", classList: "seui-virtual-pad-bottom" } },
        }, this.viewElement) as VirtualRecyclerViewTags;

        this.PadTop = nodeMounted.PadTop;
        this.ItemsHost = nodeMounted.ItemsHost;
        this.PadBottom = nodeMounted.PadBottom;

        this.scrollEl = this.opts.scrollEl
            ?? (this.viewElement.closest(".seui-popup") as HTMLElement)
            ?? (this.viewElement.parentElement as HTMLElement);

        if (!this.scrollEl) throw new Error("VirtualRecyclerView: scrollEl not found");

        this.boundOnScroll = this.onScroll.bind(this);
        this.scrollEl.addEventListener("scroll", this.boundOnScroll, { passive: true });

        this.refresh(false);
        this.attachResizeObserverOnce();
        (adapter as any)?.onVisibilityChanged?.(() => this.refreshItem());
    }

    /**
     * Suspends scroll/resize processing to prevent window updates during batch operations.
     *
     * Behavior:
     * - Cancels any scheduled animation frames.
     * - Detaches the scroll listener (if attached).
     * - Disconnects ResizeObserver and remembers to restore it on {@link resume}.
     *
     * @returns {void}
     */
    public suspend(): void {
        this.suspended = true;
        this.cancelFrames();

        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this.boundOnScroll);
        }

        if (this.resizeObs) {
            this.resizeObs.disconnect();
            this.resumeResizeAfter = true;
        }
    }

    /**
     * Resumes processing after {@link suspend}.
     *
     * Behavior:
     * - Re-attaches the scroll listener (if available).
     * - Restores ResizeObserver when it was previously disconnected.
     * - Schedules a window recalculation on the next animation frame.
     *
     * @returns {void}
     */
    public resume(): void {
        this.suspended = false;

        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.addEventListener("scroll", this.boundOnScroll, { passive: true });
        }

        if (this.resumeResizeAfter) {
            this.attachResizeObserverOnce();
            this.resumeResizeAfter = false;
        }

        this.scheduleUpdateWindow();
    }

    /**
     * Rebuilds internal virtualization state and schedules a render update.
     *
     * Behavior:
     * - When `isUpdate === false`, triggers a hard refresh via {@link refreshItem} (reset + rebuild).
     * - Updates caches to match the adapter item count.
     * - Probes initial item height on first run to seed a better estimate.
     * - Rebuilds Fenwick prefix sums and schedules window computation.
     *
     * No-op if adapter or `viewElement` is missing.
     *
     * @param {boolean} isUpdate - `true` when called due to incremental data update; `false` for initial setup/full replace.
     * @returns {void}
     * @override
     */
    public override refresh(isUpdate: boolean): void {
        if (!this.adapter || !this.viewElement) return;
        if (!isUpdate) this.refreshItem();

        const count = this.adapter.itemCount();
        this.lastRenderCount = count;

        if (count === 0) {
            this.resetState();
            this.update();
            return;
        }

        this.heightCache.length = count;

        if (!this.firstMeasured) {
            this.probeInitialHeight();
            this.firstMeasured = true;
        }

        this.rebuildFenwick(count);
        this.scheduleUpdateWindow();
        this.update();
    }

    /**
     * Ensures the item at `index` is mounted, and optionally scrolls it into view.
     *
     * This is primarily used by navigation/highlight flows where the target may not be rendered
     * due to virtualization.
     *
     * @param {number} index - Item index to ensure visible/mounted.
     * @param {{ scrollIntoView?: boolean }} [opt] - Optional behavior controls.
     * @returns {void}
     */
    public ensureRendered(index: number, opt?: { scrollIntoView?: boolean }): void {
        this.mountRange(index, index);
        if (opt?.scrollIntoView) this.scrollToIndex(index);
    }

    /**
     * Scrolls the scroll container to align the item at `index` into view.
     *
     * Calculation notes:
     * - Computes target top using prefix sums (`offsetTopOf`) and container offset relative to scrollEl.
     * - Clamps scrollTop to the scrollable range to avoid overshoot.
     *
     * No-op when itemCount is 0.
     *
     * @param {number} index - Item index to bring into view.
     * @returns {void}
     */
    public scrollToIndex(index: number): void {
        const count = this.adapter?.itemCount?.() ?? 0;
        if (count <= 0) return;

        const topInContainer = this.offsetTopOf(index);
        const containerTop = this.containerTopInScroll();
        const target = containerTop + topInContainer;
        const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);

        this.scrollEl.scrollTop = Math.min(Math.max(0, target), maxScroll);
    }

    /**
     * Disposes runtime resources without destroying the instance.
     *
     * Intended for adapter swaps or teardown sequencing:
     * - cancels pending frames,
     * - removes scroll listeners,
     * - disconnects ResizeObserver,
     * - removes mounted item elements and clears internal maps.
     *
     * @returns {void}
     */
    public dispose(): void {
        this.cancelFrames();

        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this.boundOnScroll);
        }

        this.resizeObs?.disconnect();
        this.created.forEach(el => el.remove());
        this.created.clear();
    }

    /**
     * Destroys the virtual recycler view and releases all resources.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Resets internal caches and disposes listeners/observers.
     * - Removes scaffold DOM nodes (PadTop, ItemsHost, PadBottom).
     * - Completes lifecycle teardown via {@link Lifecycle.destroy}.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.resetState();
        this.dispose();

        this.PadTop.remove();
        this.ItemsHost.remove();
        this.PadBottom.remove();

        this.PadTop = null as HTMLDivElement;
        this.ItemsHost = null as HTMLDivElement;
        this.PadBottom = null as HTMLDivElement;

        super.destroy();
    }

    /**
     * Hard reset used after large visibility changes (e.g., search/filter cleared).
     *
     * This recalculates padding and height structures by:
     * - suspending processing,
     * - resetting state and removing invisible elements,
     * - recomputing estimator stats from cache,
     * - rebuilding Fenwick prefix sums,
     * - resetting window bounds and resuming updates.
     *
     * @returns {void}
     */
    public refreshItem(): void {
        if (!this.adapter) return;
        const count = this.adapter.itemCount();
        if (count <= 0) return;

        this.suspend();
        this.resetState();
        this.cleanupInvisibleItems();
        this.recomputeMeasuredStats(count);
        this.rebuildFenwick(count);
        this.start = 0;
        this.end = -1;
        this.resume();
    }

    /** Cancels any pending animation frames for window calculation and measurement. */
    private cancelFrames(): void {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.measureRaf != null) {
            cancelAnimationFrame(this.measureRaf);
            this.measureRaf = null;
        }
    }

    /**
     * Resets internal state: mounted elements, caches, Fenwick sums, padding, and estimator stats.
     *
     * DOM side effects:
     * - Removes all currently mounted item elements tracked in {@link created}.
     * - Resets pad heights to `0px`.
     *
     * @returns {void}
     */
    private resetState(): void {
        this.created.forEach(el => el.remove());
        this.created.clear();
        this.heightCache = [];
        this.fenwick.reset(0);
        this.PadTop.style.height = "0px";
        this.PadBottom.style.height = "0px";
        this.firstMeasured = false;
        this.measuredSum = 0;
        this.measuredCount = 0;
    }

    /**
     * Measures the first item to seed a better initial height estimate.
     *
     * Strategy:
     * - Temporarily mounts index 0, measures its outer height, and updates `estimateItemHeight`.
     * - If `dynamicHeights` is disabled, the probe element is removed and the model/view init flags
     *   are reverted for that item to avoid treating the probe as a real render.
     *
     * @returns {void}
     */
    private probeInitialHeight(): void {
        const probe = 0;
        this.mountIndexOnce(probe);

        const el = this.created.get(probe);
        if (!el) return;

        const h = this.measureOuterHeight(el);
        if (!isNaN(h)) this.opts.estimateItemHeight = h;

        if (!this.opts.dynamicHeights) {
            el.remove();
            this.created.delete(probe);
            const item = this.adapter.items[probe];
            if (item) {
                item.isInit = false;
                item.view = null;
            }
        }
    }

    /**
     * Whether the item at `index` is visible (i.e., not filtered/hidden).
     *
     * Visibility convention:
     * - If `item.visible` is undefined, the item is treated as visible.
     *
     * @param {number} index - 0-based item index.
     * @returns {boolean} True if visible; otherwise false.
     */
    private isIndexVisible(index: number): boolean {
        const item = this.adapter?.items?.[index];
        return (item as any)?.visible ?? true;
    }

    /**
     * Finds the next visible item index starting from `index`.
     *
     * @param {number} index - Start index (0-based).
     * @param {number} count - Total item count.
     * @returns {number} Next visible index, or -1 if none exist.
     */
    private nextVisibleFrom(index: number, count: number): number {
        for (let i = Math.max(0, index); i < count; i++) {
            if (this.isIndexVisible(i)) return i;
        }
        return -1;
    }

    /**
     * Recomputes running estimator stats from the current height cache.
     *
     * Only counts **visible** items; invisible items do not contribute to adaptive estimation.
     *
     * @param {number} count - Total item count.
     * @returns {void}
     */
    private recomputeMeasuredStats(count: number): void {
        this.measuredSum = 0;
        this.measuredCount = 0;
        for (let i = 0; i < count; i++) {
            if (!this.isIndexVisible(i)) continue;
            const h = this.heightCache[i];
            if (h != null) {
                this.measuredSum += h;
                this.measuredCount++;
            }
        }
    }

    /**
     * Returns the view container's top offset relative to the scroll container.
     *
     * This is used to convert absolute scrollTop to a scrollTop relative to the recycler's own container.
     *
     * @returns {number} Top offset in pixels (non-negative).
     */
    private containerTopInScroll(): number {
        const a = this.viewElement!.getBoundingClientRect();
        const b = this.scrollEl.getBoundingClientRect();
        return Math.max(0, a.top - b.top + this.scrollEl.scrollTop);
    }

    /**
     * Returns sticky header height with a short cache window (~16ms) to avoid layout thrashing.
     *
     * Used to adjust effective viewport height (so windowing math accounts for a visible sticky header).
     *
     * @returns {number} Sticky header height in pixels.
     */
    private stickyTopHeight(): number {
        const now = performance.now();
        if (now - this.stickyCacheTick < 16) return this.stickyCacheVal;

        const sticky = this.scrollEl.querySelector(".seui-option-handle:not(.hide)") as HTMLElement | null;
        this.stickyCacheVal = sticky?.offsetHeight ?? 0;
        this.stickyCacheTick = now;
        return this.stickyCacheVal;
    }

    /**
     * Schedules a window update on the next animation frame.
     *
     * No-op if:
     * - a frame is already scheduled, or
     * - the recycler is currently suspended.
     *
     * @returns {void}
     */
    private scheduleUpdateWindow(): void {
        if (this.rafId != null || this.suspended) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateWindowInternal();
        });
    }

    /**
     * Measures an element's "outer height" including vertical margins.
     *
     * @param {HTMLElement} el - Element to measure.
     * @returns {number} Total outer height in pixels (minimum 1).
     */
    private measureOuterHeight(el: HTMLElement): number {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const mt = parseFloat(style.marginTop) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        return Math.max(1, rect.height + mt + mb);
    }

    /**
     * Returns the current height estimate for unmeasured items.
     *
     * - When adaptive estimation is enabled and at least one item was measured,
     *   returns the running average.
     * - Otherwise returns the configured fixed estimate.
     *
     * @returns {number} Estimated item height in pixels (minimum 1).
     */
    private getEstimate(): number {
        if (this.opts.adaptiveEstimate && this.measuredCount > 0) {
            return Math.max(1, this.measuredSum / this.measuredCount);
        }
        return this.opts.estimateItemHeight;
    }

    /**
     * Rebuilds Fenwick prefix sums from current cache/estimate and visibility.
     *
     * Encoding:
     * - Invisible items contribute `0` height.
     * - Visible items contribute either cached measured height, or the current estimate.
     *
     * @param {number} count - Total number of items.
     * @returns {void}
     */
    private rebuildFenwick(count: number): void {
        const est = this.getEstimate();
        const arr = Array.from({ length: count }, (_, i) =>
            this.isIndexVisible(i) ? (this.heightCache[i] ?? est) : 0
        );
        this.fenwick.buildFrom(arr);
    }

    /**
     * Updates cached height at `index` and applies delta to the Fenwick tree.
     *
     * Behavior:
     * - Ignores invisible items (no-op).
     * - Applies an epsilon threshold to avoid jitter from sub-pixel / minor changes.
     * - Updates adaptive estimator stats and Fenwick sums in **O(log n)**.
     *
     * @param {number} index - 0-based item index to update.
     * @param {number} newH - Newly measured outer height (px).
     * @returns {boolean} True if the height changed beyond the epsilon threshold.
     */
    private updateHeightAt(index: number, newH: number): boolean {
        if (!this.isIndexVisible(index)) return false;

        const est = this.getEstimate();
        const oldH = this.heightCache[index] ?? est;

        if (Math.abs(newH - oldH) <= VirtualRecyclerView.EPS) return false;

        const prevMeasured = this.heightCache[index];
        if (prevMeasured == null) {
            this.measuredSum += newH;
            this.measuredCount++;
        } else {
            this.measuredSum += newH - prevMeasured;
        }

        this.heightCache[index] = newH;
        this.fenwick.add(index + 1, newH - oldH);
        return true;
    }

    /**
     * Finds the first visible item at or after a scroll-relative offset.
     *
     * Strategy:
     * - Use Fenwick lower-bound to approximate a candidate index by cumulative height,
     * - Then advance to the next visible item.
     *
     * @param {number} stRel - ScrollTop relative to the view container (px).
     * @param {number} count - Total item count.
     * @returns {number} A visible index (best-effort); falls back to clamped candidate when needed.
     */
    private findFirstVisibleIndex(stRel: number, count: number): number {
        const k = this.fenwick.lowerBoundPrefix(Math.max(0, stRel));
        const raw = Math.min(count - 1, k);
        const v = this.nextVisibleFrom(raw, count);
        return v === -1 ? Math.max(0, raw) : v;
    }

    /**
     * Inserts an element into {@link ItemsHost} maintaining increasing index order.
     *
     * Heuristics:
     * - Prefer inserting after the previous index element if present.
     * - Else insert before the next index element if present.
     * - Else scan children to find the first element with a larger `data-vindex`.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to insert.
     * @returns {void}
     */
    private insertIntoHostByIndex(index: number, el: HTMLElement): void {
        el.setAttribute(VirtualRecyclerView.ATTR_INDEX, String(index));

        const prev = this.created.get(index - 1);
        if (prev?.parentElement === this.ItemsHost) {
            prev.after(el);
            return;
        }

        const next = this.created.get(index + 1);
        if (next?.parentElement === this.ItemsHost) {
            this.ItemsHost.insertBefore(el, next);
            return;
        }

        const children = Array.from(this.ItemsHost.children) as HTMLElement[];
        for (const child of children) {
            const v = child.getAttribute(VirtualRecyclerView.ATTR_INDEX);
            if (v && Number(v) > index) {
                this.ItemsHost.insertBefore(el, child);
                return;
            }
        }
        this.ItemsHost.appendChild(el);
    }

    /**
     * Ensures the element is in the correct DOM position for its index.
     *
     * Reinserts the element when adjacent siblings indicate an out-of-order position.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to validate/reinsert.
     * @returns {void}
     */
    private ensureDomOrder(index: number, el: HTMLElement): void {
        if (el.parentElement !== this.ItemsHost) {
            this.insertIntoHostByIndex(index, el);
            return;
        }

        el.setAttribute(VirtualRecyclerView.ATTR_INDEX, String(index));

        const prev = el.previousElementSibling as HTMLElement | null;
        const next = el.nextElementSibling as HTMLElement | null;

        const needsReorder =
            (prev && Number(prev.getAttribute(VirtualRecyclerView.ATTR_INDEX)) > index) ||
            (next && Number(next.getAttribute(VirtualRecyclerView.ATTR_INDEX)) < index);

        if (needsReorder) {
            el.remove();
            this.insertIntoHostByIndex(index, el);
        }
    }

    /**
     * Attaches a {@link ResizeObserver} used for dynamic-height measurement.
     *
     * Singleton behavior:
     * - Only creates/attaches the observer once per instance.
     *
     * Scheduling:
     * - Observer callback schedules measurement on the next animation frame to batch DOM reads.
     * - No-op when suppressed or suspended.
     *
     * @returns {void}
     */
    private attachResizeObserverOnce(): void {
        if (this.resizeObs) return;

        this.resizeObs = new ResizeObserver(() => {
            if (this.suppressResize || this.suspended || !this.adapter || this.measureRaf != null) return;

            this.measureRaf = requestAnimationFrame(() => {
                this.measureRaf = null;
                this.measureVisibleAndUpdate();
            });
        });

        this.resizeObs.observe(this.ItemsHost);
    }

    /**
     * Measures all currently rendered items and updates the height cache.
     *
     * If any height changed:
     * - Rebuilds Fenwick sums when adaptive estimation is enabled.
     * - Schedules a window recalculation.
     *
     * @returns {void}
     */
    private measureVisibleAndUpdate(): void {
        if (!this.adapter) return;
        const count = this.adapter.itemCount();
        if (count <= 0) return;

        let changed = false;

        for (let i = this.start; i <= this.end; i++) {
            if (!this.isIndexVisible(i)) continue;

            const item = this.adapter.items[i];
            const el = (item as any)?.view?.getView?.() as HTMLElement | undefined;
            if (!el) continue;

            const newH = this.measureOuterHeight(el);
            if (this.updateHeightAt(i, newH)) changed = true;
        }

        if (changed) {
            if (this.opts.adaptiveEstimate) this.rebuildFenwick(count);
            this.scheduleUpdateWindow();
        }
    }

    /**
     * Scroll event handler. Schedules a window update on the next frame.
     *
     * @returns {void}
     */
    private onScroll(): void {
        this.scheduleUpdateWindow();
    }

    /**
     * Core window update routine: computes the visible range and reconciles mounted DOM.
     *
     * High-level steps:
     * 1) Compute scroll-relative viewport bounds (accounting for sticky header height).
     * 2) Capture an anchor item and its visual delta relative to scrollTop.
     * 3) Compute new start/end with overscan.
     * 4) Mount missing items and unmount items outside the window.
     * 5) Measure visible items (optional) and update pad heights.
     * 6) Apply anchor correction to keep scroll position stable after height changes.
     *
     * Guarding:
     * - Prevents re-entrancy via `updating`.
     * - No-op while `suspended`.
     *
     * @returns {void}
     */
    private updateWindowInternal(): void {
        if (this.updating || this.suspended) return;
        this.updating = true;

        try {
            if (!this.adapter) return;

            const count = this.adapter.itemCount();
            if (count <= 0) return;

            // Handle item count changes (e.g., add/remove)
            if (this.lastRenderCount !== count) {
                this.lastRenderCount = count;
                this.heightCache.length = count;
                this.rebuildFenwick(count);
            }

            const containerTop = this.containerTopInScroll();
            const stRel = Math.max(0, this.scrollEl.scrollTop - containerTop);
            const stickyH = this.stickyTopHeight();
            const vhEff = Math.max(0, this.scrollEl.clientHeight - stickyH);

            const anchorIndex = this.findFirstVisibleIndex(stRel, count);
            const anchorTop = this.offsetTopOf(anchorIndex);
            const anchorDelta = containerTop + anchorTop - this.scrollEl.scrollTop;

            const firstVis = this.findFirstVisibleIndex(stRel, count);
            if (firstVis === -1) {
                this.resetState();
                return;
            }

            const est = this.getEstimate();
            const overscanPx = this.opts.overscan * est;

            let startIndex = this.nextVisibleFrom(
                Math.min(count - 1, this.fenwick.lowerBoundPrefix(Math.max(0, stRel - overscanPx))),
                count
            ) ?? firstVis;

            let endIndex = Math.min(count - 1, this.fenwick.lowerBoundPrefix(stRel + vhEff + overscanPx));

            if (startIndex === this.start && endIndex === this.end) return;

            this.start = startIndex;
            this.end = endIndex;

            this.suppressResize = true;
            try {
                this.mountRange(this.start, this.end);
                this.unmountOutside(this.start, this.end);

                if (this.opts.dynamicHeights) this.measureVisibleAndUpdate();

                const topPx = this.offsetTopOf(this.start);
                const windowPx = this.windowHeight(this.start, this.end);
                const total = this.totalHeight(count);
                const bottomPx = Math.max(0, total - topPx - windowPx);

                this.PadTop.style.height = `${topPx}px`;
                this.PadBottom.style.height = `${bottomPx}px`;
            } finally {
                this.suppressResize = false;
            }

            // Keep anchor item stable to prevent scroll jump
            const anchorTopNew = this.offsetTopOf(anchorIndex);
            const targetScroll = this.containerTopInScroll() + anchorTopNew - anchorDelta;
            const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
            const clamped = Math.min(Math.max(0, targetScroll), maxScroll);

            const heightChanged = Math.abs(anchorTopNew - anchorTop) > 1;
            const scrollDiff = Math.abs(this.scrollEl.scrollTop - clamped);

            if (heightChanged && scrollDiff > 0.5 && scrollDiff < 100) {
                this.scrollEl.scrollTop = clamped;
            }
        } finally {
            this.updating = false;
        }
    }

    /** Mounts all items in the inclusive range `[start..end]`. */
    private mountRange(start: number, end: number): void {
        for (let i = start; i <= end; i++) this.mountIndexOnce(i);
    }

    /**
     * Mounts/rebinds a single item at `index`.
     *
     * Behavior:
     * - If the item is invisible, ensures it is removed/untracked (no-op otherwise).
     * - Reuses an existing DOM element when present and the model already has a view.
     * - Creates a new view holder on first mount (`item.isInit === false`) and binds via `adapter.onViewHolder`.
     * - Ensures DOM order within {@link ItemsHost} and updates the {@link created} map.
     *
     * @param {number} index - Item index to mount/rebind.
     * @returns {void}
     */
    private mountIndexOnce(index: number): void {
        if (!this.isIndexVisible(index)) {
            const existing = this.created.get(index);
            if (existing?.parentElement === this.ItemsHost) existing.remove();
            this.created.delete(index);
            return;
        }

        const item = this.adapter!.items[index];
        if (!item) return;
        const existing = this.created.get(index);

        if (existing) {
            if (!(item as any)?.view) {
                existing.remove();
                this.created.delete(index);
            } else {
                this.ensureDomOrder(index, existing);
                this.adapter.onViewHolder(item, (item as any).view, index);
            }
            return;
        }

        if (!(item as any).isInit) {
            const viewer = this.adapter!.viewHolder(this.ItemsHost, item);
            (item as any).view = viewer;
            this.adapter!.onViewHolder(item, viewer, index);
            (item as any).isInit = true;
        } else if ((item as any).view) {
            this.adapter!.onViewHolder(item, (item as any).view, index);
        }

        const el = (item as any).view?.getView?.() as HTMLElement | undefined;
        if (el) {
            this.ensureDomOrder(index, el);
            this.created.set(index, el);
        }
    }

    /**
     * Unmounts all mounted items outside the inclusive range `[start..end]`.
     *
     * @param {number} start - Window start (inclusive).
     * @param {number} end - Window end (inclusive).
     * @returns {void}
     */
    private unmountOutside(start: number, end: number): void {
        this.created.forEach((el, idx) => {
            if (idx < start || idx > end) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /**
     * Removes all currently mounted items that are now marked invisible.
     *
     * @returns {void}
     */
    private cleanupInvisibleItems(): void {
        this.created.forEach((el, idx) => {
            if (!this.isIndexVisible(idx)) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /**
     * Returns cumulative height from the start of the list to the **top** of item at `index`.
     *
     * Indexing note:
     * - Uses Fenwick prefix sum with a 1-based contract.
     * - Passing a 0-based `index` to `sum(index)` yields the sum of heights for items `[0..index-1]`,
     *   which corresponds to the CSS `offsetTop` for item `index` in a stacked list.
     *
     * @param {number} index - Item index (0-based).
     * @returns {number} Offset from the top of the list to the top of the item (px).
     */
    private offsetTopOf(index: number): number {
        return this.fenwick.sum(index);
    }

    /**
     * Returns the total height of items in the inclusive range `[start..end]`.
     *
     * @param {number} start - Start index (0-based).
     * @param {number} end - End index (0-based).
     * @returns {number} Total height in pixels.
     */
    private windowHeight(start: number, end: number): number {
        return this.fenwick.rangeSum(start + 1, end + 1);
    }

    /**
     * Returns total scrollable height for all items.
     *
     * @param {number} count - Total item count.
     * @returns {number} Total height in pixels.
     */
    private totalHeight(count: number): number {
        return this.fenwick.sum(count);
    }
}