import { Lifecycle } from "../../core/base/lifecycle";
import { EmptyStateType } from "../../types/components/state.box.type";
import { LifecycleState } from "../../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../../types/utils/selective.type";
import { Libs } from "../../utils/libs";

/**
 * Lightweight UI state box that renders contextual "empty" feedback.
 *
 * ### Responsibility
 * - Owns a single DOM node that can be shown/hidden to communicate:
 *   - **No data** (no options available)
 *   - **Not found** (search produced zero visible results)
 * - Exposes a minimal imperative API (`show`, `hide`, `isVisible`) used by higher-level
 *   controllers/components (e.g., popup/search flows).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`. When `options` are provided, {@link initialize} is called and the
 *   instance transitions to `INITIALIZED` via {@link Lifecycle.init}.
 * - This component does not automatically mount itself into a container; consumers are expected
 *   to append {@link node} where appropriate.
 * - {@link destroy} removes the node and transitions to `DESTROYED`.
 *
 * ### Idempotency / No-ops
 * - {@link show} and {@link hide} are **no-ops** until {@link node} exists.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - Uses `role="status"` and `aria-live="polite"` so screen readers announce changes without
 *   interrupting the user.
 * - Visibility is controlled via the `"hide"` CSS class; hiding does not remove the element.
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 * @see {@link EmptyStateType}
 */
export class EmptyState extends Lifecycle {
    /**
     * Root DOM element for the empty state UI.
     *
     * - Created during {@link initialize}.
     * - Intended to be appended by the parent container (component does not auto-attach).
     * - Removed from DOM during {@link destroy}.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration source for empty state messages.
     *
     * Expected to provide at least:
     * - `textNoData` (for `"nodata"`)
     * - `textNotFound` (for `"notfound"`)
     */
    public options: SelectiveOptions | null = null;

    /**
     * Creates a new {@link EmptyState}.
     *
     * If `options` are provided, initialization runs immediately (creates {@link node} and
     * transitions to `INITIALIZED`).
     *
     * @param {SelectiveOptions | null} [options=null] - Configuration containing empty state messages.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes internal resources for this component.
     *
     * Side effects:
     * - Creates the root `div` node with `role="status"` and `aria-live="polite"`.
     * - Applies base CSS classes: `"seui-empty-state"` and `"hide"`.
     * - Stores the options reference and calls {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object containing empty state messages.
     * @returns {void}
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator<HTMLDivElement>({
            node: "div",
            classList: ["seui-empty-state", "hide"],
            role: "status",
            ariaLive: "polite",
        });

        this.init();
    }

    /**
     * Shows the empty state message for the given scenario.
     *
     * - `"nodata"`: uses `options.textNoData`
     * - `"notfound"`: uses `options.textNotFound`
     *
     * No-op if {@link node} or {@link options} are not initialized.
     *
     * @param {EmptyStateType} [type="nodata"] - Which empty state message to display.
     * @returns {void}
     */
    public show(type: EmptyStateType = "nodata"): void {
        if (!this.node || !this.options) return;

        const text =
            type === "notfound"
                ? this.options.textNotFound
                : this.options.textNoData;

        this.node.textContent = text;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the empty state node by applying the `"hide"` CSS class.
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
     * Whether the empty state is currently visible.
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