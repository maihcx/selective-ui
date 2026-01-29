import { IEventCallback, IEventHandler, IEventToken } from "../types/utils/ievents.type";

/**
 * iEvents
 *
 * Lightweight event utility that standardizes a "token-controlled" handler pipeline and
 * provides small helpers for DOM dispatch and batch-calling functions.
 *
 * The core idea is a **shared event token** passed to handlers via a controller callback:
 * - `stopPropagation()` stops invoking subsequent handlers (pipeline short-circuit).
 * - `cancel()` marks the token as canceled and also stops propagation.
 *
 * ### Responsibility
 * - Create a per-dispatch control token via {@link buildEventToken}.
 * - Execute handlers sequentially with short-circuit rules via {@link callEvent}.
 * - Dispatch native DOM events via {@link trigger}.
 * - Execute an array of functions safely (skip non-functions) via {@link callFunctions}.
 *
 * ### Lifecycle / Idempotency
 * - Pure static utility: no instance state, no lifecycle.
 * - {@link callFunctions} is tolerant/no-op when `funcs` is not an array.
 * - {@link callEvent} is tolerant/no-op for non-function entries in `handles`.
 *
 * ### Event / Hook Flow
 * {@link callEvent}:
 * 1) {@link buildEventToken} → `(token, callback)`
 * 2) Iterate handlers in order:
 *    handler(callback, ...params?)
 *    → if `token.isCancel === true` OR `token.isContinue === false`, stop iterating
 * 3) Return `token` to the caller for inspection.
 *
 * ### Control semantics (important)
 * - **Continue (token.isContinue)**: defaults to `true`. Set to `false` by `stopPropagation()` or `cancel()`.
 * - **Cancel (token.isCancel)**: defaults to `false`. Set to `true` only by `cancel()`.
 * - `cancel()` implies `stopPropagation()` (i.e., cancels and stops further handlers).
 *
 * ### DOM / Side-effect Notes
 * - {@link trigger} creates a new native {@link Event} and dispatches it on the provided target.
 * - {@link callEvent} and {@link callFunctions} do not touch the DOM; they only call functions.
 *
 * @see {@link IEventToken}
 * @see {@link IEventCallback}
 */
export class iEvents {
    /**
     * Creates a new event token and its controller callback.
     *
     * ### Purpose
     * - The returned `token` is **read-only** (via getters) from the handler perspective.
     * - The returned `callback` is the only way to mutate internal token state.
     *
     * ### Token rules
     * - Starts with `{ isContinue: true, isCancel: false }`.
     * - `callback.stopPropagation()` → `isContinue = false`.
     * - `callback.cancel()` → `isCancel = true` and `isContinue = false`.
     *
     * @returns An object containing:
     * - `token`: immutable view of the dispatch state.
     * - `callback`: controller passed into handlers to modify dispatch flow.
     */
    public static buildEventToken(): { token: IEventToken; callback: IEventCallback } {
        const privToken = { isContinue: true, isCancel: false };

        const token: IEventToken = {
            get isContinue() {
                return privToken.isContinue;
            },
            get isCancel() {
                return privToken.isCancel;
            },
        };

        const callback: IEventCallback = {
            stopPropagation() {
                privToken.isContinue = false;
            },
            cancel() {
                privToken.isCancel = true;
                privToken.isContinue = false;
            },
        };

        return { token, callback };
    }

    /**
     * Invokes event handlers sequentially (in-order) with a shared control callback.
     *
     * Handlers are invoked until:
     * - A handler calls `callback.stopPropagation()` (sets `token.isContinue = false`), or
     * - A handler calls `callback.cancel()` (sets `token.isCancel = true` and stops propagation), or
     * - The handler list is exhausted.
     *
     * ### Parameter passing
     * - If `params` is a non-null array, each handler is called as: `handler(callback, ...params)`.
     * - Otherwise, handlers are called as: `handler(callback)`.
     *
     * ### Tolerance behavior
     * - Non-function entries in `handles` are skipped (no-ops).
     *
     * @template TParams - Tuple type representing the extra handler parameters.
     * @param params - Optional tuple of parameters forwarded to handlers; pass `null` to send no params.
     * @param handles - List of handlers (or unknown entries; non-functions are ignored).
     * @returns The {@link IEventToken} describing the final dispatch state.
     */
    public static callEvent<TParams extends unknown[]>(
        params: TParams | null,
        ...handles: Array<IEventHandler<TParams> | unknown>
    ): IEventToken {
        const { token, callback } = this.buildEventToken();

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];
            if (typeof handle !== "function") continue;

            if (params && Array.isArray(params)) {
                (handle as IEventHandler<TParams>)(callback, ...params);
            } else {
                (handle as IEventHandler<[]>)(callback);
            }

            if (token.isCancel || !token.isContinue) break;
        }

        return token;
    }

    /**
     * Dispatches a native DOM {@link Event} on the provided target.
     *
     * ### Side effects
     * - Creates a new `Event(eventSTR, opts)` and synchronously dispatches it via `dispatchEvent`.
     *
     * @param element - Dispatch target (`HTMLElement`, `Window`, or `Document`).
     * @param eventSTR - Event type string (e.g., `"change"`, `"input"`, `"scroll"`).
     * @param opts - Standard {@link EventInit} options (defaults to `{ bubbles: true, cancelable: true }`).
     * @returns The created and dispatched {@link Event} instance.
     */
    public static trigger(
        element: HTMLElement | Window | Document,
        eventSTR: string,
        opts: EventInit = { bubbles: true, cancelable: true }
    ): Event {
        const evt = new Event(eventSTR, opts);
        element.dispatchEvent(evt);
        return evt;
    }

    /**
     * Executes a list of functions in-order with the provided parameters.
     *
     * ### Tolerance behavior
     * - No-ops if `funcs` is not an array.
     * - Skips non-function entries.
     *
     * @template TParams - Tuple type of the arguments passed to each function.
     * @param funcs - Array of functions (or unknown entries; non-functions are ignored).
     * @param params - Arguments forwarded to each function.
     */
    public static callFunctions<TParams extends unknown[]>(
        funcs: Array<((...args: TParams) => unknown) | unknown>,
        ...params: TParams
    ): void {
        if (!Array.isArray(funcs)) return;
        for (const fn of funcs) {
            if (typeof fn !== "function") continue;
            (fn as (...args: TParams) => unknown)(...params);
        }
    }
}