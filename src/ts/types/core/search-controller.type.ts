/**
 * Represents the state of pagination for AJAX-based data loading.
 */
export type PaginationState = {
    currentPage: number;           // Current page number
    totalPages: number;            // Total number of pages available
    hasMore: boolean;              // Indicates if more pages are available
    isLoading: boolean;            // Indicates if data is currently being loaded
    currentKeyword: string;        // Current search keyword used for filtering
    isPaginationEnabled: boolean;  // Indicates if pagination is enabled
};

/**
 * Represents an individual option item returned from an AJAX request.
 */
export type AjaxOptionItem = {
    type?: "option";               // Type identifier (optional, defaults to "option")
    value: string;                 // The value of the option
    text: string;                  // Display text for the option
    selected?: boolean;            // Indicates if the option is selected
    data?: Record<string, any>;    // Additional custom data associated with the option
    imgsrc?: string;               // Optional image source for the option
    id?: string;                   // Optional unique identifier
    key?: string;                  // Optional key for internal mapping
    label?: string;                // Optional label for accessibility or grouping
    name?: string;                 // Optional name attribute
    title?: string;                // Optional title attribute
};

/**
 * Represents an option group item returned from an AJAX request.
 * Contains a label and a list of options.
 */
export type AjaxOptGroupItem = {
    type: "optgroup";              // Type identifier for option groups
    label: string;                 // Display label for the group
    data?: Record<string, any>;    // Additional custom data for the group
    options?: Array<{              // List of options within the group
        value: string;
        text: string;
        selected?: boolean;
        data?: Record<string, any>;
        imgsrc?: string;
        id?: string;
        key?: string;
        label?: string;
        name?: string;
        title?: string;
    }>;
    items?: any[];                 // Optional raw items for flexibility
    isGroup?: boolean;             // Indicates if this is treated as a group
    group?: boolean;               // Alternative flag for grouping
    name?: string;                 // Optional name attribute
    title?: string;                // Optional title attribute
};

/**
 * Represents a normalized AJAX item after parsing.
 * Can be an HTML element or a simplified object structure.
 */
export type NormalizedAjaxItem =
    | HTMLOptionElement
    | HTMLOptGroupElement
    | { type: "option"; value: string; text: string; selected?: boolean; data?: Record<string, any> }
    | { type: "optgroup"; label: string; data?: Record<string, any>; options: Array<{ value: string; text: string; selected?: boolean; data?: Record<string, any> }> };

/**
 * Represents the result of parsing an AJAX response.
 */
export type ParseResponseResult = {
    items: NormalizedAjaxItem[];   // List of normalized items
    hasPagination: boolean;        // Indicates if pagination is supported
    page: number;                  // Current page number
    totalPages: number;            // Total number of pages
    hasMore: boolean;              // Indicates if more data is available
};

/**
 * Configuration for making AJAX requests to fetch options or groups.
 */
export type AjaxConfig = {
    url: string;                   // Endpoint URL for the AJAX request
    method?: "GET" | "POST";       // HTTP method (default: GET)
    keepSelected?: boolean;        // Whether to keep previously selected items after refresh

    /**
     * Data payload for the request.
     * Can be a static object or a function that generates data dynamically
     * based on the current keyword and page number.
     */
    data?:
        | Record<string, any>
        | ((keyword: string, page: number) => Record<string, any>);

    /**
     * Function to generate request data based on selected values.
     */
    dataByValues?: (values: string[]) => Record<string, any>;
};