import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type { GroupViewTags, GroupViewResult } from "../types/views/view.group.type";

/**
 * @extends {View<GroupViewTags>}
 */
export class GroupView extends View<GroupViewTags> {
    /** @type {GroupViewResult} */
    view: GroupViewResult | null = null;

    /**
     * Renders the group view structure (header + items container), sets ARIA attributes,
     * and appends the root element to the parent container.
     */
    render(): void {
        const group_id = Libs.randomString(7);

        this.view = Libs.mountView<GroupViewTags>({
            GroupView: {
                tag: {
                    node: "div",
                    classList: ["selective-ui-group"],
                    role: "group",
                    ariaLabelledby: `seui-${group_id}-header`,
                    id: `seui-${group_id}-group`,
                },
                child: {
                    GroupHeader: {
                        tag: {
                            node: "div",
                            classList: ["selective-ui-group-header"],
                            role: "presentation",
                            id: `seui-${group_id}-header`,
                        },
                    },
                    GroupItems: {
                        tag: {
                            node: "div",
                            classList: ["selective-ui-group-items"],
                            role: "group",
                        },
                    },
                },
            },
        }) as GroupViewResult;

        // Parent is guaranteed by base constructor.
        this.parent!.appendChild(this.view.view);
    }

    /**
     * Performs a lightweight refresh of the view (currently updates the header label).
     */
    update(): void {
        this.updateLabel();
    }

    /**
     * Updates the group header text content if a label is provided.
     *
     * @param {string|null} [label=null] - The new label to display; if null, keeps current.
     */
    updateLabel(label: string | null = null): void {
        if (!this.view) return;
        const headerEl = this.view.tags.GroupHeader;
        if (label !== null) headerEl.textContent = label;
    }

    /**
     * Returns the container element that holds all option/item views in this group.
     *
     * @returns {HTMLDivElement} - The items container element.
     */
    getItemsContainer(): HTMLDivElement {
        if (!this.view) throw new Error("GroupView is not rendered.");
        return this.view.tags.GroupItems;
    }

    /**
     * Toggles the group's visibility based on whether any child item is visible.
     * Hides the entire group when all children are hidden.
     */
    updateVisibility(): void {
        if (!this.view) return;

        const items = this.view.tags.GroupItems;
        const visibleItems = Array.from(items.children).filter(
            (child) => !child.classList.contains("hide")
        );

        const isVisible = visibleItems.length > 0;
        this.view.view.classList.toggle("hide", !isVisible);
    }

    /**
     * Sets the collapsed state on the group and updates ARIA attributes accordingly.
     *
     * @param {boolean} collapsed - True to collapse; false to expand.
     */
    setCollapsed(collapsed: boolean): void {
        if (!this.view) return;

        this.view.view.classList.toggle("collapsed", collapsed);
        this.view.tags.GroupHeader.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
}