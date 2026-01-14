/**
 * @class
 */
export class ElementAdditionObserver<T extends Element = Element> {
    private _isActive = false;

    private _observer: MutationObserver | null = null;

    private _actions: Array<(el: T) => void> = [];

    /**
     * Registers a callback to be invoked whenever a matching element is detected being added to the DOM.
     *
     * @param {(el: T) => void} action - Function executed with the newly added element.
     */
    onDetect(action: (el: T) => void): void {
        this._actions.push(action);
    }

    /**
     * Clears all previously registered detection callbacks.
     */
    clearDetect(): void {
        this._actions = [];
    }

    /**
     * Starts observing the document for additions of elements matching the given tag.
     * Detects both direct additions and nested matches within added subtrees.
     *
     * @param {string} tag - The tag name to watch for (e.g., "select", "div").
     */
    start(tag: string): void {
        if (this._isActive) return;

        this._isActive = true;

        const upperTag = tag.toUpperCase();
        const lowerTag = tag.toLowerCase();

        this._observer = new MutationObserver((mutations: MutationRecord[]) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;

                    const subnode = node as HTMLElement;

                    if (subnode.tagName === upperTag) {
                        this._handle(subnode as unknown as T);
                    }

                    const matches = subnode.querySelectorAll(lowerTag);
                    matches.forEach((el) => this._handle(el as unknown as T));
                });
            }
        });

        this._observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Stops observing for element additions and releases internal resources.
     * No-ops if the observer is not active.
     */
    stop(): void {
        if (!this._isActive) return;

        this._isActive = false;
        this._observer?.disconnect();
        this._observer = null;
    }

    /**
     * Internal handler that invokes all registered detection callbacks for the provided element.
     *
     * @param {T} element - The element that was detected as added to the DOM.
     */
    private _handle(element: T): void {
        this._actions.forEach((action) => action(element));
    }
}