
/**
 * Provides a lightweight event utility with cancel/continue control:
 * - buildEventToken(): creates a token/callback pair to control flow (stopPropagation/cancel).
 * - callEvent(): invokes handlers in order, passing params; stops when canceled or propagation stopped.
 * - trigger(): dispatches a native DOM Event on the given element.
 * - callFunctions(): executes an array of functions with optional parameters.
 */

import { IEventCallback, IEventToken } from "../types/utils/ievents.type";

export type IEventHandler<TParams extends unknown[] = []> = (
    cb: IEventCallback,
    ...params: TParams
) => void;

export class iEvents {
    /**
     * Creates an event token and its controller callbacks.
     * @returns {{ token: IEventToken, callback: IEventCallback }}
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
     * Calls event handlers sequentially with optional parameters and a control callback.
     * Stops invoking further handlers if canceled or propagation is stopped.
     *
     * @param {TParams|null} params
     * @param {...IEventHandler<TParams>} handles
     * @returns {IEventToken}
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
     * Dispatches a native DOM event on the specified element.
     * @param {HTMLElement|Window|Document} element
     * @param {string} eventSTR
     * @param {{bubbles?: boolean, cancelable?: boolean}} [opts]
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
     * Invokes an array of functions with optional parameters.
     * @param {Function[]} funcs
     * @param {...any} params
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