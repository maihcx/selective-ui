import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { Libs } from "../utils/libs";

/**
 * Base directive class representing a lightweight UI control.
 *
 * A Directive is a small interactive UI element that:
 * - Owns a single root HTMLElement
 * - Participates in the standard lifecycle (`init → mount → destroy`)
 * - Encapsulates behavior rather than complex rendering logic
 *
 * This particular implementation acts as a toggle control
 * (e.g., to open/close a dropdown).
 *
 * @extends Lifecycle
 */
export class Directive extends Lifecycle {

    /**
     * Root DOM node of the directive.
     * Created during initialization and removed on destroy.
     */
    node: HTMLElement;

    /**
     * Creates a new Directive instance and immediately initializes it.
     *
     * The lifecycle is automatically started:
     * constructor → init → mount
     */
    constructor() {
        super();
        this.init();
    }

    /**
     * Initializes the directive's DOM structure.
     *
     * Creates a clickable element that behaves like a button
     * and applies appropriate ARIA attributes for accessibility.
     *
     * Automatically transitions the lifecycle from:
     * NEW → INITIALIZED → MOUNTED
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
     * Updates the visual dropdown state of the directive.
     *
     * Toggles the `drop-down` CSS class on the root node,
     * allowing presentation logic to be handled purely via styles.
     *
     * @param value - True to indicate dropdown is open; false otherwise.
     */
    public setDropdown(value: boolean): void {
        this.node.classList.toggle("drop-down", !!value);
    }

    /**
     * Destroys the directive and cleans up DOM resources.
     *
     * Removes the root node from the DOM and ends the lifecycle.
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