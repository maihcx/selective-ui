/**
 * Represents a snapshot of the current selection state in a select component.
 */
export type SelectSnapshot = {
    /** Total number of selected options. */
    length: number;
    /** Comma-separated list of selected option values. */
    values: string;
    /** Comma-separated list of selected option display texts. */
    texts: string;
    /** Raw serialized representation of selected entries. */
    selected: string;
};
