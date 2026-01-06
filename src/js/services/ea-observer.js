/**
 * @class
 */
export class ElementAdditionObserver {
    #isActive = false;
    /** @type {MutationObserver} */
    #observer = null;

    /** @type {Function[]} */
    #actions = [];

    /**
     * Registers a callback to be invoked whenever a matching element is detected being added to the DOM.
     *
     * @param {(el: HTMLSelectElement) => void} action - Function executed with the newly added element.
     */
    onDetect(action) {
        this.#actions.push(action);
    }

    /**
     * Clears all previously registered detection callbacks.
     */
    clearDetect() {
        this.#actions = [];
    }

    /**
     * Starts observing the document for additions of elements matching the given tag.
     * Detects both direct additions and nested matches within added subtrees.
     *
     * @param {string} tag - The tag name to watch for (e.g., "select", "div").
     */
    start(tag) {
        if (this.#isActive) {
            return;
        }
        this.#isActive = true;
        const upperTag = tag.toUpperCase();
        const lowerTag = tag.toLowerCase();
        this.#observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    const subnode = /** @type {HTMLElement} */ (node);
                    if (subnode.nodeType === 1) {
                        if (subnode.tagName === upperTag) {
                            this.#handle(subnode);
                        }
                        
                        const selects = subnode.querySelectorAll(lowerTag);
                        selects.forEach((select) => {
                            this.#handle(select);
                        });
                    }
                });
            });
        });

        this.#observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Stops observing for element additions and releases internal resources.
     * No-ops if the observer is not active.
     */
    stop() {
        if (!this.#isActive) {
            return;
        }
        this.#isActive = false;
        this.#observer.disconnect();
        this.#observer = null;
    }

    /**
     * Internal handler that invokes all registered detection callbacks for the provided element.
     *
     * @param {Element} element - The element that was detected as added to the DOM.
     */
    #handle(element) {
        this.#actions.forEach(action => {
            action(element);
        });
    }
}