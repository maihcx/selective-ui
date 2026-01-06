export class DatasetObserver {
    /** @type {MutationObserver} */
    #observer;

    /** @type {HTMLElement} */
    #element;

    #debounceTimer = null;

    /**
     * Observes data-* attribute changes on a target element and debounces notifications.
     * Sets up a MutationObserver to detect dataset mutations and a fallback custom event listener.
     *
     * @param {HTMLElement} element - The element whose dataset (data-* attributes) will be observed.
     */
    constructor(element) {
        this.#element = element;

        this.#observer = new MutationObserver((mutations) => {
            let datasetChanged = false;

            for (const mutation of mutations) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName?.startsWith("data-")
                ) {
                    datasetChanged = true;
                    break;
                }
            }

            if (!datasetChanged) return;

            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = setTimeout(() => {
                this.onChanged({ ...this.#element.dataset });
            }, 50);
        });

        element.addEventListener("dataset:changed", () => {
            this.onChanged({ ...this.#element.dataset });
        });
    }

    /**
     * Starts observing the element for attribute changes, including old values.
     * Uses MutationObserver to track updates to data-* attributes.
     */
    connect() {
        this.#observer.observe(this.#element, {
            attributes: true,
            attributeOldValue: true
        });
    }

    /**
     * Callback invoked when the element's dataset changes (debounced).
     * Override in subclasses to handle dataset updates.
     *
     * @param {DOMStringMap} dataset - A shallow copy of the element's current dataset.
     */
    onChanged(dataset) {
        // override
    }

    /**
     * Stops observing the element and clears any pending debounce timers.
     */
    disconnect() {
        clearTimeout(this.#debounceTimer);
        this.#observer.disconnect();
    }
}
