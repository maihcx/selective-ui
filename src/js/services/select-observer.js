export class SelectObserver {
    /** @type {MutationObserver} */
    #observer;

    /** @type {HTMLSelectElement} */
    #select;

    #debounceTimer = null;

    #lastSnapshot = null;

    #DEBOUNCE_DELAY = 50;

    
    /**
     * Initializes the SelectObserver for a given <select> element.
     * Captures the initial snapshot, sets up a MutationObserver, and listens for custom "options:changed" events.
     * Changes are debounced to prevent excessive calls.
     *
     * @param {HTMLSelectElement} select - The <select> element to observe.
     */
    constructor(select) {
        this.#select = select;
        this.#lastSnapshot = this.#createSnapshot();

        this.#observer = new MutationObserver(() => {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = setTimeout(() => {
                this.#handleChange();
            }, this.#DEBOUNCE_DELAY);
        });

        select.addEventListener("options:changed", () => {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = setTimeout(() => {
                this.#handleChange();
            }, this.#DEBOUNCE_DELAY);
        });
    }

    /**
     * Creates a snapshot of the current state of the <select> element's options.
     * The snapshot includes option count, values, texts, and selected states for comparison.
     *
     * @returns {{length:number, values:string, texts:string, selected:string}} A snapshot of the options state.
     */
    #createSnapshot() {
        const options = Array.from(this.#select.options);
        return {
            length: options.length,
            values: options.map(opt => opt.value).join(','),
            texts: options.map(opt => opt.text).join(','),
            selected: options.map(opt => opt.selected).join(',')
        };
    }

    /**
     * Determines if there has been a real change in the <select> element's options or attributes.
     * Compares the new snapshot with the previous one and updates the stored snapshot if different.
     *
     * @returns {boolean} True if a real change occurred, otherwise false.
     */
    #hasRealChange() {
        const newSnapshot = this.#createSnapshot();
        const changed = JSON.stringify(newSnapshot) !== JSON.stringify(this.#lastSnapshot);
        
        if (changed) {
            this.#lastSnapshot = newSnapshot;
        }
        
        return changed;
    }

    /**
     * Handles detected changes after debouncing.
     * If a real change is found, invokes the onChanged() hook with the current <select> element.
     */
    #handleChange() {
        if (!this.#hasRealChange()) {
            return;
        }

        this.onChanged(this.#select);
    }

    /**
     * Starts observing the <select> element for child list mutations and attribute changes.
     * Uses MutationObserver with a debounce mechanism to batch rapid updates.
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
     * Hook called when the <select> element's options or attributes change.
     * Override this method to implement custom update handling logic.
     *
     * @param {HTMLSelectElement} options - The current <select> element.
     */
    onChanged(options) { }


    /**
     * Stops observing the <select> element and clears any pending debounce timers.
     * Ensures no further change handling occurs after disconnecting.
     */
    disconnect() {
        clearTimeout(this.#debounceTimer);
        this.#observer.disconnect();
    }
}