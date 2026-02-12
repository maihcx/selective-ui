import { Lifecycle } from "../../core/base/lifecycle";
import { LifecycleState } from "../../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../../types/utils/selective.type";
import { Libs } from "../../utils/libs";

/**
 * Lightweight UI state box that renders a "loading" indicator while data is being fetched,
 * processed, or updated asynchronously.
 *
 * ### Responsibility
 * - Owns a single DOM node representing the loading state.
 * - Exposes an imperative API (`show`, `hide`, `isVisible`) to be driven by higher-level
 *   controllers (e.g., AJAX search / pagination) and containers (e.g., Popup).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`. When `options` are provided, {@link initialize} is invoked and the
 *   instance transitions to `INITIALIZED` via {@link Lifecycle.init}.
 * - This component does **not** attach itself to the DOM; consumers append {@link node} to the
 *   desired container.
 * - {@link destroy} removes the node, clears references, and transitions to `DESTROYED`.
 *
 * ### Idempotency / No-ops
 * - {@link show} and {@link hide} are **no-ops** until {@link node} exists.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - Uses `role="status"` and `aria-live="polite"` so assistive technologies announce changes
 *   without interrupting the user.
 * - Visibility is controlled via the `"hide"` CSS class; hiding does not remove the element.
 * - The `"small"` CSS class is toggled by {@link show} to support a compact loading indicator
 *   when items are already present.
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 */
export class LoadingState extends Lifecycle {
    /**
     * Root DOM element for the loading state UI.
     *
     * - Created during {@link initialize}.
     * - Intended to be appended by the parent container (component does not auto-attach).
     * - Removed from DOM during {@link destroy}.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration source for loading message text.
     *
     * Expected to provide:
     * - `textLoading` (displayed while loading is active)
     */
    public options: SelectiveOptions | null = null;

    /**
     * Creates a new {@link LoadingState}.
     *
     * If `options` are provided, initialization runs immediately (creates {@link node} and
     * transitions to `INITIALIZED`).
     *
     * @param {SelectiveOptions | null} [options=null] - Configuration containing the loading message text.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes internal resources for this component.
     *
     * Side effects:
     * - Creates the root `div` node with base CSS classes: `"seui-loading-state"` and `"hide"`.
     * - Sets initial text to `options.textLoading`.
     * - Applies `role="status"` and `aria-live="polite"`.
     * - Stores the options reference and calls {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object containing loading text.
     * @returns {void}
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator<HTMLDivElement>({
            node: "div",
            classList: ["seui-loading-state", "hide"],
            textContent: options.textLoading,
            role: "status",
            ariaLive: "polite",
        });

        this.init();
    }

    /**
     * Shows the loading indicator.
     *
     * Behavior:
     * - Updates the text to the latest `options.textLoading` (in case options changed).
     * - Toggles the `"small"` CSS class when `hasItems` is true to display a compact variant.
     * - Removes the `"hide"` class to make the node visible.
     *
     * No-op if {@link node} or {@link options} are not initialized.
     *
     * @param {boolean} hasItems - Whether existing items are already present (enables compact loading style).
     * @returns {void}
     */
    public show(hasItems: boolean): void {
        if (!this.node || !this.options) return;

        this.node.textContent = this.options.textLoading;
        this.node.classList.toggle("small", !!hasItems);
        this.node.classList.remove("hide");
    }

    /**
     * Hides the loading indicator by applying the `"hide"` CSS class.
     *
     * This does not remove the element from the DOM.
     * No-op if {@link node} is not initialized.
     *
     * @returns {void}
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Whether the loading indicator is currently visible.
     *
     * @returns {boolean} `true` when {@link node} exists and does not have the `"hide"` class.
     */
    public get isVisible(): boolean {
        return !!this.node && !this.node.classList.contains("hide");
    }

    /**
     * Releases resources owned by this component.
     *
     * - Removes the root DOM node (if present).
     * - Clears stored options and internal references.
     * - Transitions to `DESTROYED`.
     *
     * Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.options = null;

        this.node?.remove();
        this.node = null;

        super.destroy();
    }
}