import { SelectSnapshot } from "../types/services/select-observer.type";

/**
 * @class
 */
export class SelectObserver {
    private _observer: MutationObserver;

    private _select: HTMLSelectElement;

    private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

    private _lastSnapshot: SelectSnapshot | null = null;

    private readonly _DEBOUNCE_DELAY = 50;

    /**
     * Initializes the SelectObserver for a given <select> element.
     * Captures the initial snapshot, sets up a MutationObserver, and listens for custom "options:changed" events.
     * Changes are debounced to prevent excessive calls.
     *
     * @param {HTMLSelectElement} select - The <select> element to observe.
     */
    constructor(select: HTMLSelectElement) {
        this._select = select;
        this._lastSnapshot = this._createSnapshot();

        this._observer = new MutationObserver(() => {
            if (this._debounceTimer) clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this._handleChange();
            }, this._DEBOUNCE_DELAY);
        });

        select.addEventListener("options:changed", () => {
            if (this._debounceTimer) clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this._handleChange();
            }, this._DEBOUNCE_DELAY);
        });
    }

    /**
     * Creates a snapshot of the current state of the <select> element's options.
     * The snapshot includes option count, values, texts, and selected states for comparison.
     *
     * @returns {SelectSnapshot} A snapshot of the options state.
     */
    private _createSnapshot(): SelectSnapshot {
        const options = Array.from(this._select.options);
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
    private _hasRealChange(): boolean {
        const newSnapshot = this._createSnapshot();
        const changed = JSON.stringify(newSnapshot) !== JSON.stringify(this._lastSnapshot);

        if (changed) this._lastSnapshot = newSnapshot;

        return changed;
    }

    /**
     * Handles detected changes after debouncing.
     * If a real change is found, invokes the onChanged() hook with the current <select> element.
     */
    private _handleChange(): void {
        if (!this._hasRealChange()) return;
        this.onChanged(this._select);
    }

    /**
     * Starts observing the <select> element for child list mutations and attribute changes.
     * Uses MutationObserver with a debounce mechanism to batch rapid updates.
     */
    connect(): void {
        this._observer.observe(this._select, {
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
    onChanged(options: HTMLSelectElement): void {
        // override
    }

    /**
     * Stops observing the <select> element and clears any pending debounce timers.
     * Ensures no further change handling occurs after disconnecting.
     */
    disconnect(): void {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        this._observer.disconnect();
    }
}