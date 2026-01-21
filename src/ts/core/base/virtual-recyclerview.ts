import { ModelContract } from "src/ts/types/core/base/model.type";
import { RecyclerView } from "./recyclerview";
import { AdapterContract } from "src/ts/types/core/base/adapter.type";
import { Libs } from "src/ts/utils/libs";
import { VirtualOptions, VirtualRecyclerViewTags } from "src/ts/types/core/base/virtual-recyclerview.type";

/**
 * Fenwick tree (Binary Indexed Tree) for efficient prefix sum queries.
 * Supports O(log n) update and query operations for cumulative item heights.
 * Uses 1-based indexing internally for BIT operations.
 */
class Fenwick {
    private bit: number[] = [];
    private n = 0;

    constructor(n = 0) { this.reset(n); }

    /** Resets tree to new size, clearing all values. */
    reset(n: number) {
        this.n = n;
        this.bit = new Array(n + 1).fill(0);
    }

    /** Adds delta to element at 1-based index i. */
    add(i: number, delta: number) {
        for (let x = i; x <= this.n; x += x & -x) this.bit[x] += delta;
    }

    /** Returns prefix sum for range [1..i]. */
    sum(i: number): number {
        let s = 0;
        for (let x = i; x > 0; x -= x & -x) s += this.bit[x];
        return s;
    }

    /** Returns sum in range [l..r] (1-based, inclusive). */
    rangeSum(l: number, r: number): number {
        return r < l ? 0 : this.sum(r) - this.sum(l - 1);
    }

    /** Builds tree from 0-based array in O(n log n). */
    buildFrom(arr: number[]) {
        this.reset(arr.length);
        arr.forEach((val, i) => this.add(i + 1, val));
    }

    /** 
     * Binary search to find largest index where prefix sum <= target.
     * Returns count of items that fit within target height.
     */
    lowerBoundPrefix(target: number): number {
        let idx = 0, bitMask = 1;
        while (bitMask << 1 <= this.n) bitMask <<= 1;

        let cur = 0;
        for (let step = bitMask; step !== 0; step >>= 1) {
            const next = idx + step;
            if (next <= this.n && cur + this.bit[next] <= target) {
                idx = next;
                cur += this.bit[next];
            }
        }
        return idx;
    }
}

/**
 * Virtual RecyclerView with efficient windowing and dynamic height support.
 * 
 * Only renders items visible in viewport plus overscan buffer, using padding 
 * elements to simulate scroll height. Supports variable item heights with 
 * adaptive estimation and maintains scroll position during height changes.
 * 
 * @template TItem - Model type for list items
 * @template TAdapter - Adapter managing item views
 */
export class VirtualRecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> extends RecyclerView<TItem, TAdapter> {
    private opts: Required<VirtualOptions> = {
        scrollEl: undefined as HTMLElement,
        estimateItemHeight: 36,
        overscan: 8,
        dynamicHeights: true,
        adaptiveEstimate: true,
    };

    private PadTop!: HTMLDivElement;
    private ItemsHost!: HTMLDivElement;
    private PadBottom!: HTMLDivElement;
    private scrollEl!: HTMLElement;

    private heightCache: Array<number | undefined> = [];
    private fenwick = new Fenwick(0);
    private created = new Map<number, HTMLElement>();

    private firstMeasured = false;
    private start = 0;
    private end = -1;
    private resizeObs?: ResizeObserver;

    private _rafId: number | null = null;
    private _measureRaf: number | null = null;
    private _updating = false;
    private _suppressResize = false;
    private _lastRenderCount = 0;
    private _suspended = false;
    private _boundOnScroll?: () => void;
    private _resumeResizeAfter = false;

    private _stickyCacheTick = 0;
    private _stickyCacheVal = 0;

    private measuredSum = 0;
    private measuredCount = 0;

    private static readonly EPS = 0.5;
    private static readonly ATTR_INDEX = "data-vindex";

    /** Creates virtual recycler view with optional root element. */
    constructor(viewElement: HTMLDivElement | null = null) {
        super(viewElement);
    }

    /** Updates virtualization settings (overscan, heights, etc). */
    public configure(opts: Partial<VirtualOptions>) {
        this.opts = { ...this.opts, ...opts } as Required<VirtualOptions>;
    }

