import { ModelContract } from "src/ts/types/core/base/model.type";
import { RecyclerView } from "./recyclerview";
import { AdapterContract } from "src/ts/types/core/base/adapter.type";
import { Libs } from "src/ts/utils/libs";
import { VirtualOptions, VirtualRecyclerViewTags } from "src/ts/types/core/base/virtual-recyclerview.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Fenwick tree (Binary Indexed Tree) for efficient prefix-sum queries.
 *
 * - Internally uses **1-based indexing** for all BIT operations.
 * - Supports **O(log n)** updates and prefix/range queries.
 * - Useful for cumulative height calculations in virtualized lists.
 *
 * @extends Lifecycle
 */
class Fenwick extends Lifecycle {
    /** Internal BIT array. Index 0 is unused; valid range: [1..stackNum]. */
    private bit: number[] = [];

    /** Number of elements managed by the tree (logical size). */
    private stackNum = 0;

    /**
     * Creates a Fenwick tree and initializes it with the provided size (optional).
     *
     * @param stackNum - Initial number of elements (all values start at 0). Defaults to 0.
     */
    constructor(stackNum = 0) {
        super();
        this.initialize(stackNum);
    }
    
    /**
     * Initializes lifecycle and resets the tree to the given size.
     *
     * @param stackNum - Number of elements to allocate (values cleared to 0).
     */
    public initialize(stackNum: number): void {
        this.init();
        this.reset(stackNum); 
    }

    /**
     * Resets the tree to a new size and clears all values to 0.
     *
     * @param stackNum - New number of elements (valid 1-based indexes: 1..stackNum).
     */
    public reset(stackNum: number): void {
        this.stackNum = stackNum;
        this.bit = new Array(stackNum + 1).fill(0);
    }

    /**
     * Adds `delta` to the element at **1-based** index `i`.
     *
     * Complexity: **O(log n)**
     *
     * @param i - 1-based index of the element to update (1..stackNum).
     * @param delta - Value to add (can be negative).
     */
    public add(i: number, delta: number): void {
        for (let x = i; x <= this.stackNum; x += x & -x) this.bit[x] += delta;
    }

    /**
     * Returns the prefix sum for the range **[1..i]** (inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param i - 1-based index up to which the sum is calculated.
     * @returns The cumulative sum from 1 to i.
     */
    public sum(i: number): number {
        let s = 0;
        for (let x = i; x > 0; x -= x & -x) s += this.bit[x];
        return s;
    }

    /**
     * Returns the sum in the range **[l..r]** (1-based, inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param l - Left index (inclusive).
     * @param r - Right index (inclusive).
     * @returns The sum in [l..r], or 0 if r < l.
     */
    public rangeSum(l: number, r: number): number {
        return r < l ? 0 : this.sum(r) - this.sum(l - 1);
    }

    /**
     * Builds the tree from a **0-based** array in **O(n log n)**.
     *
     * Each element `arr[i]` is added to index `i + 1`.
     *
     * @param arr - Source values (0-based).
     */
    public buildFrom(arr: number[]) {
        this.reset(arr.length);
        arr.forEach((val, i) => this.add(i + 1, val));
    }

    /**
     * Finds the largest index `idx` such that `prefixSum(idx) <= target`.
     *
     * This is a classic Fenwick-tree lower-bound over prefix sums.
     * It effectively returns the **count of items** that fit within the target
     * cumulative value (e.g., number of items whose total height <= target).
     *
     * Complexity: **O(log n)**
     *
     * @param target - Target prefix sum.
     * @returns The largest index satisfying the condition (in range 0..stackNum).
     *          Returns 0 if the first element already exceeds `target`.
     */
    public lowerBoundPrefix(target: number): number {
        let idx = 0, bitMask = 1;
        while (bitMask << 1 <= this.stackNum) bitMask <<= 1;

        let cur = 0;
        for (let step = bitMask; step !== 0; step >>= 1) {
            const next = idx + step;
            if (next <= this.stackNum && cur + this.bit[next] <= target) {
                idx = next;
                cur += this.bit[next];
            }
        }
        return idx;
    }
}

/**
 * Virtual RecyclerView with efficient windowing and dynamic-height support.
 *
 * Only renders items visible in the viewport plus an overscan buffer, using
 * top/bottom padding elements to simulate full scroll height. Supports variable
 * item heights with **adaptive estimation** and maintains scroll position during
 * height changes using an **anchor item** technique.
 *
 * Key features:
 * - Virtual windowing with configurable `overscan`
 * - Dynamic heights with `ResizeObserver`-based measurement
 * - Adaptive height estimation (average of measured items)
 * - Efficient prefix sums via Fenwick tree (1-based) for O(log n) math
 * - Stable scroll position during re-measure via anchor correction
 *
 * @template TItem - Model type for list items.
 * @template TAdapter - Adapter managing item views.
 *
 * @extends RecyclerView
 */
