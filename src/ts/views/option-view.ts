
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type {
    OptionViewTags,
    OptionViewResult,
    OptionConfig,
    OptionConfigPatch
} from "../types/views/view.option.type";

/**
 * View implementation for a single selectable option.
 *
 * An option may consist of:
 * - An input element (radio or checkbox)
 * - An optional image
 * - A label container
 *
 * This view supports reactive configuration changes via a Proxy,
 * allowing partial DOM updates without fully re-rendering the view.
 *
 * @extends View<OptionViewTags>
 */
export class OptionView extends View<OptionViewTags> {

    /**
     * Reference to the mounted option view.
     * Set during `onMount`; null before render.
     */
    public view: OptionViewResult | null = null;

    /**
     * Internal configuration state used as the Proxy target.
     * Should not be mutated directly.
     */
    private config: OptionConfig | null = null;

    /**
     * Proxy wrapper around `config`.
     * Assigning properties on this object triggers incremental
     * DOM updates once the view has been rendered.
     */
    private configProxy: OptionConfig | null = null;

    /**
     * Indicates whether the initial render has been completed.
     * Partial DOM updates are skipped until this becomes true.
     */
    private isRendered = false;

    /**
     * Creates a new OptionView bound to the given parent element.
     *
     * Initializes the internal configuration and sets up
     * a reactive Proxy to track and apply configuration changes.
     *
     * @param parent - The container element that will host this option view.
     */
    public constructor(parent: HTMLElement) {
        super(parent);
        this.initialize();
    }

    /**
     * Initializes the default configuration object and wraps it in a Proxy.
     *
     * The Proxy intercepts property assignments and:
     * - Updates internal state
     * - Applies targeted DOM changes when the view is already rendered
     *
     * No DOM mutations occur before the initial render.
     */
    public initialize(): void {
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

        this.init();
    }

    /**
     * Indicates whether the option supports multiple selection.
     *
     * - `false`: single selection (radio)
     * - `true`: multiple selection (checkbox)
     */
    public get isMultiple(): boolean {
        return this.config!.isMultiple;
    }

    /**
     * Enables or disables multiple selection mode.
     *
     * When rendered:
     * - Toggles the `multiple` CSS class on the root element
     * - Switches the input type between `radio` and `checkbox`
     */
    public set isMultiple(value: boolean) {
        (this.configProxy as OptionConfig).isMultiple = !!value;
    }

    /**
     * Indicates whether the option displays an image next to the label.
     */
    public get hasImage(): boolean {
        return this.config!.hasImage;
    }

    /**
     * Shows or hides the image block.
     *
     * When rendered:
     * - Toggles related CSS classes
     * - Creates or removes the `<img>` element dynamically
     */
    public set hasImage(value: boolean) {
        (this.configProxy as OptionConfig).hasImage = !!value;
    }

    /**
     * Provides reactive access to the full option configuration.
     *
     * Mutating properties on this object triggers incremental
     * DOM updates when the view has already been rendered.
     */
    public get optionConfig(): OptionConfig {
        return this.configProxy as OptionConfig;
    }

    /**
     * Applies a batch of configuration changes.
     *
     * Only properties whose values differ from the current state
     * are assigned to the Proxy and processed.
     *
     * @param config - Partial configuration patch
     */
    public set optionConfig(config: OptionConfigPatch | null) {
        if (!config || !this.configProxy || !this.config) return;

        const changes: OptionConfigPatch = {};

        if (config.imageWidth !== undefined && config.imageWidth !== this.config.imageWidth)
            changes.imageWidth = config.imageWidth;

        if (config.imageHeight !== undefined && config.imageHeight !== this.config.imageHeight)
            changes.imageHeight = config.imageHeight;

        if (config.imageBorderRadius !== undefined && config.imageBorderRadius !== this.config.imageBorderRadius)
            changes.imageBorderRadius = config.imageBorderRadius;

        if (config.imagePosition !== undefined && config.imagePosition !== this.config.imagePosition)
            changes.imagePosition = config.imagePosition;

        if (config.labelValign !== undefined && config.labelValign !== this.config.labelValign)
            changes.labelValign = config.labelValign;

        if (config.labelHalign !== undefined && config.labelHalign !== this.config.labelHalign)
            changes.labelHalign = config.labelHalign;

        if (Object.keys(changes).length > 0) {
            Object.assign(this.configProxy, changes);
        }
    }

    /**
     * Performs the initial render of the option view.
     *
     * Builds the DOM structure based on the current configuration,
     * assigns CSS classes and ARIA attributes, mounts the view via
     * `Libs.mountView`, and enables reactive updates afterward.
     */
    public override mount(): void {
        const viewClass: string[] = ["selective-ui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${opt_id}`;

        if (this.config!.isMultiple) viewClass.push("multiple");

        if (this.config!.hasImage) {
            viewClass.push("has-image", `image-${this.config!.imagePosition}`);
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

        super.mount();
    }

    /**
     * Applies a targeted DOM update for a single configuration change.
     *
     * Updates only the affected parts of the view
     * (classes, attributes, styles, or child nodes)
     * without triggering a full re-render.
     */
    private applyPartialChange<K extends keyof OptionConfig>(
        prop: K,
        newValue: OptionConfig[K],
        oldValue: OptionConfig[K]
    ): void {
        const v = this.view;
        if (!v || !v.view) return;

        const root = v.view;
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
                    root.className = root.className
                        .replace(/image-(top|right|bottom|left)/g, "")
                        .trim();

                    const img = v.tags?.OptionImage as HTMLImageElement | null | undefined;
                    img?.remove();
                    v.tags.OptionImage = null;
                }
                break;
            }

            case "imagePosition": {
                if (this.config!.hasImage) {
                    root.className = root.className
                        .replace(/image-(top|right|bottom|left)/g, "")
                        .trim();
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

                    img.style[styleProp] = String(newValue);
                }
                break;
            }

            case "labelValign":
            case "labelHalign": {
                if (label) {
                    label.className =
                        `align-vertical-${this.config!.labelValign} ` +
                        `align-horizontal-${this.config!.labelHalign}`;
                }
                break;
            }

            default:
                void oldValue;
        }
    }

    /**
     * Creates and inserts the `<img>` element for the option on demand.
     *
     * The image is styled using the current configuration and is inserted
     * before the label when possible. If an image already exists, no action
     * is taken.
     */
    private createImage(): void {
        const v = this.view;
        if (!v || !v.view) return;

        if (v.tags?.OptionImage) return;

        const root = v.view;
        const label = v.tags?.OptionLabel as HTMLLabelElement | undefined;

        const image = document.createElement("img");
        image.className = "option-image";
        image.style.width = this.config!.imageWidth;
        image.style.height = this.config!.imageHeight;
        image.style.borderRadius = this.config!.imageBorderRadius;

        if (label?.parentElement) {
            root.insertBefore(image, label);
        } else {
            root.appendChild(image);
        }

        v.tags.OptionImage = image;
    }
}