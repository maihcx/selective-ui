
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type { OptionViewTags, OptionViewResult, OptionConfig, OptionConfigPatch } from "../types/views/view.option.type";

/**
 * @extends {View<OptionViewTags>}
 */
export class OptionView extends View<OptionViewTags> {
    public view: OptionViewResult | null = null;

    private config: OptionConfig | null = null;

    private configProxy: OptionConfig | null = null;
    
    private isRendered = false;

    /**
     * Initializes the OptionView with a parent container and sets up the reactive config proxy.
     * The proxy enables partial DOM updates when config properties change after initial render.
     *
     * @param {HTMLElement} parent - The parent element into which this view will be mounted.
     */
    public constructor(parent: HTMLElement) {
        super(parent);
        this.setupConfigProxy();
    }

    /**
     * Creates the internal configuration object and wraps it with a Proxy.
     * The proxy intercepts property assignments and, if the view is rendered,
     * applies only the necessary DOM changes for the updated property.
     * No DOM mutations occur before the first render.
     */
    private setupConfigProxy(): void {
        const self = this;

        this.config = {
            isMultiple: false,
            hasImage: false,
            imagePosition: "right",
            imageWidth: "60px",
            imageHeight: "60px",
            imageBorderRadius: "4px",
            labelValign: "center",
            labelHalign: "left",
        };

        this.configProxy = new Proxy(this.config, {
            set(target, prop, value) {
                if (typeof prop !== "string") return true;

                const key = prop as keyof OptionConfig;
                const oldValue = target[key];

                if (oldValue !== value) {
                    target[key] = value as never;
                    if (self.isRendered) {
                        self.applyPartialChange(key, value, oldValue);
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
    public get isMultiple(): boolean {
        return this.config!.isMultiple;
    }

    /**
     * Enables or disables multiple selection mode.
     * When rendered, toggles the root CSS class and switches the input type between 'checkbox' and 'radio'.
     *
     * @param {boolean} value - True to enable multiple selection; false for single selection.
     */
    public set isMultiple(value: boolean) {
        (this.configProxy as OptionConfig).isMultiple = !!value;
    }

    /**
     * Indicates whether the option includes an image block alongside the label.
     *
     * @returns {boolean} True if an image is displayed; otherwise false.
     */
    public get hasImage(): boolean {
        return this.config!.hasImage;
    }

    /**
     * Shows or hides the image block for the option.
     * When rendered, toggles related CSS classes and creates/removes the image element accordingly.
     *
     * @param {boolean} value - True to show the image; false to hide it.
     */
    public set hasImage(value: boolean) {
        (this.configProxy as OptionConfig).hasImage = !!value;
    }

    /**
     * Provides reactive access to the entire option configuration via a Proxy.
     * Mutating properties on this object will trigger partial DOM updates when rendered.
     *
     * @returns {object} The proxied configuration object.
     */
    public get optionConfig(): OptionConfig {
        return this.configProxy as OptionConfig;
    }

    /**
     * Applies a set of configuration changes in batch.
     * Only properties that differ from the current config are updated.
     * When rendered, each changed property triggers a targeted DOM update via the proxy.
     */
    public set optionConfig(config: OptionConfigPatch | null) {
        if (!config || !this.configProxy || !this.config) return;

        const changes: OptionConfigPatch = {};

        if (config.imageWidth !== undefined && config.imageWidth !== this.config.imageWidth) changes.imageWidth = config.imageWidth;
        if (config.imageHeight !== undefined && config.imageHeight !== this.config.imageHeight) changes.imageHeight = config.imageHeight;
        if (config.imageBorderRadius !== undefined && config.imageBorderRadius !== this.config.imageBorderRadius) changes.imageBorderRadius = config.imageBorderRadius;
        if (config.imagePosition !== undefined && config.imagePosition !== this.config.imagePosition) changes.imagePosition = config.imagePosition;
        if (config.labelValign !== undefined && config.labelValign !== this.config.labelValign) changes.labelValign = config.labelValign;
        if (config.labelHalign !== undefined && config.labelHalign !== this.config.labelHalign) changes.labelHalign = config.labelHalign;

        if (Object.keys(changes).length > 0) Object.assign(this.configProxy, changes);
    }

    /**
     * Renders the option view into the parent element.
     * Builds the DOM structure (input, optional image, label) based on current config,
     * assigns classes and ARIA attributes, mounts via Libs.mountView, and marks as rendered
     * to allow future incremental updates through the config proxy.
     */
    public render(): void {
        const viewClass: Array<string> = ["selective-ui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${opt_id}`;

        if (this.config!.isMultiple) viewClass.push("multiple");
        if (this.config!.hasImage) {
            viewClass.push("has-image");
            viewClass.push(`image-${this.config!.imagePosition}`);
        }

        const childStructure: any = {
            OptionInput: {
                tag: {
                    node: "input",
                    type: this.config!.isMultiple ? "checkbox" : "radio",
                    classList: "allow-choice",
                    id: inputID,
                },
            },
            ...(this.config!.hasImage && {
                OptionImage: {
                    tag: {
                        node: "img",
                        classList: "option-image",
                        style: {
                            width: this.config!.imageWidth,
                            height: this.config!.imageHeight,
                            borderRadius: this.config!.imageBorderRadius,
                        },
                    },
                },
            }),
            OptionLabel: {
                tag: {
                    node: "label",
                    htmlFor: inputID,
                    classList: [
                        `align-vertical-${this.config!.labelValign}`,
                        `align-horizontal-${this.config!.labelHalign}`,
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
        this.isRendered = true;
    }

    /**
     * Applies a targeted DOM update for a single configuration property change.
     * Safely updates classes, attributes, styles, and child elements without re-rendering the whole view.
     */
    private applyPartialChange<K extends keyof OptionConfig>(
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
                    root.classList.add(`image-${this.config!.imagePosition}`);
                    this.createImage();
                } else {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, "").trim();

                    const img = v.tags?.OptionImage as HTMLImageElement | null | undefined;
                    if (img) {
                        img.remove();
                        v.tags.OptionImage = null;
                    }
                }
                break;
            }

            case "imagePosition": {
                if (this.config!.hasImage) {
                    root.className = root.className.replace(/image-(top|right|bottom|left)/g, "").trim();
                    root.classList.add(`image-${String(newValue)}`);
                }
                break;
            }

            case "imageWidth":
            case "imageHeight":
            case "imageBorderRadius": {
                const img = v.tags?.OptionImage as HTMLImageElement | null | undefined;
                if (img) {
                    const styleProp =
                        prop === "imageWidth" ? "width" :
                            prop === "imageHeight" ? "height" :
                                "borderRadius";

                    const val = String(newValue);
                    if (img.style[styleProp] !== val) img.style[styleProp] = val;
                }
                break;
            }

            case "labelValign":
            case "labelHalign": {
                if (label) {
                    const newClass =
                        `align-vertical-${this.config!.labelValign} align-horizontal-${this.config!.labelHalign}`;
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
    private createImage(): void {
        const v = this.view;
        if (!v || !v.view) return;

        const existing = v.tags?.OptionImage as HTMLImageElement | null | undefined;
        if (existing) return;

        const root = v.view as HTMLElement;
        const label = v.tags?.OptionLabel as HTMLLabelElement | undefined;

        const image = document.createElement("img");
        image.className = "option-image";
        image.style.width = this.config!.imageWidth;
        image.style.height = this.config!.imageHeight;
        image.style.borderRadius = this.config!.imageBorderRadius;

        if (label && label.parentElement) root.insertBefore(image, label);
        else root.appendChild(image);

        v.tags.OptionImage = image;
    }
}