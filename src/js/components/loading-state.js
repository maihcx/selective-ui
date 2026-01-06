import { Libs } from "../utils/libs";

export class LoadingState {

    /** @type {HTMLDivElement} */
    node = null;
    
    options = null;

    /**
     * Represents a loading state component that displays a loading message during data fetch or processing.
     * Provides methods to show/hide the state and check its visibility.
     */
    constructor(options = null) { 
        options && this.init(options); 
    }
    
    /**
     * Initializes the loading state element with ARIA attributes for accessibility and stores configuration options.
     *
     * @param {object} options - Configuration object containing text for the loading message.
     */
    init(options) {
        this.options = options;
        this.node = /** @type {HTMLDivElement} */(Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-loading-state", "hide"],
            textContent: options.textLoading,
            role: "status",
            ariaLive: "polite"
        }));
    }

    /**
     * Displays the loading state message and adjusts its size based on whether items are present.
     *
     * @param {boolean} hasItems - If true, applies a "small" style for compact display.
     */
    show(hasItems) {
        this.node.textContent = this.options.textLoading;
        this.node.classList.toggle("small", hasItems);
        this.node.classList.remove("hide");
    }

    /**
     * Hides the loading state element by adding the "hide" class.
     */
    hide() {
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the loading state is currently visible.
     *
     * @returns {boolean} - True if visible, false otherwise.
     */
    get isVisible() {
        return !this.node.classList.contains("hide");
    }
}