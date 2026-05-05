import { MountViewResult } from "../utils/libs.type";

/**
 * Represents the DOM tags created when mounting a GroupView component.
 * These tags correspond to key sections of the group UI.
 */
export type GroupViewTags = {
    /** Root container for the group view */
    GroupView: HTMLDivElement;
    /** Header section displaying the group title */
    GroupHeader: HTMLDivElement;
    /** Container for the group's items */
    GroupItems: HTMLDivElement;
};

/**
 * Represents the result of mounting a GroupView.
 * Extends MountViewResult with a guaranteed root element (`view`).
 */
export type GroupViewResult = MountViewResult<GroupViewTags> & {
    /** The root element of the mounted group view */
    view: Element;
};
