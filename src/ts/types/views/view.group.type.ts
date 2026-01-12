import { MountViewResult } from "../utils/libs.type";

/**
 * Represents the DOM tags created when mounting a GroupView component.
 * These tags correspond to key sections of the group UI.
 */
export type GroupViewTags = {
    GroupView: HTMLDivElement;    // Root container for the group view
    GroupHeader: HTMLDivElement;  // Header section displaying the group title
    GroupItems: HTMLDivElement;   // Container for the group's items
};

/**
 * Represents the result of mounting a GroupView.
 * Extends MountViewResult with a guaranteed root element (`view`).
 */
export type GroupViewResult = MountViewResult<GroupViewTags> & {
    view: Element; // The root element of the mounted group view
};