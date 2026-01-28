import { Model } from "../core/base/model";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";
import { OptionView } from "../views/option-view";

import type { IEventCallback } from "../types/utils/ievents.type";
import type { OptionViewTags } from "../types/views/view.option.type";
import type { GroupModel } from "./group-model";
import { SelectiveOptions } from "../types/utils/selective.type";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * Model representing a single `<option>` entry in the Select UI.
 *
 * Responsibilities:
 * - Mirror and synchronize state with the underlying `<option>` element
 *   (value, selected, dataset, text)
 * - Expose computed properties for rendering (image, rich text/stripped text)
 * - Manage visibility and highlight states for keyboard navigation
 * - Notify external listeners for selection and visibility changes
 *
 * Lifecycle:
 * - On `init()`: precomputes `textToFind` for filtering
 * - On `update()`: syncs DOM (view) with element state (label, image, selection)
 * - On `destroy()`: clears listeners and references
 *
 * @extends {Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions>}
 */
export class OptionModel extends Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions> {
    /** External selection listeners (fired by `selected` setter). */
    private privOnSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    /** Internal selection listeners (fired by `selectedNonTrigger` setter). */
    private privOnInternalSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    /** Visibility listeners (fired by `visible` setter). */
    private privOnVisibilityChanged: Array<(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void> = [];

    /** Visibility flag (controlled by filtering/search). */
    private _visible = true;

    /** Highlight flag (used for keyboard focus/hover). */
    private _highlighted = false;

    /** Parent group model (if this option belongs to a group). */
    public group: GroupModel | null = null;

    /**
     * Creates an option model with configuration and optional bindings.
     *
     * @param options - Rendering/config options for the Select UI.
     * @param targetElement - Underlying `<option>` element.
     * @param view - Associated view responsible for rendering.
     */
    public constructor(options: SelectiveOptions, targetElement: HTMLOptionElement | null = null, view: OptionView | null = null) {
        super(options, targetElement, view);
    }

    /**
     * Initializes the model.
     *
     * - Precomputes `textToFind` (lowercased, normalized) for fast searching
     * - Emits lifecycle `onInit` and then immediately `mount()` for first render
     */
    public override init(): void {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());

        super.init();
        this.mount();
    }

    /**
     * Image source (from dataset: `imgsrc` or `image`), or empty string if absent.
     */
    public get imageSrc(): string {
        return this.dataset?.imgsrc || this.dataset?.image || "";
    }

    /**
     * Whether this option has an associated image.
     */
    public get hasImage(): boolean {
        return !!this.imageSrc;
    }

    /**
     * Current value of the underlying `<option>`.
     */
    public get value(): string {
        return this.targetElement?.value ?? "";
    }

    /**
     * Whether this option is currently selected (proxied to `<option>.selected`).
     */
    public get selected(): boolean {
        return !!this.targetElement?.selected;
    }

    /**
     * Sets the selected state and triggers **external** selection listeners.
     *
     * Flow:
     * - Writes through to `selectedNonTrigger` to sync UI/ARIA/DOM attributes
     * - Calls `privOnSelected` listeners via `iEvents.callEvent`
     */
    public set selected(value: boolean) {
        this.selectedNonTrigger = value;
        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnSelected);
    }

    /**
     * Whether the option is currently visible (for filtering).
     */
    public get visible(): boolean {
        return this._visible;
    }

    /**
     * Sets visibility and toggles `hide` class on the view.
     * Notifies visibility listeners.
     */
    public set visible(value: boolean) {
        if (this._visible === value) return;
        this._visible = value;

        const viewEl = this.view?.getView?.();
        if (viewEl) viewEl.classList.toggle("hide", !value);

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnVisibilityChanged);
    }

    /**
     * Selected state **without** firing external listeners (alias of `selected`).
     *
     * Useful for internal sync when toggling the underlying element or view.
     */
    public get selectedNonTrigger(): boolean {
        return this.selected;
    }

    /**
     * Sets selected state and updates:
     * - Input checked state (checkbox/radio)
     * - Root view classes (`checked`) and ARIA attributes (`aria-selected`)
     * - Underlying `<option>` `selected` attribute/property
     *
     * Fires **internal** selection listeners afterwards.
     */
    public set selectedNonTrigger(value: boolean) {
        const input = this.view?.view?.tags?.OptionInput;
        const viewEl = this.view?.getView?.();

        if (input) (input as HTMLInputElement).checked = value;

        if (viewEl && this.targetElement) {
            viewEl.classList.toggle("checked", !!value);
            viewEl.setAttribute("aria-selected", value ? "true" : "false");
            this.targetElement.toggleAttribute("selected", !!value);
        }

        if (this.targetElement) this.targetElement.selected = value;

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnInternalSelected);
    }

    /**
     * Display text for the option (with tag translation).
     *
     * - When `allowHtml = true`: returns the translated HTML string (not stripped)
     * - When `allowHtml = false`: returns stripped/sanitized text (plain)
     */
    public get text(): string {
        const raw = this.dataset?.mask ?? this.targetElement?.text ?? "";
        const translated = Libs.tagTranslate(raw);
        return this.options.allowHtml ? translated : Libs.stripHtml(translated);
    }

    /**
     * Plain-text version of the display text (trimmed).
     *
     * - If `allowHtml = true`: strips HTML from `text`
     * - Else: returns `text` directly (already plain)
     */
    public get textContent(): string {
        return this.options.allowHtml ? Libs.stripHtml(this.text).trim() : this.text.trim();
    }

    /** Normalized, lowercase text used for searching/filtering. */
    public textToFind: string;

    /**
     * Dataset object from the underlying `<option>` element (or empty object).
     */
    public get dataset(): DOMStringMap {
        return this.targetElement?.dataset ?? ({} as DOMStringMap);
    }

    /**
     * Whether the option is currently highlighted (e.g., keyboard navigation).
     */
    public get highlighted(): boolean {
        return this._highlighted;
    }

    /**
     * Sets highlight state and toggles the `highlight` class on the view.
     * Always ensures DOM class reflects the latest state.
     */
    public set highlighted(value: boolean) {
        const val = !!value;
        const viewEl = this.view?.getView?.();

        if (this._highlighted !== val) this._highlighted = val;
        if (viewEl) viewEl.classList.toggle("highlight", val);
    }

    /**
     * Subscribes to **external** selection changes (fired by `selected` setter).
     */
    public onSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this.privOnSelected.push(callback);
    }

    /**
     * Subscribes to **internal** selection changes (fired by `selectedNonTrigger` setter).
     */
    public onInternalSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this.privOnInternalSelected.push(callback);
    }

    /**
     * Subscribes to visibility changes (fired by `visible` setter).
     */
    public onVisibilityChanged(callback: (evtToken: IEventCallback, model: OptionModel, visible: boolean) => void): void {
        this.privOnVisibilityChanged.push(callback);
    }

    /**
     * Hook called when the underlying target `<option>` or options change.
     *
     * Syncs:
     * - Label content (HTML vs text based on `allowHtml`)
     * - Image `src`/`alt` (if present)
     * - Initial selected state from `<option>.selected`
     */
    public override update(): void {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());
        if (!this.view) {
            super.update();
            return;
        }

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

        super.update();
    }

    /**
     * Destroys the model and clears listeners/references.
     *
     * - Empties listener arrays
     * - Detaches from group
     * - Clears search cache
     * - Ends lifecycle
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.privOnSelected = [];
        this.privOnInternalSelected = [];
        this.privOnVisibilityChanged = [];
        this.group = null;
        this.textToFind = null as unknown as string;
        
        super.destroy();
    }
}