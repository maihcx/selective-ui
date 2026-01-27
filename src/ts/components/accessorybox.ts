import { MixedAdapter } from "../adapter/mixed-adapter";
import { Lifecycle } from "../core/base/lifecycle";
import { ModelManager } from "../core/model-manager";
import { OptionModel } from "../models/option-model";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { MountViewResult } from "../types/utils/libs.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";

/**
 * Accessory box that displays “selected chips” for multi-select mode.
 *
 * Responsibilities:
 * - Create and position a lightweight container near the Select UI mask
 * - Render current selections as removable “accessory items” (chips)
 * - Dispatch selection changes back to the ModelManager
 * - Show/hide based on configuration and current selection count
 *
 * Lifecycle:
 * - Constructed with optional options → `initialize()` → `init()`
 * - `setRoot()` binds to the Select UI mask and calls `mount()`
 * - `setModelData()` re-renders chips and calls `update()`
 * - `destroy()` removes the DOM node and clears references
 *
 * @extends Lifecycle
 */
export class AccessoryBox extends Lifecycle {
    /** Internal reference to the mounted node structure. */
    private nodeMounted: MountViewResult<any> | null = null;

    /** Root DOM element of the accessory box (hidden by default). */
    private node: HTMLDivElement | null = null;

    /** Configuration (texts, behavior, placement style). */
    private options: SelectiveOptions | null = null;

    /** The overlay/mask element belonging to the main Select UI. */
    private selectUIMask: HTMLDivElement | null = null;

    /** Parent element hosting both the Select UI mask and the accessory box. */
    private parentMask: HTMLDivElement | null = null;

    /** ModelManager used to trigger selection state changes. */
    private modelManager: ModelManager<MixedItem, MixedAdapter> | null = null;

    /** Current list of selected option models rendered as “chips”. */
    private modelDatas: OptionModel[] = [];

    /**
     * Creates an AccessoryBox and (optionally) initializes it with configuration.
     *
     * @param options - Configuration options (e.g., placement via `accessoryStyle`,
     *                  visibility via `accessoryVisible`, texts, etc.).
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Stores options and starts the lifecycle.
     *
     * Does not attach the node yet; the DOM structure is created in `init()`.
     *
     * @param options - Configuration object for the accessory box.
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;
        this.init(); // Trigger lifecycle initialization
    }

    /**
     * Initializes the accessory box DOM structure.
     *
     * - Creates the root node (hidden by default)
     * - Stops mouseup events from propagating to parent containers
     * - Completes the lifecycle initialization
     */
    public init(): void {
        if (this.state !== LifecycleState.NEW) return;

        this.nodeMounted = Libs.mountNode({
            AccessoryBox: {
                tag: {
                    node: "div",
                    classList: ["selective-ui-accessorybox", "hide"],
                    onmouseup: (evt: MouseEvent) => {
                        // Prevent outside listeners from reacting to chip clicks
                        evt.stopPropagation();
                    },
                },
            },
        }) as MountViewResult<any>;

        this.node = this.nodeMounted.view as HTMLDivElement;

        super.init(); // Mark as INITIALIZED
    }

    /**
     * Binds to the Select UI mask and positions the accessory box relative to it.
     *
     * You should call this after the Select UI mask is available. This method
     * will insert the accessory box either before or after the mask based on
     * `options.accessoryStyle` and then call `mount()`.
     *
     * @param selectUIMask - The overlay/mask element of the main Select UI.
     */
    public setRoot(selectUIMask: HTMLDivElement): void {
        this.selectUIMask = selectUIMask;
        this.parentMask = selectUIMask.parentElement as HTMLDivElement | null;

        this.refreshLocation();
        this.mount();
    }

    /**
     * Lifecycle mount override (no-op guard).
     *
     * Ensures mount is only applied once the component has been initialized.
     */
    public mount(): void {
        if (!this.is(LifecycleState.INITIALIZED)) {
            return;
        }
        super.mount();
    }

