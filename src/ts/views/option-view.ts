import { View } from "../core/base/view";
import { Libs } from "../utils/libs";
import type {
    OptionViewTags,
    OptionViewResult,
    OptionConfig,
    OptionConfigPatch
} from "../types/views/view.option.type";

/**
 * OptionView
 *
 * View implementation for a single selectable option with reactive configuration.
 *
 * ### Responsibility
 * - Renders an option with input (radio/checkbox) + optional image + label.
 * - Supports **reactive configuration** via Proxy-based change tracking.
 * - Applies **incremental DOM updates** for configuration changes (no full re-render).
 * - Manages input type switching (radio ↔ checkbox) based on selection mode.
 * - Dynamically creates/removes image elements when {@link hasImage} changes.
 *
 * ### Structure
 * ```
 * OptionView (root, role="option")
 *   ├─ OptionInput (<input type="radio|checkbox">)
 *   ├─ OptionImage (<img>, conditional)
 *   └─ OptionLabel (<label>)
 *       └─ LabelContent (<div>)
 * ```
 *
 * ### Lifecycle (View-based FSM)
 * - **Construction**: Calls {@link initialize}, sets up config Proxy, transitions `NEW → INITIALIZED`.
 * - **{@link mount}**: Creates DOM structure based on current config, transitions `INITIALIZED → MOUNTED`.
 * - **Reactive updates**: After mount, config changes trigger {@link applyPartialChange} (targeted DOM updates).
 * - **{@link destroy}**: Removes DOM nodes, transitions to `DESTROYED`.
 *
 * ### Reactive configuration strategy
 * - **{@link config}**: Internal target object (should not be mutated directly).
 * - **{@link configProxy}**: Proxy wrapper; assignments trigger {@link applyPartialChange}.
 * - **{@link isRendered}**: Gates partial updates (no DOM changes before initial {@link mount}).
 * - **Batch updates**: {@link optionConfig} setter applies multiple changes efficiently (only diffed properties).
 *
 * ### Partial update semantics
 * - **`isMultiple`**: Toggles `"multiple"` class, switches input `type` (radio ↔ checkbox).
 * - **`hasImage`**: Toggles `"has-image"` class, creates/removes `<img>` element.
 * - **`imagePosition`**: Replaces `image-{position}` class (top/right/bottom/left).
 * - **`imageWidth/Height/BorderRadius`**: Mutates `<img>` inline styles.
 * - **`labelValign/Halign`**: Replaces label alignment classes.
 *
 * ### Image lifecycle
 * - Created on-demand via {@link createImage} when `hasImage = true`.
 * - Removed via `remove()` when `hasImage = false`.
 * - Reference stored in `view.tags.OptionImage` (nulled after removal).
 *
 * ### Accessibility
 * - Root: `role="option"`, `aria-selected="false"` (managed externally), `tabindex="-1"`.
 * - Input: Associated with label via unique `id` / `htmlFor`.
 * - Label: Clickable, triggers input selection.
 *
 * ### DOM side effects
 * - {@link mount} creates and appends full structure.
 * - {@link applyPartialChange} mutates classes, attributes, styles, or child nodes.
 * - {@link createImage} inserts `<img>` element.
 * - Setters ({@link isMultiple}, {@link hasImage}) trigger Proxy → DOM updates.
 *
 * ### No-op / Idempotency
 * - {@link applyPartialChange} is no-op if view not mounted (early return guard).
 * - {@link createImage} is no-op if image already exists.
 * - {@link optionConfig} setter only assigns diffed properties (avoids redundant Proxy triggers).
 * - Safe to call setters multiple times with same value (Proxy guards against no-op updates).
 *
 * @extends View<OptionViewTags>
 * @template OptionViewTags - Type descriptor for the option's DOM structure.
 * @see {@link OptionViewResult}
 * @see {@link OptionConfig}
 * @see {@link View}
 */
export class OptionView extends View<OptionViewTags> {

    /**
     * Strongly-typed reference to the mounted option view structure.
     *
     * Structure:
     * - **view**: Root container element.
     * - **tags**: Named references to input, image (conditional), label, label content.
     *
     * Lifecycle:
     * - `null` until {@link mount} completes.
     * - Cleared during {@link destroy}.
     *
     * @public
     */
    public view: OptionViewResult | null = null;

    /**
     * Internal configuration object (Proxy target).
     *
     * Lifecycle:
     * - Initialized during {@link initialize} with default values.
     * - Mutated via {@link configProxy} Proxy trap.
     *
     * Notes:
     * - **Should not be mutated directly**; use {@link configProxy} or typed setters.
     * - Contains default values for layout, image, and alignment.
     *
     * @private
     */
    private config: OptionConfig | null = null;

