/**
 * Represents the control object passed to event handlers,
 * allowing them to manage event flow.
 */
export interface IEventCallback {
    /**
     * Stops the event from propagating to other handlers.
     * Useful when you want to prevent further event processing.
     */
    stopPropagation(): void;

    /**
     * Cancels the event entirely.
     * Typically used to abort the current operation or prevent default behavior.
     */
    cancel(): void;
}

/**
 * Represents the token returned by `callEvent` or `buildEventToken`,
 * which indicates the state of event execution.
 */
export interface IEventToken {
    /**
     * Indicates whether the event should continue executing.
     * True if no cancellation occurred.
     */
    readonly isContinue: boolean;

    /**
     * Indicates whether the event has been canceled.
     * True if `cancel()` was called during event handling.
     */
    readonly isCancel: boolean;
}

export type IEventHandler<TParams extends unknown[] = []> = (
    cb: IEventCallback,
    ...params: TParams
) => void;