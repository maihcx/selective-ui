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
 * Adapter that can render a heterogeneous list composed of groups and options.
 *
 * Responsibilities:
 * - Build and maintain a flat list of options for navigation and visibility stats
 * - Create proper views based on item type (GroupView / OptionView)
 * - Bind view logic (events, image/label rendering, collapsed/expanded state)
 * - Track selection for both single and multiple-select modes
 * - Emit visibility-change statistics to subscribed listeners
 *
 * Lifecycle / Events:
 * - On `init()`: schedule a debounced visibility aggregation dispatcher
 * - On item changes: rebuild the flat structure and notify observers
 * - Delegates selection updates via the underlying `OptionModel` event hooks
 *
 * @extends {Adapter<MixedItem, GroupView | OptionView>}
 */
export class MixedAdapter extends Adapter<MixedItem, GroupView | OptionView> {
    /** Whether the adapter operates in multi-selection mode. */
    public isMultiple = false;

    /** Registered listeners for aggregated visibility statistics. */
    private visibilityChangedCallbacks: Array<(stats: VisibilityStats) => void> = [];

    /** Index (in the flat list) of the currently highlighted option. */
    private currentHighlightIndex = -1;

    /** Cached pointer to the single selected item in single-select mode. */
    private selectedItemSingle: OptionModel | null = null;

    /** Top-level group models (if any). */
    public groups: GroupModel[] = [];

    /** Flat list of all option models (including those inside groups). */
    public flatOptions: OptionModel[] = [];

    /**
     * Creates a MixedAdapter with an optional initial list of items.
     * Builds an initial flat structure for fast navigation and stats.
     *
     * @param items - Initial items (groups and/or options).
     */
    public constructor(items: MixedItem[] = []) {
        super(items);
        this.buildFlatStructure();
    }

    /**
     * Initializes internal scheduling for visibility-change notifications,
     * then calls the base lifecycle and mounts immediately.
     *
     * - Debounced `sche_vis_${adapterKey}` computes visibility aggregates
     *   and invokes all registered `visibilityChangedCallbacks`.
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
     * Builds / rebuilds a flat list of options and captures group references.
     *
     * The flat list is used for:
     * - navigation across visible options
     * - computing visibility statistics quickly
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
     * Factory method returning the appropriate view implementation per item type.
     *
     * @param parent - The container element where the view will be mounted.
     * @param item - The item to render (group or option).
     * @returns A new GroupView/OptionView instance based on the item type.
     */
    override viewHolder(parent: HTMLElement, item: MixedItem): GroupView | OptionView {
        if (item instanceof GroupModel) return new GroupView(parent);
        return new OptionView(parent);
    }

    /**
     * Binds a data model (group or option) to its view and delegates rendering
     * to specialized handlers.
     *
     * @param item - GroupModel or OptionModel.
     * @param viewer - The view instance that will render the model.
     * @param position - Position of the item in the top-level list.
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
     * Handles binding/rendering for a group:
     * - Sets header text and click-to-toggle behavior
     * - Observes collapsed state to hide/show child options
     * - Ensures each child option is rendered and bound
     * - Syncs collapsed state and visibility
     *
     * @param groupModel - Group data model.
     * @param groupView - Group view instance.
     * @param position - Group index.
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
     * Handles binding/rendering for an option:
     * - Applies adapter-wide and model-specific visual configuration (image, label alignment, etc.)
     * - Wires click/hover listeners for selection and highlighting
     * - Syncs selection state (single vs multiple)
     * - Updates image source/alt and label HTML
     *
     * @param optionModel - Option data model.
     * @param optionViewer - Option view instance.
     * @param position - Option index within its group list.
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
            const imageTag = optionViewer.view.tags.OptionImage as HTMLImageElement | null;
            if (imageTag) {
                if (imageTag.src !== optionModel.imageSrc) imageTag.src = optionModel.imageSrc;
                if (imageTag.alt !== optionModel.text) imageTag.alt = optionModel.text;
            }
        }

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

            optionModel.onSelected((_evtToken: IEventCallback, _el: OptionModel, _selected: boolean) => {
                this.changeProp("selected");
            });

            optionModel.onInternalSelected((_evtToken: IEventCallback, _el: OptionModel, selected: boolean) => {
                if (selected) this.selectedItemSingle = optionModel;
                this.changeProp("selected_internal");
            });

            optionModel.onVisibilityChanged((_evtToken: IEventCallback, model: OptionModel, _visible: boolean) => {
                model.group?.updateVisibility();
                this.notifyVisibilityChanged();
            });
        }

        if (optionModel.selected) {
            this.selectedItemSingle = optionModel;
            optionModel.selectedNonTrigger = true;
        }
    }

    /**
     * Replaces items and rebuilds the internal flat structure.
     * Emits the standard pre/post change notifications and updates lifecycle.
     *
     * @param items - New mixed item collection (groups/options).
     */
    override async setItems(items: MixedItem[]): Promise<void> {
        await this.changingProp("items", items);
        this.items = items;
        this.buildFlatStructure();
        await this.changeProp("items", items);
        this.update();
    }

