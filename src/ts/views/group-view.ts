import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type { GroupViewTags, GroupViewResult } from "../types/views/view.group.type";
import { SelectiveOptions } from "../types/utils/selective.type";

/**
 * GroupView
 *
 * View implementation for rendering grouped collections of selectable items.
 *
 * ### Responsibility
 * - Renders a semantic group structure: header (label) + items container.
 * - Manages group-level visibility based on child item state.
 * - Supports collapse/expand interactions with accessibility annotations.
 * - Provides typed access to DOM structure via {@link view}.
 *
 * ### Structure
 * ```
 * GroupView (root)
 *   ├─ GroupHeader (label, role="presentation")
 *   └─ GroupItems (container, role="group")
 * ```
 *
 * ### Lifecycle (View-based FSM)
 * - **Construction**: Accepts parent container, transitions `NEW → INITIALIZED`.
 * - **{@link mount}**: Creates DOM structure, appends to parent, transitions `INITIALIZED → MOUNTED`.
 * - **{@link update}**: Refreshes group header label, transitions `MOUNTED → UPDATED → MOUNTED`.
 * - **{@link destroy}**: Removes DOM nodes, transitions to `DESTROYED`.
 *
 * ### Visibility semantics
 * - {@link updateVisibility} hides the entire group when all child items are hidden.
 * - Checks for `"hide"` class on children (does not inspect `display` or `visibility` styles).
 *
 * ### Accessibility
 * - Root container: `role="group"`, `aria-labelledby` points to header.
 * - Header: `role="presentation"`, unique ID for labeling.
 * - Items container: `role="group"` (nested group).
 * - Collapse state: `aria-expanded` attribute on header (managed by {@link setCollapsed}).
 *
 * ### DOM side effects
 * - {@link mount} creates and appends DOM structure.
 * - {@link updateLabel} mutates header `textContent`.
 * - {@link setCollapsed} toggles CSS classes and ARIA attributes.
 * - {@link updateVisibility} toggles `"hide"` class on root.
 *
 * ### No-op / Idempotency
 * - {@link updateLabel}, {@link updateVisibility}, {@link setCollapsed} are no-ops if not mounted (early return guards).
 * - Safe to call multiple times without side effects beyond DOM state updates.
 *
 * @extends View<GroupViewTags>
 * @template GroupViewTags - Type descriptor for the group's DOM structure.
 * @see {@link GroupViewResult}
 * @see {@link View}
 */
export class GroupView extends View<GroupViewTags> {

    /**
     * Strongly-typed reference to the mounted group view structure.
     *
     * Structure:
     * - **view**: Root container element.
     * - **tags**: Named references to header and items container.
     *
     * Lifecycle:
     * - `null` until {@link mount} completes.
     * - Cleared during {@link destroy}.
     *
     * @public
     */
    public view: GroupViewResult | null = null;

    /**
     * Parsed configuration (bound from the `<select>` element via binder map).
     *
     * Provides feature flags (multiple/disabled/readonly/visible/virtualScroll/ajax/autoclose…),
     * a11y ids (e.g. `SEID_LIST`, `SEID_HOLDER`) and user callbacks under `options.on`.
     *
     * @internal
     */
    private options: SelectiveOptions | null = null;

    /**
     * Creates a new GroupView bound to the given parent element.
     *
     * Initialization flow:
     * 1. Calls `super(parent)` (View base constructor).
     *
     * @public
     * @param {HTMLElement} parent - Container element that will host this group view.
     * @param {SelectiveOptions} options - Optional configuration for this group view.
     */
    public constructor(parent: HTMLElement, options?: SelectiveOptions) {
        super(parent);
        this.options = options;
    }

    /**
     * Mounts the group view into the DOM.
     *
     * Creation flow:
     * 1. Generates unique group ID (7-character random string).
     * 2. Creates DOM structure via {@link Libs.mountNode}:
     *    - Root: `<div role="group" aria-labelledby="seui-{this.options?.SEID || default}-{id}-header">`
     *    - Header: `<div role="presentation" id="seui-{this.options?.SEID || default}-{id}-header">`
     *    - Items: `<div role="group">` (nested group for child items)
     * 3. Appends root to {@link parent} container.
     * 4. Transitions `INITIALIZED → MOUNTED` via `super.mount()`.
     *
     * Accessibility setup:
     * - Root `aria-labelledby` associates group with header text.
     * - Header `role="presentation"` hides it from navigation (purely visual label).
     * - Items container `role="group"` creates semantic boundary for children.
     *
     * Postcondition:
     * - {@link view} is populated with typed DOM references.
     *
     * @public
     * @returns {void}
     * @override
     * @throws {Error} If {@link parent} is null (should never occur due to base `View` constructor).
     */
    public override mount(): void {
        const group_id = Libs.randomString(7);

        this.view = Libs.mountNode<GroupViewResult>({
            GroupView: {
                tag: {
                    node: "div",
                    classList: ["seui-group"],
                    role: "group",
                    ariaLabelledby: `seui-${this.options?.SEID || "default"}-${group_id}-header`,
                    id: `seui-${this.options?.SEID || "default"}-${group_id}-group`,
                },
                child: {
                    GroupHeader: {
                        tag: {
                            node: "div",
                            classList: ["seui-group-header"],
                            role: "presentation",
                            id: `seui-${this.options?.SEID || "default"}-${group_id}-header`,
                        },
                    },
                    GroupItems: {
                        tag: {
                            node: "div",
                            classList: ["seui-group-items"],
                            role: "group",
                        },
                    },
                },
            },
        });

        // Parent is guaranteed to exist by the base View constructor.
        this.parent!.appendChild(this.view.view);

        super.mount();
    }

