
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type { OptionViewTags, OptionViewResult, OptionConfig, OptionConfigPatch } from "../types/views/view.option.type";

/**
 * @extends {View<OptionViewTags>}
 */
export class OptionView extends View<OptionViewTags> {
    view: OptionViewResult | null = null;

    private _config: OptionConfig | null = null;

    private _configProxy: OptionConfig | null = null;
    
    private _isRendered = false;

    /**
     * Initializes the OptionView with a parent container and sets up the reactive config proxy.
     * The proxy enables partial DOM updates when config properties change after initial render.
     *
     * @param {HTMLElement} parent - The parent element into which this view will be mounted.
     */
    constructor(parent: HTMLElement) {
        super(parent);
        this._setupConfigProxy();
    }

    /**
     * Creates the internal configuration object and wraps it with a Proxy.
     * The proxy intercepts property assignments and, if the view is rendered,
     * applies only the necessary DOM changes for the updated property.
     * No DOM mutations occur before the first render.
     */
    private _setupConfigProxy(): void {
        const self = this;

        this._config = {
            isMultiple: false,
            hasImage: false,
            imagePosition: "right",
            imageWidth: "60px",
            imageHeight: "60px",
            imageBorderRadius: "4px",
            labelValign: "center",
            labelHalign: "left",
        };

        this._configProxy = new Proxy(this._config, {
            set(target, prop, value) {
                if (typeof prop !== "string") return true;

                const key = prop as keyof OptionConfig;
                const oldValue = target[key];

                if (oldValue !== (value as any)) {
                    (target as any)[key] = value;
                    if (self._isRendered) {
                        self._applyPartialChange(key, value, oldValue);
                    }
                }
                return true;
            },
        });
    }

    /**
     * Indicates whether the option supports multiple selection (checkbox) instead of single (radio).
     *
     * @returns {boolean} True if multiple selection is enabled; otherwise false.
     */
    get isMultiple(): boolean {
        return this._config!.isMultiple;
    }

    /**
     * Enables or disables multiple selection mode.
     * When rendered, toggles the root CSS class and switches the input type between 'checkbox' and 'radio'.
     *
     * @param {boolean} value - True to enable multiple selection; false for single selection.
     */
    set isMultiple(value: boolean) {
        (this._configProxy as OptionConfig).isMultiple = !!value;
    }

    /**
     * Indicates whether the option includes an image block alongside the label.
     *
     * @returns {boolean} True if an image is displayed; otherwise false.
     */
    get hasImage(): boolean {
        return this._config!.hasImage;
    }

    /**
     * Shows or hides the image block for the option.
     * When rendered, toggles related CSS classes and creates/removes the image element accordingly.
     *
     * @param {boolean} value - True to show the image; false to hide it.
     */
    set hasImage(value: boolean) {
        (this._configProxy as OptionConfig).hasImage = !!value;
    }

    /**
     * Provides reactive access to the entire option configuration via a Proxy.
     * Mutating properties on this object will trigger partial DOM updates when rendered.
     *
     * @returns {object} The proxied configuration object.
     */
    get optionConfig(): OptionConfig {
        return this._configProxy as OptionConfig;
    }

    /**
     * Applies a set of configuration changes in batch.
     * Only properties that differ from the current config are updated.
     * When rendered, each changed property triggers a targeted DOM update via the proxy.
     */
    set optionConfig(config: OptionConfigPatch | null) {
        if (!config || !this._configProxy || !this._config) return;

        const changes: OptionConfigPatch = {};

        if (config.imageWidth !== undefined && config.imageWidth !== this._config.imageWidth) changes.imageWidth = config.imageWidth;
        if (config.imageHeight !== undefined && config.imageHeight !== this._config.imageHeight) changes.imageHeight = config.imageHeight;
        if (config.imageBorderRadius !== undefined && config.imageBorderRadius !== this._config.imageBorderRadius) changes.imageBorderRadius = config.imageBorderRadius;
        if (config.imagePosition !== undefined && config.imagePosition !== this._config.imagePosition) changes.imagePosition = config.imagePosition;
        if (config.labelValign !== undefined && config.labelValign !== this._config.labelValign) changes.labelValign = config.labelValign;
        if (config.labelHalign !== undefined && config.labelHalign !== this._config.labelHalign) changes.labelHalign = config.labelHalign;

        if (Object.keys(changes).length > 0) Object.assign(this._configProxy, changes);
    }

