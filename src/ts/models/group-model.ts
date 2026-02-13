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
 * Domain model for a native `<optgroup>` element.
 *
 * This model represents a **group header** plus its **child options** and is used by
 * adapters/recyclers to render grouped lists (e.g., {@link GroupView} + {@link OptionModel} rows).
 *
 * ### Responsibility
 * - Mirror and synchronize state derived from the backing `<optgroup>`:
 *   - `label` from `optgroup.label`
 *   - `collapsed` from `optgroup.dataset.collapsed` (string → boolean)
 * - Own and manage the group’s child {@link OptionModel} collection, including back-references.
 * - Provide derived selectors for consumer logic: `value`, `selectedItems`, `visibleItems`, `hasVisibleItems`.
 * - Emit collapsed-state change notifications to subscribers via `onCollapsedChanged(...)`.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor delegates to {@link Model} and initializes base lifecycle (`NEW → INITIALIZED`).
 * - {@link init} reads initial state from the target element and transitions to `MOUNTED`.
 * - {@link update} keeps the attached {@link GroupView} in sync (label + collapsed state).
 * - {@link destroy} destroys all child options and transitions to `DESTROYED` (idempotent).
 *
 * ### Relationships
 * - **Model ↔ View**: `view` (when assigned) is a {@link GroupView} responsible for DOM updates.
 * - **Group ↔ Options**: `items` contains child {@link OptionModel}s; each option holds `option.group`.
 * - **Adapter/Recycler**: binders (e.g., MixedAdapter) call `addItem/removeItem`, set `view`,
 *   and invoke {@link updateVisibility} based on filtering/virtualization outcomes.
 *
 * ### Events / Hooks
 * - Collapsed changes are dispatched through {@link iEvents.callEvent} to callbacks registered via
 *   {@link onCollapsedChanged}. These callbacks receive an `evtToken` for iEvents chaining/cancellation,
 *   the model, and the new collapsed state.
 *
 * @extends {Model<HTMLOptGroupElement, GroupViewTags, GroupView, SelectiveOptions>}
 * @see {@link OptionModel}
 * @see {@link GroupView}
 */
export class GroupModel extends Model<HTMLOptGroupElement, GroupViewTags, GroupView, SelectiveOptions> {
    /** Group label (mirrors `HTMLSelectOptGroupElement.label`). */
    public label = "";

    /**
     * Child option models that belong to this group.
     *
     * Ownership: this group destroys its children in {@link destroy}.
     */
    public items: OptionModel[] = [];

    /**
     * Whether this group is collapsed.
     *
     * Source-of-truth:
     * - Initialized from `targetElement.dataset.collapsed` (string → boolean).
     * - Toggled via {@link toggleCollapse}.
     */
    public collapsed = false;

