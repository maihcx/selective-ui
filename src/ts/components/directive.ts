import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { Libs } from "../utils/libs";

/**
 * Minimal directive primitive for small interactive UI controls.
 *
 * A **Directive** is a lightweight, DOM-driven control that:
 * - Owns a single root {@link HTMLElement} ({@link node})
 * - Participates in the core lifecycle FSM via {@link Lifecycle}
 * - Encapsulates behavior (state toggles / event wiring) rather than complex rendering
 *
 * This implementation models a generic “toggle” affordance (commonly used to open/close a dropdown),
 * leaving styling and actual open/close mechanics to higher-level components.
 *
 * ### Lifecycle (Strict-ish FSM)
 * - Construction calls {@link init} immediately.
 * - {@link init} creates the DOM node, transitions `NEW → INITIALIZED`, then calls {@link mount}
 *   (resulting in `MOUNTED`).
 * - {@link destroy} removes the node and transitions to `DESTROYED` (idempotent guard).
 *
 * ### Idempotency / No-ops
 * - {@link setDropdown} is purely a DOM class toggle and is safe to call repeatedly.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - The root node is created with `role="button"` and an `aria-label`.
 * - Visual state is represented by toggling a CSS class (`"drop-down"`).
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 */
export class Directive extends Lifecycle {
    /**
     * Root DOM node for this directive.
     *
     * - Created during {@link init}.
     * - Must be appended/positioned by the owning container.
     * - Removed from DOM during {@link destroy}.
     */
    node: HTMLElement;

    /**
     * Creates a new Directive and immediately initializes it.
     *
     * Lifecycle progression:
     * `constructor()` → {@link init} → {@link mount}
     *
     * @returns {void}
     */
    constructor() {
        super();
        this.init();
    }

    /**
     * Initializes the directive's DOM structure and advances lifecycle state.
     *
     * Side effects:
     * - Creates a single clickable root element via {@link Libs.nodeCreator}.
     * - Applies `role="button"` and `aria-label` for accessibility.
     * - Transitions `NEW → INITIALIZED → MOUNTED` by calling `super.init()` then {@link mount}.
     *
     * @returns {void}
     * @override
     */
    public override init(): void {
        // Libs.nodeCreator returns Element, but this node
        // is guaranteed to be an HTMLElement in this context.
        this.node = Libs.nodeCreator({
            node: "div",
            classList: "selective-ui-directive",
            role: "button",
            ariaLabel: "Toggle dropdown",
        }) as HTMLElement;

        super.init();
        this.mount();
    }

    /**
     * Updates the directive's visual "dropdown open" state.
     *
     * Implementation:
     * - Toggles the `"drop-down"` CSS class on {@link node}.
     * - Presentation is expected to be handled purely via CSS.
     *
     * @param {boolean} value - `true` to indicate dropdown is open; `false` otherwise.
     * @returns {void}
     */
    public setDropdown(value: boolean): void {
        this.node.classList.toggle("drop-down", !!value);
    }

    /**
     * Destroys the directive and releases DOM resources.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Removes {@link node} from the DOM.
     * - Clears references and completes teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.node.remove();
        this.node = null;

        super.destroy();
    }
}