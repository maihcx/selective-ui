import { Model } from "../core/base/model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";
import { OptionView } from "../views/option-view";

import type { IEventCallback } from "../types/utils/ievents.type";
import type { OptionViewTags } from "../types/views/view.option.type";
import type { GroupModel } from "./group-model";
import { SelectiveOptions } from "../types/utils/selective.type";

/**
 * @extends {Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions>}
 */
export class OptionModel extends Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions> {
    private _privOnSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    private _privOnInternalSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    private _privOnVisibilityChanged: Array<(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void> = [];

    private _visible = true;

    private _highlighted = false;

    group: GroupModel | null = null;

    /**
     * Constructs a Model instance with configuration options and optional bindings to a target element and view.
     * Stores references for later updates and rendering.
     *
     * @param {SelectiveOptions} options - Configuration options for the model.
     * @param {HTMLOptionElement|null} [targetElement=null] - The underlying element (e.g., <option> or group node).
     * @param {OptionView|null} [view=null] - The associated view responsible for rendering the model.
     */
    constructor(options: SelectiveOptions, targetElement: HTMLOptionElement | null = null, view: OptionView | null = null) {
        super(options, targetElement, view);
        
        (async () => {
            this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());
        })();
    }

    /**
     * Returns the image source from dataset (imgsrc or image), or an empty string if absent.
     *
     * @type {string}
     */
    get imageSrc(): string {
        return this.dataset?.imgsrc || this.dataset?.image || "";
    }

    /**
     * Indicates whether this option has an associated image source.
     *
     * @type {boolean}
     */
    get hasImage(): boolean {
        return !!this.imageSrc;
    }

    /**
     * Gets the option's current value from the underlying <option> element.
     *
     * @type {string}
     */
    get value(): string {
        return this.targetElement?.value ?? "";
    }

    /**
     * Gets whether the option is currently selected (proxied to the <option> element).
     *
     * @type {boolean}
     */
    get selected(): boolean {
        return !!this.targetElement?.selected;
    }

    /**
     * Sets the selected state and triggers external selection listeners.
     * Uses selectedNonTrigger internally to update DOM/ARIA without firing external side effects first.
     *
     * @type {boolean}
     */
    set selected(value: boolean) {
        this.selectedNonTrigger = value;
        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this._privOnSelected);
    }

    /**
     * Gets whether the option is currently visible in the UI.
     *
     * @type {boolean}
     */
    get visible(): boolean {
        return this._visible;
    }

    /**
     * Sets the visibility state; toggles "hide" class on the view and notifies visibility listeners.
     *
     * @type {boolean}
     */
    set visible(value: boolean) {
        if (this._visible === value) return;
        this._visible = value;

        const viewEl = this.view?.getView?.();
        if (viewEl) viewEl.classList.toggle("hide", !value);

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this._privOnVisibilityChanged);
    }

    /**
     * Gets the selected state without triggering external listeners (alias of selected).
     *
     * @type {boolean}
     */
    get selectedNonTrigger(): boolean {
        return this.selected;
    }

    /**
     * Sets the selected state and updates input checked, CSS classes, ARIA attributes,
     * and the underlying <option> 'selected' attribute. Notifies internal selection listeners.
     *
     * @type {boolean}
     */
    set selectedNonTrigger(value: boolean) {
        const input = this.view?.view?.tags?.OptionInput;
        const viewEl = this.view?.getView?.();

        if (input) (input as HTMLInputElement).checked = value;

        if (viewEl && this.targetElement) {
            viewEl.classList.toggle("checked", !!value);
            viewEl.setAttribute("aria-selected", value ? "true" : "false");
            this.targetElement.toggleAttribute("selected", !!value);
        }

        if (this.targetElement) this.targetElement.selected = value;

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this._privOnInternalSelected);
    }

    /**
     * Returns the display text for the option, applying tag translation and optional HTML allowance.
     * If allowHtml=false, returns stripped/sanitized text.
     *
     * @type {string}
     */
    get text(): string {
        const raw = this.dataset?.mask ?? this.targetElement?.text ?? "";
        const translated = Libs.tagTranslate(raw);
        return this.options.allowHtml ? translated : Libs.stripHtml(translated);
    }

    /**
     * Returns a plain-text version of the display text (trimmed),
     * stripping HTML if allowHtml is true, otherwise the raw text.
     *
     * @type {string}
     */
    get textContent(): string {
        return this.options.allowHtml ? Libs.stripHtml(this.text).trim() : this.text.trim();
    }

    textToFind: string;

    /**
     * Returns the dataset object of the underlying <option> element, or an empty object.
     *
     * @type {DOMStringMap|Record<string, string>}
     */
    get dataset(): DOMStringMap {
        return this.targetElement?.dataset ?? ({} as DOMStringMap);
    }

    /**
     * Gets whether the option is currently highlighted (e.g., via keyboard navigation).
     *
     * @type {boolean}
     */
    get highlighted(): boolean {
        return this._highlighted;
    }

    /**
     * Sets the highlighted state and toggles the "highlight" CSS class on the view.
     * Always syncs the DOM class even if the state is unchanged.
     *
     * @type {boolean}
     */
    set highlighted(value: boolean) {
        const val = !!value;
        const viewEl = this.view?.getView?.();

        if (this._highlighted !== val) this._highlighted = val;
        if (viewEl) viewEl.classList.toggle("highlight", val);
    }

    /**
     * Registers a listener invoked when external selection changes (via setter `selected`).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Selection listener.
     */
    onSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this._privOnSelected.push(callback);
    }

    /**
     * Registers a listener invoked when internal selection changes (via setter `selectedNonTrigger`).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Internal selection listener.
     */
    onInternalSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this._privOnInternalSelected.push(callback);
    }

    /**
     * Registers a listener invoked when visibility changes (via setter `visible`).
     *
     * @param {(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void} callback - Visibility listener.
     */
    onVisibilityChanged(callback: (evtToken: IEventCallback, model: OptionModel, visible: boolean) => void): void {
        this._privOnVisibilityChanged.push(callback);
    }

    /**
     * Hook called when the target <option> element changes.
     * Updates label content (HTML or text), image src/alt if present,
     * and synchronizes initial selected state to the view.
     */
    onTargetChanged(): void {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());
        if (!this.view) return;

        const labelContent = this.view.view.tags.LabelContent;
        if (labelContent) {
            if (this.options.allowHtml) {
                labelContent.innerHTML = this.text;
            } else {
                labelContent.textContent = this.textContent;
            }
        }

        const imageTag = this.view.view.tags.OptionImage;
        if (imageTag && this.hasImage) {
            (imageTag as HTMLImageElement).src = this.imageSrc;
            (imageTag as HTMLImageElement).alt = this.text;
        }

        if (this.targetElement) this.selectedNonTrigger = this.targetElement.selected;
    }
}