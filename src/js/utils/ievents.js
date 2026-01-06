
/**
 * Provides a lightweight event utility with cancel/continue control:
 * - buildEventToken(): creates a token/callback pair to control flow (stopPropagation/cancel).
 * - callEvent(): invokes handlers in order, passing params; stops when canceled or propagation stopped.
 * - trigger(): dispatches a native DOM Event on the given element.
 * - callFunctions(): executes an array of functions with optional parameters.
 */
export class iEvents {
    /**
     * Creates an event token and its controller callbacks.
     * @returns {{ token: IEventToken, callback: IEventCallback }}
     */
    static buildEventToken() {
        const privToken = { isContinue: true, isCancel: false };

        const token = {
            get isContinue() { return privToken.isContinue; },
            get isCancel() { return privToken.isCancel; }
        };

        const callback = {
            stopPropagation() { privToken.isContinue = false; },
            cancel() { privToken.isCancel = true; privToken.isContinue = false; }
        };

        return { token, callback };
    }

    /**
     * Calls event handlers sequentially with optional parameters and a control callback.
     * Stops invoking further handlers if canceled or propagation is stopped.
     *
     * @template T
     * @param {T[]|null} params
     * @param {...Function} handles
     * @returns {IEventToken}
     */
    static callEvent(params, ...handles) {
        const { token, callback } = this.buildEventToken();

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];

            if (typeof handle !== 'function') continue;

            if (params && Array.isArray(params)) {
                handle(callback, ...params);
            } else {
                handle(callback);
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
    static trigger(element, eventSTR, opts = { bubbles: true, cancelable: true }) {
        const evt = new Event(eventSTR, opts);
        element.dispatchEvent(evt);
        return evt;
    }

    /**
     * Invokes an array of functions with optional parameters.
     * @param {Function[]} funcs
     * @param {...any} params
     */
    static callFunctions(funcs, ...params) {
        if (!Array.isArray(funcs)) return;
        for (const fn of funcs) {
            if (typeof fn !== 'function') continue;
            fn(...params);
        }
    }
}
