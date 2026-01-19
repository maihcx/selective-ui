import { ModelContract } from "src/ts/types/core/base/model.type";
import { RecyclerView } from "./recyclerview";
import { AdapterContract } from "src/ts/types/core/base/adapter.type";
import { Libs } from "src/ts/utils/libs";
import {
    VirtualOptions,
    VirtualRecyclerViewTags,
} from "src/ts/types/core/base/virtual-recyclerview.type";

/**
 * Fenwick tree (Binary Indexed Tree) for prefix sums over item heights.
 * Uses 1-based indexing internally.
 */
class Fenwick {
    private bit: number[] = [];
    private n = 0;

    /**
     * Creates a Fenwick tree initialized with size `n`.
     *
     * @param {number} [n=0] - Number of elements.
     */
    constructor(n = 0) {
        this.reset(n);
    }

    /**
     * Resets the tree to a new size and clears all values.
     *
     * @param {number} n - Number of elements.
     */
    reset(n: number) {
        this.n = n;
        this.bit = new Array(n + 1).fill(0);
    }

    /**
     * Adds `delta` to element at index `i` (1-based).
     *
     * @param {number} i - 1-based index.
     * @param {number} delta - Amount to add.
     */
    add(i: number, delta: number) {
        for (let x = i; x <= this.n; x += x & -x) this.bit[x] += delta;
    }

    /**
     * Returns the prefix sum in range [1..i] (1-based).
     *
     * @param {number} i - 1-based index.
     * @returns {number} Prefix sum.
     */
    sum(i: number): number {
        let s = 0;
        for (let x = i; x > 0; x -= x & -x) s += this.bit[x];
        return s;
    }

    /**
     * Returns the sum in range [l..r] (1-based).
     *
     * @param {number} l - Left bound (1-based).
     * @param {number} r - Right bound (1-based).
     * @returns {number} Range sum.
     */
    rangeSum(l: number, r: number): number {
        if (r < l) return 0;
        return this.sum(r) - this.sum(l - 1);
    }

    /**
     * Builds the tree from a 0-based array in O(n log n).
     *
     * @param {number[]} arr - 0-based values.
     */
    buildFrom(arr: number[]) {
        this.reset(arr.length);
        for (let i = 0; i < arr.length; i++) this.add(i + 1, arr[i]);
    }

