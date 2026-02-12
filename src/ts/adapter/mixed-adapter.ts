import { Adapter } from "../core/base/adapter";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { GroupView } from "../views/group-view";
import { OptionView } from "../views/option-view";
import { MixedItem, VisibilityStats } from "../types/core/base/mixed-adapter.type";
import { IEventCallback } from "../types/utils/ievents.type";
import { ImagePosition, LabelHalign, LabelValign } from "../types/views/view.option.type";
import { Libs } from "../utils/libs";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * Mixed (heterogeneous) adapter for rendering and interacting with a list that contains
 * both {@link GroupModel} and {@link OptionModel} items.
 *
 * ### Responsibility
 * - Flatten hierarchical data (groups → options) into `flatOptions` for:
 *   - keyboard navigation (highlight + next/prev visible),
 *   - visibility aggregation (visibleCount/totalCount),
 *   - selection helpers (getSelectedItem(s), checkAll).
 * - Create the correct view implementation per item:
 *   - {@link GroupView} for groups,
 *   - {@link OptionView} for options (including options inside a group container).
 * - Bind DOM events and model hooks to keep View ↔ Model synchronized:
 *   - click → selection changes,
 *   - mouseenter → highlight changes,
 *   - model visibility change → group visibility recalculation + debounced stats event.
 *
 * ### Lifecycle (Strict FSM, idempotency)
 * - `init()` registers a debounced visibility aggregation job and then calls `mount()`.
 * - View binding in `handleGroupView` / `handleOptionView` is guarded by `model.isInit`
 *   to avoid double-wiring listeners (idempotent binding).
 * - `destroy()` clears scheduler jobs and destroys groups (cascades into their options/views),
 *   then transitions to `DESTROYED`. Subsequent destroy calls are **no-ops**.
 *
 * ### Event / Hook flow (external vs internal)
 * - **External selection**: user click triggers `changingProp("select")` then changes `OptionModel.selected`,
 *   and eventually emits adapter-level `changeProp("selected")` via `optionModel.onSelected`.
 * - **Internal selection**: `OptionModel.selectedNonTrigger` / `onInternalSelected` updates internal state
 *   (e.g., cache `selectedItemSingle`) and emits adapter-level `changeProp("selected_internal")`
 *   without implying user intent.
 *
 * ### Visibility / Highlight / Navigation
 * - Visibility is tracked per option model (`OptionModel.visible`), and groups can update their own
 *   derived visibility via `GroupModel.updateVisibility()`.
 * - Highlight is tracked by flat index (`currentHighlightIndex`) and by model flag
 *   (`OptionModel.highlighted`), enabling view-level styling / a11y hooks.
 *
 * ### DOM side effects / a11y notes
 * - Adds DOM listeners (`click`, `mouseenter`) on first bind only.
 * - Uses `Element.scrollIntoView()` when highlighting with scrolling enabled.
 * - When options are virtualized, falls back to `recyclerView.ensureRendered(i, { scrollIntoView: true })`
 *   before attempting to scroll.
 *
 * @extends {Adapter<MixedItem, GroupView | OptionView>}
 * @see {@link GroupModel}
 * @see {@link OptionModel}
 * @see {@link GroupView}
 * @see {@link OptionView}
 */
export class MixedAdapter extends Adapter<MixedItem, GroupView | OptionView> {
    /** Whether the adapter operates in multi-selection mode. */
    public isMultiple = false;

    /**
     * Subscribers for aggregated visibility statistics.
     * Fired via a debounced scheduler to avoid repeated recomputation during batch updates.
     */
    private visibilityChangedCallbacks: Array<(stats: VisibilityStats) => void> = [];

    /**
     * Flat index of the currently highlighted option.
     * `-1` indicates "no highlight".
     */
    private currentHighlightIndex = -1;

    /**
     * Cached pointer to the selected option in single-select mode.
     * Used to efficiently clear previous selection when selecting a new option.
     */
    private selectedItemSingle: OptionModel | null = null;

    /** Top-level group models (if any). */
    public groups: GroupModel[] = [];

    /**
     * Flattened list of all option models, including options inside groups.
     * This is the primary index space for navigation/highlight.
     */
    public flatOptions: OptionModel[] = [];

    /**
     * Creates a MixedAdapter with an optional initial list of items.
     * Immediately computes `groups` and `flatOptions` for navigation/stats.
     *
     * @param {MixedItem[]} [items=[]] - Initial items (groups and/or options).
     */
    public constructor(items: MixedItem[] = []) {
        super(items);
        this.buildFlatStructure();
    }

