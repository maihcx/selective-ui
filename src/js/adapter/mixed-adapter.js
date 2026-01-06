import { Adapter } from "../core/base/adapter";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { GroupView } from "../views/group-view";
import { OptionView } from "../views/option-view";

/**
 * @extends {Adapter<GroupModel|OptionModel>}
 */
export class MixedAdapter extends Adapter {
    isMultiple = false;
    #visibilityChangedCallbacks = [];
    #currentHighlightIndex = -1;
    /** @type {OptionModel} */
    #selectedItemSingle = null;

    /** @type {GroupModel[]} */
    groups = [];

    /** @type {OptionModel[]} */
    flatOptions = [];

    constructor(items = []) {
        super(items);
        this.#buildFlatStructure();
    }

    /**
     * Build flat list of all options for navigation
     */
    #buildFlatStructure() {
        this.flatOptions = [];
        this.groups = [];

        this.items.forEach(item => {
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
    viewHolder(parent, item) {
        if (item instanceof GroupModel) {
            return new GroupView(parent);
        } else {
            return new OptionView(parent);
        }
    }
    
    /**
     * Binds a data model (GroupModel or OptionModel) to its corresponding view
     * and delegates rendering logic based on the type of item.
     *
     * @param {GroupModel|OptionModel} item - The data model representing either a group or an option.
     * @param {GroupView|OptionView} viewer - The view instance that displays the item in the UI.
     * @param {number} position - The position (index) of the item within its parent list.
     */
    onViewHolder(item, viewer, position) {
        item.position = position;
        
        if (item instanceof GroupModel) {
            this.#handleGroupView(item, /** @type {GroupView} */ (viewer), position);
        } else if (item instanceof OptionModel) {
            this.#handleOptionView(item, /** @type {OptionView} */ (viewer), position);
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
    #handleGroupView(groupModel, groupView, position) {
        super.onViewHolder(groupModel, groupView, position);
        groupModel.view = groupView;

        const header = groupView.getTag("GroupHeader");
        header.textContent = groupModel.label;

        if (!groupModel.isInit) {
            header.style.cursor = "pointer";
            header.addEventListener("click", () => {
                groupModel.toggleCollapse();
            });

            groupModel.onCollapsedChanged((evtToken, model, collapsed) => {
                model.items.forEach(optItem => {
                    const optView = optItem.view?.getView();
                    if (optView) {
                        optView.style.display = collapsed ? "none" : "";
                    }
                });
                this.onCollapsedChange(model, collapsed);
            });
        }

        const itemsContainer = groupView.getItemsContainer();
        groupModel.items.forEach((optionModel, idx) => {
            let optionViewer = optionModel.view;
            if (!optionModel.isInit) {
                optionViewer = new OptionView(itemsContainer);
            }
            this.#handleOptionView(optionModel, optionViewer, idx);
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
    #handleOptionView(optionModel, optionViewer, position) {
        optionViewer.isMultiple = this.isMultiple;
        optionViewer.hasImage = optionModel.hasImage;
        optionViewer.optionConfig = {
            imageWidth: optionModel.options.imageWidth,
            imageHeight: optionModel.options.imageHeight,
            imageBorderRadius: optionModel.options.imageBorderRadius,
            imagePosition: optionModel.options.imagePosition,
            labelValign: optionModel.options.labelValign,
            labelHalign: optionModel.options.labelHalign
        };

        if (!optionModel.isInit) {
            super.onViewHolder(optionModel, optionViewer, position);
        } else {
            optionViewer.update();
        }

        optionModel.view = optionViewer;

        if (optionModel.hasImage) {
            const imageTag = optionViewer.getTag("OptionImage");
            if (imageTag) {
                imageTag.src = optionModel.imageSrc;
                imageTag.alt = optionModel.text;
            }
        }

        optionViewer.getTag("LabelContent").innerHTML = optionModel.text;

        if (!optionModel.isInit) {
            optionViewer.getTag("OptionView").addEventListener("click", (ev) => {
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
                        if (this.#selectedItemSingle) {
                            this.#selectedItemSingle.selected = false;
                        }
                        optionModel.selected = true;
                    }, 5);
                }
            });

            optionViewer.getTag("OptionView").title = optionModel.textContent;

            optionViewer.getTag("OptionView").addEventListener("mouseenter", () => {
                if (this.isSkipEvent) return;
                this.setHighlight(this.flatOptions.indexOf(optionModel), false);
            });

            optionModel.onSelected((evtToken, el, selected) => {
                this.changeProp("selected");
            });

            optionModel.onInternalSelected((evtToken, el, selected) => {
                if (selected) {
                    this.#selectedItemSingle = optionModel;
                }
                this.changeProp("selected_internal");
            });

            optionModel.onVisibilityChanged((evtToken, model, visible) => {
                if (model.group) {
                    model.group.updateVisibility();
                }
                this.#notifyVisibilityChanged();
            });
        }

        if (optionModel.selected) {
            this.#selectedItemSingle = optionModel;
            optionModel.selectedNonTrigger = true;
        }
    }
    
    /**
     * Updates the list of items in the component and rebuilds its internal flat structure.
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to be displayed.
     */
    setItems(items) {
        this.changingProp("items", items);
        this.items = items;
        this.#buildFlatStructure();
        this.changeProp("items", items);
    }
    
    /**
     * Synchronizes the component's items from an external source by delegating to setItems().
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to sync.
     */
    syncFromSource(items) {
        this.setItems(items);
    }
    
    /**
     * Updates the component's data items and rebuilds the internal flat structure
     * without triggering change notifications.
     *
     * @param {Array<GroupModel|OptionModel>} items - The new collection of items to update.
     */
    updateData(items) {
        this.items = items;
        this.#buildFlatStructure();
    }
    
    /**
     * Returns all option items that are currently selected.
     *
     * @returns {OptionModel[]} - An array of selected option items from the flat list.
     */
    getSelectedItems() {
        return this.flatOptions.filter(item => item.selected);
    }

    /**
     * Returns the first selected option item, if any.
     *
     * @returns {OptionModel|undefined} - The first selected option or undefined if none are selected.
     */
    getSelectedItem() {
        return this.flatOptions.find(item => item.selected);
    }

    /**
     * Checks or unchecks all options when in multiple selection mode.
     *
     * @param {boolean} isChecked - If true, select all; if false, deselect all.
     */
    checkAll(isChecked) {
        if (this.isMultiple) {
            this.flatOptions.forEach(item => {
                item.selected = isChecked;
            });
        }
    }

    /**
     * Subscribes a callback to visibility changes across options.
     *
     * @param {(stats: {visibleCount:number,totalCount:number,hasVisible:boolean,isEmpty:boolean}) => void} callback
     *        - Function to invoke when visibility stats change.
     */
    onVisibilityChanged(callback) {
        this.#visibilityChangedCallbacks.push(callback);
    }

    /**
     * Notifies all registered visibility-change callbacks with up-to-date statistics.
     * Computes visible and total counts, then emits aggregated state.
     */
    #notifyVisibilityChanged() {
        const visibleCount = this.flatOptions.filter(item => item.visible).length;
        const totalCount = this.flatOptions.length;

        this.#visibilityChangedCallbacks.forEach(callback => {
            callback({
                visibleCount,
                totalCount,
                hasVisible: visibleCount > 0,
                isEmpty: totalCount === 0
            });
        });
    }

    /**
     * Computes and returns current visibility statistics for options.
     *
     * @returns {{visibleCount:number,totalCount:number,hasVisible:boolean,isEmpty:boolean}}
     *          - Aggregated visibility information.
     */
    getVisibilityStats() {
        const visibleCount = this.flatOptions.filter(item => item.visible).length;
        const totalCount = this.flatOptions.length;

        return {
            visibleCount,
            totalCount,
            hasVisible: visibleCount > 0,
            isEmpty: totalCount === 0
        };
    }

    /**
     * Resets the highlight to the first visible option (index 0).
     */
    resetHighlight() {
        this.setHighlight(0);
    }

    /**
     * Moves the highlight forward/backward among visible options and optionally scrolls into view.
     *
     * @param {number} direction - Increment (+1) or decrement (-1) of the current visible index.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     */
    navigate(direction, isScrollToView = true) {
        const visibleOptions = this.flatOptions.filter(opt => opt.visible);
        if (visibleOptions.length === 0) return;

        let currentVisibleIndex = visibleOptions.findIndex(
            opt => opt === this.flatOptions[this.#currentHighlightIndex]
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
    selectHighlighted() {
        if (this.#currentHighlightIndex > -1 && this.flatOptions[this.#currentHighlightIndex]) {
            const item = this.flatOptions[this.#currentHighlightIndex];
            if (item.visible) {
                const viewEl = item.view?.getView();
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
    setHighlight(target, isScrollToView = true) {
        let index = 0;
        if (typeof target === "number") {
            index = target;
        } else if (target instanceof OptionModel) {
            const fi = this.flatOptions.indexOf(target);
            index = fi > -1 ? fi : 0;
        } else {
            index = 0;
        }
        
        if (this.#currentHighlightIndex > -1 && this.flatOptions[this.#currentHighlightIndex]) {
            this.flatOptions[this.#currentHighlightIndex].highlighted = false;
        }

        for (let i = index; i < this.flatOptions.length; i++) {
            const item = this.flatOptions[i];
            if (item.visible) {
                item.highlighted = true;
                this.#currentHighlightIndex = i;

                if (isScrollToView) {
                    const el = item.view?.getView();
                    if (el) {
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                }

                this.onHighlightChange(i, item.view?.getView()?.id);
                return;
            }
        }
    }

    /**
     * Hook invoked whenever the highlight changes.
     * Override to handle UI side effects (e.g., ARIA announcement, focus sync).
     *
     * @param {number} index - The flat index of the newly highlighted item.
     * @param {string|undefined} id - The DOM id of the highlighted item's view, if available.
     */
    onHighlightChange(index, id) {}

    
    /**
     * Hook invoked when a group's collapsed state changes.
     * Override to handle side effects like analytics or layout adjustments.
     *
     * @param {GroupModel} model - The group whose collapsed state changed.
     * @param {boolean} collapsed - The new collapsed state.
     */
    onCollapsedChange(model, collapsed) {}
}