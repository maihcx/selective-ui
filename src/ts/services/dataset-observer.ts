/**
 * @class
 */
export class DatasetObserver {
    private _observer: MutationObserver;

    private _element: HTMLElement;

    private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Observes data-* attribute changes on a target element and debounces notifications.
     * Sets up a MutationObserver to detect dataset mutations and a fallback custom event listener.
     *
     * @param {HTMLElement} element - The element whose dataset (data-* attributes) will be observed.
     */
    constructor(element: HTMLElement) {
        this._element = element;

        this._observer = new MutationObserver((mutations: MutationRecord[]) => {
            let datasetChanged = false;

            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName?.startsWith("data-")) {
                    datasetChanged = true;
                    break;
                }
            }

            if (!datasetChanged) return;

            if (this._debounceTimer) clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this.onChanged({ ...this._element.dataset });
            }, 50);
        });

        element.addEventListener("dataset:changed", () => {
            this.onChanged({ ...this._element.dataset });
        });
    }

    /**
     * Starts observing the element for attribute changes, including old values.
     * Uses MutationObserver to track updates to data-* attributes.
     */
    connect(): void {
        this._observer.observe(this._element, {
            attributes: true,
            attributeOldValue: true,
        });
    }

    /**
     * Callback invoked when the element's dataset changes (debounced).
     * Override in subclasses to handle dataset updates.
     *
     * @param {Record<string, string>} dataset - A shallow copy of the element's current dataset.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChanged(dataset: Record<string, string>): void {
        // override
    }

    /**
     * Stops observing the element and clears any pending debounce timers.
     */
    disconnect(): void {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        this._observer.disconnect();
    }
}