export class VirtualRecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> extends RecyclerView<TItem, TAdapter> {
    /**
     * Virtualization settings.
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
    /** Fenwick tree storing current height values (0 for invisible items). */
    private fenwick = new Fenwick(0);
    /** Map of currently created (mounted) DOM elements keyed by item index. */
    private created = new Map<number, HTMLElement>();

    /** Whether an initial height probe has been performed. */
    private firstMeasured = false;
    /** Current window bounds (inclusive) in flat item-space. */
    private start = 0;
    /** Current window end (inclusive). -1 means not initialized. */
    private end = -1;
    /** Observer used to detect height changes of visible items. */
    private resizeObs?: ResizeObserver;

    /** Pending animation frame ids for window and measurement. */
    private rafId: number | null = null;
    private measureRaf: number | null = null;

    /** Re-entrancy/suspension flags. */
    private updating = false;
    private suppressResize = false;
    private lastRenderCount = 0;
    private suspended = false;
    private boundOnScroll?: () => void;
    private resumeResizeAfter = false;

    /** Small cache for sticky header height (16ms TTL). */
    private stickyCacheTick = 0;
    private stickyCacheVal = 0;

    /** Stats for adaptive estimator. */
    private measuredSum = 0;
    private measuredCount = 0;

    /** Epsilon threshold for height-change significance. */
    private static readonly EPS = 0.5;
    /** Attribute stored on each element indicating its item index. */
    private static readonly ATTR_INDEX = "data-vindex";

    /** Creates a virtual recycler view with an optional root element. */
    constructor(viewElement: HTMLDivElement | null = null) {
        super(viewElement);
    }

    /**
     * Updates virtualization settings (overscan, estimates, dynamic heights, etc.).
     *
     * @param opts - Partial configuration to merge with current options.
     */
    public configure(opts: Partial<VirtualOptions>) {
        this.opts = { ...this.opts, ...opts } as Required<VirtualOptions>;
    }

    /**
     * Binds an adapter and initializes the virtualization scaffold.
     *
     * Flow:
     * 1) Dispose previous adapter/listeners if any
     * 2) Call `super.setAdapter(adapter)` to wire lifecycle
     * 3) Build the pad elements (top, host, bottom)
     * 4) Resolve `scrollEl` (from config or DOM)
     * 5) Attach scroll listener, refresh and attach resize observer
     * 6) Subscribe to adapter visibility changes to force a refresh
     *
     * @param adapter - The adapter managing models and item views.
     */
    public override setAdapter(adapter: TAdapter) {
        if (this.adapter) this.dispose();

        super.setAdapter(adapter);
        adapter.recyclerView = this;

        if (!this.viewElement) return;

        this.viewElement.replaceChildren();

        const nodeMounted = Libs.mountNode({
            PadTop:   { tag: { node: "div", classList: "selective-ui-virtual-pad-top" } },
            ItemsHost:{ tag: { node: "div", classList: "selective-ui-virtual-items" } },
            PadBottom:{ tag: { node: "div", classList: "selective-ui-virtual-pad-bottom" } },
        }, this.viewElement) as VirtualRecyclerViewTags;

        this.PadTop = nodeMounted.PadTop;
        this.ItemsHost = nodeMounted.ItemsHost;
        this.PadBottom = nodeMounted.PadBottom;

        this.scrollEl = this.opts.scrollEl 
            ?? (this.viewElement.closest(".selective-ui-popup") as HTMLElement) 
            ?? (this.viewElement.parentElement as HTMLElement);

        if (!this.scrollEl) throw new Error("VirtualRecyclerView: scrollEl not found");

        this.boundOnScroll = this.onScroll.bind(this);
        this.scrollEl.addEventListener("scroll", this.boundOnScroll, { passive: true });

        this.refresh(false);
        this.attachResizeObserverOnce();
        (adapter as any)?.onVisibilityChanged?.(() => this.refreshItem());
    }

