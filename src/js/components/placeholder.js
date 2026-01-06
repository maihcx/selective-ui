import {Libs} from "../utils/libs.js";

/**
 * @class
 */
export class PlaceHolder {
    /**
     * Represents a placeholder component for the Select UI, allowing dynamic updates to placeholder text.
     * Supports HTML content based on configuration and provides methods to get or set the placeholder value.
     */
    constructor(options) {
        options && this.init(options);
    }

    /**
     * @type {Element}
     */
    node = null;
    
    #options = null;
    
    /**
     * Initializes the placeholder element with provided options and renders its initial content.
     *
     * @param {object} options - Configuration object containing placeholder text and HTML allowance.
     */
    init(options) {
        this.node = Libs.nodeCreator({
            node: "div", classList: "selective-ui-placeholder", innerHTML: options.placeholder
        });
        this.#options = options;
    }
    
    /**
     * Retrieves the current placeholder text from the configuration.
     *
     * @returns {string} - The current placeholder text.
     */
    get() {
        return this.#options.placeholder
    }
    
    /**
     * Updates the placeholder text and optionally saves it to the configuration.
     * Applies HTML sanitization based on the allowHtml setting.
     *
     * @param {string} value - The new placeholder text.
     * @param {boolean} [isSave=true] - Whether to persist the new value in the configuration.
     */
    set(value, isSave = true) {
        if (isSave) {
            this.#options.placeholder = value;
        }
        value = Libs.tagTranslate(value);
        this.node.innerHTML = this.#options.allowHtml ? value : Libs.stripHtml(value);
    }
}