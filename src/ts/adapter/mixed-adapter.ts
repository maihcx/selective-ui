import { Adapter } from "../core/base/adapter";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { GroupView } from "../views/group-view";
import { OptionView } from "../views/option-view";
import { MixedItem, VisibilityStats } from "../types/core/base/mixed-adapter.type";
import { IEventCallback } from "../types/utils/ievents.type";
import { ImagePosition, LabelHalign, LabelValign } from "../types/views/view.option.type";

/**
 * @extends {Adapter<GroupModel|OptionModel>}
 */
export class MixedAdapter extends Adapter<MixedItem, GroupView | OptionView> {
    isMultiple = false;

    private _visibilityChangedCallbacks: Array<(stats: VisibilityStats) => void> = [];
    private _currentHighlightIndex = -1;

    private _selectedItemSingle: OptionModel | null = null;

    groups: GroupModel[] = [];

    flatOptions: OptionModel[] = [];

    constructor(items: MixedItem[] = []) {
        super(items);
        this._buildFlatStructure();
    }

    /**
     * Build flat list of all options for navigation
     */
    private _buildFlatStructure(): void {
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
     * Creates and returns the appropriate view instance for the given item type.
     *
     * @param {HTMLElement} parent - The parent container element where the view will be attached.
     * @param {GroupModel|OptionModel} item - The data model representing either a group or an option.
     * @returns {GroupView|OptionView} - A new view instance corresponding to the item type.
     */
    override viewHolder(parent: HTMLElement, item: MixedItem): GroupView | OptionView {
        if (item instanceof GroupModel) return new GroupView(parent);
        return new OptionView(parent);
    }

    /**
     * Binds a data model (GroupModel or OptionModel) to its corresponding view
     * and delegates rendering logic based on the type of item.
     *
     * @param {GroupModel|OptionModel} item - The data model representing either a group or an option.
     * @param {GroupView|OptionView|null} viewer - The view instance that displays the item in the UI.
     * @param {number} position - The position (index) of the item within its parent list.
     */
    override onViewHolder(item: MixedItem, viewer: GroupView | OptionView | null, position: number): void {
        item.position = position;

        if (item instanceof GroupModel) {
            this._handleGroupView(item, viewer as GroupView, position);
        } else if (item instanceof OptionModel) {
            this._handleOptionView(item, viewer as OptionView, position);
        }

        item.isInit = true;
    }

    /**
     * Handles binding and rendering logic for a group view, including header behavior,
     * collapse/expand state, and initialization of option items.
     *
     * @param {GroupModel} groupModel - The data model representing the group and its items.
     * @param {GroupView} groupView - The view instance that renders the group in the UI.
     * @param {number} position - The position (index) of the group within a list.
     */
    private _handleGroupView(groupModel: GroupModel, groupView: GroupView, position: number): void {
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

            this._handleOptionView(optionModel, optionViewer, idx);
            optionModel.isInit = true;
        });