    /** 
     * Binds adapter and initializes virtualization scaffold.
     * Removes previous adapter if exists, sets up scroll listeners and DOM structure.
     */
    override setAdapter(adapter: TAdapter) {
        if (this.adapter) this.dispose();

        super.setAdapter(adapter);
        adapter.recyclerView = this;

        if (!this.viewElement) return;

        this.viewElement.replaceChildren();

        const nodeMounted = Libs.mountNode({
            PadTop: { tag: { node: "div", classList: "selective-ui-virtual-pad-top" } },
            ItemsHost: { tag: { node: "div", classList: "selective-ui-virtual-items" } },
            PadBottom: { tag: { node: "div", classList: "selective-ui-virtual-pad-bottom" } },
        }, this.viewElement) as VirtualRecyclerViewTags;

        this.PadTop = nodeMounted.PadTop;
        this.ItemsHost = nodeMounted.ItemsHost;
        this.PadBottom = nodeMounted.PadBottom;

        this.scrollEl = this.opts.scrollEl 
            ?? (this.viewElement.closest(".selective-ui-popup") as HTMLElement) 
            ?? (this.viewElement.parentElement as HTMLElement);

        if (!this.scrollEl) throw new Error("VirtualRecyclerView: scrollEl not found");

        this._boundOnScroll = this.onScroll.bind(this);
        this.scrollEl.addEventListener("scroll", this._boundOnScroll, { passive: true });

        this.refresh(false);
        this.attachResizeObserverOnce();
        (adapter as any)?.onVisibilityChanged?.(() => this.refreshItem());
    }

