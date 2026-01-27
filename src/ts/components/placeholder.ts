import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Libs } from "../utils/libs";

/**
 * UI component representing a placeholder for the Select UI.
 *
 * The placeholder displays contextual guidance when no value is selected.
 * It supports dynamic updates and optional HTML content, depending on configuration.
 *
 * The component manages a single DOM node and participates
 * in the standard `Lifecycle`.
 *
 * @extends Lifecycle
 */
export class PlaceHolder extends Lifecycle {

    /**
     * Root DOM element of the placeholder component.
     * Created during initialization and removed on destroy.
     */
    public node: HTMLElement | null = null;

    /**
     * Configuration options containing placeholder text
     * and rendering preferences (e.g., allowHtml).
     */
    private options: SelectiveOptions | null = null;

    /**
     * Creates a new PlaceHolder instance.
     *
     * If options are provided, the component is initialized immediately.
     *
     * @param options - Configuration object containing placeholder text
     *                  and HTML rendering settings.
     */
    constructor(options: SelectiveOptions | null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes the placeholder component.
     *
     * Creates the DOM node, applies base styling,
     * renders the initial placeholder content,
     * stores configuration options, and starts the lifecycle.
     *
     * @param options - Configuration object containing placeholder settings.
     */
    private initialize(options: SelectiveOptions): void {
        this.node = Libs.nodeCreator({
            node: "div",
            classList: "selective-ui-placeholder",
            innerHTML: options.placeholder,
        }) as HTMLElement;

        this.options = options;

        this.init();
    }

    /**
     * Returns the current placeholder text from the configuration.
     *
     * @returns The current placeholder value, or an empty string if not set.
     */
    public get(): string {
        return this.options?.placeholder ?? "";
    }

    /**
     * Updates the placeholder content.
     *
     * The value can optionally be persisted back into the configuration.
     * HTML rendering is controlled by the `allowHtml` option:
     * - When enabled, translated HTML is rendered
     * - When disabled, HTML tags are stripped for safety
     *
     * @param value - The new placeholder content.
     * @param isSave - Whether to persist the value in the configuration.
     *                 Defaults to `true`.
     */
    public set(value: string, isSave: boolean = true): void {
        if (!this.node || !this.options) return;

        if (isSave) {
            this.options.placeholder = value;
        }

        const translated = Libs.tagTranslate(value);
        this.node.innerHTML = this.options.allowHtml
            ? translated
            : Libs.stripHtml(translated);
    }

    /**
     * Destroys the placeholder component.
     *
     * Removes the DOM node, clears stored options,
     * and terminates the lifecycle.
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        
        this.node?.remove();
        this.node = null;
        this.options = null;

        super.destroy();
    }
}