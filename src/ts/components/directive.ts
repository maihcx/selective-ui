
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class Directive {
    /**
     * @type {HTMLElement}
     */
    node: HTMLElement;

    constructor() {
        this.node = this._init();
    }

    /**
     * Represents a directive button element used to toggle dropdown state.
     * Initializes a clickable node with appropriate ARIA attributes for accessibility.
     */
    private _init(): HTMLElement {
        // Libs.nodeCreator returns Element, but this node is always an HTMLElement in practice.
        return Libs.nodeCreator({
            node: "div",
            classList: "selective-ui-directive",
            role: "button",
            ariaLabel: "Toggle dropdown",
        }) as HTMLElement;
    }

    /**
     * Sets the dropdown state by toggling the "drop-down" CSS class on the directive node.
     *
     * @param {boolean} value - If true, adds the "drop-down" class; otherwise removes it.
     */
    setDropdown(value: boolean): void {
        this.node.classList.toggle("drop-down", !!value);
    }
}