    /** 
     * Pauses scroll/resize processing to prevent updates during batch operations.
     * Cancels pending frames and disconnects observers.
     */
    public suspend() {
        this._suspended = true;
        this.cancelFrames();
        
        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this._boundOnScroll);
        }

        if (this.resizeObs) {
            this.resizeObs.disconnect();
            this._resumeResizeAfter = true;
        }
    }

    /** 
     * Resumes scroll/resize processing after suspension.
     * Re-attaches listeners and schedules window update.
     */
    public resume() {
        this._suspended = false;

        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.addEventListener("scroll", this._boundOnScroll, { passive: true });
        }

        if (this._resumeResizeAfter) {
            this.attachResizeObserverOnce();
            this._resumeResizeAfter = false;
        }

        this.scheduleUpdateWindow();
    }

    /**
     * Rebuilds internal state and schedules render update.
     * Probes initial item height on first run, rebuilds Fenwick tree.
     * 
     * @param isUpdate - True if called from data update, false on initial setup
     */
    override refresh(isUpdate: boolean): void {
        if (!this.adapter || !this.viewElement) return;
        if (!isUpdate) this.refreshItem();

        const count = this.adapter.itemCount();
        this._lastRenderCount = count;

        if (count === 0) {
            this.resetState();
            return;
        }

        this.heightCache.length = count;

        if (!this.firstMeasured) {
            this.probeInitialHeight();
            this.firstMeasured = true;
        }

        this.rebuildFenwick(count);
        this.scheduleUpdateWindow();
    }

    /** 
     * Ensures item at index is rendered and optionally scrolls into view.
     * Useful for programmatic navigation to specific items.
     */
    public ensureRendered(index: number, opt?: { scrollIntoView?: boolean }) {
        this.mountRange(index, index);
        if (opt?.scrollIntoView) this.scrollToIndex(index);
    }

    /** 
     * Scrolls container to make item at index visible.
     * Calculates target scroll position accounting for container offset.
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
     * Cleans up all resources: listeners, observers, DOM elements.
     * Call before removing component to prevent memory leaks.
     */
    public dispose() {
        this.cancelFrames();
        
        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this._boundOnScroll);
        }
        
        this.resizeObs?.disconnect();
        this.created.forEach(el => el.remove());
        this.created.clear();
    }

    /**
     * Hard reset after visibility changes (e.g., search/filter cleared).
     * Rebuilds all height structures and remounts visible window.
     * Essential for fixing padding calculations after bulk visibility changes.
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
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._measureRaf != null) {
            cancelAnimationFrame(this._measureRaf);
            this._measureRaf = null;
        }
    }

    /** Resets all internal state: DOM, caches, measurements. */
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
     * Measures first item to set initial height estimate.
     * Removes probe element if dynamic heights disabled.
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
     * Checks if item is visible (not filtered/hidden).
     * Defaults to visible if property undefined.
     */
    private isIndexVisible(index: number): boolean {
        const item = this.adapter?.items?.[index];
        return item?.visible ?? true;
    }

    /** 
     * Finds next visible item index starting from given index.
     * Returns -1 if no visible items found.
     */
    private nextVisibleFrom(index: number, count: number): number {
        for (let i = Math.max(0, index); i < count; i++) {
            if (this.isIndexVisible(i)) return i;
        }
        return -1;
    }

    /** 
     * Recalculates total measured height and count from cache.
     * Only counts visible items for adaptive estimation.
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

    /** Returns view container's top offset relative to scroll container. */
    private containerTopInScroll(): number {
        const a = this.viewElement!.getBoundingClientRect();
        const b = this.scrollEl.getBoundingClientRect();
        return a.top - b.top + this.scrollEl.scrollTop;
    }

    /** 
     * Returns sticky header height with 16ms cache to avoid DOM thrashing.
     * Used to adjust viewport calculations.
     */
    private stickyTopHeight(): number {
        const now = performance.now();
        if (now - this._stickyCacheTick < 16) return this._stickyCacheVal;

        const sticky = this.scrollEl.querySelector(".selective-ui-option-handle:not(.hide)") as HTMLElement | null;
        this._stickyCacheVal = sticky?.offsetHeight ?? 0;
        this._stickyCacheTick = now;
        return this._stickyCacheVal;
    }

    /** Schedules window update on next frame if not already scheduled. */
    private scheduleUpdateWindow() {
        if (this._rafId != null || this._suspended) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.updateWindowInternal();
        });
    }

    /** 
     * Measures element's total height including margins.
     * Used for accurate item height tracking.
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
     * Uses adaptive average if enabled, otherwise fixed estimate.
     */
    private getEstimate(): number {
        if (this.opts.adaptiveEstimate && this.measuredCount > 0) {
            return Math.max(1, this.measuredSum / this.measuredCount);
        }
        return this.opts.estimateItemHeight;
    }

    /** 
     * Rebuilds Fenwick tree with current heights and estimates.
     * Invisible items get 0 height, others use cached or estimated height.
     */
    private rebuildFenwick(count: number) {
        const est = this.getEstimate();
        const arr = Array.from({ length: count }, (_, i) => 
            this.isIndexVisible(i) ? (this.heightCache[i] ?? est) : 0
        );
        this.fenwick.buildFrom(arr);
    }

    /**
     * Updates cached height at index and applies delta to Fenwick tree.
     * Updates running average for adaptive estimation.
     * 
     * @returns True if height changed beyond epsilon threshold
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
     * Finds first visible item at or after scroll offset.
     * Uses Fenwick binary search then adjusts for visibility.
     */
    private findFirstVisibleIndex(stRel: number, count: number): number {
        const k = this.fenwick.lowerBoundPrefix(Math.max(0, stRel));
        const raw = Math.min(count - 1, k);
        const v = this.nextVisibleFrom(raw, count);
        return v === -1 ? Math.max(0, raw) : v;
    }

    /**
     * Inserts element into DOM maintaining index order.
     * Tries adjacent siblings first, then scans for insertion point.
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
     * Ensures element is in correct DOM position for its index.
     * Reinserts if siblings indicate wrong position.
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
     * Attaches ResizeObserver to measure items when they resize.
     * Singleton pattern - only creates once per instance.
     */
    private attachResizeObserverOnce() {
        if (this.resizeObs) return;

        this.resizeObs = new ResizeObserver(() => {
            if (this._suppressResize || this._suspended || !this.adapter || this._measureRaf != null) return;
            
            this._measureRaf = requestAnimationFrame(() => {
                this._measureRaf = null;
                this.measureVisibleAndUpdate();
            });
        });

        this.resizeObs.observe(this.ItemsHost);
    }

    /**
     * Measures all currently rendered items and updates height cache.
     * Triggers window update if any heights changed.
     */
    private measureVisibleAndUpdate() {
        if (!this.adapter) return;
        const count = this.adapter.itemCount();
        if (count <= 0) return;

        let changed = false;

        for (let i = this.start; i <= this.end; i++) {
            if (!this.isIndexVisible(i)) continue;

            const item = this.adapter.items[i];
            const el = item?.view?.getView?.() as HTMLElement | undefined;
            if (!el) continue;

            const newH = this.measureOuterHeight(el);
            if (this.updateHeightAt(i, newH)) changed = true;
        }

        if (changed) {
            if (this.opts.adaptiveEstimate) this.rebuildFenwick(count);
            this.scheduleUpdateWindow();
        }
    }

    /** Scroll event handler - schedules render update. */
    private onScroll() {
        this.scheduleUpdateWindow();
    }

    /**
     * Core rendering logic - calculates and updates visible window.
     * 
     * 1. Calculates viewport bounds accounting for scroll and sticky headers
     * 2. Uses anchor item to prevent scroll jumping during height changes
     * 3. Determines start/end indices with overscan buffer
     * 4. Mounts/unmounts items as needed
     * 5. Measures visible items if dynamic heights enabled
     * 6. Updates padding elements to maintain total scroll height
     * 7. Adjusts scroll position to maintain anchor item position
     */
    private updateWindowInternal() {
        if (this._updating || this._suspended) return;
        this._updating = true;

        try {
            if (!this.adapter) return;

            const count = this.adapter.itemCount();
            if (count <= 0) return;

            if (this._lastRenderCount !== count) {
                this._lastRenderCount = count;
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

            this._suppressResize = true;
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
                this._suppressResize = false;
            }

            const anchorTopNew = this.offsetTopOf(anchorIndex);
            const targetScroll = this.containerTopInScroll() + anchorTopNew - anchorDelta;
            const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
            const clamped = Math.min(Math.max(0, targetScroll), maxScroll);

            if (Math.abs(this.scrollEl.scrollTop - clamped) > 0.5) {
                this.scrollEl.scrollTop = clamped;
            }
        } finally {
            this._updating = false;
        }
    }

    /** Mounts all items in inclusive range [start..end]. */
    private mountRange(start: number, end: number) {
        for (let i = start; i <= end; i++) this.mountIndexOnce(i);
    }

    /**
     * Mounts single item, reusing existing element if available.
     * Creates view holder on first mount, rebinds on subsequent renders.
     */
    private mountIndexOnce(index: number) {
        if (!this.isIndexVisible(index)) {
            const existing = this.created.get(index);
            if (existing?.parentElement === this.ItemsHost) existing.remove();
            this.created.delete(index);
            return;
        }

        const item = this.adapter!.items[index];
        const existing = this.created.get(index);

        if (existing) {
            if (!item?.view) {
                existing.remove();
                this.created.delete(index);
            } else {
                this.ensureDomOrder(index, existing);
                this.adapter.onViewHolder(item, item.view, index);
            }
            return;
        }

        if (!item.isInit) {
            const viewer = this.adapter!.viewHolder(this.ItemsHost, item);
            item.view = viewer;
            this.adapter!.onViewHolder(item, viewer, index);
            item.isInit = true;
        } else if (item.view) {
            this.adapter!.onViewHolder(item, item.view, index);
        }

        const el = item.view?.getView?.() as HTMLElement | undefined;
        if (el) {
            this.ensureDomOrder(index, el);
            this.created.set(index, el);
        }
    }

    /** Removes all mounted items outside [start..end] range. */
    private unmountOutside(start: number, end: number) {
        this.created.forEach((el, idx) => {
            if (idx < start || idx > end) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /** Removes all items marked as invisible from DOM. */
    private cleanupInvisibleItems() {
        this.created.forEach((el, idx) => {
            if (!this.isIndexVisible(idx)) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });
    }

    /** Returns cumulative height from start to top of item at index. */
    private offsetTopOf(index: number): number {
        return this.fenwick.sum(index);
    }

    /** Returns total height of items in range [start..end]. */
    private windowHeight(start: number, end: number): number {
        return this.fenwick.rangeSum(start + 1, end + 1);
    }

    /** Returns total scrollable height for all items. */
    private totalHeight(count: number): number {
        return this.fenwick.sum(count);
    }
}