    /**
     * Initializes debounced visibility aggregation and transitions lifecycle forward.
     *
     * - Registers `sche_vis_${adapterKey}`:
     *   - computes `{ visibleCount, totalCount, hasVisible, isEmpty }` from `flatOptions`,
     *   - notifies {@link onVisibilityChanged} subscribers,
     *   - triggers a proxy scheduler `sche_vis_proxy_${adapterKey}` for downstream chaining.
     * - Calls base `init()` and mounts immediately.
     *
     * Idempotency:
     * - Scheduler key is deterministic per adapter instance (`adapterKey`).
     *
     * @returns {void}
     * @override
     */
    public override init() {
        Libs.callbackScheduler.on(
            `sche_vis_${this.adapterKey}`,
            () => {
                const visibleCount = this.flatOptions.filter((item) => item.visible).length;
                const totalCount = this.flatOptions.length;

                this.visibilityChangedCallbacks.forEach((callback) => {
                    callback({
                        visibleCount,
                        totalCount,
                        hasVisible: visibleCount > 0,
                        isEmpty: totalCount === 0,
                    });
                });

                // Proxy hook; allows other listeners to chain after visibility aggregation.
                Libs.callbackScheduler.run(`sche_vis_proxy_${this.adapterKey}`);
            },
            { debounce: 10 }
        );

        super.init();
        this.mount();
    }

    /**
     * Rebuilds the derived structures:
     * - `groups`: top-level {@link GroupModel} list
     * - `flatOptions`: all {@link OptionModel} instances in traversal order
     *
     * The flat list is used for:
     * - navigation across visible options,
     * - computing visibility statistics,
     * - highlight index mapping.
     *
     * @returns {void}
     */
    private buildFlatStructure(): void {
        this.flatOptions = [];
        this.groups = [];

        this.items.forEach((item) => {
            if (item instanceof GroupModel) {
                this.groups.push(item);
                this.flatOptions.push(...item.items);
            } else if (item instanceof OptionModel) {
                this.flatOptions.push(item);
            }
        });
    }

    /**
     * Creates the appropriate view instance for a given item.
     *
     * @param {HTMLElement} parent - Container element where the view will be mounted.
     * @param {MixedItem} item - The item to render (group or option).
     * @returns {GroupView | OptionView} A view instance matching the item type.
     * @override
     */
    override viewHolder(parent: HTMLElement, item: MixedItem): GroupView | OptionView {
        if (item instanceof GroupModel) return new GroupView(parent);
        return new OptionView(parent);
    }

    /**
     * Binds a model (group or option) to its view and delegates to specialized handlers.
     *
     * Notes:
     * - Assigns `item.position` in the top-level `items` list (not the `flatOptions` index).
     * - Performs one-time listener binding guarded by `item.isInit`.
     *
     * @param {MixedItem} item - {@link GroupModel} or {@link OptionModel}.
     * @param {GroupView | OptionView | null} viewer - The view instance that will render the model.
     * @param {number} position - Position in the top-level mixed list.
     * @returns {void}
     * @override
     */
    override onViewHolder(item: MixedItem, viewer: GroupView | OptionView | null, position: number): void {
        item.position = position;

        if (item instanceof GroupModel) {
            this.handleGroupView(item, viewer as GroupView, position);
        } else if (item instanceof OptionModel) {
            this.handleOptionView(item, viewer as OptionView, position);
        }

        item.isInit = true;
    }