    /**
     * Renders the option view into the parent element.
     * Builds the DOM structure (input, optional image, label) based on current config,
     * assigns classes and ARIA attributes, mounts via Libs.mountView, and marks as rendered
     * to allow future incremental updates through the config proxy.
     */
    render(): void {
        const viewClass: Array<string> = ["selective-ui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${opt_id}`;

        if (this._config!.isMultiple) viewClass.push("multiple");
        if (this._config!.hasImage) {
            viewClass.push("has-image");
            viewClass.push(`image-${this._config!.imagePosition}`);
        }

        const childStructure: any = {
            OptionInput: {
                tag: {
                    node: "input",
                    type: this._config!.isMultiple ? "checkbox" : "radio",
                    classList: "allow-choice",
                    id: inputID,
                },
            },
            ...(this._config!.hasImage && {
                OptionImage: {
                    tag: {
                        node: "img",
                        classList: "option-image",
                        style: {
                            width: this._config!.imageWidth,
                            height: this._config!.imageHeight,
                            borderRadius: this._config!.imageBorderRadius,
                        },
                    },
                },
            }),
            OptionLabel: {
                tag: {
                    node: "label",
                    htmlFor: inputID,
                    classList: [
                        `align-vertical-${this._config!.labelValign}`,
                        `align-horizontal-${this._config!.labelHalign}`,
                    ],
                },
                child: {
                    LabelContent: { tag: { node: "div" } },
                },
            },
        };

        this.view = Libs.mountView<OptionViewTags>({
            OptionView: {
                tag: {
                    node: "div",
                    id: `seui-${opt_id}-option`,
                    classList: viewClass,
                    role: "option",
                    ariaSelected: "false",
                    tabIndex: "-1",
                },
                child: childStructure,
            },
        }) as OptionViewResult;

        this.parent!.appendChild(this.view.view);
        this._isRendered = true;
    }

    /**
     * Applies a targeted DOM update for a single configuration property change.
     * Safely updates classes, attributes, styles, and child elements without re-rendering the whole view.
     */
    private _applyPartialChange<K extends keyof OptionConfig>(
        prop: K,
        newValue: OptionConfig[K],
        oldValue: OptionConfig[K]
    ): void {
        const v = this.view;
        if (!v || !v.view) return;

        const root = v.view as HTMLElement;
        const input = v.tags?.OptionInput as HTMLInputElement | undefined;
        const label = v.tags?.OptionLabel as HTMLLabelElement | undefined;

        switch (prop) {
            case "isMultiple": {
                const val = !!newValue;
                root.classList.toggle("multiple", val);
                if (input && input.type !== (val ? "checkbox" : "radio")) {
                    input.type = val ? "checkbox" : "radio";
                }
                break;
            }

            case "hasImage": {
                const val = !!newValue;
                root.classList.toggle("has-image", val);

                if (val) {
                    root.classList.add(`image-${this._config!.imagePosition}`);
                    this._createImage();
                } else {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, "").trim();

                    const img = (v.tags as any)?.OptionImage as HTMLImageElement | null | undefined;
                    if (img) {
                        img.remove();
                        (v.tags as any).OptionImage = null;
                    }
                }
                break;
            }

            case "imagePosition": {
                if (this._config!.hasImage) {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, "").trim();
                    root.classList.add(`image-${String(newValue)}`);
                }
                break;
            }

            case "imageWidth":
            case "imageHeight":
            case "imageBorderRadius": {
                const img = (v.tags as any)?.OptionImage as HTMLImageElement | null | undefined;
                if (img) {
                    const styleProp =
                        prop === "imageWidth" ? "width" :
                            prop === "imageHeight" ? "height" :
                                "borderRadius";

                    const val = String(newValue);
                    if ((img.style as any)[styleProp] !== val) (img.style as any)[styleProp] = val;
                }
                break;
            }

            case "labelValign":
            case "labelHalign": {
                if (label) {
                    const newClass =
                        `align-vertical-${this._config!.labelValign} align-horizontal-${this._config!.labelHalign}`;
                    if (label.className !== newClass) label.className = newClass;
                }
                break;
            }

            default:
                void oldValue;
        }
    }

    /**
     * Creates the <img> element for the option on demand and inserts it into the DOM.
     * Skips creation if the view or root is missing, or if an image already exists.
     * The image receives configured styles (width, height, borderRadius) and is placed
     * before the label if present; otherwise appended to the root. Updates `v.tags.OptionImage`.
     */
    private _createImage(): void {
        const v = this.view;
        if (!v || !v.view) return;

        const existing = (v.tags as any)?.OptionImage as HTMLImageElement | null | undefined;
        if (existing) return;

        const root = v.view as HTMLElement;
        const label = v.tags?.OptionLabel as HTMLLabelElement | undefined;

        const image = document.createElement("img");
        image.className = "option-image";
        image.style.width = this._config!.imageWidth;
        image.style.height = this._config!.imageHeight;
        image.style.borderRadius = this._config!.imageBorderRadius;

        if (label && label.parentElement) root.insertBefore(image, label);
        else root.appendChild(image);

        (v.tags as any).OptionImage = image;
    }
}