    /**
     * Pauses scroll/resize processing to prevent updates during batch operations.
     * Cancels pending frames and disconnects observers.
     */
    public suspend() {
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
     * Resumes scroll/resize processing after suspension.
     * Re-attaches listeners and schedules a window update.
     */
    public resume() {
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
     * Rebuilds internal state and schedules a render update.
     * Probes initial item height on first run and rebuilds the Fenwick tree.
     *
     * @param isUpdate - True if called from a data update; false on initial setup.
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
     * Ensures the item at `index` is rendered and optionally scrolls it into view.
     *
     * @param index - Item index to ensure visible/mounted.
     * @param opt - Optional behavior: `{ scrollIntoView?: boolean }`.
     */
    public ensureRendered(index: number, opt?: { scrollIntoView?: boolean }) {
        this.mountRange(index, index);
        if (opt?.scrollIntoView) this.scrollToIndex(index);
    }

    /**
     * Scrolls the container to make the item at `index` visible.
     * Calculates target scroll position accounting for container offset.
     *
     * @param index - Item index to bring into view.
     */
    public scrollToIndex(index: number) {
        const count = this.adapter?.itemCount?.() ?? 0;
        if (count <= 0) return;

        const topInContainer = this.offsetTopOf(index);
        const containerTop = this.containerTopInScroll();
        const target = containerTop + topInContainer;
        const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
        
        this.scrollEl.scrollTop = Math.min(Math.max(0, target), maxScroll);
    }

    /**
     * Cleans up all resources: listeners, observers, and DOM elements.
     * Call before removing the component to prevent memory leaks.
     */
    public dispose() {
        this.cancelFrames();
        
        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this.boundOnScroll);
        }
        
        this.resizeObs?.disconnect();
        this.created.forEach(el => el.remove());
        this.created.clear();
    }

    /**
     * Destroys the virtual recycler view and releases resources.
     *
     * - Resets internal state and disposes observers/listeners
     * - Removes scaffold elements (PadTop, ItemsHost, PadBottom)
     * - Ends the lifecycle
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

        this.PadTop = null as unknown as HTMLDivElement;
        this.ItemsHost = null as unknown as HTMLDivElement;
        this.PadBottom = null as unknown as HTMLDivElement;

        super.destroy();
    }

    /**
     * Hard reset after large visibility changes (e.g., search/filter cleared).
     *
     * Rebuilds all height structures and remounts the visible window.
     * Essential for fixing padding calculations after bulk visibility updates.
     */
    public refreshItem() {
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

    /** Cancels all pending animation frames. */
    private cancelFrames() {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.measureRaf != null) {
            cancelAnimationFrame(this.measureRaf);
            this.measureRaf = null;
        }
    }

