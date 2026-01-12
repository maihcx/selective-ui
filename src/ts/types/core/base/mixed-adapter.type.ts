import { GroupModel } from "src/ts/models/group-model";
import { OptionModel } from "src/ts/models/option-model";

/**
 * Represents an item that can be either a group or an option.
 * Used for mixed collections where both types are allowed.
 */
export type MixedItem = GroupModel | OptionModel;

/**
 * Statistics about the visibility state of items in a list or container.
 */
export type VisibilityStats = {
    visibleCount: number;  // Number of items currently visible
    totalCount: number;    // Total number of items in the collection
    hasVisible: boolean;   // Indicates if there is at least one visible item
    isEmpty: boolean;      // Indicates if the collection is empty
};