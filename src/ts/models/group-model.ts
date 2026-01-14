import { Model } from "../core/base/model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";
import type { GroupViewTags } from "../types/views/view.group.type";
import { GroupView } from "../views/group-view";
import { OptionModel } from "./option-model";
import type { IEventCallback } from "../types/utils/ievents.type";
import { DefaultConfig } from "../types/utils/istorage.type";

/**
 * @extends {Model<HTMLOptGroupElement, GroupViewTags, GroupView>}
 */
export class GroupModel extends Model<HTMLOptGroupElement, GroupViewTags, GroupView, DefaultConfig> {
    label = "";

    items: OptionModel[] = [];

    collapsed = false;

    private _privOnCollapsedChanged: Array<(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void> = [];

    /**
     * Initializes a group model with options and an optional <optgroup> target.
     * Reads the label and collapsed state from the target element's attributes/dataset.
     *
     * @param {DefaultConfig} options - Configuration for the model.
     * @param {HTMLOptGroupElement} [targetElement] - The source <optgroup> element.
     */
    constructor(options: DefaultConfig, targetElement?: HTMLOptGroupElement) {
        super(options, targetElement ?? null, null);

        if (targetElement) {
            this.label = targetElement.label;
            this.collapsed = Libs.string2Boolean(targetElement.dataset?.collapsed);
        }
    }

    /**
     * Returns the array of values from all option items within the group.
     *
     * @type {string[]}
     */
    get value(): string[] {
        return this.items.map((item) => item.value);
    }

    /**
     * Returns the list of option items currently selected within the group.
     *
     * @type {OptionModel[]}
     */
    get selectedItems(): OptionModel[] {
        return this.items.filter((item) => item.selected);
    }

    /**
     * Returns the list of option items currently visible within the group.
     *
     * @type {OptionModel[]}
     */
    get visibleItems(): OptionModel[] {
        return this.items.filter((item) => item.visible);
    }

    /**
     * Indicates whether the group has at least one visible option item.
     *
     * @type {boolean}
     */
    get hasVisibleItems(): boolean {
        return this.visibleItems.length > 0;
    }

    /**
     * Updates the group's label from the new target element and propagates the change to the view.
     *
     * @param {HTMLOptGroupElement} targetElement - The updated <optgroup> element.
     */
    update(targetElement: HTMLOptGroupElement): void {
        this.label = targetElement.label;
        this.view?.updateLabel(this.label);
    }

    /**
     * Hook invoked when the target element reference changes.
     * Updates the view's label and collapsed state to keep UI in sync.
     */
    onTargetChanged(): void {
        if (this.view) {
            this.view.updateLabel(this.label);
            this.view.setCollapsed(this.collapsed);
        }
    }

    /**
     * Registers a callback to be invoked when the group's collapsed state changes.
     *
     * @param {(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void} callback - Listener for collapse changes.
     */
    onCollapsedChanged(callback: (evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void): void {
        this._privOnCollapsedChanged.push(callback);
    }

    /**
     * Toggles the group's collapsed state, updates the view, and notifies registered listeners.
     */
    toggleCollapse(): void {
        this.collapsed = !this.collapsed;
        this.view?.setCollapsed(this.collapsed);

        iEvents.callEvent<[GroupModel, boolean]>([this, this.collapsed], ...this._privOnCollapsedChanged);
    }

    /**
     * Adds an option item to this group and sets its back-reference to the group.
     *
     * @param {OptionModel} optionModel - The option to add.
     */
    addItem(optionModel: OptionModel): void {
        this.items.push(optionModel);
        optionModel.group = this;
    }

    /**
     * Removes an option item from this group and clears its group reference.
     *
     * @param {OptionModel} optionModel - The option to remove.
     */
    removeItem(optionModel: OptionModel): void {
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
    updateVisibility(): void {
        this.view?.updateVisibility();
    }
}