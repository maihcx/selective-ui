import {Libs} from "../utils/libs.js";

/**
 * @class
 */
export class Directive {
    constructor() {
        this.#init();
    }
    /**
     * @type {Element}
     */
    node = null;
    
    /**
     * Represents a directive button element used to toggle dropdown state.
     * Initializes a clickable node with appropriate ARIA attributes for accessibility.
     */
    #init() {
        this.node = Libs.nodeCreator({
            node: "div", classList: "selective-ui-directive", role: "button", ariaLabel: "Toggle dropdown"
        });
    }
    
    /**
     * Sets the dropdown state by toggling the "drop-down" CSS class on the directive node.
     *
     * @param {boolean} value - If true, adds the "drop-down" class; otherwise removes it.
     */
    setDropdown(value) {
        if (value) {
            this.node.classList.add("drop-down");
        }
        else {
            this.node.classList.remove("drop-down");
        }
    }
}