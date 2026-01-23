import { SelectSnapshot } from "../types/services/select-observer.type";

/**
 * @class
 */
export class SelectObserver {
    private observer: MutationObserver;

    private select: HTMLSelectElement;

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    private lastSnapshot: SelectSnapshot | null = null;

    private readonly _DEBOUNCE_DELAY = 50;

    /**
     * Initializes the SelectObserver for a given <select> element.
     * Captures the initial snapshot, sets up a MutationObserver.
     * Changes are debounced to prevent excessive calls.
     *
     * @param {HTMLSelectElement} select - The <select> element to observe.
     */
    constructor(select: HTMLSelectElement) {
        this.select = select;
        this.lastSnapshot = this.createSnapshot();

        this.observer = new MutationObserver(() => {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.handleChange();
            }, this._DEBOUNCE_DELAY);
        });
    }

    /**
     * Creates a snapshot of the current state of the <select> element's options.
     * The snapshot includes option count, values, texts, and selected states for comparison.
     *
     * @returns {SelectSnapshot} A snapshot of the options state.
     */
    private createSnapshot(): SelectSnapshot {
        const options = Array.from(this.select.options);
        return {
            length: options.length,
            values: options.map((opt) => opt.value).join(","),
            texts: options.map((opt) => opt.text).join(","),
            selected: options.map((opt) => String(opt.selected)).join(","),
        };
    }

    /**
     * Determines if there has been a real change in the <select> element's options or attributes.
     * Compares the new snapshot with the previous one and updates the stored snapshot if different.
     *
     * @returns {boolean} True if a real change occurred, otherwise false.
     */
    private hasRealChange(): boolean {
        const newSnapshot = this.createSnapshot();
        const changed = JSON.stringify(newSnapshot) !== JSON.stringify(this.lastSnapshot);

        if (changed) this.lastSnapshot = newSnapshot;

        return changed;
    }

    /**
     * Handles detected changes after debouncing.
     * If a real change is found, invokes the onChanged() hook with the current <select> element.
     */
    private handleChange(): void {
        if (!this.hasRealChange()) return;
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