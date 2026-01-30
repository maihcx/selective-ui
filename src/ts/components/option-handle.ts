import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { MountViewResult } from "../types/utils/libs.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";

/**
 * OptionHandle
 *
 * Headless-friendly, DOM-driven UI control that exposes bulk selection actions
 * ("Select all" / "Deselect all") for multiple-selection experiences.
 *
 * ### Responsibility
 * - Creates and owns a small DOM subtree (root + two action elements).
 * - Exposes registration APIs for action callbacks (`onSelectAll`, `onDeSelectAll`).
 * - Reflects feature flags from {@link SelectiveOptions} by showing/hiding itself.
 * - Participates in the library {@link Lifecycle} finite-state machine (FSM).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`.
 * - {@link initialize} builds DOM and calls `init()` → transitions to `INITIALIZED`.
 * - {@link update} is safe to call repeatedly; it re-evaluates visibility and then
 *   delegates to `super.update()` (idempotent once in `UPDATED`).
 * - {@link destroy} is a terminal transition; subsequent calls are no-ops.
 *
 * ### Event / Callback Flow
 * - User interaction is handled via DOM `onclick` handlers bound during initialization.
 * - On click, this component dispatches callbacks through {@link iEvents.callFunctions}.
 * - This class does not own selection state; it only emits intent via callbacks.
 *
 * ### Visibility Contract
 * Visible only when BOTH flags are enabled:
 * - `options.multiple` truthy (after {@link Libs.string2Boolean} coercion)
 * - `options.selectall` truthy (after {@link Libs.string2Boolean} coercion)
 *
 * ### DOM / a11y Notes
 * - Uses `<a>` elements as action triggers. This is a DOM-side effect and may have
 *   accessibility implications depending on `href`, keyboard handling, and ARIA.
 *
 * @extends Lifecycle
 */
export class OptionHandle extends Lifecycle {
    /**
     * Result returned by {@link Libs.mountNode}.
     *
     * Stores the mounted view structure so the component can keep a stable reference
     * to its created DOM nodes. `null` before {@link initialize}.
     *
     * @internal
     */
    private nodeMounted: MountViewResult<any> | null = null;

    /**
     * Root element of this control.
     *
     * Created during {@link initialize}. This node is used by {@link show}/{@link hide}
     * and removed during {@link destroy}.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration snapshot used for:
     * - labels (`textSelectAll`, `textDeselectAll`)
     * - feature flags (`multiple`, `selectall`)
     *
     * Treated as read-only after initialization; cleared on {@link destroy}.
     *
     * @internal
     */
    private options: SelectiveOptions | null = null;

    /**
     * Callback list invoked when the "Select all" control is activated.
     *
     * Callbacks are invoked via {@link iEvents.callFunctions}. This component does not
     * interpret arguments; it delegates invocation semantics to the dispatcher helper.
     *
     * @internal
     */
    private actionOnSelectAll: Array<(...args: unknown[]) => unknown> = [];

    /**
     * Callback list invoked when the "Deselect all" control is activated.
     *
     * Callbacks are invoked via {@link iEvents.callFunctions}. This component does not
     * interpret arguments; it delegates invocation semantics to the dispatcher helper.
     *
     * @internal
     */
    private actionOnDeSelectAll: Array<(...args: unknown[]) => unknown> = [];

