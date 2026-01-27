/**
 * @class
 */
export class ElementAdditionObserver<T extends Element = Element> {
    private isActive = false;

    private observer: MutationObserver | null = null;

    private actions: Array<(el: T) => void> = [];

    /**
     * Registers a callback to be invoked whenever a matching element is detected being added to the DOM.
     *
     * @param {(el: T) => void} action - Function executed with the newly added element.
     */
    public onDetect(action: (el: T) => void): void {
        this.actions.push(action);
    }

    /**
     * Clears all previously registered detection callbacks.
     */
    public clearDetect(): void {
        this.actions = [];
    }

    /**
     * connect observing the document for additions of elements matching the given tag.
     * Detects both direct additions and nested matches within added subtrees.
     *
     * @param {string} tag - The tag name to watch for (e.g., "select", "div").
     */
    public connect(tag: string): void {
        if (this.isActive) return;

        this.isActive = true;

        const upperTag = tag.toUpperCase();
        const lowerTag = tag.toLowerCase();

        this.observer = new MutationObserver((mutations: MutationRecord[]) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;

                    const subnode = node as T;

                    if (subnode.tagName === upperTag) {
                        this.handle(subnode as T);
                    }

                    const matches = subnode.querySelectorAll(lowerTag);
                    matches.forEach((el) => this.handle(el as T));
                });
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Stops observing for element additions and releases internal resources.
     * No-ops if the observer is not active.
     */
    public disconnect(): void {
        if (!this.isActive) return;

        this.isActive = false;
        this.observer?.disconnect();
        this.observer = null;
    }

    /**
     * Internal handler that invokes all registered detection callbacks for the provided element.
     *
     * @param {T} element - The element that was detected as added to the DOM.
     */
    private handle(element: T): void {
        this.actions.forEach((action) => action(element));
    }
}