import {Libs} from "../utils/libs.js";

/**
 * @class
 */
export class EmptyState {
    /**
     * @type {HTMLDivElement}
     */
    node = null;

    options = null;

    /**
     * Represents an empty state component that displays a message when no data or search results are available.
     * Provides methods to show/hide the state and check its visibility.
     */
    constructor(options = null) {
        options && this.init(options);
    }

    /**
     * Initializes the empty state element with ARIA attributes for accessibility and stores configuration options.
     *
     * @param {object} options - Configuration object containing text for "no data" and "not found" states.
     */
    init(options) {
        this.options = options;
        
        this.node = /** @type {HTMLDivElement} */ (Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-empty-state", "hide"],
            role: "status",
            ariaLive: "polite"
        }));
    }

    /**
     * Displays the empty state message based on the provided type.
     *
     * @param {"notfound" | "nodata"} [type="nodata"] - Determines which message to show:
     *        "notfound" for search results not found, "nodata" for no available data.
     */
    show(type = "nodata") {
        const text = type === "notfound" 
            ? this.options.textNotFound 
            : this.options.textNoData;
        
        this.node.textContent = text;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the empty state element by adding the "hide" class.
     */
    hide() {
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the empty state is currently visible.
     *
     * @returns {boolean} - True if visible, false otherwise.
     */
    get isVisible() {
        return !this.node.classList.contains("hide");
    }
}