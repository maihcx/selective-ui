import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Libs } from "../utils/libs";

/**
 * PlaceHolder
 *
 * DOM-driven placeholder view for the Select UI when no value is selected.
 * This component is intentionally minimal: it owns a single DOM node and exposes
 * getter/setter APIs for the placeholder content.
 *
 * ### Responsibility
 * - Create and own the placeholder DOM element (`.selective-ui-placeholder`).
 * - Render placeholder content from {@link SelectiveOptions.placeholder}.
 * - Support runtime updates via {@link set}, optionally persisting into options.
 * - Participate in the shared {@link Lifecycle} FSM.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`.
 * - {@link initialize} creates DOM and calls `init()` → transitions to `INITIALIZED`.
 * - Updates are data-driven via {@link set}; this class does not override `update()`.
 * - {@link destroy} removes the DOM node and clears references; repeat calls are no-ops
 *   once {@link LifecycleState.DESTROYED}.
 *
 * ### DOM / Rendering Notes
 * - Content is written through `innerHTML` (DOM side effect).
 * - {@link Libs.tagTranslate} is applied to the incoming value before rendering.
 * - When `options.allowHtml` is falsy, HTML is stripped via {@link Libs.stripHtml}
 *   to reduce injection risk. When truthy, translated HTML is rendered as-is.
 *
 * @extends Lifecycle
 */
export class PlaceHolder extends Lifecycle {
    /**
     * Root DOM element for the placeholder.
     *
     * Created during {@link initialize}. Removed from the DOM during {@link destroy}.
     * `null` before initialization and after destruction.
     */
    public node: HTMLElement | null = null;

    /**
     * Configuration snapshot used to render and optionally persist placeholder content.
     *
     * Key fields used by this component:
     * - `placeholder`: initial/current placeholder text/markup
     * - `allowHtml`: controls whether HTML is rendered or stripped
     *
     * Cleared during {@link destroy}.
     *
     * @internal
     */
    private options: SelectiveOptions | null = null;

    /**
     * Creates a new {@link PlaceHolder}.
     *
     * If `options` is provided, the component initializes immediately and enters the
     * {@link Lifecycle} by calling `init()` internally. If `options` is `null`, the
     * instance remains in `NEW` until initialized elsewhere (by design).
     *
     * @param options - Select UI options containing placeholder content and rendering flags.
     */
    constructor(options: SelectiveOptions | null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Builds the placeholder DOM node and starts the lifecycle.
     *
     * Side effects:
     * - Creates a `div.selective-ui-placeholder` node via {@link Libs.nodeCreator}.
     * - Writes initial placeholder content into `innerHTML`.
     * - Transitions the lifecycle by calling `init()`.
     *
     * @param options - Options providing placeholder content and rendering behavior.
     * @internal
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
     * Returns the current placeholder content as stored in {@link options}.
     *
     * This method does not read from the DOM; it returns the configuration value.
     *
     * @returns The configured placeholder string, or an empty string if uninitialized.
     */
    public get(): string {
        return this.options?.placeholder ?? "";
    }

    /**
     * Updates the rendered placeholder content.
     *
     * Behavior:
     * - No-ops if the component is not initialized (`node`/`options` missing).
     * - Optionally persists the new value back into {@link options.placeholder}.
     * - Applies {@link Libs.tagTranslate} before rendering.
     * - Renders using `innerHTML`:
     *   - If `options.allowHtml` is truthy, renders translated HTML.
     *   - Otherwise, strips HTML via {@link Libs.stripHtml} and renders safe text/markup.
     *
     * @param value - New placeholder content to render.
     * @param isSave - When `true` (default), also updates {@link options.placeholder}.
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
     * Disposes the placeholder DOM and terminates the lifecycle.
     *
     * Strict FSM / idempotency:
     * - If already {@link LifecycleState.DESTROYED}, returns immediately.
     *
     * Side effects:
     * - Removes {@link node} from the DOM (if present).
     * - Clears references to allow garbage collection.
     *
     * @override
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