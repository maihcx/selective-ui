/**
 * ElementAdditionObserver
 *
 * Generic DOM utility that detects when elements of a given tag name are added to the document
 * and notifies registered listeners.
 *
 * ### Responsibility
 * - Observes `document.body` for subtree mutations (`childList + subtree`).
 * - Detects newly added elements that match a watched tag name:
 *   - Direct additions (the added node itself)
 *   - Nested additions (descendants inside the added subtree via `querySelectorAll`)
 * - Dispatches detected elements to registered callbacks (external hooks).
 *
 * ### Lifecycle / Idempotency
 * - {@link connect} starts observation. Subsequent calls while active are **no-ops**.
 * - {@link disconnect} stops observation. Subsequent calls while inactive are **no-ops**.
 * - Callbacks can be managed independently via {@link onDetect} and {@link clearDetect}.
 *
 * ### Event / Hook Flow
 * DOM mutation → match extraction → {@link handle} → invoke each callback from {@link actions}.
 *
 * ### DOM / Performance Notes
 * - This observer runs on every mutation affecting `document.body` subtree.
 * - For each added element node, it may call `querySelectorAll(tag)`, which can be expensive
 *   for large inserted subtrees or frequent DOM churn.
 *
 * @template T - Element subtype emitted to callbacks (defaults to {@link Element}).
 */
export class ElementAdditionObserver<T extends Element = Element> {
    /**
     * Tracks whether the observer is currently attached to the document.
     *
     * Used to enforce a "connect once" contract and make {@link connect}/{@link disconnect} idempotent.
     *
     * @internal
     */
    private isActive = false;

    /**
     * Underlying DOM {@link MutationObserver} instance.
     *
     * `null` when disconnected.
     *
     * @internal
     */
    private observer: MutationObserver | null = null;

    /**
     * Registered detection callbacks.
     *
     * Each callback is invoked with the detected element instance.
     *
     * @internal
     */
    private actions: Set<(el: T) => void> = new Set();

    /**
     * Registers a callback invoked whenever a matching element is detected as added to the DOM.
     *
     * Notes:
     * - Callbacks are invoked in registration order.
     * - This is an "external hook": this class does not store detected elements; it only emits them.
     *
     * @param action - Function executed with the newly detected element.
     */
    public onDetect(action: (el: T) => void): void {
        this.actions.add(action);
    }

    /**
     * Clears all registered detection callbacks.
     *
     * This does not affect the active observation state. If connected, the observer continues
     * to scan mutations but will not invoke any listeners until new callbacks are registered.
     */
    public clearDetect(): void {
        this.actions.clear();
    }

    /**
     * Starts observing the document for additions of elements matching the given tag name.
     *
     * Detection includes:
     * - The added node itself (when it is an element and matches `tag`)
     * - Descendants of the added node that match `tag` (via `querySelectorAll`)
     *
     * Idempotency:
     * - No-ops if already active.
     *
     * Side effects:
     * - Attaches a {@link MutationObserver} to `document.body` with `{ childList: true, subtree: true }`.
     *
     * @param tag - Tag name to watch for (e.g., `"select"`, `"div"`). Case-insensitive.
     */
    public connect(tag: string): void {
        if (this.isActive) return;

        this.isActive = true;

        const upperTag = tag.toUpperCase();
        const lowerTag = tag.toLowerCase();

        this.observer = new MutationObserver((mutations: MutationRecord[]) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    // Only element nodes can have tagName/querySelectorAll.
                    if (node.nodeType !== 1) return;

                    const subnode = node as T;

                    // Direct match: the added node itself.
                    if (subnode.tagName === upperTag) {
                        this.handle(subnode as T);
                    }

                    // Nested matches: descendants inside the added subtree.
                    const matches = subnode.querySelectorAll(lowerTag);
                    matches.forEach((el) => this.handle(el as T));
                });
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Stops observing for element additions and releases internal resources.
     *
     * Idempotency:
     * - No-ops if not active.
     *
     * Side effects:
     * - Disconnects the underlying {@link MutationObserver}.
     * - Clears the observer reference (does not clear registered callbacks).
     */
    public disconnect(): void {
        if (!this.isActive) return;

        this.isActive = false;
        this.observer?.disconnect();
        this.observer = null;
    }

    /**
     * Dispatches a detected element to all registered callbacks.
     *
     * Notes:
     * - Invocation is synchronous and in-order.
     * - Exceptions thrown by a callback will propagate and may prevent later callbacks
     *   from executing (no internal try/catch is applied).
     *
     * @param element - The element detected as added to the DOM.
     * @internal
     */
    private handle(element: T): void {
        for (const action of this.actions) {
            action(element);
        }
    }
}