    /**
     * Finds the largest `idx` such that `prefixSum(idx) <= target`.
     * Returns `idx` in [0..n] where `idx` represents the count of items
     * that fit within `target`.
     *
     * @param {number} target - Target prefix sum.
     * @returns {number} Largest index satisfying the condition.
     */
    lowerBoundPrefix(target: number): number {
        let idx = 0;
        let bitMask = 1;
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
 * Virtualized recycler view that mounts only a window of items and simulates
 * the remaining scrollable space using top/bottom padding.
 *
 * Supports dynamic (measured) item heights and adaptive estimation.
 *
 * @template TItem Model type produced by the adapter.
 * @template TAdapter Adapter type that creates/binds item views.
 */
export class VirtualRecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> extends RecyclerView<TItem, TAdapter> {
    private opts: Required<VirtualOptions>;

    private PadTop!: HTMLDivElement;
    private ItemsHost!: HTMLDivElement;
    private PadBottom!: HTMLDivElement;

    private scrollEl!: HTMLElement;

    private heightCache: Array<number | undefined> = [];
    private fenwick = new Fenwick(0);
    private created: Map<number, HTMLElement> = new Map();

    private firstMeasured = false;
    private start = 0;
    private end = -1;

    private resizeObs?: ResizeObserver;

    private _rafId: number | null = null;
    private _updating = false;
    private _suppressResize = false;

    private _lastRenderCount = 0;
    private _suspended = false;
    private _boundOnScroll?: () => void;
    private _resumeResizeAfter = false;

    private _measureRaf: number | null = null;

    private static readonly EPS = 0.5;
    private static readonly ATTR_INDEX = "data-vindex";

    private _stickyCacheTick = 0;
    private _stickyCacheVal = 0;

    private measuredSum = 0;
    private measuredCount = 0;

    /**
     * Creates a virtual recycler view instance.
     *
     * @param {HTMLDivElement|null} [viewElement=null] - Root element used as the view container.
     */
    constructor(viewElement: HTMLDivElement | null = null) {
        super(viewElement);
        this.opts = {
            scrollEl: undefined as any,
            estimateItemHeight: 36,
            overscan: 8,
            dynamicHeights: true,
            adaptiveEstimate: true,
        };
    }

    /**
     * Updates the virtualization configuration.
     *
     * @param {Partial<VirtualOptions>} opts - Options to override.
     */
    public configure(opts: Partial<VirtualOptions>) {
        this.opts = { ...this.opts, ...opts } as Required<VirtualOptions>;
    }

    /**
     * Binds an adapter and mounts the virtualization scaffold into the view element.
     * Removes previous bindings if an adapter was already attached.
     *
     * @param {TAdapter} adapter - Adapter to attach.
     * @throws If the scroll container cannot be resolved.
     */
    override setAdapter(adapter: TAdapter) {
        if (this.adapter) this.dispose();

        super.setAdapter(adapter);
        (adapter as any).recyclerView = this;

        if (!this.viewElement) return;

        this.viewElement.replaceChildren();

        const nodeMounted = Libs.mountNode(
            {
                PadTop: {
                    tag: {
                        node: "div",
                        classList: "selective-ui-virtual-pad-top",
                    },
                },
                ItemsHost: {
                    tag: {
                        node: "div",
                        classList: "selective-ui-virtual-items",
                    },
                },
                PadBottom: {
                    tag: {
                        node: "div",
                        classList: "selective-ui-virtual-pad-bottom",
                    },
                },
            },
            this.viewElement
        ) as VirtualRecyclerViewTags;

        this.PadTop = nodeMounted.PadTop;
        this.ItemsHost = nodeMounted.ItemsHost;
        this.PadBottom = nodeMounted.PadBottom;

        this.scrollEl =
            this.opts.scrollEl ??
            (this.viewElement.closest(".selective-ui-popup") as HTMLElement) ??
            (this.viewElement.parentElement as HTMLElement);

        if (!this.scrollEl)
            throw new Error("VirtualRecyclerView: scrollEl not found");

        this._boundOnScroll = this.onScroll.bind(this);
        this.scrollEl.addEventListener("scroll", this._boundOnScroll, {
            passive: true,
        });

        this.refresh(false);
        this.attachResizeObserverOnce();
        (adapter as any)?.onVisibilityChanged(() => {
            this.refreshItem();
        });
    }

    /**
     * Temporarily disables scroll and resize processing.
     * Cancels scheduled frames and disconnects resize observer.
     */
    public suspend() {
        this._suspended = true;

        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this._boundOnScroll);
        }

        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        if (this._measureRaf != null) {
            cancelAnimationFrame(this._measureRaf);
            this._measureRaf = null;
        }

        if (this.resizeObs) {
            this.resizeObs.disconnect();
            this._resumeResizeAfter = true;
        } else {
            this._resumeResizeAfter = false;
        }
    }

    /**
     * Re-enables scroll and resize processing after suspension.
     */
    public resume() {
        this._suspended = false;

        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.addEventListener("scroll", this._boundOnScroll, {
                passive: true,
            });
        }

        if (this._resumeResizeAfter) {
            this.attachResizeObserverOnce();
            this._resumeResizeAfter = false;
        }

