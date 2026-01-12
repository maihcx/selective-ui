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

/**
 * Represents a single timer entry for delayed execution.
 */
export type TimerEntry = {
    execute: (params: unknown[] | null) => void; // Function to execute after timeout
    timeout: number;                              // Delay in milliseconds
    once: boolean;                                // Whether the timer runs only once
};

/**
 * Store for active timers, organized by keys.
 * Structure: { [executeKey]: { [timerId]: timeoutHandle } }
 */
export type TimerRunnerStore = Record<string, Record<string, ReturnType<typeof setTimeout>>>;

/**
 * Represents the timer process manager.
 * Handles scheduling, clearing, and executing stored timers.
 */
export type TimerProcess = {
    executeStored: Record<string, TimerEntry[]>; // Stored timer entries by key
    timerRunner: TimerRunnerStore;               // Active timer handles

    /**
     * Schedule a new execution entry.
     * @param keyExecute - Unique key for the execution group.
     * @param execute - Function to execute after timeout.
     * @param timeout - Delay in milliseconds (default: 0).
     * @param once - Whether to execute only once (default: false).
     */
    setExecute(keyExecute: string, execute: (params: unknown[] | null) => void, timeout?: number, once?: boolean): void;

    /**
     * Clear all executions associated with the given key.
     * @param keyExecute - Key identifying the execution group.
     */
    clearExecute(keyExecute: string): void;

    /**
     * Run all stored executions for the given key immediately.
     * @param keyExecute - Key identifying the execution group.
     * @param params - Optional parameters passed to the execution functions.
     */
    run(keyExecute: string, ...params: unknown[]): void;
};