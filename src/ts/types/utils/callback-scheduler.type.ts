/**
 * Represents a unique identifier for a group of scheduled callbacks.
 *
 * Can be a string or a symbol. Used as the key when registering or running callbacks
 * in the CallbackScheduler.
 */
export type TimerKey = string | symbol;

/**
 * Represents optional configuration for a scheduled callback.
 */
export interface TimerOptions {
    /**
     * The debounce delay in milliseconds before executing the callback.
     * Default is 50ms if not specified.
     */
    debounce?: number;

    /**
     * Indicates whether the callback should be executed only once.
     * If true, the callback is automatically removed after execution.
     */
    once?: boolean;
}

/**
 * Represents a single scheduled callback entry within the CallbackScheduler.
 *
 * Contains the callback function, its debounce delay, and execution behavior.
 */
export interface TimerEntry<T extends any[] = any[]> {
    /**
     * The function to be executed when the callback is run.
     * Arguments are passed from the `run()` method.
     */
    callback: (...args: T) => void;

    /**
     * The debounce delay in milliseconds before executing the callback.
     */
    debounce: number;

    /**
     * Indicates whether the callback should be executed only once.
     * If true, it will be automatically removed after execution.
     */
    once: boolean;

    /**
     * The internal timer reference used to manage debounce.
     * Set automatically by CallbackScheduler; should not be modified manually.
     */
    timer?: ReturnType<typeof setTimeout>;
}