        groupView.setCollapsed(groupModel.collapsed);
        groupView.updateVisibility();
    }

    /**
     * Handles binding and rendering logic for an option item, including image setup,
     * label rendering, event wiring, and selection state synchronization.
     *
     * @param {OptionModel} optionModel - The data model representing a single option.
     * @param {OptionView} optionViewer - The view instance that renders the option in the UI.
     * @param {number} position - The index of this option within its group's item list.
     */
    private _handleOptionView(optionModel: OptionModel, optionViewer: OptionView, position: number): void {
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
            optionViewer.view.tags.OptionView.addEventListener("click", (ev: MouseEvent) => {
                ev.stopPropagation();
                ev.preventDefault();

                if (this.isSkipEvent) return;

                if (this.isMultiple) {
                    this.changingProp("select");
                    setTimeout(() => {
                        optionModel.selected = !optionModel.selected;
                    }, 5);
                } else if (optionModel.selected !== true) {
                    this.changingProp("select");
                    setTimeout(() => {
                        if (this._selectedItemSingle) this._selectedItemSingle.selected = false;
                        optionModel.selected = true;
                    }, 5);
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
                if (selected) this._selectedItemSingle = optionModel;
                this.changeProp("selected_internal");
            });

            optionModel.onVisibilityChanged((_evtToken: IEventCallback, model: OptionModel, _visible: boolean) => {
                model.group?.updateVisibility();
                this._notifyVisibilityChanged();
            });
        }

        if (optionModel.selected) {
            this._selectedItemSingle = optionModel;
            optionModel.selectedNonTrigger = true;
        }
    }

    /**
     * Updates the list of items in the component and rebuilds its internal flat structure.
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to be displayed.
     */
    override setItems(items: MixedItem[]): void {
        this.changingProp("items", items);
        this.items = items;
        this._buildFlatStructure();
        this.changeProp("items", items);
    }

    /**
     * Synchronizes the component's items from an external source by delegating to setItems().
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to sync.
     */
    override syncFromSource(items: MixedItem[]): void {
        this.setItems(items);
    }

    /**
     * Updates the component's data items and rebuilds the internal flat structure
     * without triggering change notifications.
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to update.
     */
    override updateData(items: MixedItem[]): void {
        this.items = items;
        this._buildFlatStructure();
    }

    /**
     * Returns all option items that are currently selected.
     *
     * @returns {OptionModel[]} - An array of selected option items from the flat list.
     */
    getSelectedItems(): OptionModel[] {
        return this.flatOptions.filter((item) => item.selected);
    }

    /**
     * Returns the first selected option item, if any.
     *
     * @returns {OptionModel|undefined} - The first selected option or undefined if none are selected.
     */
    getSelectedItem(): OptionModel | undefined {
        return this.flatOptions.find((item) => item.selected);
    }

    /**
     * Checks or unchecks all options when in multiple selection mode.
     *
     * @param {boolean} isChecked - If true, select all; if false, deselect all.
     */
    checkAll(isChecked: boolean): void {
        if (!this.isMultiple) return;
        this.flatOptions.forEach((item) => {
            item.selected = isChecked;
        });
    }

    /**
     * Subscribes a callback to visibility changes across options.
     *
     * @param {(stats: {visibleCount:number,totalCount:number,hasVisible:boolean,isEmpty:boolean}) => void} callback
     * - Function to invoke when visibility stats change.
     */
    onVisibilityChanged(callback: (stats: VisibilityStats) => void): void {
        this._visibilityChangedCallbacks.push(callback);
    }

    /**
     * Notifies all registered visibility-change callbacks with up-to-date statistics.
     * Computes visible and total counts, then emits aggregated state.
     */
    private _notifyVisibilityChanged(): void {
        const visibleCount = this.flatOptions.filter((item) => item.visible).length;
        const totalCount = this.flatOptions.length;

        this._visibilityChangedCallbacks.forEach((callback) => {
            callback({
                visibleCount,
                totalCount,
                hasVisible: visibleCount > 0,
                isEmpty: totalCount === 0,
            });
        });
    }

    /**
     * Computes and returns current visibility statistics for options.
     */
    getVisibilityStats(): VisibilityStats {
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
     * Resets the highlight to the first visible option (index 0).
     */
    resetHighlight(): void {
        this.setHighlight(0);
    }

    /**
     * Moves the highlight forward/backward among visible options and optionally scrolls into view.
     *
     * @param {number} direction - Increment (+1) or decrement (-1) of the current visible index.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     */
    navigate(direction: number, isScrollToView: boolean = true): void {
        const visibleOptions = this.flatOptions.filter((opt) => opt.visible);
        if (visibleOptions.length === 0) return;

        let currentVisibleIndex = visibleOptions.findIndex(
            (opt) => opt === this.flatOptions[this._currentHighlightIndex]
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
     * Triggers a click on the currently highlighted and visible option to select it.
     * No-op if nothing is highlighted or the highlighted item is not visible.
     */
    selectHighlighted(): void {
        if (this._currentHighlightIndex > -1 && this.flatOptions[this._currentHighlightIndex]) {
            const item = this.flatOptions[this._currentHighlightIndex];
            if (item.visible) {
                const viewEl = item.view?.getView?.();
                if (viewEl) viewEl.click();
            }
        }
    }

    /**
     * Highlights a target option by flat index or model instance, skipping invisible items,
     * and optionally scrolls the highlighted element into view.
     *
     * @param {number|OptionModel} target - Flat index or the specific OptionModel to highlight.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     */
    setHighlight(target: number | OptionModel, isScrollToView: boolean = true): void {
        let index = 0;

        if (typeof target === "number") {
            index = target;
        } else if (target instanceof OptionModel) {
            const fi = this.flatOptions.indexOf(target);
            index = fi > -1 ? fi : 0;
        } else {
            index = 0;
        }

        if (this._currentHighlightIndex > -1 && this.flatOptions[this._currentHighlightIndex]) {
            this.flatOptions[this._currentHighlightIndex].highlighted = false;
        }

        for (let i = index; i < this.flatOptions.length; i++) {
            const item = this.flatOptions[i];
            if (!item?.visible) continue;

            item.highlighted = true;
            this._currentHighlightIndex = i;

            if (isScrollToView) {
                const el = item.view?.getView?.();
                if (el) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                } else {
                    this.recyclerView?.ensureRendered?.(i, { scrollIntoView: true });
                }
            }

            this.onHighlightChange(i, item.view?.getView?.()?.id);
            return;
        }
    }

    /**
     * Hook invoked whenever the highlight changes.
     * Override to handle UI side effects (e.g., ARIA announcement, focus sync).
     */
    onHighlightChange(index: number, id?: string): void { }

    /**
     * Hook invoked when a group's collapsed state changes.
     * Override to handle side effects like analytics or layout adjustments.
     */
    onCollapsedChange(model: GroupModel, collapsed: boolean): void { }
}