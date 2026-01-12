import { DefaultConfig } from "../types/utils/istorage.type";
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class PlaceHolder {
    /**
     * @type {HTMLElement | null}
     */
    node: HTMLElement | null = null;

    private _options: DefaultConfig | null = null;

    /**
     * Represents a placeholder component for the Select UI, allowing dynamic updates to placeholder text.
     * Supports HTML content based on configuration and provides methods to get or set the placeholder value.
     */
    constructor(options: DefaultConfig | null) {
        if (options) this.init(options);
    }

    /**
     * Initializes the placeholder element with provided options and renders its initial content.
     *
     * @param {object} options - Configuration object containing placeholder text and HTML allowance.
     */
    init(options: DefaultConfig): void {
        this.node = Libs.nodeCreator({
            node: "div",
            classList: "selective-ui-placeholder",
            innerHTML: options.placeholder,
        }) as HTMLElement;

        this._options = options;
    }

    /**
     * Retrieves the current placeholder text from the configuration.
     *
     * @returns {string} - The current placeholder text.
     */
    get(): string {
        return this._options?.placeholder ?? "";
    }

    /**
     * Updates the placeholder text and optionally saves it to the configuration.
     * Applies HTML sanitization based on the allowHtml setting.
     *
     * @param {string} value - The new placeholder text.
     * @param {boolean} [isSave=true] - Whether to persist the new value in the configuration.
     */
    set(value: string, isSave: boolean = true): void {
        if (!this.node || !this._options) return;

        if (isSave) this._options.placeholder = value;

        const translated = Libs.tagTranslate(value);
        this.node.innerHTML = this._options.allowHtml ? translated : Libs.stripHtml(translated);
    }
}