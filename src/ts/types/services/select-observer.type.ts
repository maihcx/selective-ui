/**
 * Represents a snapshot of the current selection state in a select component.
 */
export type SelectSnapshot = {
    length: number;   // Total number of selected items
    values: string;   // Comma-separated string of selected values
    texts: string;    // Comma-separated string of selected display texts
    selected: string; // Raw representation of selected items (could be IDs or combined keys)
};