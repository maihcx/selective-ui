/**
 * DatasetObserver
 *
 * Lightweight observer that watches `data-*` attribute mutations on a target element
 * and emits a debounced snapshot of `element.dataset`.
 *
 * ### Responsibility
 * - Detect changes to `data-*` attributes using a {@link MutationObserver}.
 * - Debounce rapid attribute mutations into a single callback invocation.
 * - Provide a secondary/manual notification path via a custom `"dataset:changed"` event.
 *
 * ### Event Model (External vs. Internal)
 * - **External changes**: DOM attribute mutations (e.g., `el.dataset.disabled = "1"`) are detected
 *   by {@link MutationObserver} and delivered after the debounce window.
 * - **Internal/manual signal**: dispatching `"dataset:changed"` on the element forces an immediate
 *   snapshot emission (not debounced here), useful when dataset-like state is updated through
 *   non-attribute paths or when consumers want an explicit refresh signal.
 *
 * ### Debounce Semantics
 * - Multiple attribute changes within ~50ms are coalesced into a single {@link onChanged} call.
 * - The callback receives a shallow copy of the current dataset (`{ ...element.dataset }`),
 *   ensuring callers do not hold a live reference.
 *
 * ### Usage
 * - Create instance with a target element.
 * - Call {@link connect} to start observing.
 * - Implement/assign {@link onChanged} to react to updates.
 * - Call {@link disconnect} during teardown to prevent leaks.
 */
export class DatasetObserver {
    /** Underlying MutationObserver instance used to detect `data-*` attribute mutations. */
    private observer: MutationObserver;

    /** Target element whose dataset (`data-*` attributes) is observed. */
    private element: HTMLElement;

    /**
     * Debounce timer handle for coalescing rapid attribute mutations.
     * Cleared/replaced whenever a new relevant mutation arrives within the debounce window.
     */
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Creates a {@link DatasetObserver} for the given element.
     *
     * Side effects:
     * - Instantiates a {@link MutationObserver} that filters for `attributes` mutations
     *   where `attributeName` starts with `"data-"`.
     * - Registers a `"dataset:changed"` event listener on the element to allow manual
     *   emission of dataset snapshots.
     *
     * Notes:
     * - Observation does not begin until {@link connect} is called.
     * - The `"dataset:changed"` listener is always active after construction.
     *
     * @param element - The element whose `data-*` attributes will be observed.
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
     * Starts observing the target element for attribute changes.
     *
     * - Observes all attribute mutations and relies on the mutation callback to filter
     *   down to `data-*` changes.
     * - `attributeOldValue` is enabled to allow future diagnostics; the current implementation
     *   does not consume old values directly.
     *
     * No-op behavior:
     * - Calling `connect()` multiple times will register multiple observations on the same
     *   element in standard DOM APIs. Consumers should treat this as "call once" unless the
     *   implementation is extended to guard idempotency.
     */
    public connect(): void {
        this.observer.observe(this.element, {
            attributes: true,
            attributeOldValue: true,
        });
    }

    /**
     * Hook invoked when the element's dataset changes.
     *
     * Consumers typically override this method (or assign to it) to react to changes such as:
     * - disabled / readonly / visible flags
     * - feature toggles exposed via `data-*` attributes
     *
     * The `dataset` argument is a shallow copy of the *current* dataset at the time of emission.
     *
     * @param dataset - Snapshot of `element.dataset` (string values).
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onChanged(dataset: Record<string, string>): void {
        // override
    }

    /**
     * Stops observing and clears pending debounce work.
     *
     * Side effects:
     * - Cancels the pending debounce timer (if any).
     * - Disconnects the underlying {@link MutationObserver}.
     *
     * Idempotency:
     * - Safe to call multiple times; subsequent calls will be effectively no-ops after disconnect.
     */
    public disconnect(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}