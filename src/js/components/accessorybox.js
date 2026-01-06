import { ModelManager } from "../core/model-manager";
import { OptionModel } from "../models/option-model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class AccessoryBox {
    /**
     * @type {MountViewResult<any>}
     */
    nodeMounted = null;

    /**
     * @type {HTMLDivElement}
     */
    node = null;

    options = null;

    /** @type {HTMLDivElement} */
    selectUIMask;

    /** @type {HTMLDivElement} */
    parentMask;

    /** @type {ModelManager} */
    modelManager;

    /**
     * Initializes the accessory box with optional configuration and immediately calls init() if provided.
     *
     * @param {object|null} options - Configuration options for the accessory box (e.g., layout and behavior).
     */
    constructor(options = null) {
        options && this.init(options);
    }

    /**
     * Creates the accessory box DOM node and stores the provided options.
     * The node is initially hidden and stops mouseup events from bubbling.
     *
     * @param {object} options - Configuration object for the accessory box.
     */
    init(options) {
        this.nodeMounted = Libs.mountNode({
            AccessoryBox: {
                tag: {node: "div", classList: ["selective-ui-accessorybox", "hide"], onmouseup: (evt) => {
                    evt.stopPropagation();
                }}
            }
        });
        this.node = /** @type {HTMLDivElement} */ (this.nodeMounted.view);
        this.options = options;
    }

    /**
     * Sets the root references for the accessory box (mask elements) and refreshes its location in the DOM.
     *
     * @param {HTMLDivElement} selectUIMask - The overlay/mask element of the main Select UI.
     */
    setRoot(selectUIMask) {
        this.selectUIMask = selectUIMask;
        this.parentMask = /** @type {HTMLDivElement} */ (selectUIMask.parentElement);

        this.refreshLocation();
    }

    /**
     * Inserts the accessory box before or after the Select UI mask depending on the configured accessoryStyle.
     * Keeps the accessory box aligned relative to the parent mask.
     */
    refreshLocation() {
        this.parentMask.insertBefore(this.node, (this.options.accessoryStyle == "top" ? this.selectUIMask : this.selectUIMask.nextSibling));
    }

    /**
     * Assigns a ModelManager instance used to trigger and manage selection state changes.
     *
     * @param {ModelManager} modelManager - The model manager controlling option state.
     */
    setModelManager(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * Renders accessory items for the currently selected options in multiple-select mode.
     * Shows the accessory box when there are items; otherwise hides it. Triggers a window resize event.
     *
     * @param {OptionModel[]} modelDatas - List of option models to render as accessory items.
     */
    setModelData(modelDatas) {
        this.node.replaceChildren();
        
        if (modelDatas.length > 0 && this.options.multiple) {
            this.node.classList.remove("hide");

            modelDatas.forEach(modelData => {
                Libs.mountNode({
                    AccessoryItem: {
                        tag: {node: "div", classList: ["accessory-item"]},
                        child: {
                            Button: {
                                tag: {node: "span", classList: ["accessory-item-button"], role: "button", ariaLabel: `${this.options.textAccessoryDeselect}${modelData.textContent}`, title: `${this.options.textAccessoryDeselect}${modelData.textContent}`, onclick: (evt) => {
                                    this.modelManager.triggerChanging("select");
                                    setTimeout(() => {
                                        modelData.selected = false;
                                    }, 10);
                                }}
                            },
                            Content: {
                                tag: {node: "span", classList: ["accessory-item-content"], innerHTML: modelData.text}
                            }
                        }
                    }
                }, this.node);
            });
        }
        else {
            this.node.classList.add("hide");
        }
        iEvents.trigger(window, "resize");
    }
}