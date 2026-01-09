
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";

/**
 * @extends {View<OptionViewTags>}
 */
export class OptionView extends View {
    /** @type {OptionViewResult} */
    view;

    #config = null;
    #configProxy = null;
    #isRendered = false;

    /**
     * Initializes the OptionView with a parent container and sets up the reactive config proxy.
     * The proxy enables partial DOM updates when config properties change after initial render.
     *
     * @param {HTMLElement} parent - The parent element into which this view will be mounted.
     */
    constructor(parent) {
        super(parent);
        this.#setupConfigProxy();
    }

    /**
     * Creates the internal configuration object and wraps it with a Proxy.
     * The proxy intercepts property assignments and, if the view is rendered,
     * applies only the necessary DOM changes for the updated property.
     * No DOM mutations occur before the first render.
     */
    #setupConfigProxy() {
        const self = this;
        
        this.#config = {
            isMultiple: false,
            hasImage: false,
            imagePosition: 'right',
            imageWidth: '60px',
            imageHeight: '60px',
            imageBorderRadius: '4px',
            labelValign: 'center',
            labelHalign: 'left'
        };

        this.#configProxy = new Proxy(this.#config, {
            set(target, prop, value) {
                const oldValue = target[prop];
                
                if (oldValue !== value) {
                    target[prop] = value;
                    
                    if (self.#isRendered) {
                        self.#applyPartialChange(prop, value, oldValue);
                    }
                }
                return true;
            }
        });
    }

    /**
     * Indicates whether the option supports multiple selection (checkbox) instead of single (radio).
     *
     * @returns {boolean} True if multiple selection is enabled; otherwise false.
     */
    get isMultiple() {
        return this.#config.isMultiple;
    }

    
    /**
     * Enables or disables multiple selection mode.
     * When rendered, toggles the root CSS class and switches the input type between 'checkbox' and 'radio'.
     *
     * @param {boolean} value - True to enable multiple selection; false for single selection.
     */
    set isMultiple(value) {
        this.#configProxy.isMultiple = !!value;
    }

    /**
     * Indicates whether the option includes an image block alongside the label.
     *
     * @returns {boolean} True if an image is displayed; otherwise false.
     */
    get hasImage() {
        return this.#config.hasImage;
    }

    
    /**
     * Shows or hides the image block for the option.
     * When rendered, toggles related CSS classes and creates/removes the image element accordingly.
     *
     * @param {boolean} value - True to show the image; false to hide it.
     */
    set hasImage(value) {
        this.#configProxy.hasImage = !!value;
    }

    /**
     * Provides reactive access to the entire option configuration via a Proxy.
     * Mutating properties on this object will trigger partial DOM updates when rendered.
     *
     * @returns {object} The proxied configuration object.
     */
    get optionConfig() {
        return this.#configProxy;
    }

    
    /**
     * Applies a set of configuration changes in batch.
     * Only properties that differ from the current config are updated.
     * When rendered, each changed property triggers a targeted DOM update via the proxy.
     *
     * @param {object} config - Partial configuration object.
     * @param {string} [config.imageWidth] - CSS width of the image (e.g., '60px').
     * @param {string} [config.imageHeight] - CSS height of the image (e.g., '60px').
     * @param {string} [config.imageBorderRadius] - CSS border-radius for the image (e.g., '4px').
     * @param {'top'|'right'|'bottom'|'left'} [config.imagePosition] - Position of the image relative to the label.
     * @param {'top'|'center'|'bottom'} [config.labelValign] - Vertical alignment of the label.
     * @param {'left'|'center'|'right'} [config.labelHalign] - Horizontal alignment of the label.
     */
    set optionConfig(config) {
        if (!config) return;
        
        const changes = {};
        let hasChanges = false;

        if (config.imageWidth !== undefined && config.imageWidth !== this.#config.imageWidth) {
            changes.imageWidth = config.imageWidth;
            hasChanges = true;
        }
        if (config.imageHeight !== undefined && config.imageHeight !== this.#config.imageHeight) {
            changes.imageHeight = config.imageHeight;
            hasChanges = true;
        }
        if (config.imageBorderRadius !== undefined && config.imageBorderRadius !== this.#config.imageBorderRadius) {
            changes.imageBorderRadius = config.imageBorderRadius;
            hasChanges = true;
        }
        if (config.imagePosition !== undefined && config.imagePosition !== this.#config.imagePosition) {
            changes.imagePosition = config.imagePosition;
            hasChanges = true;
        }
        if (config.labelValign !== undefined && config.labelValign !== this.#config.labelValign) {
            changes.labelValign = config.labelValign;
            hasChanges = true;
        }
        if (config.labelHalign !== undefined && config.labelHalign !== this.#config.labelHalign) {
            changes.labelHalign = config.labelHalign;
            hasChanges = true;
        }

        if (hasChanges) {
            Object.assign(this.#configProxy, changes);
        }
    }

    /**
     * Renders the option view into the parent element.
     * Builds the DOM structure (input, optional image, label) based on current config,
     * assigns classes and ARIA attributes, mounts via Libs.mountView, and marks as rendered
     * to allow future incremental updates through the config proxy.
     */
    render() {
        const viewClass = ["selective-ui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${opt_id}`;

        if (this.#config.isMultiple) {
            viewClass.push("multiple");
        }
        if (this.#config.hasImage) {
            viewClass.push("has-image");
            viewClass.push(`image-${this.#config.imagePosition}`);
        }

        const childStructure = {
            OptionInput: {
                tag: {
                    node: "input",
                    type: this.#config.isMultiple ? "checkbox" : "radio",
                    classList: "allow-choice",
                    id: inputID
                }
            },
            ...(this.#config.hasImage && {
                OptionImage: {
                    tag: {
                        node: "img",
                        classList: "option-image",
                        style: {
                            width: this.#config.imageWidth,
                            height: this.#config.imageHeight,
                            borderRadius: this.#config.imageBorderRadius
                        }
                    }
                }
            }),
            OptionLabel: {
                tag: {
                    node: "label",
                    htmlFor: inputID,
                    classList: [
                        `align-vertical-${this.#config.labelValign}`,
                        `align-horizontal-${this.#config.labelHalign}`
                    ]
                },
                child: {
                    LabelContent: { tag: { node: "div" } }
                }
            }
        };

        this.view = Libs.mountView({
            OptionView: {
                tag: {
                    node: "div",
                    id: `seui-${opt_id}-option`,
                    classList: viewClass,
                    role: "option",
                    ariaSelected: "false",
                    tabIndex: "-1"
                },
                child: childStructure
            }
        });

        this.parent.appendChild(this.view.view);
        this.#isRendered = true;
    }

    /**
     * Applies a targeted DOM update for a single configuration property change.
     * Safely updates classes, attributes, styles, and child elements without re-rendering the whole view.
     *
     * @param {string | symbol} prop - The name of the changed configuration property.
     * @param {any} newValue - The new value assigned to the property.
     * @param {any} oldValue - The previous value of the property.
     */
    #applyPartialChange(prop, newValue, oldValue) {
        const v = this.view;
        if (!v || !v.view) return;

        const root = v.view;
        const input = v.tags?.OptionInput;
        const label = v.tags?.OptionLabel;

        switch(prop) {
            case 'isMultiple':
                root.classList.toggle('multiple', newValue);
                
                if (input && input.type !== (newValue ? 'checkbox' : 'radio')) {
                    input.type = newValue ? 'checkbox' : 'radio';
                }
                break;

            case 'hasImage':
                root.classList.toggle('has-image', newValue);
                
                if (newValue) {
                    root.classList.add(`image-${this.#config.imagePosition}`);
                    this.#createImage();
                } else {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, '').trim();
                    const image = v.tags?.OptionImage;
                    if (image) {
                        image.remove();
                        v.tags.OptionImage = null;
                    }
                }
                break;

            case 'imagePosition':
                if (this.#config.hasImage) {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, '').trim();
                    root.classList.add(`image-${newValue}`);
                }
                break;

            case 'imageWidth':
            case 'imageHeight':
            case 'imageBorderRadius':
                const image = v.tags?.OptionImage;
                if (image) {
                    const styleProp = {
                        'imageWidth': 'width',
                        'imageHeight': 'height',
                        'imageBorderRadius': 'borderRadius'
                    }[prop];
                    
                    if (image.style[styleProp] !== newValue) {
                        image.style[styleProp] = newValue;
                    }
                }
                break;

            case 'labelValign':
            case 'labelHalign':
                if (label) {
                    const newClass = `align-vertical-${this.#config.labelValign} align-horizontal-${this.#config.labelHalign}`;
                    if (label.className !== newClass) {
                        label.className = newClass;
                    }
                }
                break;
        }
    }

    /**
     * Creates the <img> element for the option on demand and inserts it into the DOM.
     * Skips creation if the view or root is missing, or if an image already exists.
     * The image receives configured styles (width, height, borderRadius) and is placed
     * before the label if present; otherwise appended to the root. Updates `v.tags.OptionImage`.
     */
    #createImage() {
        const v = this.view;
        if (!v || !v.view) return;

        let image = v.tags?.OptionImage;
        if (image) return;

        const root = v.view;
        const label = v.tags?.OptionLabel;
        
        image = document.createElement('img');
        image.className = 'option-image';
        image.style.width = this.#config.imageWidth;
        image.style.height = this.#config.imageHeight;
        image.style.borderRadius = this.#config.imageBorderRadius;
        
        if (label && label.parentElement) {
            root.insertBefore(image, label);
        } else {
            root.appendChild(image);
        }
        
        v.tags.OptionImage = image;
    }
}