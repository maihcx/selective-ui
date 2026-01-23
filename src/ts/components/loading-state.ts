import { SelectiveOptions } from "../types/utils/selective.type";
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class LoadingState {
    public node: HTMLDivElement | null = null;

    public options: SelectiveOptions | null = null;

    /**
     * Represents a loading state component that displays a loading message during data fetch or processing.
     * Provides methods to show/hide the state and check its visibility.
     */
    public constructor(options: SelectiveOptions | null = null) {
        if (options) this.init(options);
    }

    /**
     * Initializes the loading state element with ARIA attributes for accessibility and stores configuration options.
     *
     * @param {object} options - Configuration object containing text for the loading message.
     */
    private init(options: SelectiveOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-loading-state", "hide"],
            textContent: options.textLoading,
            role: "status",
            ariaLive: "polite",
        }) as HTMLDivElement;
    }

    /**
     * Displays the loading state message and adjusts its size based on whether items are present.
     *
     * @param {boolean} hasItems - If true, applies a "small" style for compact display.
     */
    public show(hasItems: boolean): void {
        if (!this.node || !this.options) return;

        this.node.textContent = this.options.textLoading;
        this.node.classList.toggle("small", !!hasItems);
        this.node.classList.remove("hide");
    }

    /**
     * Hides the loading state element by adding the "hide" class.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the loading state is currently visible.
     *
     * @returns {boolean} - True if visible, false otherwise.
     */
    public get isVisible(): boolean {
        return !!this.node && !this.node.classList.contains("hide");
    }
}