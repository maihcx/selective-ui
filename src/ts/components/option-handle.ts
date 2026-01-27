import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { MountViewResult } from "../types/utils/libs.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";

/**
 * UI control that exposes "Select All" / "Deselect All" actions
 * for multiple-selection lists.
 *
 * Responsibilities:
 * - Renders two action controls (links/buttons)
 * - Shows/hides itself based on configuration flags
 * - Allows registration of callbacks for both actions
 * - Participates in the standard `Lifecycle`
 *
 * Visibility rule:
 * - Visible only when `options.multiple` and `options.selectall` are truthy.
 *
 * @extends Lifecycle
 */
export class OptionHandle extends Lifecycle {

    /**
     * Internal reference to the mounted node structure returned by `Libs.mountNode`.
     * Used to access typed tags if needed. Null before initialization.
     */
    private nodeMounted: MountViewResult<any> | null = null;

    /**
     * Root DOM element of the option handle component.
     * Created during initialization and removed on destroy.
     */
    public node: HTMLDivElement | null = null;

    /**
     * Configuration options controlling labels and feature flags.
     * (e.g., textSelectAll, textDeselectAll, multiple, selectall)
     */
    private options: SelectiveOptions | null = null;

    /**
     * Registered callbacks executed when "Select All" is activated.
     */
    private actionOnSelectAll: Array<(...args: unknown[]) => unknown> = [];

    /**
     * Registered callbacks executed when "Deselect All" is activated.
     */
    private actionOnDeSelectAll: Array<(...args: unknown[]) => unknown> = [];

    /**
     * Creates a new OptionHandle control.
     *
     * If `options` are provided, the component is initialized immediately and
     * enters the lifecycle (init). Otherwise, call a custom initializer later
     * to set it up.
     *
     * @param options - Configuration with texts and feature flags.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Initializes the option handle UI.
     *
     * Builds the DOM:
     * - Root: `.selective-ui-option-handle.hide`
     * - Children: "Select All" and "Deselect All" controls
     *
     * Wires their click handlers to invoke registered callbacks
     * via the `iEvents.callFunctions` helper.
     *
     * @param options - Configuration providing labels and feature flags.
     */
    private initialize(options: SelectiveOptions): void {
        this.nodeMounted = Libs.mountNode({
            OptionHandle: {
                tag: { node: "div", classList: ["selective-ui-option-handle", "hide"] },
                child: {
                    SelectAll: {
                        tag: {
                            node: "a",
                            classList: "selective-ui-option-handle-item",
                            textContent: options.textSelectAll,
                            onclick: () => {
                                iEvents.callFunctions(this.actionOnSelectAll);
                            },
                        },
                    },
                    DeSelectAll: {
                        tag: {
                            node: "a",
                            classList: "selective-ui-option-handle-item",
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
     * Returns whether the handle should be available (and thus visible)
     * based on current configuration flags.
     *
     * Availability requires:
     * - `multiple` is truthy
     * - `selectall` is truthy
     *
     * @returns True if both features are enabled; otherwise false.
     */
    private available(): boolean {
        if (!this.options) return false;
        return Libs.string2Boolean(this.options.multiple) && Libs.string2Boolean(this.options.selectall);
    }

    /**
     * Refreshes the visibility based on `available()` and emits the update lifecycle.
     *
     * - Shows the handle when available
     * - Hides it otherwise
     *
     * Note: `super.update()` transitions lifecycle to `UPDATED` (idempotent after first call).
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
     * Makes the option handle visible.
     *
     * Removes the `hide` class from the root node.
     */
    public show(): void {
        if (!this.node) return;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the option handle.
     *
     * Adds the `hide` class to the root node.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Registers a callback for the "Select All" action.
     *
     * The callback will be invoked with the arguments provided
     * by the action dispatcher (if any).
     *
     * @param action - Function to execute when "Select All" is triggered.
     */
    public onSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") {
            this.actionOnSelectAll.push(action);
        }
    }

    /**
     * Registers a callback for the "Deselect All" action.
     *
     * The callback will be invoked with the arguments provided
     * by the action dispatcher (if any).
     *
     * @param action - Function to execute when "Deselect All" is triggered.
     */
    public onDeSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") {
            this.actionOnDeSelectAll.push(action);
        }
    }

    /**
     * Destroys the option handle component.
     *
     * Removes the DOM node, clears stored options,
     * and terminates the lifecycle.
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