    /**
     * Binds / renders a group header and its option children.
     *
     * Responsibilities:
     * - Set header label and click-to-toggle behavior (one-time).
     * - Observe collapsed state:
     *   - toggles child option DOM display,
     *   - invokes {@link onCollapsedChange} hook.
     * - Ensure each child option has a view and is bound via {@link handleOptionView}.
     * - Sync collapsed UI and derived visibility for the group view.
     *
     * DOM side effects:
     * - Adds a click listener to the group header (only once).
     * - Updates child option view element `style.display` on collapse changes.
     *
     * @param {GroupModel} groupModel - Group data model.
     * @param {GroupView} groupView - Group view instance.
     * @param {number} position - Group index in the top-level list.
     * @returns {void}
     */
    private handleGroupView(groupModel: GroupModel, groupView: GroupView, position: number): void {
        super.onViewHolder(groupModel, groupView, position);
        groupModel.view = groupView;

        const header = groupView.view.tags.GroupHeader;
        header.textContent = groupModel.label;

        if (!groupModel.isInit) {
            header.style.cursor = "pointer";

            header.addEventListener("click", () => {
                groupModel.toggleCollapse();
            });

            groupModel.onCollapsedChanged((evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => {
                void evtToken;

                model.items.forEach((optItem) => {
                    const optView = optItem.view?.getView?.();
                    if (optView) optView.style.display = collapsed ? "none" : "";
                });

                this.onCollapsedChange(model, collapsed);
            });
        }

        const itemsContainer = groupView.getItemsContainer();

        groupModel.items.forEach((optionModel, idx) => {
            let optionViewer = optionModel.view;
            if (!optionModel.isInit || !optionViewer) {
                optionViewer = new OptionView(itemsContainer);
            }

            this.handleOptionView(optionModel, optionViewer, idx);
            optionModel.isInit = true;
        });

        groupView.setCollapsed(groupModel.collapsed);
        groupView.updateVisibility();
    }

    /**
     * Binds / renders an option row and wires selection/highlight/visibility behavior.
     *
     * Responsibilities:
     * - Apply visual configuration from the model options (image sizing/position, label alignment).
     * - Render image (src/alt) and label HTML.
     * - Wire DOM events (one-time):
     *   - click → selection (single/multiple),
     *   - mouseenter → highlight.
     * - Wire model hooks (one-time):
     *   - `onSelected` → `changeProp("selected")` (external semantics),
     *   - `onInternalSelected` → cache single selected + `changeProp("selected_internal")` (internal semantics),
     *   - `onVisibilityChanged` → group visibility recompute + debounced visibility stats.
     *
     * Selection semantics:
     * - Multi-select: toggles `selected` for the clicked option.
     * - Single-select: clears previous selected option (if cached) and selects the clicked one.
     * - Both paths run `changingProp("select")` before mutating selection when not skipping events.
     *
     * DOM side effects:
     * - Adds listeners to `OptionView` element only on first bind.
     * - Updates image and label DOM each bind.
     *
     * @param {OptionModel} optionModel - Option data model.
     * @param {OptionView} optionViewer - Option view instance.
     * @param {number} position - Option index within its group list (or rendering context).
     * @returns {void}
     */
    private handleOptionView(optionModel: OptionModel, optionViewer: OptionView, position: number): void {
        optionViewer.isMultiple = this.isMultiple;
        optionViewer.hasImage = optionModel.hasImage;

        optionViewer.optionConfig = {
            imageWidth: optionModel.options.imageWidth as string,
            imageHeight: optionModel.options.imageHeight as string,
            imageBorderRadius: optionModel.options.imageBorderRadius as string,
            imagePosition: optionModel.options.imagePosition as ImagePosition,
            labelValign: optionModel.options.labelValign as LabelValign,
            labelHalign: optionModel.options.labelHalign as LabelHalign,
        };

        if (!optionModel.isInit) {
            super.onViewHolder(optionModel, optionViewer, position);
        }

        optionModel.view = optionViewer;

        if (optionModel.hasImage) {
            const imageTag = optionViewer.view.tags.OptionImage;
            if (imageTag) {
                if (imageTag.src !== optionModel.imageSrc) imageTag.src = optionModel.imageSrc;
                if (imageTag.alt !== optionModel.text) imageTag.alt = optionModel.text;
            }
        }

        // Label uses HTML to support rich content; consumers must ensure the model text is safe.
        optionViewer.view.tags.LabelContent.innerHTML = optionModel.text;

        if (!optionModel.isInit) {
            optionViewer.view.tags.OptionView.addEventListener("click", async (ev: MouseEvent) => {
                ev.stopPropagation();
                ev.preventDefault();

                if (this.isSkipEvent) return;

                if (this.isMultiple) {
                    await this.changingProp("select");
                    optionModel.selected = !optionModel.selected;
                } else if (optionModel.selected !== true) {
                    await this.changingProp("select");
                    if (this.selectedItemSingle) this.selectedItemSingle.selected = false;
                    optionModel.selected = true;
                }
            });

            optionViewer.view.tags.OptionView.title = optionModel.textContent;

            optionViewer.view.tags.OptionView.addEventListener("mouseenter", () => {
                if (this.isSkipEvent) return;
                this.setHighlight(this.flatOptions.indexOf(optionModel), false);
            });

            // External selection notification (user-facing semantics).
            optionModel.onSelected((_evtToken: IEventCallback, _el: OptionModel, _selected: boolean) => {
                this.changeProp("selected");
            });

            // Internal selection notification (non-trigger semantics).
            optionModel.onInternalSelected((_evtToken: IEventCallback, _el: OptionModel, selected: boolean) => {
                if (selected) this.selectedItemSingle = optionModel;
                this.changeProp("selected_internal");
            });

            // Visibility changes affect group visibility and aggregated visibility stats.
            optionModel.onVisibilityChanged((_evtToken: IEventCallback, model: OptionModel, _visible: boolean) => {
                model.group?.updateVisibility();
                this.notifyVisibilityChanged();
            });
        }

        // Ensure single-select cache and suppress re-trigger when model is already selected.
        if (optionModel.selected) {
            this.selectedItemSingle = optionModel;
            optionModel.selectedNonTrigger = true;
        }
    }

    /**
     * Replaces items and rebuilds derived structures with full change notifications.
     *
     * Flow:
     * - `changingProp("items", items)` (pre-change pipeline)
     * - assign `this.items`, rebuild `groups`/`flatOptions`
     * - `changeProp("items", items)` (post-change pipeline)
     * - {@link Lifecycle.update}
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {Promise<void>}
     * @override
     */
    override async setItems(items: MixedItem[]): Promise<void> {
        await this.changingProp("items", items);
        this.items = items;
        this.buildFlatStructure();
        await this.changeProp("items", items);
        this.update();
    }

    /**
     * Synchronizes items from an external source by delegating to {@link setItems}.
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {Promise<void>}
     * @override
     */
    override async syncFromSource(items: MixedItem[]): Promise<void> {
        await this.setItems(items);
    }

    /**
     * Updates items and rebuilds derived structures **without** emitting change notifications.
     * Useful for internal reconciliation where observers should not be notified.
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {void}
     * @override
     */
    override updateData(items: MixedItem[]): void {
        this.items = items;
        this.buildFlatStructure();
        this.update();
    }

    /**
     * Releases adapter resources and clears derived state.
     *
     * Behavior:
     * - Clears visibility scheduler task (`sche_vis_${adapterKey}`).
     * - Destroys all group models (which may cascade to child models/views).
     * - Resets cached selection/highlight and subscriber lists.
     *
     * Idempotent:
     * - Returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        Libs.callbackScheduler.clear(`sche_vis_${this.adapterKey}`);

        this.groups.forEach(group => {
            group.destroy();
        });

        this.visibilityChangedCallbacks = [];
        this.currentHighlightIndex = -1;
        this.selectedItemSingle = null;
        this.groups = [];
        this.flatOptions = [];

        super.destroy();
    }

    /**
     * Returns all currently selected options from the flat list.
     *
     * @returns {OptionModel[]} Selected options.
     */
    public getSelectedItems(): OptionModel[] {
        return this.flatOptions.filter((item) => item.selected);
    }

    /**
     * Returns the first selected option from the flat list (if any).
     * Primarily useful for single-select mode.
     *
     * @returns {OptionModel | undefined} The first selected option, or `undefined` if none.
     */
    public getSelectedItem(): OptionModel | undefined {
        return this.flatOptions.find((item) => item.selected);
    }

    /**
     * Selects or deselects all options when in multiple selection mode.
     * No-op if `isMultiple` is false.
     *
     * @param {boolean} isChecked - `true` to select all; `false` to deselect all.
     * @returns {void}
     */
    public checkAll(isChecked: boolean): void {
        if (!this.isMultiple) return;
        this.flatOptions.forEach((item) => {
            item.selected = isChecked;
        });
    }

    /**
     * Subscribes to aggregated visibility changes across all options.
     * The callback is invoked from a debounced scheduler.
     *
     * @param {(stats: VisibilityStats) => void} callback - Invoked with `{ visibleCount, totalCount, hasVisible, isEmpty }`.
     * @returns {void}
     */
    public onVisibilityChanged(callback: (stats: VisibilityStats) => void): void {
        this.visibilityChangedCallbacks.push(callback);
    }

    /**
     * Schedules a debounced visibility statistics recomputation and subscriber notification.
     *
     * @returns {void}
     */
    private notifyVisibilityChanged(): void {
        Libs.callbackScheduler.run(`sche_vis_${this.adapterKey}`);
    }

    /**
     * Computes and returns current visibility statistics for options.
     *
     * @returns {VisibilityStats} Aggregated stats: `{ visibleCount, totalCount, hasVisible, isEmpty }`.
     */
    public getVisibilityStats(): VisibilityStats {
        const visibleCount = this.flatOptions.filter((item) => item.visible).length;
        const totalCount = this.flatOptions.length;

        return {
            visibleCount,
            totalCount,
            hasVisible: visibleCount > 0,
            isEmpty: totalCount === 0,
        };
    }

    /**
     * Resets highlight navigation to the first visible option (starting from index 0).
     *
     * @returns {void}
     */
    public resetHighlight(): void {
        this.setHighlight(0);
    }

    /**
     * Moves highlight among **visible** options and optionally scrolls the new target into view.
     *
     * - Wraps around at both ends (circular navigation).
     * - Uses the current highlight (flat index) as the starting point.
     *
     * @param {number} direction - `+1` to move forward; `-1` to move backward.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     * @returns {void}
     */
    public navigate(direction: number, isScrollToView: boolean = true): void {
        const visibleOptions = this.flatOptions.filter((opt) => opt.visible);
        if (visibleOptions.length === 0) return;

        let currentVisibleIndex = visibleOptions.findIndex(
            (opt) => opt === this.flatOptions[this.currentHighlightIndex]
        );
        if (currentVisibleIndex === -1) currentVisibleIndex = -1;

        let nextVisibleIndex = currentVisibleIndex + direction;
        if (nextVisibleIndex >= visibleOptions.length) nextVisibleIndex = 0;
        if (nextVisibleIndex < 0) nextVisibleIndex = visibleOptions.length - 1;

        const nextOption = visibleOptions[nextVisibleIndex];
        const flatIndex = this.flatOptions.indexOf(nextOption);

        this.setHighlight(flatIndex, isScrollToView);
    }

    /**
     * Programmatically selects (clicks) the currently highlighted option if it is visible.
     *
     * DOM side effects:
     * - Calls `HTMLElement.click()` on the rendered option view element.
     *
     * No-op if:
     * - No highlight is set,
     * - Highlighted item does not exist,
     * - Highlighted item is not visible,
     * - View element is not available (e.g., not rendered).
     *
     * @returns {void}
     */
    public selectHighlighted(): void {
        if (this.currentHighlightIndex > -1 && this.flatOptions[this.currentHighlightIndex]) {
            const item = this.flatOptions[this.currentHighlightIndex];
            if (item.visible) {
                const viewEl = item.view?.getView?.();
                if (viewEl) viewEl.click();
            }
        }
    }

    /**
     * Highlights a target option (by flat index or model reference), skipping invisible items.
     * Optionally scrolls the highlighted item into view.
     *
     * Behavior:
     * - Clears previous highlight (if any) by toggling `OptionModel.highlighted = false`.
     * - Starting from the resolved index, finds the first visible option and highlights it.
     * - If scrolling is enabled:
     *   - scrolls the DOM element when available, otherwise
     *   - asks the recycler to render the item and scroll into view (virtualized lists).
     * - Invokes {@link onHighlightChange} hook after applying highlight.
     *
     * @param {number | OptionModel} target - Flat index or option model to highlight.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     * @returns {void}
     */
    public setHighlight(target: number | OptionModel, isScrollToView: boolean = true): void {
        let index = 0;

        if (typeof target === "number") {
            index = target;
        } else if (target instanceof OptionModel) {
            const fi = this.flatOptions.indexOf(target);
            index = fi > -1 ? fi : 0;
        } else {
            index = 0;
        }

        if (this.currentHighlightIndex > -1 && this.flatOptions[this.currentHighlightIndex]) {
            this.flatOptions[this.currentHighlightIndex].highlighted = false;
        }

        for (let i = index; i < this.flatOptions.length; i++) {
            const item = this.flatOptions[i];
            if (!item?.visible) continue;

            item.highlighted = true;
            this.currentHighlightIndex = i;

            if (isScrollToView) {
                const el = item.view?.getView?.();
                if (el) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                } else {
                    // If virtualized, ensure the item is rendered before trying to scroll.
                    this.recyclerView?.ensureRendered?.(i, { scrollIntoView: true });
                }
            }

            this.onHighlightChange(i, item.view?.getView?.()?.id);
            return;
        }
    }

    /**
     * Hook called whenever highlight changes.
     *
     * Intended for UI side effects that do not belong in core adapter logic, e.g.:
     * - roving tabindex / focus synchronization,
     * - ARIA live region announcements,
     * - analytics/navigation instrumentation.
     *
     * @param {number} index - Flat index of the newly highlighted option.
     * @param {string} [id] - Optional DOM id of the highlighted view element (when available).
     * @returns {void}
     */
    public onHighlightChange(index: number, id?: string): void { }

    /**
     * Hook called whenever a group's collapsed state changes.
     *
     * Intended for integration side effects, e.g.:
     * - layout recalculation,
     * - popup resize,
     * - analytics.
     *
     * @param {GroupModel} model - The group whose collapsed state changed.
     * @param {boolean} collapsed - New collapsed state.
     * @returns {void}
     */
    public onCollapsedChange(model: GroupModel, collapsed: boolean): void { }
}