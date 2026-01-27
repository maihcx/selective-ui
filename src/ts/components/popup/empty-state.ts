import { Lifecycle } from "../../core/base/lifecycle";
import { EmptyStateType } from "../../types/components/state.box.type";
import { LifecycleState } from "../../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../../types/utils/selective.type";
import { Libs } from "../../utils/libs";

/**
 * UI component that represents an empty state.
 *
 * The empty state is used to display contextual feedback when:
 * - No data is available
 * - A search yields no matching results
 *
 * It manages a single DOM node and participates in the standard lifecycle.
 *
 * @extends Lifecycle
 */
export class EmptyState extends Lifecycle {

    /**
     * Root DOM element of the empty state component.
     * Created during initialization and removed on destroy.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration options providing display text
     * for different empty state scenarios.
     */
    public options: SelectiveOptions | null = null;

    /**
     * Creates a new EmptyState instance.
     *
     * If options are provided, the component is initialized immediately.
     *
     * @param options - Configuration containing messages for
     *                  "no data" and "not found" states.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes the empty state component.
     *
     * Creates the root DOM element, applies accessibility attributes,
     * stores configuration options, and starts the lifecycle.
     *
     * @param options - Configuration object containing empty state messages.
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-empty-state", "hide"],
            role: "status",
            ariaLive: "polite",
        }) as HTMLDivElement;

        this.init();
    }

    /**
     * Displays the empty state message.
     *
     * The message content depends on the provided type:
     * - `"nodata"`: no data available
     * - `"notfound"`: no matching search results
     *
     * @param type - Type of empty state to display.
     *               Defaults to `"nodata"`.
     */
    public show(type: EmptyStateType = "nodata"): void {
        if (!this.node || !this.options) return;

        const text =
            type === "notfound"
                ? this.options.textNotFound
                : this.options.textNoData;

        this.node.textContent = text;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the empty state component.
     *
     * This does not remove the element from the DOM;
     * it only updates its visibility via CSS.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the empty state is currently visible.
     *
     * @returns True if the empty state is shown; otherwise false.
     */
    public get isVisible(): boolean {
        return !!this.node && !this.node.classList.contains("hide");
    }

    /**
     * Destroys the empty state component.
     *
     * Removes the DOM node, clears stored options,
     * and terminates the lifecycle.
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.options = null;

        this.node?.remove();
        this.node = null;

        super.destroy();
    }
}