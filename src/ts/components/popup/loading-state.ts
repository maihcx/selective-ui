import { Lifecycle } from "../../core/base/lifecycle";
import { LifecycleState } from "../../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../../types/utils/selective.type";
import { Libs } from "../../utils/libs";

/**
 * UI component representing a loading state.
 *
 * The loading state is displayed while data is being fetched,
 * processed, or updated asynchronously.
 *
 * It manages a single DOM element and participates in the
 * standard lifecycle provided by `Lifecycle`.
 *
 * @extends Lifecycle
 */
export class LoadingState extends Lifecycle {

    /**
     * Root DOM element of the loading state component.
     * Created during initialization and removed on destroy.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration options containing the loading message text.
     */
    public options: SelectiveOptions | null = null;

    /**
     * Creates a new LoadingState instance.
     *
     * If options are provided, the component is initialized immediately.
     *
     * @param options - Configuration object containing the loading message text.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes the loading state component.
     *
     * Creates the root DOM element, sets the initial loading text,
     * applies accessibility attributes, stores configuration options,
     * and starts the lifecycle.
     *
     * @param options - Configuration object containing loading text.
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;

        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["selective-ui-loading-state", "hide"],
            textContent: options.textLoading,
            role: "status",
            ariaLive: "polite",
        }) as HTMLDivElement;

        this.init();
    }

    /**
     * Displays the loading state.
     *
     * When items are already present, the loading state can be shown
     * in a compact form by applying a reduced ("small") style.
     *
     * @param hasItems - True if existing items are present,
     *                   enabling a compact loading indicator.
     */
    public show(hasItems: boolean): void {
        if (!this.node || !this.options) return;

        this.node.textContent = this.options.textLoading;
        this.node.classList.toggle("small", !!hasItems);
        this.node.classList.remove("hide");
    }

    /**
     * Hides the loading state.
     *
     * This only toggles visibility via CSS and does not
     * remove the element from the DOM.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Indicates whether the loading state is currently visible.
     *
     * @returns True if the loading indicator is shown; otherwise false.
     */
    public get isVisible(): boolean {
        return !!this.node && !this.node.classList.contains("hide");
    }

    /**
     * Destroys the loading state component.
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