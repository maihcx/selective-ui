/**
 * SelectObserver
 *
 * Lightweight mutation tracker for native `<select>` elements.
 *
 * ### Responsibility
 * - Observes DOM changes (child list, attributes) on a bound `<select>` element.
 * - Debounces rapid mutations to prevent excessive handler invocations.
 * - Provides a lifecycle hook ({@link onChanged}) for consumers to react to detected changes.
 *
 * ### Observed mutations
 * - **Child list**: `<option>` / `<optgroup>` additions, removals, reordering.
 * - **Attributes**: `selected`, `value`, `disabled` changes (via `attributeFilter`).
 *
 * ### Debounce behavior
 * - Changes are batched using a `50ms` debounce timer ({@link _DEBOUNCE_DELAY}).
 * - Rapid successive mutations trigger only a single {@link onChanged} call after the delay.
 *
 * ### Lifecycle
 * - **Construction**: Initializes the `MutationObserver` but does **not** start observing.
 * - **{@link connect}**: Activates observation.
 * - **{@link disconnect}**: Stops observation, clears pending timers, releases resources.
 *
 * ### No-op / Idempotency
 * - {@link disconnect} is safe to call multiple times (clears timer only if present).
 * - {@link onChanged} is a no-op by default; consumers must override to implement behavior.
 *
 * ### DOM side effects
 * - None directly; mutation detection is read-only.
 * - Side effects occur only via consumer-implemented {@link onChanged} hook.
 *
 * @class
 */
export class SelectObserver {
    /**
     * Internal `MutationObserver` instance.
     *
     * - Created during construction.
     * - Configured to debounce mutations via {@link debounceTimer}.
     * - Disconnected during {@link disconnect}.
     *
     * @private
     */
    private observer: MutationObserver;

    /**
     * The native `<select>` element being observed.
     *
     * - Set during construction.
     * - Passed to {@link onChanged} when mutations are detected.
     *
     * @private
     */
    private select: HTMLSelectElement;

    /**
     * Debounce timer handle for batching rapid mutations.
     *
     * - Cleared and reset on each mutation event.
     * - Invokes {@link handleChange} after {@link _DEBOUNCE_DELAY} milliseconds of inactivity.
     * - Nulled during {@link disconnect}.
     *
     * @private
     */
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Debounce delay in milliseconds.
     *
     * - Fixed at `50ms` to balance responsiveness and batch efficiency.
     * - Applied to all mutation events.
     *
     * @private
     * @readonly
     */
    private readonly _DEBOUNCE_DELAY = 50;

    /**
     * Creates a new SelectObserver for the given `<select>` element.
     *
     * Side effects:
     * - Initializes the `MutationObserver` with debounced change handling.
     * - Does **not** start observing; call {@link connect} to activate.
     *
     * @param {HTMLSelectElement} select - The `<select>` element to observe for mutations.
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
     * Internal handler invoked after debounce delay expires.
     *
     * Implementation:
     * - Forwards the current {@link select} element to the {@link onChanged} hook.
     *
     * @private
     * @returns {void}
     */
    private handleChange(): void {
        this.onChanged(this.select);
    }

    /**
     * Activates mutation observation on the bound `<select>` element.
     *
     * Configuration:
     * - **childList**: Detects `<option>` / `<optgroup>` additions/removals.
     * - **subtree**: `false` (only direct children, no deep nesting).
     * - **attributes**: Tracks `selected`, `value`, `disabled` changes.
     *
     * Notes:
     * - Safe to call multiple times; `MutationObserver.observe()` replaces previous config.
     * - Mutations are debounced via {@link debounceTimer}.
     *
     * @public
     * @returns {void}
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
     * Hook invoked when debounced mutations are detected.
     *
     * Default behavior:
     * - No-op; consumers must override to implement custom change handling.
     *
     * Typical use cases:
     * - Sync internal state with the native `<select>` DOM.
     * - Trigger re-rendering of a virtual option list.
     * - Update accessibility attributes or external UI components.
     *
     * @public
     * @param {HTMLSelectElement} options - The current `<select>` element (same as {@link select}).
     * @returns {void}
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onChanged(selectElement: HTMLSelectElement): void {
        // override
    }

    /**
     * Stops mutation observation and releases resources.
     *
     * Behavior:
     * - Clears any pending {@link debounceTimer} to prevent stale {@link onChanged} invocations.
     * - Disconnects the `MutationObserver`.
     * - Idempotent: safe to call multiple times.
     *
     * Notes:
     * - After disconnection, no further mutations will be detected until {@link connect} is called again.
     *
     * @public
     * @returns {void}
     */
    public disconnect(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}