import { MixedAdapter } from "../adapter/mixed-adapter";
import { ModelManager } from "../core/model-manager";
import { OptionModel } from "../models/option-model";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { MountViewResult } from "../types/utils/libs.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";


/**
 * @class
 */
export class AccessoryBox {
    /**
     * @type {MountViewResult<any> | null}
     */
    nodeMounted: MountViewResult<any> | null = null;

    /**
     * @type {HTMLDivElement | null}
     */
    node: HTMLDivElement | null = null;

    options: SelectiveOptions | null = null;

    /** @type {HTMLDivElement | null} */
    selectUIMask: HTMLDivElement | null = null;

    /** @type {HTMLDivElement | null} */
    parentMask: HTMLDivElement | null = null;

    /** @type {ModelManager<MixedItem> | null} */
    modelManager: ModelManager<MixedItem, MixedAdapter> | null = null;

    /**
     * Initializes the accessory box with optional configuration and immediately calls init() if provided.
     *
     * @param {object|null} options - Configuration options for the accessory box (e.g., layout and behavior).
     */
    constructor(options: SelectiveOptions | null = null) {
        if (options) this.init(options);
    }

    /**
     * Creates the accessory box DOM node and stores the provided options.
     * The node is initially hidden and stops mouseup events from bubbling.
     *
     * @param {SelectiveOptions} options - Configuration object for the accessory box.
     */
    init(options: SelectiveOptions): void {
        this.nodeMounted = Libs.mountNode({
            AccessoryBox: {
                tag: {
                    node: "div",
                    classList: ["selective-ui-accessorybox", "hide"],
                    onmouseup: (evt: MouseEvent) => {
                        evt.stopPropagation();
                    },
                },
            },
        }) as MountViewResult<any>;

        this.node = this.nodeMounted.view as HTMLDivElement;
        this.options = options;
    }

    /**
     * Sets the root references for the accessory box (mask elements) and refreshes its location in the DOM.
     *
     * @param {HTMLDivElement} selectUIMask - The overlay/mask element of the main Select UI.
     */
    setRoot(selectUIMask: HTMLDivElement): void {
        this.selectUIMask = selectUIMask;
        this.parentMask = selectUIMask.parentElement as HTMLDivElement | null;

        this.refreshLocation();
    }

    /**
     * Inserts the accessory box before or after the Select UI mask depending on the configured accessoryStyle.
     * Keeps the accessory box aligned relative to the parent mask.
     */
    refreshLocation(): void {
        if (!this.parentMask || !this.node || !this.selectUIMask || !this.options) return;

        const ref =
            this.options.accessoryStyle === "top"
                ? this.selectUIMask
                : (this.selectUIMask.nextSibling as ChildNode | null);

        this.parentMask.insertBefore(this.node, ref);
    }

    /**
     * Assigns a ModelManager instance used to trigger and manage selection state changes.
     *
     * @param {ModelManager} modelManager - The model manager controlling option state.
     */
    setModelManager(modelManager: ModelManager<MixedItem, MixedAdapter> | null): void {
        this.modelManager = modelManager;
    }

    /**
     * Renders accessory items for the currently selected options in multiple-select mode.
     * Shows the accessory box when there are items; otherwise hides it. Triggers a window resize event.
     *
     * @param {OptionModel[]} modelDatas - List of option models to render as accessory items.
     */
    setModelData(modelDatas: OptionModel[]): void {
        if (!this.node || !this.options) return;

        this.node.replaceChildren();

        if (modelDatas.length > 0 && this.options.multiple) {
            this.node.classList.remove("hide");

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
                                        onclick: (evt: MouseEvent) => {
                                            evt.preventDefault();
                                            this.modelManager?.triggerChanging?.("select");
                                            setTimeout(() => {
                                                modelData.selected = false;
                                            }, 10);
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
                    this.node
                );
            });
        } else {
            this.node.classList.add("hide");
        }

        iEvents.trigger(window, "resize");
    }
}