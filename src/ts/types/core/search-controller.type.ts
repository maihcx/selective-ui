/**
 * Represents the state of pagination for AJAX-based data loading.
 */
export type PaginationState = {
    /** Current 1-based page index. */
    currentPage: number;
    /** Total number of pages available for the current query. */
    totalPages: number;
    /** Whether another page can be requested. */
    hasMore: boolean;
    /** Whether a request is currently in flight. */
    isLoading: boolean;
    /** Keyword currently used to fetch/filter data. */
    currentKeyword: string;
    /** Whether pagination behavior is enabled for this datasource. */
    isPaginationEnabled: boolean;
};

/**
 * Represents an individual option item returned from an AJAX request.
 */
export type AjaxOptionItem = {
    /** Type discriminator; defaults to `"option"` when omitted. */
    type?: "option";
    /** Serialized option value submitted to forms / APIs. */
    value: string;
    /** Display text shown in the UI. */
    text: string;
    /** Whether the option should start in selected state. */
    selected?: boolean;
    /** Arbitrary metadata preserved through normalization. */
    data?: Record<string, any>;
    /** Optional image source for custom rendering. */
    imgsrc?: string;
    /** Optional unique identifier from backend data. */
    id?: string;
    /** Optional stable key for mapping or diffing. */
    key?: string;
    /** Optional label override (e.g. accessibility/grouping use-cases). */
    label?: string;
    /** Optional name attribute for compatibility with legacy payloads. */
    name?: string;
    /** Optional title attribute for tooltip/semantics. */
    title?: string;
};

/**
 * Represents an option group item returned from an AJAX request.
 * Contains a label and a list of options.
 */
export type AjaxOptGroupItem = {
    /** Type discriminator for grouped entries. */
    type: "optgroup";
    /** Human-readable label for the group. */
    label: string;
    /** Group-level metadata from the datasource. */
    data?: Record<string, any>;
    /** Option children when backend uses `options` as group payload key. */
    options?: Array<{
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
    /** Raw child payload when backend uses non-standard item structures. */
    items?: any[];
    /** Compatibility flag used by some APIs to mark grouped entries. */
    isGroup?: boolean;
    /** Legacy alias of `isGroup`. */
    group?: boolean;
    /** Optional name attribute for compatibility with legacy payloads. */
    name?: string;
    /** Optional title attribute for tooltip/semantics. */
    title?: string;
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
    /** Normalized items ready to be consumed by the adapter layer. */
    items: NormalizedAjaxItem[];
    /** Whether pagination metadata is present and should be honored. */
    hasPagination: boolean;
    /** Current 1-based page index returned from the server. */
    page: number;
    /** Total number of pages for the current query. */
    totalPages: number;
    /** Whether another page can be fetched. */
    hasMore: boolean;
};

/**
 * Configuration for making AJAX requests to fetch options or groups.
 */
export type AjaxConfig = {
    /** Endpoint URL used for remote search/pagination requests. */
    url: string;
    /** HTTP method used by requests (defaults to `GET`). */
    method?: "GET" | "POST";
    /** Preserve selected options when replacing remote results. */
    keepSelected?: boolean;

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