    /**
     * Reactive Proxy wrapper around {@link config}.
     *
     * Behavior:
     * - Intercepts property assignments via `set` trap.
     * - Triggers {@link applyPartialChange} for diffed values when {@link isRendered} is `true`.
     * - Prevents redundant DOM updates when value hasn't changed.
     *
     * Usage:
     * - Accessed via {@link optionConfig} getter or typed setters ({@link isMultiple}, {@link hasImage}).
     *
     * @private
     */
    private configProxy: OptionConfig | null = null;

    /**
     * Flag indicating whether the initial render has completed.
     *
     * Lifecycle:
     * - `false` until {@link mount} finishes.
     * - `true` afterward (enables partial updates).
     *
     * Purpose:
     * - Gates {@link applyPartialChange} to prevent DOM mutations before structure exists.
     *
     * @private
     */
    private isRendered = false;

    /**
     * Creates a new OptionView bound to the given parent element.
     *
     * Initialization flow:
     * 1. Calls `super(parent)` (View base constructor).
     * 2. Calls {@link initialize} to set up config and Proxy.
     * 3. Transitions `NEW → INITIALIZED` via `this.init()` inside {@link initialize}.
     *
     * @public
     * @param {HTMLElement} parent - Container element that will host this option view.
     */
    public constructor(parent: HTMLElement) {
        super(parent);
        this.initialize();
    }

    /**
     * Initializes the default configuration and sets up reactive Proxy.
     *
     * Configuration defaults:
     * - `isMultiple`: `false` (radio mode)
     * - `hasImage`: `false` (no image)
     * - `imagePosition`: `"right"`
     * - `imageWidth/Height`: `"60px"`
     * - `imageBorderRadius`: `"4px"`
     * - `labelValign/Halign`: `"center"` / `"left"`
     *
     * Proxy behavior:
     * - **`set` trap**: Compares old vs new value; if different:
     *   1. Updates {@link config} target.
     *   2. Calls {@link applyPartialChange} if {@link isRendered} is `true`.
     * - Returns `true` to indicate success.
     *
     * Postcondition:
     * - {@link config} and {@link configProxy} are initialized.
     * - Transitions `NEW → INITIALIZED` via `this.init()`.
     *
     * Notes:
     * - No DOM mutations occur until {@link mount} is called.
     *
     * @public
     * @returns {void}
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
     * Semantics:
     * - `false`: Single selection mode (radio input).
     * - `true`: Multiple selection mode (checkbox input).
     *
     * @public
     * @returns {boolean} Current selection mode.
     */
    public get isMultiple(): boolean {
        return this.config!.isMultiple;
    }

    /**
     * Enables or disables multiple selection mode.
     *
     * Side effects (when rendered):
     * - Toggles `"multiple"` CSS class on root element.
     * - Switches input `type` attribute (`"radio"` ↔ `"checkbox"`).
     *
     * Notes:
     * - Assignments trigger Proxy → {@link applyPartialChange}.
     * - No-op if value hasn't changed (Proxy guards).
     *
     * @public
     * @param {boolean} value - `true` for multiple selection; `false` for single.
     */
    public set isMultiple(value: boolean) {
        (this.configProxy as OptionConfig).isMultiple = !!value;
    }

    /**
     * Indicates whether the option displays an image.
     *
     * @public
     * @returns {boolean} `true` if image is visible; `false` otherwise.
     */
    public get hasImage(): boolean {
        return this.config!.hasImage;
    }

    /**
     * Shows or hides the option's image element.
     *
     * Side effects (when rendered):
     * - **`true`**: Toggles `"has-image"` class, adds `image-{position}` class, calls {@link createImage}.
     * - **`false`**: Removes `"has-image"` and `image-*` classes, removes `<img>` element, nulls reference.
     *
     * Notes:
     * - Assignments trigger Proxy → {@link applyPartialChange}.
     * - Image is created on-demand (not pre-rendered).
     *
     * @public
     * @param {boolean} value - `true` to show image; `false` to hide.
     */
    public set hasImage(value: boolean) {
        (this.configProxy as OptionConfig).hasImage = !!value;
    }

    /**
     * Provides reactive access to the full option configuration.
     *
     * Usage:
     * - **Getter**: Returns {@link configProxy} for direct property access.
     * - **Setter**: Applies batch configuration changes (see setter docs).
     *
     * Notes:
     * - Mutating properties on the returned object triggers incremental DOM updates.
     * - Safe to read/write after {@link initialize} completes.
     *
     * @public
     * @returns {OptionConfig} Reactive configuration Proxy.
     */
    public get optionConfig(): OptionConfig {
        return this.configProxy as OptionConfig;
    }

