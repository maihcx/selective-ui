/**
 * @class
 */
export class DatasetObserver {
    private observer: MutationObserver;

    private element: HTMLElement;

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Observes data-* attribute changes on a target element and debounces notifications.
     * Sets up a MutationObserver to detect dataset mutations and a fallback custom event listener.
     *
     * @param {HTMLElement} element - The element whose dataset (data-* attributes) will be observed.
     */
    public constructor(element: HTMLElement) {
        this.element = element;

        this.observer = new MutationObserver((mutations: MutationRecord[]) => {
            let datasetChanged = false;

            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName?.startsWith("data-")) {
                    datasetChanged = true;
                    break;
                }
            }

            if (!datasetChanged) return;

            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.onChanged({ ...this.element.dataset });
            }, 50);
        });

        element.addEventListener("dataset:changed", () => {
            this.onChanged({ ...this.element.dataset });
        });
    }

    /**
     * Starts observing the element for attribute changes, including old values.
     * Uses MutationObserver to track updates to data-* attributes.
     */
    public connect(): void {
        this.observer.observe(this.element, {
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
    public onChanged(dataset: Record<string, string>): void {
        // override
    }

    /**
     * Stops observing the element and clears any pending debounce timers.
     */
    public disconnect(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}