    /** Resets all internal state: DOM, caches, and measurements. */
    private resetState() {
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
     * Measures the first item to set an initial height estimate.
     * If dynamic heights are disabled, removes the probe element afterward.
     */
    private probeInitialHeight() {
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
     * Whether item at `index` is visible (not filtered/hidden).
     * Defaults to visible when the property is undefined.
     */
    private isIndexVisible(index: number): boolean {
        const item = this.adapter?.items?.[index];
        return (item as any)?.visible ?? true;
    }

    /**
     * Finds the next visible item index starting from `index`.
     * Returns -1 if no visible items are found.
     */
    private nextVisibleFrom(index: number, count: number): number {
        for (let i = Math.max(0, index); i < count; i++) {
            if (this.isIndexVisible(i)) return i;
        }
        return -1;
    }

    /**
     * Recalculates total measured height and count from cache.
     * Only counts **visible** items for adaptive estimation.
     */
    private recomputeMeasuredStats(count: number) {
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

    /** Returns view container's top offset relative to the scroll container. */
    private containerTopInScroll(): number {
        const a = this.viewElement!.getBoundingClientRect();
        const b = this.scrollEl.getBoundingClientRect();
        return Math.max(0, a.top - b.top + this.scrollEl.scrollTop);
    }

    /**
     * Returns sticky header height with ~16ms cache to avoid layout thrashing.
     * Used to adjust effective viewport height.
     */
    private stickyTopHeight(): number {
        const now = performance.now();
        if (now - this.stickyCacheTick < 16) return this.stickyCacheVal;

        const sticky = this.scrollEl.querySelector(".selective-ui-option-handle:not(.hide)") as HTMLElement | null;
        this.stickyCacheVal = sticky?.offsetHeight ?? 0;
        this.stickyCacheTick = now;
        return this.stickyCacheVal;
    }

    /** Schedules a window update on the next frame if not already scheduled. */
    private scheduleUpdateWindow() {
        if (this.rafId != null || this.suspended) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateWindowInternal();
        });
    }

    /**
     * Measures an element's total height including vertical margins.
     *
     * @param el - Element to measure.
     * @returns Total outer height in pixels.
     */
    private measureOuterHeight(el: HTMLElement): number {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const mt = parseFloat(style.marginTop) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        return Math.max(1, rect.height + mt + mb);
    }

    /**
     * Returns height estimate for unmeasured items.
     * Uses adaptive average if enabled, otherwise the fixed estimate.
     */
    private getEstimate(): number {
        if (this.opts.adaptiveEstimate && this.measuredCount > 0) {
            return Math.max(1, this.measuredSum / this.measuredCount);
        }
        return this.opts.estimateItemHeight;
    }

    /**
     * Rebuilds the Fenwick tree with current heights and estimates.
     * Invisible items receive height 0; others use cached or estimated height.
     *
     * @param count - Total number of items.
     */
    private rebuildFenwick(count: number) {
        const est = this.getEstimate();
        const arr = Array.from({ length: count }, (_, i) => 
            this.isIndexVisible(i) ? (this.heightCache[i] ?? est) : 0
        );
        this.fenwick.buildFrom(arr);
    }

    /**
     * Updates cached height at `index` and applies delta to the Fenwick tree.
     * Also updates running average for the adaptive estimator.
     *
     * @param index - Item index to update.
     * @param newH - Newly measured outer height (px).
     * @returns True if the height changed beyond the epsilon threshold.
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
     * Uses Fenwick lower-bound then adjusts forward to the next visible item.
     *
     * @param stRel - ScrollTop relative to the view container (px).
     * @param count - Total item count.
     */
    private findFirstVisibleIndex(stRel: number, count: number): number {
        const k = this.fenwick.lowerBoundPrefix(Math.max(0, stRel));
        const raw = Math.min(count - 1, k);
        const v = this.nextVisibleFrom(raw, count);
        return v === -1 ? Math.max(0, raw) : v;
    }

    /**
     * Inserts an element into the host maintaining increasing index order.
     * Tries adjacent siblings first, then scans for the insertion point.
     *
     * @param index - Item index.
     * @param el - Element to insert.
     */
    private insertIntoHostByIndex(index: number, el: HTMLElement) {
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
     * Reinserts when adjacent siblings indicate an out-of-order position.
     *
     * @param index - Item index.
     * @param el - Element to validate/reinsert.
     */
    private ensureDomOrder(index: number, el: HTMLElement) {
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
     * Attaches a ResizeObserver to measure items when they resize.
     * Singleton pattern — only creates once per instance.
     */
    private attachResizeObserverOnce() {
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
     * Triggers a window update when any heights changed.
     */
    private measureVisibleAndUpdate() {
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

    /** Scroll event handler — schedules a render update. */
    private onScroll() {
        this.scheduleUpdateWindow();
    }

    /**
     * Core rendering logic — calculates and updates the visible window.
     *
     * Steps:
     * 1) Calculate viewport bounds (account for sticky headers)
     * 2) Use an anchor item to prevent scroll jumping on height changes
     * 3) Determine start/end indices with overscan buffer
     * 4) Mount/unmount items as needed
     * 5) Measure visible items (if dynamic heights enabled)
     * 6) Update pad heights (top/bottom) to maintain total scroll span
     * 7) Adjust scroll position to keep the anchor item stable
     */
    private updateWindowInternal() {
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
    private mountRange(start: number, end: number) {
        for (let i = start; i <= end; i++) this.mountIndexOnce(i);
    }

    /**
     * Mounts a single item, reusing an existing element if available.
     * Creates the view holder on first mount, or rebinds on subsequent renders.
     *
     * @param index - Item index to mount/rebind.
     */
    private mountIndexOnce(index: number) {
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
     * Removes all mounted items outside the inclusive range `[start..end]`.
     */
    private unmountOutside(start: number, end: number) {
        this.created.forEach((el, idx) => {
            if (idx < start || idx > end) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /**
     * Removes all items currently marked as invisible from the DOM.
     */
    private cleanupInvisibleItems() {
        this.created.forEach((el, idx) => {
            if (!this.isIndexVisible(idx)) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /**
     * Returns cumulative height from the start to the **top** of item at `index`.
     *
     * Internally uses Fenwick sum on the **inclusive** range [1..index],
     * which corresponds to offset-top in 0-based item space.
     *
     * @param index - Item index (0-based).
     */
    private offsetTopOf(index: number): number {
        return this.fenwick.sum(index);
    }

    /**
     * Returns the total height of items in inclusive range `[start..end]`.
     *
     * @param start - Start index (0-based).
     * @param end - End index (0-based).
     */
    private windowHeight(start: number, end: number): number {
        return this.fenwick.rangeSum(start + 1, end + 1);
    }

    /**
     * Returns the total scrollable height for all items.
     *
     * @param count - Total item count.
     */
    private totalHeight(count: number): number {
        return this.fenwick.sum(count);
    }
}