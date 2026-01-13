/**
 * Specification for creating a DOM node dynamically.
 * Includes attributes, styles, events, and accessibility properties.
 */
export type NodeSpec = {
    node: string;                                // Tag name of the node (e.g., "div", "span")
    classList?: string | string[];              // CSS classes to apply
    style?: Partial<CSSStyleDeclaration>;       // Inline styles for the node
    dataset?: Record<string, string>;           // Data attributes (e.g., data-* values)
    role?: string;                               // ARIA role for accessibility
    ariaLive?: string;                           // ARIA live region setting
    ariaLabelledby?: string;                     // ARIA labelledby reference
    ariaControls?: string;                       // ARIA controls reference
    ariaHaspopup?: string;                       // ARIA haspopup attribute
    ariaMultiselectable?: string;                // ARIA multiselectable attribute
    ariaAutocomplete?: string;                   // ARIA autocomplete attribute
    event?: Record<string, EventListener>;       // Event listeners mapped by event name
    [key: string]: unknown;                      // Allow additional custom properties
};

/**
 * Generic mount result shape used across views.
 * Returned by mountView/mountNode utilities.
 *
 * @template TTags - A map of tag names to their corresponding HTMLElement instances.
 */
export type MountViewResult<TTags extends Record<string, HTMLElement>> = {
    view: HTMLElement | null;                   // Root element of the mounted view
    tags: TTags & { id: string };               // Tag map with an additional unique ID
};