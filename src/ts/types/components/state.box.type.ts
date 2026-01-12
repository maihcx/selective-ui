/**
 * Represents the possible states when data is empty.
 * - "notfound": No matching results found.
 * - "nodata": No data available to display.
 */
export type EmptyStateType = "notfound" | "nodata";

/**
 * Configuration options for displaying empty states.
 */
export interface EmptyStateOptions {
    textNoData: string;      // Text to display when there is no data
    textNotFound: string;    // Text to display when no results are found
    [key: string]: unknown;  // Allows additional custom properties
}

/**
 * Configuration options for displaying loading state.
 */
export interface LoadingStateOptions {
    textLoading: string;     // Text to display while data is loading
    [key: string]: unknown;  // Allows additional custom properties
}