    /**
     * Positions the accessory box relative to the Select UI mask.
     *
     * Placement rules:
     * - `accessoryStyle === "top"` → insert before the mask
     * - otherwise → insert after the mask
     *
     * Also keeps the accessory box aligned under the same parent container.
     */
    public refreshLocation(): void {
        if (
            !this.parentMask ||
            !this.node ||
            !this.selectUIMask ||
            !this.options
        ) return;

        const ref =
            this.options.accessoryStyle === "top"
                ? this.selectUIMask
                : (this.selectUIMask.nextSibling as ChildNode | null);

        this.parentMask.insertBefore(this.node, ref);
    }

    /**
     * Assigns the `ModelManager` instance used to trigger selection changes.
     *
     * @param modelManager - The model manager controlling option state.
     */
    public setModelManager(
        modelManager: ModelManager<MixedItem, MixedAdapter> | null,
    ): void {
        this.modelManager = modelManager;
    }

    /**
     * Renders accessory items (“chips”) for the provided selected options.
     *
     * Behavior:
     * - Clears the current container
     * - For multi-select mode with non-empty data, mounts each chip:
     *   - A “button” (span with role="button") to deselect the option
     *   - A content span showing the option’s text (HTML is preserved as provided)
     * - When the button is clicked:
     *   - Calls `modelManager.triggerChanging("select")`
     *   - Sets `modelData.selected = false`
     *
     * Finally:
     * - Updates visibility based on config and chip count
     * - Emits lifecycle `update()` and a window `"resize"` event
     *
     * @param modelDatas - List of option models representing current selections.
     */
    public setModelData(modelDatas: OptionModel[]): void {
        if (!this.node || !this.options) return;
        this.node.replaceChildren();

        if (modelDatas.length > 0 && this.options.multiple) {
            modelDatas.forEach((modelData) => {
                Libs.mountNode(
                    {
                        AccessoryItem: {
                            tag: { node: "div", classList: ["accessory-item"] },
                            child: {
                                Button: {
                                    tag: {
                                        node: "span",
                                        classList: ["accessory-item-button"],
                                        role: "button",
                                        ariaLabel: `${this.options!.textAccessoryDeselect}${modelData.textContent}`,
                                        title: `${this.options!.textAccessoryDeselect}${modelData.textContent}`,
                                        onclick: async (evt: MouseEvent) => {
                                            evt.preventDefault();
                                            await this.modelManager?.triggerChanging?.("select");
                                            modelData.selected = false;
                                        },
                                    },
                                },
                                Content: {
                                    tag: {
                                        node: "span",
                                        classList: ["accessory-item-content"],
                                        innerHTML: modelData.text,
                                    },
                                },
                            },
                        },
                    },
                    this.node,
                );
            });
        } else {
            modelDatas = [];
        }

        this.modelDatas = modelDatas;
        this.refreshDisplay();
        this.update(); // lifecycle UPDATE
        iEvents.trigger(window, "resize");
    }

    /**
     * Lifecycle update override (no-op guard).
     *
     * Ensures update is only emitted after the component is mounted.
     */
    public update(): void {
        if (this.state !== LifecycleState.MOUNTED) return;
        super.update();
    }

    /**
     * Applies visibility rules based on configuration and chip count.
     *
     * Visible when:
     * - `accessoryVisible` is truthy
     * - There is at least one selected item
     * - The Select is in multiple mode
     */
    private refreshDisplay(): void {
        if (
            this.options?.accessoryVisible &&
            this.modelDatas.length > 0 &&
            this.options.multiple
        ) {
            this.show();
        } else {
            this.hide();
        }
    }

    /** Shows the accessory box. */
    private show(): void {
        this.node?.classList.remove("hide");
    }

    /** Hides the accessory box. */
    private hide(): void {
        this.node?.classList.add("hide");
    }

    /**
     * Destroys the accessory box and releases resources.
     *
     * - Removes the root DOM node
     * - Clears references to mounted structures, options, masks, and ModelManager
     * - Resets internal model data
     * - Ends the lifecycle
     */
    public destroy(): void {
        if (this.state === LifecycleState.DESTROYED) return;

        // Clean up DOM
        this.node?.remove();

        // Clear references
        this.nodeMounted = null;
        this.node = null;
        this.options = null;
        this.selectUIMask = null;
        this.parentMask = null;
        this.modelManager = null;
        this.modelDatas = [];

        super.destroy();
    }
}