    /**
     * Applies a batch of configuration changes efficiently.
     *
     * Optimization strategy:
     * 1. Compares each incoming property against current {@link config} value.
     * 2. Builds a `changes` object containing **only diffed properties**.
     * 3. Assigns `changes` to {@link configProxy} via `Object.assign` (triggers Proxy traps).
     *
     * Diffed properties:
     * - `imageWidth`, `imageHeight`, `imageBorderRadius`
     * - `imagePosition`
     * - `labelValign`, `labelHalign`
     *
     * Notes:
     * - No-op if `config` is `null`, or no properties differ.
     * - Prevents redundant Proxy triggers for unchanged values.
     * - Each changed property triggers {@link applyPartialChange} individually.
     *
     * @public
     * @param {OptionConfigPatch | null} config - Partial configuration patch; `null` is no-op.
     * @returns {void}
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
     * Rendering flow:
     * 1. Generates unique option ID (7-character random string).
     * 2. Builds CSS classes based on current {@link config} (`multiple`, `has-image`, `image-{position}`).
     * 3. Constructs child structure:
     *    - **OptionInput**: `<input type="radio|checkbox">` with unique ID.
     *    - **OptionImage** (conditional): `<img>` with inline styles (width/height/borderRadius).
     *    - **OptionLabel**: `<label htmlFor="{inputID}">` with alignment classes.
     *      - **LabelContent**: `<div>` (content placeholder).
     * 4. Creates DOM via {@link Libs.mountView}.
     * 5. Appends root to {@link parent}.
     * 6. Sets {@link isRendered} to `true` (enables reactive updates).
     * 7. Transitions `INITIALIZED → MOUNTED` via `super.mount()`.
     *
     * Accessibility setup:
     * - Root: `role="option"`, `aria-selected="false"`, `tabindex="-1"`.
     * - Input/Label association via `id` / `htmlFor`.
     *
     * Postcondition:
     * - {@link view} is populated with typed DOM references.
     * - Reactive updates are now enabled.
     *
     * @public
     * @returns {void}
     * @override
     */
    public override mount(): void {
        const viewClass: string[] = ["seui-option-view"];
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
     * Implementation strategy:
     * - Retrieves DOM references from {@link view}.
     * - Switches on `prop` to determine update type.
     * - Mutates **only** the affected DOM nodes (classes, attributes, styles, or child structure).
     *
     * Update rules:
     * - **`isMultiple`**: Toggle `"multiple"` class, switch input `type` (radio ↔ checkbox).
     * - **`hasImage`**: Toggle `"has-image"` class, create/remove `<img>` element, manage `image-*` classes.
     * - **`imagePosition`**: Replace `image-{position}` class (top/right/bottom/left).
     * - **`imageWidth/Height/BorderRadius`**: Mutate `<img>` inline styles.
     * - **`labelValign/Halign`**: Replace label alignment classes.
     *
     * No-op conditions:
     * - If {@link view} is `null` (not mounted yet).
     * - If affected element doesn't exist (e.g., image removed).
     *
     * Notes:
     * - Called by Proxy `set` trap when {@link isRendered} is `true`.
     * - Avoids full re-render; updates are incremental and efficient.
     * - `oldValue` parameter is unused (reserved for future diffing logic).
     *
     * @private
     * @template K - Key of {@link OptionConfig}.
     * @param {K} prop - Property name that changed.
     * @param {OptionConfig[K]} newValue - New value for the property.
     * @param {OptionConfig[K]} oldValue - Previous value (currently unused).
     * @returns {void}
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
     * Creation flow:
     * 1. Checks if image already exists (early return if present).
     * 2. Creates `<img>` element with:
     *    - Class: `"option-image"`
     *    - Inline styles: `width`, `height`, `borderRadius` from {@link config}.
     * 3. Inserts image before {@link OptionLabel} (if label exists), otherwise appends to root.
     * 4. Stores reference in `view.tags.OptionImage`.
     *
     * No-op conditions:
     * - If {@link view} is `null` (not mounted yet).
     * - If image already exists in `view.tags.OptionImage`.
     *
     * Notes:
     * - Called by {@link applyPartialChange} when `hasImage` transitions to `true`.
     * - Insertion order ensures proper layout (image before label).
     *
     * @private
     * @returns {void}
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