    /**
     * Subscribers invoked when collapsed state changes.
     * Callbacks are invoked through {@link iEvents.callEvent}.
     */
    private privOnCollapsedChanged: Array<(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void> = [];

    /**
     * Creates a group model from configuration and an optional `<optgroup>` element.
     *
     * @param {SelectiveOptions} options - Shared configuration for models/views.
     * @param {HTMLOptGroupElement} [targetElement] - Backing `<optgroup>` element (when available).
     */
    public constructor(options: SelectiveOptions, targetElement?: HTMLOptGroupElement) {
        super(options, targetElement ?? null, null);
        this.label = this.targetElement.label;
        this.collapsed = Libs.string2Boolean(this.targetElement.dataset?.collapsed);
    }

    /**
     * Initializes group state from the backing `<optgroup>` (if present) and mounts the model.
     *
     * Behavior:
     * - Reads `label` from `targetElement.label`.
     * - Reads `collapsed` from `targetElement.dataset.collapsed` via {@link Libs.string2Boolean}.
     * - Calls `super.init()` then transitions to `MOUNTED` via `mount()`.
     *
     * Idempotency:
     * - Base {@link Model}/{@link Lifecycle} guards prevent duplicate `init()` transitions.
     *
     * @returns {void}
     * @override
     */
    public override init(): void {
        super.init();
        this.mount();
    }

    /**
     * Returns all option values within this group.
     *
     * @returns {string[]} Values of all child options (in current `items` order).
     */
    public get value(): string[] {
        return this.items.map((item) => item.value);
    }

    /**
     * Returns the subset of child options that are currently selected.
     *
     * @returns {OptionModel[]} Selected child options.
     */
    public get selectedItems(): OptionModel[] {
        return this.items.filter((item) => item.selected);
    }

    /**
     * Returns the subset of child options that are currently visible.
     *
     * Visibility is typically controlled by filtering/search (e.g., toggling `OptionModel.visible`).
     *
     * @returns {OptionModel[]} Visible child options.
     */
    public get visibleItems(): OptionModel[] {
        return this.items.filter((item) => item.visible);
    }

    /**
     * Whether the group has at least one visible option.
     *
     * @returns {boolean} True if any child option is visible.
     */
    public get hasVisibleItems(): boolean {
        return this.visibleItems.length > 0;
    }

    /**
     * Rebinds this model to a new `<optgroup>` element and synchronizes the label immediately.
     *
     * Notes:
     * - This method updates the label and pushes it to the view, then triggers a lifecycle update.
     * - The signature is intentionally stricter than the base model (`HTMLOptGroupElement` only).
     *
     * @param {HTMLOptGroupElement} targetElement - Updated backing `<optgroup>` element.
     * @returns {void}
     */
    public updateTarget(targetElement: HTMLOptGroupElement): void {
        this.label = targetElement.label;
        this.view?.updateLabel(this.label);
        this.update();
    }

    /**
     * Synchronizes the attached view (if any) with current model state and emits lifecycle update.
     *
     * View sync:
     * - Updates header label
     * - Applies collapsed state
     *
     * @returns {void}
     * @override
     */
    public override update(): void {
        if (this.view) {
            this.view.updateLabel(this.label);
            this.view.setCollapsed(this.collapsed);
        }
        super.update();
    }

    /**
     * Destroys the group model and releases owned resources.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Destroys all child {@link OptionModel} instances.
     * - Clears the `items` array.
     * - Completes lifecycle teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
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
     * Subscribes to changes in the group's collapsed state.
     *
     * Callbacks are invoked from {@link toggleCollapse} via {@link iEvents.callEvent}.
     *
     * @param {(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void} callback
     * Listener invoked with `(evtToken, model, collapsed)`.
     * @returns {void}
     */
    public onCollapsedChanged(callback: (evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void): void {
        this.privOnCollapsedChanged.push(callback);
    }

    /**
     * Toggles collapsed state, updates the view, and notifies subscribers.
     *
     * Side effects:
     * - Mutates {@link collapsed}.
     * - Calls `view.setCollapsed(...)` if a view is attached.
     * - Dispatches callbacks registered via {@link onCollapsedChanged}.
     *
     * @returns {void}
     */
    public toggleCollapse(): void {
        this.collapsed = !this.collapsed;
        this.view?.setCollapsed(this.collapsed);

        iEvents.callEvent<[GroupModel, boolean]>([this, this.collapsed], ...this.privOnCollapsedChanged);
    }

    /**
     * Adds a child option to this group and sets the option's back-reference.
     *
     * @param {OptionModel} optionModel - Option to add.
     * @returns {void}
     */
    public addItem(optionModel: OptionModel): void {
        this.items.push(optionModel);
        optionModel.group = this;
    }

    /**
     * Removes a child option from this group and clears the option's back-reference.
     *
     * No-op if the option is not present in {@link items}.
     *
     * @param {OptionModel} optionModel - Option to remove.
     * @returns {void}
     */
    public removeItem(optionModel: OptionModel): void {
        const index = this.items.indexOf(optionModel);
        if (index > -1) {
            this.items.splice(index, 1);
            optionModel.group = null;
        }
    }

    /**
     * Requests the attached view (if any) to recompute/update its visibility.
     *
     * Typically called after child visibility changes (filter/search) so the group header can
     * reflect whether it contains visible items.
     *
     * No-op if no view is attached.
     *
     * @returns {void}
     */
    public updateVisibility(): void {
        this.view?.updateVisibility();
    }
}