    /**
     * Synchronizes items from an external source by delegating to `setItems()`.
     *
     * @param items - New mixed item collection (groups/options).
     */
    override async syncFromSource(items: MixedItem[]): Promise<void> {
        await this.setItems(items);
    }

    /**
     * Updates items and rebuilds the flat structure **without** firing change notifications.
     *
     * @param items - New mixed item collection (groups/options).
     */
    override updateData(items: MixedItem[]): void {
        this.items = items;
        this.buildFlatStructure();
        this.update();
    }

    /**
     * Destroys the adapter and cleans up:
     * - Clears visibility scheduler
     * - Destroys all groups (cascades to their items/views)
     * - Resets cached state and arrays
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
     * Returns all currently selected option items.
     *
     * @returns Array of selected options from the flat list.
     */
    public getSelectedItems(): OptionModel[] {
        return this.flatOptions.filter((item) => item.selected);
    }

    /**
     * Returns the first selected option (if any).
     *
     * @returns The first selected option; `undefined` if none.
     */
    public getSelectedItem(): OptionModel | undefined {
        return this.flatOptions.find((item) => item.selected);
    }

    /**
     * Checks/unchecks all options when in multiple selection mode.
     *
     * @param isChecked - `true` to select all; `false` to deselect all.
     */
    public checkAll(isChecked: boolean): void {
        if (!this.isMultiple) return;
        this.flatOptions.forEach((item) => {
            item.selected = isChecked;
        });
    }

    /**
     * Subscribes a callback to visibility changes across options.
     *
     * @param callback - Invoked with aggregated visibility stats.
     */
    public onVisibilityChanged(callback: (stats: VisibilityStats) => void): void {
        this.visibilityChangedCallbacks.push(callback);
    }

    /**
     * Schedules a visibility statistics recomputation and notifies subscribers.
     */
    private notifyVisibilityChanged(): void {
        Libs.callbackScheduler.run(`sche_vis_${this.adapterKey}`);
    }

    /**
     * Computes and returns current visibility statistics for options.
     *
     * @returns Aggregated stats: `{ visibleCount, totalCount, hasVisible, isEmpty }`.
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
     * Resets the highlight to the first visible option.
     */
    public resetHighlight(): void {
        this.setHighlight(0);
    }

    /**
     * Moves the highlight among visible options and optionally scrolls into view.
     *
     * @param direction - +1 to move forward; -1 to move backward.
     * @param isScrollToView - Whether to scroll the highlighted item into view. Defaults to `true`.
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
     * Triggers a click on the currently highlighted, visible option.
     * No-ops if nothing is highlighted or the item is hidden.
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
     * Highlights a target option (by flat index or model reference),
     * skipping invisible items and optionally scrolling into view.
     *
     * @param target - Flat index or OptionModel instance to highlight.
     * @param isScrollToView - Whether to scroll the highlighted item into view. Defaults to `true`.
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
     * Hook invoked whenever the highlighted item changes.
     * Override to handle UI side effects (e.g., ARIA announcement, focus sync).
     *
     * @param index - Flat index of the newly highlighted item.
     * @param id - Optional DOM id of the highlighted view element.
     */
    public onHighlightChange(index: number, id?: string): void { }

    /**
     * Hook invoked whenever a group's collapsed state changes.
     * Override to handle side effects (e.g., analytics, layout adjustments).
     *
     * @param model - The group whose collapsed state changed.
     * @param collapsed - New collapsed state.
     */
    public onCollapsedChange(model: GroupModel, collapsed: boolean): void { }
}