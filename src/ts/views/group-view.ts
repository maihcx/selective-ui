
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type { GroupViewTags, GroupViewResult } from "../types/views/view.group.type";

/**
 * View implementation responsible for rendering and managing
 * a grouped collection of selectable items.
 *
 * The group consists of:
 * - A header element (label)
 * - A container holding child item views
 *
 * @extends View<GroupViewTags>
 */
export class GroupView extends View<GroupViewTags> {

    /**
     * Strongly-typed reference to the mounted group view structure.
     * Will be null until the view has been mounted.
     */
    public view: GroupViewResult | null = null;

    /**
     * Mounts the group view into the DOM.
     *
     * Creates the group container, header, and items wrapper,
     * applies required ARIA attributes, and appends the root
     * element to the parent container.
     */
    public override mount(): void {
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

        // Parent is guaranteed to exist by the base View constructor.
        this.parent!.appendChild(this.view.view);

        super.mount();
    }

    /**
     * Called when the view needs to be updated.
     *
     * Currently performs a lightweight refresh by updating
     * the group header label.
     */
    public override update(): void {
        this.updateLabel();
        super.update();
    }

    /**
     * Updates the text content of the group header.
     *
     * @param label - The new label to display.
     *                If null, the existing label is preserved.
     */
    public updateLabel(label: string | null = null): void {
        if (!this.view) return;

        const headerEl = this.view.tags.GroupHeader;
        if (label !== null) {
            headerEl.textContent = label;
        }
    }

    /**
     * Returns the container element that holds all item/option views
     * belonging to this group.
     *
     * @returns The HTMLDivElement used as the items container.
     * @throws {Error} If the view has not been mounted yet.
     */
    public getItemsContainer(): HTMLDivElement {
        if (!this.view) {
            throw new Error("GroupView has not been rendered.");
        }
        return this.view.tags.GroupItems;
    }

    /**
     * Updates the visibility of the group based on its children.
     *
     * If all child items are hidden, the entire group
     * will be hidden as well.
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
     * This updates both:
     * - Visual state (CSS classes)
     * - Accessibility state (ARIA attributes)
     *
     * @param collapsed - True to collapse the group, false to expand it.
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