    /**
     * Updates the group view in response to state changes.
     *
     * Behavior:
     * - Refreshes the group header label via {@link updateLabel}.
     * - Transitions `MOUNTED → UPDATED → MOUNTED` via `super.update()`.
     *
     * Notes:
     * - Currently performs only label refresh; extend for additional update logic.
     * - Does **not** update visibility or collapse state automatically.
     *
     * @public
     * @returns {void}
     * @override
     */
    public override update(): void {
        this.updateLabel();
        super.update();
    }

    /**
     * Updates the text content of the group header.
     *
     * Behavior:
     * - No-op if not mounted ({@link view} is `null`).
     * - If `label` is `null`, preserves existing header text.
     * - Otherwise, replaces header `textContent` with new label.
     *
     * Notes:
     * - Does **not** escape HTML (uses `textContent`, not `innerHTML`).
     * - Safe to call multiple times with same value (idempotent).
     *
     * @public
     * @param {string | null} [label=null] - New label to display; `null` preserves current label.
     * @returns {void}
     */
    public updateLabel(label: string | null = null): void {
        if (!this.view) return;

        const headerEl = this.view.tags.GroupHeader;
        if (label !== null) {
            headerEl.textContent = label;
        }
    }

    /**
     * Returns the container element for child item views.
     *
     * Usage:
     * - Caller appends `OptionView` or other child views to this container.
     * - Container provides semantic grouping (`role="group"`).
     *
     * @public
     * @returns {HTMLDivElement} The items container element.
     * @throws {Error} If the view has not been mounted yet ({@link view} is `null`).
     */
    public getItemsContainer(): HTMLDivElement {
        if (!this.view) {
            throw new Error("GroupView has not been rendered.");
        }
        return this.view.tags.GroupItems;
    }

    /**
     * Updates the group's visibility based on child item state.
     *
     * Visibility rules:
     * - Iterates through direct children of the items container.
     * - Counts children **without** the `"hide"` CSS class.
     * - Toggles `"hide"` class on root container:
     *   - **Added** if all children are hidden (zero visible).
     *   - **Removed** if any child is visible.
     *
     * Notes:
     * - No-op if not mounted ({@link view} is `null`).
     * - Only checks for `"hide"` class; does **not** inspect `display` or `visibility` styles.
     * - Safe to call repeatedly (idempotent based on current child state).
     *
     * @public
     * @returns {void}
     */
    public updateVisibility(): void {
        if (!this.view) return;

        const items = this.view.tags.GroupItems;
        const visibleItems = Array.from(items.children).filter(
            child => !child.classList.contains("hide")
        );

        this.view.view.classList.toggle("hide", visibleItems.length === 0);
    }

    /**
     * Sets the collapsed/expanded state of the group.
     *
     * State updates:
     * - **CSS**: Toggles `"collapsed"` class on root container.
     * - **ARIA**: Sets `aria-expanded` attribute on header (`"true"` or `"false"`).
     *
     * Visual effects:
     * - CSS class typically controls item container visibility (via stylesheet).
     * - ARIA attribute communicates state to assistive technologies.
     *
     * Notes:
     * - No-op if not mounted ({@link view} is `null`).
     * - Does **not** animate or transition; relies on CSS for presentation.
     * - Safe to call with same value repeatedly (idempotent).
     *
     * @public
     * @param {boolean} collapsed - `true` to collapse the group; `false` to expand.
     * @returns {void}
     */
    public setCollapsed(collapsed: boolean): void {
        if (!this.view) return;

        this.view.view.classList.toggle("collapsed", collapsed);
        this.view.tags.GroupHeader.setAttribute(
            "aria-expanded",
            collapsed ? "false" : "true"
        );
    }
}