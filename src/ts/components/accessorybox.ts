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
 * Accessory container that renders "selected chips" for multi-select mode.
 *
 * This component is a small DOM-driven helper that sits next to the Select UI mask and
 * visualizes current selections as removable chips. It does not own selection state by itself;
 * instead, it delegates deselection actions back to the {@link ModelManager} and underlying models.
 *
 * ### Responsibility
 * - Create a lightweight DOM container (single root node) for chips.
 * - Position the container relative to the Select UI mask (top or bottom insertion).
 * - Render the current selection set as removable chips.
 * - Dispatch deselect actions back into the selection pipeline:
 *   - pre-change hook via `modelManager.triggerChanging("select")`
 *   - then mutate the model (`OptionModel.selected = false`) to produce external selection events.
 * - Show/hide based on configuration (`accessoryVisible`, `multiple`) and chip count.
 *
 * ### Lifecycle (Strict FSM & idempotency)
 * - Construction optionally calls {@link initialize} and transitions `NEW → INITIALIZED` via {@link init}.
 * - {@link setRoot} binds DOM anchors, inserts the node into the mask container, then calls {@link mount}.
 * - {@link setModelData} re-renders chips and calls {@link update} (guarded: only after mounted).
 * - {@link destroy} removes the DOM node, clears references, and transitions to `DESTROYED`.
 *
 * No-ops / guards:
 * - `init()` is guarded to only run in `NEW`.
 * - `mount()` is guarded to only run in `INITIALIZED`.
 * - `update()` is guarded to only emit once mounted.
 *
 * ### Event / callback flow
 * - Chip remove click:
 *   1) prevents default
 *   2) awaits `modelManager.triggerChanging("select")` (pre-change pipeline)
 *   3) sets `modelData.selected = false` (external selection semantic)
 * - After rendering chips, triggers `window` `"resize"` via {@link iEvents.trigger} to allow
 *   popup/layout logic to recompute geometry.
 *
 * ### DOM & a11y side effects
 * - Creates a root `<div>` with classes `selective-ui-accessorybox hide`.
 * - Stops `mouseup` propagation on the root to avoid "outside click" behaviors.
 * - Each chip has:
 *   - a `<span role="button">` with `aria-label`/`title` for screen readers and tooltips,
 *   - a content `<span>` rendered via `innerHTML` from {@link OptionModel.text}.
 * - Visibility is controlled via `"hide"` class.
 *
 * @extends Lifecycle
 * @see {@link ModelManager}
 * @see {@link OptionModel}
 */
export class AccessoryBox extends Lifecycle {
    /**
     * Mounted structure returned by the node mounting helper.
     * Contains the root element (`view`) and any tag handles (if present).
     */
    private nodeMounted: MountViewResult<any> | null = null;

    /**
     * Root DOM element of the accessory box (hidden by default).
     * Created during {@link init} and removed during {@link destroy}.
     */
    private node: HTMLDivElement | null = null;

    /**
     * Component configuration (texts, behavior, placement).
     * This component reads:
     * - `accessoryStyle` ("top" or default bottom)
     * - `accessoryVisible` (enable/disable)
     * - `multiple` (multi-select mode)
     * - `textAccessoryDeselect` (a11y label prefix)
     */
    private options: SelectiveOptions | null = null;

    /**
     * The Select UI mask element used as the positioning reference.
     * Provided by {@link setRoot}.
     */
    private selectUIMask: HTMLDivElement | null = null;

    /**
     * Parent container that hosts both the Select UI mask and the accessory box.
     * Computed from `selectUIMask.parentElement`.
     */
    private parentMask: HTMLDivElement | null = null;

    /**
     * ModelManager used to run selection pipelines and coordinate state updates.
     * This component does not own selection state; it delegates to the model layer.
     */
    private modelManager: ModelManager<MixedItem, MixedAdapter> | null = null;

    /**
     * Current selected option models rendered as chips.
     * This is a cached snapshot used for show/hide decisions and re-rendering.
     */
    private modelDatas: OptionModel[] = [];

    /**
     * Creates an AccessoryBox and optionally initializes it with configuration.
     *
     * @param {SelectiveOptions | null} [options=null] - Configuration controlling placement/visibility and texts.
     */
    public constructor(options: SelectiveOptions | null = null) {
        super();
        if (options) this.initialize(options);
    }

