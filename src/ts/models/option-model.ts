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
 * Domain model for a native `<option>` element.
 *
 * This is the core selectable row model consumed by adapters/recyclers. It mirrors the backing
 * `<option>` node while also carrying UI-only state used by the headless+DOM-driven layer
 * (visibility, highlight, precomputed search key).
 *
 * ### Responsibility
 * - Mirror and synchronize state with the backing `<option>` element:
 *   - `value`, `selected`, `dataset`, and display label (with optional tag translation / HTML policy).
 * - Provide derived properties for rendering:
 *   - image resolution (`imageSrc` / `hasImage`),
 *   - rich/stripped label (`text` / `textContent`),
 *   - normalized search key (`textToFind`).
 * - Maintain UI-only flags:
 *   - `visible` for filtering/search,
 *   - `highlighted` for keyboard navigation/hover.
 * - Publish change notifications:
 *   - **External** selection (`selected`) vs **internal** selection sync (`selectedNonTrigger`),
 *   - visibility changes (`visible`).
 *
 * ### Lifecycle (Strict FSM)
 * - Base {@link Model} calls `init()` during construction (`NEW → INITIALIZED`), and this subclass
 *   overrides {@link init} to precompute {@link textToFind} before delegating to `super.init()`.
 * - {@link init} then transitions to `MOUNTED` via `mount()` for first render readiness.
 * - {@link update} recomputes derived text/search fields and pushes state into the {@link OptionView}
 *   if attached, then emits lifecycle update.
 * - {@link destroy} clears listeners/references and transitions to `DESTROYED` (idempotent).
 *
 * ### External vs internal selection semantics
 * - `selected` is the **external** user-facing signal:
 *   updates state (via {@link selectedNonTrigger}) and then notifies {@link onSelected} listeners.
 * - `selectedNonTrigger` is the **internal** sync signal:
 *   updates view/DOM/backing `<option>` and then notifies {@link onInternalSelected} listeners
 *   **without** implying user intent.
 *
 * ### DOM & a11y side effects (when a view is attached)
 * - Toggles CSS classes: `"hide"`, `"highlight"`, `"checked"`.
 * - Updates `aria-selected` on the option row root element.
 * - Updates label content (either `innerHTML` or `textContent` depending on `allowHtml`).
 * - Mirrors selection state to the backing `<option>` (property + attribute).
 *
 * @extends {Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions>}
 * @see {@link GroupModel}
 * @see {@link OptionView}
 */
export class OptionModel extends Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions> {
    /**
     * External selection subscribers (emitted by the {@link selected} setter).
     * Use this for user-facing selection flows.
     */
    private privOnSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    /**
     * Internal selection subscribers (emitted by the {@link selectedNonTrigger} setter).
     * Use this for silent synchronization flows.
     */
    private privOnInternalSelected: Array<(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void> = [];

    /**
     * Visibility subscribers (emitted by the {@link visible} setter).
     * Commonly used to recompute group visibility and update aggregated visibility stats.
     */
    private privOnVisibilityChanged: Array<(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void> = [];

    /**
     * Visibility flag used for filtering/search.
     * When `false`, adapters/recyclers may treat this item as non-renderable.
     */
    private _visible = true;

    /** Highlight flag used for keyboard navigation / hover. */
    private _highlighted = false;

    /**
     * Parent group model (if this option belongs to a group).
     * Assigned by grouping logic (e.g., GroupModel/MixedAdapter).
     */
    public group: GroupModel | null = null;

    /**
     * Creates an option model.
     *
     * @param {SelectiveOptions} options - Shared configuration for models/views.
     * @param {HTMLOptionElement | null} [targetElement=null] - Backing `<option>` element.
     * @param {OptionView | null} [view=null] - Optional view used to render this model.
     */
    public constructor(
        options: SelectiveOptions,
        targetElement: HTMLOptionElement | null = null,
        view: OptionView | null = null
    ) {
        super(options, targetElement, view);
    }

    /**
     * Initializes the model and precomputes the search key.
     *
     * - Computes {@link textToFind} from {@link textContent} (lowercased + normalized).
     * - Delegates to `super.init()` and then transitions to `MOUNTED` via `mount()`.
     *
     * @returns {void}
     * @override
     */
    public override init(): void {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());

        super.init();
        this.mount();
    }

    /**
     * Image source resolved from dataset (`imgsrc` or `image`), or empty string if absent.
     *
     * @returns {string}
     */
    public get imageSrc(): string {
        return this.dataset?.imgsrc || this.dataset?.image || "";
    }

    /**
     * Whether this option has an image associated with it.
     *
     * @returns {boolean}
     */
    public get hasImage(): boolean {
        return !!this.imageSrc;
    }

    /**
     * Current value of the backing `<option>`.
     *
     * @returns {string}
     */
    public get value(): string {
        return this.targetElement?.value ?? "";
    }

    /**
     * Whether the backing `<option>` is selected.
     *
     * @returns {boolean}
     */
    public get selected(): boolean {
        return !!this.targetElement?.selected;
    }

    /**
     * Sets selected state and emits **external** selection listeners.
     *
     * Flow:
     * - Delegates to {@link selectedNonTrigger} to synchronize view/DOM/backing element.
     * - Notifies {@link onSelected} subscribers via {@link iEvents.callEvent}.
     *
     * @param {boolean} value - New selection state.
     * @returns {void}
     */
    public set selected(value: boolean) {
        this.selectedNonTrigger = value;
        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnSelected);
    }

    /**
     * Whether this option is visible (used for filtering/search).
     *
     * @returns {boolean}
     */
    public get visible(): boolean {
        return this._visible;
    }

