import { Model } from "../core/base/model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";
import type { GroupViewTags } from "../types/views/view.group.type";
import { GroupView } from "../views/group-view";
import { OptionModel } from "./option-model";
import type { IEventCallback } from "../types/utils/ievents.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * Model representing an `<optgroup>` with a label and a list of option items.
 *
 * Responsibilities:
 * - Mirror and synchronize state with the underlying `<optgroup>` element
 *   (label, collapsed state from dataset)
 * - Manage child `OptionModel` items and their back-reference to the group
 * - Expose derived data (selected/visible items, values)
 * - Notify listeners when the collapsed state changes
 *
 * Lifecycle:
 * - On `init()`: reads initial label/collapsed state from the target element
 * - On `update()`: syncs view (label + collapsed)
 * - On `destroy()`: destroys child items and clears references
 *
 * @extends {Model<HTMLOptGroupElement, GroupViewTags, GroupView, SelectiveOptions>}
 */
export class GroupModel extends Model<HTMLOptGroupElement, GroupViewTags, GroupView, SelectiveOptions> {
    /** Group label (mirrors `<optgroup>.label`). */
    public label = "";

    /** Child option items belonging to this group. */
    public items: OptionModel[] = [];

    /** Whether this group is collapsed (may be read from dataset). */
    public collapsed = false;

    /** Registered listeners for collapsed-state changes. */
    private privOnCollapsedChanged: Array<(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void> = [];

    /**
     * Creates a group model from config and an optional `<optgroup>` element.
     *
     * Reads the initial label and collapsed state from the element (if provided).
     *
     * @param options - Configuration for the model.
     * @param targetElement - Optional source `<optgroup>` element.
     */
    public constructor(options: SelectiveOptions, targetElement?: HTMLOptGroupElement) {
        super(options, targetElement ?? null, null);
    }
    
    /**
     * Initializes the model by reading the label and collapsed state
     * from the underlying `<optgroup>` (when available), then mounts.
     */
    public override init() {
        if (this.targetElement) {
            this.label = this.targetElement.label;
            this.collapsed = Libs.string2Boolean(this.targetElement.dataset?.collapsed);
        }

        super.init();
        this.mount();
    }

    /**
     * Returns the list of values for all option items within the group.
     */
    public get value(): string[] {
        return this.items.map((item) => item.value);
    }

    /**
     * Returns the subset of option items that are currently selected.
     */
    public get selectedItems(): OptionModel[] {
        return this.items.filter((item) => item.selected);
    }

    /**
     * Returns the subset of option items that are currently visible.
     */
    public get visibleItems(): OptionModel[] {
        return this.items.filter((item) => item.visible);
    }

    /**
     * Indicates whether there is at least one visible option in the group.
     */
    public get hasVisibleItems(): boolean {
        return this.visibleItems.length > 0;
    }

    /**
     * Updates the group's label from a new target element and propagates
     * the change to the view, then emits lifecycle update.
     *
     * @param targetElement - The updated `<optgroup>` element.
     */
    public updateTarget(targetElement: HTMLOptGroupElement): void {
        this.label = targetElement.label;
        this.view?.updateLabel(this.label);
        this.update();
    }

    /**
     * Lifecycle update hook.
     *
     * Keeps the view in sync with the current model state:
     * - Updates header label
     * - Applies the collapsed state
     */
    public override update(): void {
        if (this.view) {
            this.view.updateLabel(this.label);
            this.view.setCollapsed(this.collapsed);
        }
        super.update();
    }

    /**
     * Destroys the group model and releases resources.
     *
     * - Destroys all child option models
     * - Clears the items array
     * - Ends the lifecycle
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.items.forEach(item => {
            item.destroy();
        });

        this.items = [];
        super.destroy();
    }

    /**
     * Subscribes a listener to changes in the group's collapsed state.
     *
     * @param callback - Listener invoked with `(evtToken, model, collapsed)`.
     */
    public onCollapsedChanged(callback: (evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void): void {
        this.privOnCollapsedChanged.push(callback);
    }

    /**
     * Toggles the group's collapsed state, updates the view,
     * and notifies registered listeners.
     */
    public toggleCollapse(): void {
        this.collapsed = !this.collapsed;
        this.view?.setCollapsed(this.collapsed);

        iEvents.callEvent<[GroupModel, boolean]>([this, this.collapsed], ...this.privOnCollapsedChanged);
    }

    /**
     * Adds an option item to the group and sets its back-reference.
     *
     * @param optionModel - Option to add.
     */
    public addItem(optionModel: OptionModel): void {
        this.items.push(optionModel);
        optionModel.group = this;
    }

    /**
     * Removes an option item from the group and clears its back-reference.
     *
     * @param optionModel - Option to remove.
     */
    public removeItem(optionModel: OptionModel): void {
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
    public updateVisibility(): void {
        this.view?.updateVisibility();
    }
}