        this.scheduleUpdateWindow();
    }

    /**
     * Refreshes internal caches and schedules an update based on adapter content.
     * Rebuilds height structures and probes an initial estimate on first run.
     * 
     * @param isUpdate - Indicates if this refresh is due to an update operation.
     */
    override refresh(isUpdate: boolean): void {
        if (!this.adapter || !this.viewElement) return;

        if (!isUpdate) {
            this.refreshItem();
        }

        const count = this.adapter.itemCount();
        this._lastRenderCount = count;

        if (count === 0) {
            this.created.forEach((el) => el.remove());
            this.created.clear();
            this.heightCache = [];
            this.fenwick.reset(0);
            this.PadTop.style.height = "0px";
            this.PadBottom.style.height = "0px";
            this.firstMeasured = false;
            this.measuredSum = 0;
            this.measuredCount = 0;
            return;
        }

        if (this.heightCache.length !== count) {
            this.heightCache.length = count;
        }

        if (!this.firstMeasured) {
            const probe = 0;
            this.mountIndexOnce(probe);

            const el = this.created.get(probe);
            if (el) {
                const h = this.measureOuterHeight(el);
                if (!isNaN(h)) this.opts.estimateItemHeight = h;

                if (!this.opts.dynamicHeights) {
                    el.remove();
                    this.created.delete(probe);
                    const item = this.adapter.items[probe] as any;
                    if (item) {
                        item.isInit = false;
                        item.view = null;
                    }
                }
            }

            this.firstMeasured = true;
        }

        this.rebuildFenwick(count);
        this.scheduleUpdateWindow();
    }

    /**
     * Ensures the given index is rendered and optionally scrolls it into view.
     *
     * @param {number} index - Item index to ensure.
     * @param {{ scrollIntoView?: boolean }} [opt] - Optional behavior.
     */
    public ensureRendered(index: number, opt?: { scrollIntoView?: boolean }) {
        const { scrollIntoView = false } = opt || {};
        this.mountRange(index, index);
        if (scrollIntoView) this.scrollToIndex(index);
    }

    /**
     * Returns whether an item at index is visible.
     * If item.visible is undefined, treat as visible.
     */
    private isIndexVisible(index: number): boolean {
        const item = this.adapter?.items?.[index] as any;
        if (!item) return true;
        const v = item.visible;
        return v === undefined ? true : !!v;
    }

    /**
     * Returns the next visible index from `index` (inclusive).
     * If none found, returns -1.
     */
    private nextVisibleFrom(index: number, count: number): number {
        for (let i = Math.max(0, index); i < count; i++) {
            if (this.isIndexVisible(i)) return i;
        }
        return -1;
    }

    /**
     * Recomputes measuredSum/measuredCount from current heightCache,
     * considering only visible items.
     */
    private recomputeMeasuredStats(count: number) {
        this.measuredSum = 0;
        this.measuredCount = 0;
        for (let i = 0; i < count; i++) {
            if (!this.isIndexVisible(i)) continue;
            const h = this.heightCache[i];
            if (h != null) {
                this.measuredSum += h;
                this.measuredCount += 1;
            }
        }
    }

    /**
     * Scrolls the container so that item at `index` becomes visible.
     *
     * @param {number} index - Item index.
     */
    public scrollToIndex(index: number) {
        const count = this.adapter?.itemCount?.() ?? 0;
        if (count <= 0) return;

        const topInContainer = this.offsetTopOf(index);
        const containerTop = this.containerTopInScroll();
        const target = containerTop + topInContainer;

        const maxScroll = Math.max(
            0,
            this.scrollEl.scrollHeight - this.scrollEl.clientHeight
        );
        this.scrollEl.scrollTop = Math.min(Math.max(0, target), maxScroll);
    }

    /**
     * Disposes listeners, scheduled frames, observers and removes created elements.
     */
    public dispose() {
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._measureRaf != null) {
            cancelAnimationFrame(this._measureRaf);
            this._measureRaf = null;
        }
        if (this.scrollEl && this._boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this._boundOnScroll);
        }
        if (this.resizeObs) {
            this.resizeObs.disconnect();
            this.resizeObs = undefined;
        }
        this.created.forEach((el) => el.remove());
        this.created.clear();
    }

    /**
     * Computes the top offset of the view container relative to the scroll container.
     *
     * @returns {number} Relative top offset in pixels.
     */
    private containerTopInScroll(): number {
        const a = this.viewElement!.getBoundingClientRect();
        const b = this.scrollEl.getBoundingClientRect();
        return a.top - b.top + this.scrollEl.scrollTop;
    }

    /**
     * Computes the height of the sticky header element inside scroll container.
     * Uses a short-lived cache to avoid repeated DOM queries in a single frame.
     *
     * @returns {number} Sticky top height in pixels.
     */
    private stickyTopHeight(): number {
        const now = performance.now();
        if (now - this._stickyCacheTick < 16) return this._stickyCacheVal;

        const sticky = this.scrollEl.querySelector(
            ".selective-ui-option-handle:not(.hide)"
        ) as HTMLElement | null;

        const val = sticky ? sticky.offsetHeight : 0;
        this._stickyCacheTick = now;
        this._stickyCacheVal = val;
        return val;
    }

    /**
     * Schedules a window update on the next animation frame.
     */
    private scheduleUpdateWindow() {
        if (this._rafId != null) return;
        if (this._suspended) return;

        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.updateWindowInternal();
        });
    }

    /**
     * Measures the rendered height of an element including vertical margins.
     *
     * @param {HTMLElement} el - Element to measure.
     * @returns {number} Outer height in pixels.
     */
    private measureOuterHeight(el: HTMLElement): number {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const mt = parseFloat(style.marginTop) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        return Math.max(1, rect.height + mt + mb);
    }

    /**
     * Returns the current height estimate used for unmeasured items.
     *
     * @returns {number} Estimated item height in pixels.
     */
    private getEstimate(): number {
        if (this.opts.adaptiveEstimate && this.measuredCount > 0) {
            const avg = this.measuredSum / this.measuredCount;
            return Math.max(1, avg);
        }
        return this.opts.estimateItemHeight;
    }

    /**
     * Rebuilds the Fenwick tree based on current cache/estimate.
     *
     * @param {number} count - Total item count.
     */
    private rebuildFenwick(count: number) {
        const est = this.getEstimate();
        const arr = new Array(count);
        for (let i = 0; i < count; i++) {
            if (!this.isIndexVisible(i)) {
                arr[i] = 0;
            } else {
                arr[i] = this.heightCache[i] ?? est;
            }
        }
        this.fenwick.buildFrom(arr);
    }


    /**
     * Updates cached height at a given index and applies the delta to Fenwick tree.
     *
     * @param {number} index - 0-based index.
     * @param {number} newH - New measured height.
     * @returns {boolean} True if the height changed meaningfully.
     */
    private updateHeightAt(index: number, newH: number) {
        if (!this.isIndexVisible(index)) return false;
        const est = this.getEstimate();
        const oldH = this.heightCache[index] ?? est;

        if (Math.abs(newH - oldH) <= VirtualRecyclerView.EPS) return false;

        const prevMeasured = this.heightCache[index];
        if (prevMeasured == null) {
            this.measuredSum += newH;
            this.measuredCount += 1;
        } else {
            this.measuredSum += newH - prevMeasured;
        }

        this.heightCache[index] = newH;
        this.fenwick.add(index + 1, newH - oldH);
        return true;
    }

    /**
     * Finds the first visible item index for a scroll offset relative to the container.
     *
     * @param {number} stRel - Scroll top relative to the container.
     * @param {number} count - Total item count.
     * @returns {number} First visible item index.
     */
    private findFirstVisibleIndex(stRel: number, count: number): number {
        const k = this.fenwick.lowerBoundPrefix(Math.max(0, stRel));
        const raw = Math.min(count - 1, k);
        const v = this.nextVisibleFrom(raw, count);
        return v === -1 ? Math.max(0, raw) : v;
    }

    /**
     * Inserts an element into the host so that DOM order matches item index order.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to insert.
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

        const children = this.ItemsHost.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i] as HTMLElement;
            const v = child.getAttribute(VirtualRecyclerView.ATTR_INDEX);
            if (v == null) continue;
            const childIndex = Number(v);
            if (childIndex > index) {
                this.ItemsHost.insertBefore(el, child);
                return;
            }
        }
        this.ItemsHost.appendChild(el);
    }

    /**
     * Ensures an element is located in the correct DOM position relative to its index.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to validate.
     */
    private ensureDomOrder(index: number, el: HTMLElement) {
        if (el.parentElement !== this.ItemsHost) {
            this.insertIntoHostByIndex(index, el);
            return;
        }

        el.setAttribute(VirtualRecyclerView.ATTR_INDEX, String(index));

        const prev = el.previousElementSibling as HTMLElement | null;
        if (prev) {
            const pv = prev.getAttribute(VirtualRecyclerView.ATTR_INDEX);
            if (pv != null && Number(pv) > index) {
                el.remove();
                this.insertIntoHostByIndex(index, el);
                return;
            }
        }

        const next = el.nextElementSibling as HTMLElement | null;
        if (next) {
            const nv = next.getAttribute(VirtualRecyclerView.ATTR_INDEX);
            if (nv != null && Number(nv) < index) {
                el.remove();
                this.insertIntoHostByIndex(index, el);
                return;
            }
        }
    }

    /**
     * Attaches a resize observer that measures visible items and updates caches.
     * The observer is attached once and re-used across refresh cycles.
     */
    private attachResizeObserverOnce() {
        if (this.resizeObs) return;

        this.resizeObs = new ResizeObserver(() => {
            if (this._suppressResize) return;
            if (this._suspended) return;
            if (!this.adapter) return;

            if (this._measureRaf != null) return;
            this._measureRaf = requestAnimationFrame(() => {
                this._measureRaf = null;
                this.measureVisibleAndUpdate();
            });
        });

        this.resizeObs.observe(this.ItemsHost);
    }

    /**
     * Measures currently visible items and updates height structures when changed.
     */
    private measureVisibleAndUpdate() {
        if (!this.adapter) return;
        const count = this.adapter.itemCount();
        if (count <= 0) return;

        let changed = false;

        for (let i = this.start; i <= this.end; i++) {
            if (!this.isIndexVisible(i)) continue;

            const item = this.adapter.items[i] as any;
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

    /**
     * Handles scroll events by scheduling a window update.
     */
    private onScroll() {
        this.scheduleUpdateWindow();
    }

    /**
     * Updates the rendered window of items based on current scroll position.
     * Maintains an anchor item to avoid perceived jump during height adjustments.
     */
    private updateWindowInternal() {
        if (this._updating) return;
        if (this._suspended) return;
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
            const anchorDelta =
                containerTop + anchorTop - this.scrollEl.scrollTop;
            
            const firstVis = this.findFirstVisibleIndex(stRel, count);
            if (firstVis === -1) {
                this.created.forEach((el) => el.remove());
                this.created.clear();
                this.PadTop.style.height = "0px";
                this.PadBottom.style.height = "0px";
                return;
            }

            const est = this.getEstimate();
            const overscanPx = this.opts.overscan * est;

            const startByPx = this.fenwick.lowerBoundPrefix(Math.max(0, stRel - overscanPx));
            let startIndex = Math.max(0, Math.min(count - 1, startByPx));
            startIndex = this.nextVisibleFrom(startIndex, count);
            if (startIndex === -1) startIndex = firstVis;

            const endByPx = this.fenwick.lowerBoundPrefix(stRel + vhEff + overscanPx);
            let endIndex = Math.max(0, Math.min(count - 1, endByPx));

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

            const containerTop2 = this.containerTopInScroll();
            const anchorTopNew = this.offsetTopOf(anchorIndex);
            const targetScroll = containerTop2 + anchorTopNew - anchorDelta;

            const maxScroll = Math.max(
                0,
                this.scrollEl.scrollHeight - this.scrollEl.clientHeight
            );
            const clamped = Math.min(Math.max(0, targetScroll), maxScroll);

            if (Math.abs(this.scrollEl.scrollTop - clamped) > 0.5) {
                this.scrollEl.scrollTop = clamped;
            }
        } finally {
            this._updating = false;
        }
    }

    /**
     * Mounts items in the inclusive range [start..end].
     *
     * @param {number} start - Start index.
     * @param {number} end - End index.
     */
    private mountRange(start: number, end: number) {
        for (let i = start; i <= end; i++) this.mountIndexOnce(i);
    }

    /**
     * Mounts an item at `index` if not created, ensures DOM order, and re-binds view.
     *
     * @param {number} index - Item index.
     */
    private mountIndexOnce(index: number) {
        if (!this.isIndexVisible(index)) {
            const existing = this.created.get(index);
            if (existing && existing.parentElement === this.ItemsHost) existing.remove();
            this.created.delete(index);
            return;
        }

        const item = this.adapter!.items[index] as any;

        if (this.created.has(index)) {
            const existing = this.created.get(index);
            if (!item?.view) {
                existing?.remove();
                this.created.delete(index);
            } else {
                this.ensureDomOrder(index, existing);
                this.adapter.onViewHolder(item, item.view, index);
                return;
            }
        }

        if (!item.isInit) {
            const viewer = this.adapter!.viewHolder(this.ItemsHost, item);
            item.view = viewer;
            this.adapter!.onViewHolder(item, viewer, index);
            item.isInit = true;
        } else {
            if (item.view) this.adapter!.onViewHolder(item, item.view, index);
        }

        const el = item.view?.getView?.() as HTMLElement | undefined;
        if (!el) return;

        this.ensureDomOrder(index, el);
        this.created.set(index, el);

        // if (this.opts.dynamicHeights) {
            // const h = this.measureOuterHeight(el);
            // const changed = this.updateHeightAt(index, h);
            // if (changed && this.opts.adaptiveEstimate) {
            //     const count = this.adapter!.itemCount();
            //     this.rebuildFenwick(count);
            // }
        // }
    }

    /**
     * Unmounts (removes) created elements outside the inclusive range [start..end].
     *
     * @param {number} start - Start index.
     * @param {number} end - End index.
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
     * Returns the vertical offset from the start to the top of `index`.
     *
     * @param {number} index - Item index.
     * @returns {number} Offset in pixels.
     */
    private offsetTopOf(index: number): number {
        return this.fenwick.sum(index);
    }

    /**
     * Returns the total height of items in inclusive range [start..end].
     *
     * @param {number} start - Start index.
     * @param {number} end - End index.
     * @returns {number} Height in pixels.
     */
    private windowHeight(start: number, end: number): number {
        return this.fenwick.rangeSum(start + 1, end + 1);
    }

    /**
     * Returns the total estimated/measured height for `count` items.
     *
     * @param {number} count - Item count.
     * @returns {number} Total height in pixels.
     */
    private totalHeight(count: number): number {
        return this.fenwick.sum(count);
    }

    /**
     * Rebuilds virtualization state after `item.visible` changes.
     *
     * This method performs a **hard reset** of the virtual list and rebuilds all
     * height structures to ensure paddings (especially PadBottom) are recalculated
     * correctly after large visibility changes (e.g., clearing a search/filter).
     */
    public refreshItem() {
        if (!this.adapter) return;
        const count = this.adapter.itemCount();
        if (count <= 0) return;

        this.suspend();

        this.created.forEach((el) => el.remove());
        this.created.clear();
        this.heightCache = [];
        this.fenwick.reset(0);
        this.firstMeasured = false;
        this.measuredSum = 0;
        this.measuredCount = 0;

        this.created.forEach((el, idx) => {
            if (!this.isIndexVisible(idx)) {
                if (el.parentElement === this.ItemsHost) el.remove();
                this.created.delete(idx);
            }
        });

        this.recomputeMeasuredStats(count);
        this.rebuildFenwick(count);

        this.start = 0;
        this.end = -1;

        this.resume();
    }
}