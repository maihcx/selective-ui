import { Model } from "../core/base/model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";
import { GroupView } from "../views/group-view";
import { OptionModel } from "./option-model";

/**
 * @extends {Model<HTMLOptGroupElement, GroupViewTags, GroupView>}
 */
export class GroupModel extends Model {
    label = "";
    /** @type {OptionModel[]} */
    items = [];
    collapsed = false;
    #privOnCollapsedChanged = [];

    /**
     * Initializes a group model with options and an optional <optgroup> target.
     * Reads the label and collapsed state from the target element's attributes/dataset.
     *
     * @param {object} options - Configuration for the model.
     * @param {HTMLOptGroupElement} [targetElement] - The source <optgroup> element.
     */
    constructor(options, targetElement) {
        super(options, targetElement);
        if (targetElement) {
            this.label = targetElement.label;
            this.collapsed = Libs.string2Boolean(targetElement.dataset?.collapsed);
        }
    }

    /**
     * Returns the array of values from all option items within the group.
     *
     * @type {String[]}
     */
    get value() {
        return this.items.map(item => item.value);
    }

    /**
     * Returns the list of option items currently selected within the group.
     *
     * @type {OptionModel[]}
     */
    get selectedItems() {
        return this.items.filter(item => item.selected);
    }

    /**
     * Returns the list of option items currently visible within the group.
     *
     * @type {OptionModel[]}
     */
    get visibleItems() {
        return this.items.filter(item => item.visible);
    }

    /**
     * Indicates whether the group has at least one visible option item.
     *
     * @type {boolean}
     */
    get hasVisibleItems() {
        return this.visibleItems.length > 0;
    }

    /**
     * Updates the group's label from the new target element and propagates the change to the view.
     *
     * @param {HTMLOptGroupElement} targetElement - The updated <optgroup> element.
     */
    update(targetElement) {
        this.label = targetElement.label;
        if (this.view) {
            this.view.updateLabel(this.label);
        }
    }

    /**
     * Hook invoked when the target element reference changes.
     * Updates the view's label and collapsed state to keep UI in sync.
     */
    onTargetChanged() {
        if (this.view) {
            this.view.updateLabel(this.label);
            this.view.setCollapsed(this.collapsed);
        }
    }

    /**
     * Registers a callback to be invoked when the group's collapsed state changes.
     *
     * @param {(evtToken: any, model: GroupModel, collapsed: boolean) => void} callback - Listener for collapse changes.
     */
    onCollapsedChanged(callback) {
        this.#privOnCollapsedChanged.push(callback);
    }

    /**
     * Toggles the group's collapsed state, updates the view, and notifies registered listeners.
     */
    toggleCollapse() {
        this.collapsed = !this.collapsed;
        if (this.view) {
            this.view.setCollapsed(this.collapsed);
        }
        iEvents.callEvent([this, this.collapsed], ...this.#privOnCollapsedChanged);
    }

    /**
     * Adds an option item to this group and sets its back-reference to the group.
     *
     * @param {OptionModel} optionModel - The option to add.
     */
    addItem(optionModel) {
        this.items.push(optionModel);
        optionModel.group = this;
    }

    /**
     * Removes an option item from this group and clears its group reference.
     *
     * @param {OptionModel} optionModel - The option to remove.
     */
    removeItem(optionModel) {
        const index = this.items.indexOf(optionModel);
        if (index > -1) {
            this.items.splice(index, 1);
            optionModel.group = null;
        }
    }

    /**
     * Updates the group's visibility in the view, typically based on children visibility.
     * No-ops if the view is not initialized.
     */
    updateVisibility() {
        if (this.view) {
            this.view.updateVisibility();
        }
    }
}