    /**
     * Stores options and starts lifecycle initialization.
     *
     * Note: This does not attach the node into the DOM. DOM insertion occurs in {@link setRoot}
     * after the Select UI mask is available.
     *
     * @param {SelectiveOptions} options - Configuration object for the accessory box.
     * @returns {void}
     */
    private initialize(options: SelectiveOptions): void {
        this.options = options;
        this.init(); // Trigger lifecycle initialization
    }

    /**
     * Initializes the accessory box DOM structure.
     *
     * Guarded: runs only when state is `NEW`.
     *
     * Side effects:
     * - Creates the root node with base classes (`selective-ui-accessorybox`, `hide`).
     * - Stops `mouseup` propagation to avoid outside-click handlers reacting to chip interactions.
     *
     * @returns {void}
     * @override
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
     * Binds the component to the Select UI mask and inserts the accessory node into the DOM.
     *
     * - Captures the mask and its parent container.
     * - Calls {@link refreshLocation} to place the node either before or after the mask.
     * - Transitions to `MOUNTED` by calling {@link mount}.
     *
     * @param {HTMLDivElement} selectUIMask - The overlay/mask element of the main Select UI.
     * @returns {void}
     */
    public setRoot(selectUIMask: HTMLDivElement): void {
        this.selectUIMask = selectUIMask;
        this.parentMask = selectUIMask.parentElement as HTMLDivElement | null;

        this.refreshLocation();
        this.mount();
    }

    /**
     * Lifecycle mount (guarded).
     *
     * This component can only be mounted after {@link init} has completed (`INITIALIZED`).
     * No-op otherwise.
     *
     * @returns {void}
     * @override
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
     * Placement:
     * - When `options.accessoryStyle === "top"`: insert before the mask.
     * - Otherwise: insert after the mask (before `mask.nextSibling`).
     *
     * No-op if the DOM anchors or {@link options} are not available.
     *
     * @returns {void}
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
     * Assigns the {@link ModelManager} used to run selection pipelines and mutate selection state.
     *
     * @param {ModelManager<MixedItem, MixedAdapter> | null} modelManager - Model manager controlling option state.
     * @returns {void}
     */
    public setModelManager(
        modelManager: ModelManager<MixedItem, MixedAdapter> | null,
    ): void {
        this.modelManager = modelManager;
    }

    /**
     * Re-renders chips for the given selected options.
     *
     * Rendering behavior:
     * - Clears previous chips (`node.replaceChildren()`).
     * - When `options.multiple === true` and `modelDatas.length > 0`:
     *   - mounts a chip per option with:
     *     - a `<span role="button">` that deselects the option,
     *     - a content span rendered from `OptionModel.text` (HTML preserved).
     * - Otherwise, normalizes to an empty list.
     *
     * Deselect click flow:
     * 1) `preventDefault()`
     * 2) `await modelManager.triggerChanging("select")` (pre-change pipeline; no-op if manager is absent)
     * 3) `modelData.selected = false` (external selection semantics)
     *
     * Post-render side effects:
     * - Calls {@link refreshDisplay} to toggle visibility.
     * - Emits lifecycle {@link update} (guarded).
     * - Triggers a global `"resize"` event to allow layout/popup recalculation.
     *
     * @param {OptionModel[]} modelDatas - Selected options to render.
     * @returns {void}
     *
     * @remarks
     * The chip label uses `innerHTML` and therefore assumes `modelData.text` is trusted/sanitized upstream
     * when HTML rendering is enabled.
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
     * Lifecycle update (guarded).
     *
     * Only emits updates after the component is mounted. This keeps the FSM strict and prevents
     * update hooks from running before the node is attached to the DOM.
     *
     * @returns {void}
     * @override
     */
    public update(): void {
        if (this.state !== LifecycleState.MOUNTED) return;
        super.update();
    }

    /**
     * Applies display rules based on configuration and current selection count.
     *
     * Visible when all are true:
     * - `options.accessoryVisible`
     * - `options.multiple`
     * - `modelDatas.length > 0`
     *
     * @returns {void}
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

    /**
     * Shows the accessory box by removing the `"hide"` CSS class.
     *
     * @returns {void}
     */
    private show(): void {
        this.node?.classList.remove("hide");
    }

    /**
     * Hides the accessory box by applying the `"hide"` CSS class.
     *
     * @returns {void}
     */
    private hide(): void {
        this.node?.classList.add("hide");
    }

    /**
     * Destroys the accessory box and releases owned resources.
     *
     * Behavior:
     * - Idempotent: returns early if already `DESTROYED`.
     * - Removes the root DOM node.
     * - Clears references (options, anchors, manager) and cached model data.
     * - Completes lifecycle teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
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