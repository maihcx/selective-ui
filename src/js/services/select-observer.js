export class SelectObserver {
    /** @type {MutationObserver} */
    #observer;

    /** @type {HTMLSelectElement} */
    #select;

    #debounceTimer = null;

    /**
     * Observes a <select> element for option list and attribute changes, with debouncing.
     * Detects modifications to children (options added/removed) and relevant attributes
     * ("selected", "value", "disabled"). Emits updates via the overridable onChanged() hook.
     *
     * @param {HTMLSelectElement} select - The <select> element to monitor.
     */
    constructor(select) {
        this.#observer = new MutationObserver(() => {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = setTimeout(() => {
                this.onChanged(select);
            }, 50);
        });

        this.#select = select;

        select.addEventListener("options:changed", () => {
            this.onChanged(select);
        });
    }

    /**
     * Starts observing the select element for child list mutations and attribute changes.
     * Uses a MutationObserver with a debounce to batch rapid updates.
     */
    connect() {
        this.#observer.observe(this.#select, {
            childList: true,
            subtree: false,

            attributes: true,
            attributeFilter: ["selected", "value", "disabled"]
        });
    }

    /**
     * Hook invoked when the select's options or attributes change.
     * Override to handle updates; receives the current HTMLCollection of options.
     *
     * @param {HTMLSelectElement} options - The Select element.
     */
    onChanged(options) { }

    /**
     * Stops observing the select element and clears any pending debounce timers.
     */
    disconnect() {
        clearTimeout(this.#debounceTimer);
        this.#observer.disconnect();
    }
}