    /**
     * Sets visibility and synchronizes the view (if attached), then emits visibility listeners.
     *
     * Side effects (when view attached):
     * - Toggles `"hide"` CSS class on the view root element.
     *
     * Idempotent:
     * - No-op if the new value equals the current state.
     *
     * @param {boolean} value - New visibility state.
     * @returns {void}
     */
    public set visible(value: boolean) {
        if (this._visible === value) return;
        this._visible = value;

        const viewEl = this.view?.getView?.();
        if (viewEl) viewEl.classList.toggle("hide", !value);

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnVisibilityChanged);
    }

    /**
     * Reads selected state without emitting external selection listeners.
     *
     * @returns {boolean}
     */
    public get selectedNonTrigger(): boolean {
        return this.selected;
    }

    /**
     * Sets selected state **silently** (internal sync), updates view/a11y/backing DOM, then emits internal listeners.
     *
     * Side effects (when view/backing element exist):
     * - Updates the input checked state (`OptionInput`) if present.
     * - Toggles `"checked"` class on the root element.
     * - Sets `aria-selected`.
     * - Mirrors to backing `<option>`:
     *   - toggles `selected` attribute,
     *   - sets `targetElement.selected`.
     *
     * @param {boolean} value - New selection state.
     * @returns {void}
     */
    public set selectedNonTrigger(value: boolean) {
        const input = this.view?.view?.tags?.OptionInput;
        const viewEl = this.view?.getView?.();

        if (input) {
            input.checked = value;
        }

        if (viewEl && this.targetElement) {
            viewEl.classList.toggle("checked", !!value);
            viewEl.setAttribute("aria-selected", value ? "true" : "false");
            this.targetElement.toggleAttribute("selected", !!value);
        }

        if (this.targetElement) {
            this.targetElement.selected = value;
        }

        iEvents.callEvent<[OptionModel, boolean]>([this, value], ...this.privOnInternalSelected);
    }

    /**
     * Display label for rendering (with tag translation and HTML policy).
     *
     * Source precedence:
     * - `dataset.mask` if present, otherwise `targetElement.text`.
     *
     * Policy:
     * - When `options.allowHtml === true`, returns translated HTML.
     * - When `options.allowHtml === false`, returns plain text (HTML stripped).
     *
     * @returns {string}
     */
    public get text(): string {
        const raw = this.dataset?.mask ?? this.targetElement?.text ?? "";
        const translated = Libs.tagTranslate(raw);
        return this.options.allowHtml ? translated : Libs.stripHtml(translated);
    }

    /**
     * Plain-text version of the display label, trimmed.
     *
     * - If `allowHtml` is enabled, strips HTML from {@link text}.
     * - Otherwise returns {@link text} directly (already plain).
     *
     * @returns {string}
     */
    public get textContent(): string {
        return this.options.allowHtml ? Libs.stripHtml(this.text).trim() : this.text.trim();
    }

    /**
     * Normalized, lowercase search key used for filtering/search.
     * Computed during {@link init} and recomputed in {@link update}.
     */
    public textToFind: string;

    /**
     * Dataset object of the backing `<option>` element.
     *
     * @returns {DOMStringMap}
     */
    public get dataset(): DOMStringMap {
        return this.targetElement?.dataset ?? {};
    }

    /**
     * Whether this option is currently highlighted (navigation/hover).
     *
     * @returns {boolean}
     */
    public get highlighted(): boolean {
        return this._highlighted;
    }

    /**
     * Sets highlight state and synchronizes the view (if attached).
     *
     * Side effects:
     * - Toggles `"highlight"` CSS class on the view root element.
     *
     * @param {boolean} value - New highlight state.
     * @returns {void}
     */
    public set highlighted(value: boolean) {
        const val = !!value;
        const viewEl = this.view?.getView?.();

        if (this._highlighted !== val) this._highlighted = val;
        if (viewEl) viewEl.classList.toggle("highlight", val);
    }

    /**
     * Subscribes to **external** selection changes (emitted by {@link selected}).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    public onSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this.privOnSelected.push(callback);
    }

    /**
     * Subscribes to **internal** selection changes (emitted by {@link selectedNonTrigger}).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    public onInternalSelected(callback: (evtToken: IEventCallback, el: OptionModel, selected: boolean) => void): void {
        this.privOnInternalSelected.push(callback);
    }

    /**
     * Subscribes to visibility changes (emitted by {@link visible}).
     *
     * @param {(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    public onVisibilityChanged(callback: (evtToken: IEventCallback, model: OptionModel, visible: boolean) => void): void {
        this.privOnVisibilityChanged.push(callback);
    }

    /**
     * Synchronizes derived fields and the attached view from the current backing element/options.
     *
     * Syncs:
     * - {@link textToFind} (normalized search key)
     * - Label content:
     *   - `innerHTML` when `allowHtml` is enabled,
     *   - otherwise `textContent`
     * - Image attributes (`src`/`alt`) when present
     * - Selected state from `targetElement.selected` via {@link selectedNonTrigger}
     *
     * No-op for view updates when no view is attached; still emits lifecycle update via `super.update()`.
     *
     * @returns {void}
     * @override
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
            imageTag.src = this.imageSrc;
            imageTag.alt = this.text;
        }

        if (this.targetElement) this.selectedNonTrigger = this.targetElement.selected;

        super.update();
    }

    /**
     * Destroys the model and releases listener references.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Clears external/internal selection listeners and visibility listeners.
     * - Detaches from parent group and clears cached search key.
     * - Completes teardown via `super.destroy()` (base {@link Model} also destroys the view if present).
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.privOnSelected = [];
        this.privOnInternalSelected = [];
        this.privOnVisibilityChanged = [];
        this.group = null;
        this.textToFind = null;
        
        super.destroy();
    }
}