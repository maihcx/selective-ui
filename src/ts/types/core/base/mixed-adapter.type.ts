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
    /** Number of items currently visible after filters are applied. */
    visibleCount?: number;
    /** Total number of items tracked by the adapter. */
    totalCount?: number;
    /** Convenience flag indicating whether at least one item is visible. */
    hasVisible?: boolean;
    /** Convenience flag indicating whether the collection has no items. */
    isEmpty?: boolean;
};