    /**
     * Creates an {@link OptionHandle}.
     *
     * If `options` is provided, the instance immediately performs {@link initialize}
     * and enters the {@link Lifecycle} (calls `init()` internally).
     * If `options` is `null`, the instance stays in `NEW` until initialized elsewhere.
     *
     * @param options - Feature flags and labels for the two actions.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes DOM and binds event handlers.
     *
     * DOM structure (conceptually):
     * - Root: `div.seui-option-handle.hide`
     * - Child: `a.seui-option-handle-item` ("Select all")
     * - Child: `a.seui-option-handle-item` ("Deselect all")
     *
     * Click handlers:
     * - "Select all" → dispatches {@link actionOnSelectAll} via {@link iEvents.callFunctions}
     * - "Deselect all" → dispatches {@link actionOnDeSelectAll} via {@link iEvents.callFunctions}
     *
     * Side effects:
     * - Creates DOM nodes (via {@link Libs.mountNode})
     * - Transitions lifecycle by calling `init()` at the end
     *
     * @param options - Configuration providing labels and feature flags.
     * @internal
     */
    private initialize(options: SelectiveOptions): void {
        this.nodeMounted = Libs.mountNode({
            OptionHandle: {
                tag: { node: "div", classList: ["seui-option-handle", "hide"] },
                child: {
                    SelectAll: {
                        tag: {
                            node: "a",
                            classList: "seui-option-handle-item",
                            textContent: options.textSelectAll,
                            onclick: () => {
                                iEvents.callFunctions(this.actionOnSelectAll);
                            },
                        },
                    },
                    DeSelectAll: {
                        tag: {
                            node: "a",
                            classList: "seui-option-handle-item",
                            textContent: options.textDeselectAll,
                            onclick: () => {
                                iEvents.callFunctions(this.actionOnDeSelectAll);
                            },
                        },
                    },
                },
            },
        }) as MountViewResult<any>;

        this.node = this.nodeMounted.view as HTMLDivElement;
        this.options = options;

        this.init();
    }

    /**
     * Computes whether this control is enabled/available under current configuration.
     *
     * This method performs a boolean coercion using {@link Libs.string2Boolean} to
     * support string-like flags in {@link SelectiveOptions}.
     *
     * No-ops:
     * - Returns `false` when {@link options} has not been set.
     *
     * @returns `true` when both `multiple` and `selectall` are enabled; otherwise `false`.
     * @internal
     */
    private available(): boolean {
        if (!this.options) return false;
        return Libs.string2Boolean(this.options.multiple) && Libs.string2Boolean(this.options.selectall);
    }

    /**
     * Re-evaluates visibility and advances the lifecycle update step.
     *
     * Behavior:
     * - If {@link node} exists, toggles the `hide` class based on {@link available}.
     * - Always delegates to `super.update()` to participate in the FSM transition.
     *
     * Idempotency:
     * - Repeated calls remain safe; DOM class toggling is stable and the underlying
     *   {@link Lifecycle} update is expected to be idempotent after the first transition.
     *
     * @override
     */
    public override update(): void {
        if (this.node) {
            if (this.available()) {
                this.show();
            } else {
                this.hide();
            }
        }

        super.update();
    }

    /**
     * Shows the control by removing the `hide` CSS class on the root node.
     *
     * No-ops when {@link node} is `null`.
     */
    public show(): void {
        if (!this.node) return;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the control by adding the `hide` CSS class on the root node.
     *
     * No-ops when {@link node} is `null`.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Registers a callback for the external "Select all" intent.
     *
     * Notes:
     * - This is an "external event" hook: it notifies the host/controller layer that a
     *   bulk action was requested. This component does not mutate selection state itself.
     * - Callbacks are executed by {@link iEvents.callFunctions} when the corresponding
     *   DOM control is activated.
     *
     * @param action - Callback invoked on activation; ignored when not a function.
     */
    public onSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") {
            this.actionOnSelectAll.push(action);
        }
    }

    /**
     * Registers a callback for the external "Deselect all" intent.
     *
     * Notes:
     * - This is an "external event" hook: it notifies the host/controller layer that a
     *   bulk deselection was requested. This component does not mutate selection state itself.
     * - Callbacks are executed by {@link iEvents.callFunctions} when the corresponding
     *   DOM control is activated.
     *
     * @param action - Callback invoked on activation; ignored when not a function.
     */
    public onDeSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") {
            this.actionOnDeSelectAll.push(action);
        }
    }

    /**
     * Tears down DOM resources and terminates the lifecycle.
     *
     * Strict FSM / idempotency:
     * - If already in {@link LifecycleState.DESTROYED}, this method returns immediately.
     *
     * Side effects:
     * - Removes the root DOM node from the document (if present).
     * - Clears references to options and callback lists to allow GC.
     * - Delegates to `super.destroy()` to finalize the lifecycle transition.
     *
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.node.remove();

        this.options = null;
        this.actionOnSelectAll = null;
        this.actionOnDeSelectAll = null;
        this.node = null

        super.destroy();
    }
}