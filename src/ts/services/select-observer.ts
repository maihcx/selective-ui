/**
 * @class
 */
export class SelectObserver {
    private observer: MutationObserver;

    private select: HTMLSelectElement;

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly _DEBOUNCE_DELAY = 50;

    /**
     * Initializes the SelectObserver for a given <select> element.
     * Sets up a MutationObserver.
     * Changes are debounced to prevent excessive calls.
     *
     * @param {HTMLSelectElement} select - The <select> element to observe.
     */
    constructor(select: HTMLSelectElement) {
        this.select = select;

        this.observer = new MutationObserver(() => {
            clearTimeout(this.debounceTimer!);
            this.debounceTimer = setTimeout(() => {
                this.handleChange();
            }, this._DEBOUNCE_DELAY);
        });
    }

    /**
     * Handles detected changes after debouncing.
     * If a real change is found, invokes the onChanged() hook with the current <select> element.
     */
    private handleChange(): void {
        this.onChanged(this.select);
    }

    /**
     * Starts observing the <select> element for child list mutations and attribute changes.
     * Uses MutationObserver with a debounce mechanism to batch rapid updates.
     */
    public connect(): void {
        this.observer.observe(this.select, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ["selected", "value", "disabled"],
        });
    }

    /**
     * Hook called when the <select> element's options or attributes change.
     * Override this method to implement custom update handling logic.
     *
     * @param {HTMLSelectElement} options - The current <select> element.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onChanged(options: HTMLSelectElement): void {
        // override
    }

    /**
     * Stops observing the <select> element and clears any pending debounce timers.
     * Ensures no further change handling occurs after disconnecting.
     */
    public disconnect(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}