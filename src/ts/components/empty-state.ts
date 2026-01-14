import { EmptyStateOptions, EmptyStateType } from "../types/components/state.box.type";
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class EmptyState {
    node: HTMLDivElement | null = null;

    options: EmptyStateOptions | null = null;

    /**
     * Represents an empty state component that displays a message when no data or search results are available.
     * Provides methods to show/hide the state and check its visibility.
     */
    constructor(options: EmptyStateOptions | null = null) {
        if (options) this.init(options);
    }

    /**
     * Initializes the empty state element with ARIA attributes for accessibility and stores configuration options.
     *
     * @param {object} options - Configuration object containing text for "no data" and "not found" states.
     */
    init(options: EmptyStateOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-empty-state", "hide"],
            role: "status",
            ariaLive: "polite",
        }) as HTMLDivElement;
    }

    /**
     * Displays the empty state message based on the provided type.
     *
     * @param {"notfound" | "nodata"} [type="nodata"] - Determines which message to show:
     *        "notfound" for search results not found, "nodata" for no available data.
     */
    show(type: EmptyStateType = "nodata"): void {
        if (!this.node || !this.options) return;

        const text = type === "notfound" ? this.options.textNotFound : this.options.textNoData;

        this.node.textContent = text;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the empty state element by adding the "hide" class.
     */
    hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the empty state is currently visible.
     *
     * @returns {boolean} - True if visible, false otherwise.
     */
    get isVisible(): boolean {
        return !!this.node && !this.node.classList.contains("hide");
    }
}