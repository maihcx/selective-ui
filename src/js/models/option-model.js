import { Model } from "../core/base/model.js";
import { iEvents } from "../utils/ievents.js";
import { Libs } from "../utils/libs.js";
import { OptionView } from "../views/option-view.js";

/**
 * @extends {Model<HTMLOptionElement, OptionViewTags, OptionView>}
 */
export class OptionModel extends Model {
    #privOnSelected = [];
    #privOnInternalSelected = [];
    #privOnVisibilityChanged = [];
    #visible = true;
    #highlighted = false;

    /** @type {import('./group-model').GroupModel} */
    group = null
    
    /**
     * Returns the image source from dataset (imgsrc or image), or an empty string if absent.
     *
     * @type {string}
     */
    get imageSrc() {
        return this.dataset?.imgsrc || this.dataset?.image || "";
    }
    
    /**
     * Indicates whether this option has an associated image source.
     *
     * @type {boolean}
     */
    get hasImage() {
        return !!this.imageSrc;
    }
    
    /**
     * Gets the option's current value from the underlying <option> element.
     *
     * @type {string}
     */
    get value() {
        return this.targetElement.value;
    }
    
    /**
     * Gets whether the option is currently selected (proxied to the <option> element).
     *
     * @type {boolean}
     */
    get selected() {
       return this.targetElement.selected;
    }
    
    /**
     * Sets the selected state and triggers external selection listeners.
     * Uses selectedNonTrigger internally to update DOM/ARIA without firing external side effects first.
     *
     * @type {boolean}
     */
    set selected(value) {
        this.selectedNonTrigger = value;
        
        iEvents.callEvent([this, value], ...this.#privOnSelected);
    }
    
    /**
     * Gets whether the option is currently visible in the UI.
     *
     * @type {boolean}
     */
    get visible() {
        return this.#visible;
    }
    
    /**
     * Sets the visibility state; toggles "hide" class on the view and notifies visibility listeners.
     *
     * @type {boolean}
     */
    set visible(value) {
        if (this.#visible === value) return;
        this.#visible = value;
        
        const view = this.view?.getView();
        if (view) {
            view.classList.toggle("hide", !value);
        }

        iEvents.callEvent([this, value], ...this.#privOnVisibilityChanged);
    }
    
    /**
     * Gets the selected state without triggering external listeners (alias of selected).
     *
     * @type {boolean}
     */
    get selectedNonTrigger() {
        return this.selected;
    }
    
    /**
     * Sets the selected state and updates input checked, CSS classes, ARIA attributes,
     * and the underlying <option> 'selected' attribute. Notifies internal selection listeners.
     *
     * @type {boolean}
     */
    set selectedNonTrigger(value) {
        const tag = this.view?.getTag("OptionInput");
        const view = this.view?.getView();
        
        if (tag) {
            tag.checked = value;
        }

        if (view) {
            view.classList.toggle("checked", !!value);
            view.setAttribute("aria-selected", value ? "true" : "false");
            this.targetElement.toggleAttribute("selected", !!value);
        }
        
        this.targetElement.selected = value;
        iEvents.callEvent([this, value], ...this.#privOnInternalSelected);
    }
    
    /**
     * Returns the display text for the option, applying tag translation and optional HTML allowance.
     * If allowHtml=false, returns stripped/sanitized text.
     *
     * @type {string}
     */
    get text() {
        const text = Libs.tagTranslate(this.dataset?.mask ?? this.targetElement.text);
        return this.options.allowHtml ? text : Libs.stripHtml(text);
    }
    
    /**
     * Returns a plain-text version of the display text (trimmed),
     * stripping HTML if allowHtml is true, otherwise the raw text.
     *
     * @type {string}
     */
    get textContent() {
        return this.options.allowHtml ? Libs.stripHtml(this.text).trim() : this.text.trim();
    }
    
    /**
     * Returns the dataset object of the underlying <option> element, or an empty object.
     *
     * @type {DOMStringMap|Record<string, string>}
     */
    get dataset() {
        return this.targetElement.dataset ?? {};
    }

    /**
     * Gets whether the option is currently highlighted (e.g., via keyboard navigation).
     *
     * @type {boolean}
     */
    get highlighted() {
        return this.#highlighted;
    }
    

    /**
     * Sets the highlighted state and toggles the "highlight" CSS class on the view.
     * Always syncs the DOM class even if the state is unchanged.
     *
     * @type {boolean}
     */
    set highlighted(value) {
        const val = !!value;
        const view = this.view?.getView?.();

        if (this.#highlighted !== val) {
            this.#highlighted = val;
        }

        if (view) {
            view.classList.toggle('highlight', val);
        }
    }

    
    /**
     * Registers a listener invoked when external selection changes (via setter `selected`).
     *
     * @param {(evtToken: any, el: OptionModel, selected: boolean) => void} callback - Selection listener.
     */
    onSelected(callback) {
        this.#privOnSelected.push(callback);
    }
    
    /**
     * Registers a listener invoked when internal selection changes (via setter `selectedNonTrigger`).
     *
     * @param {(evtToken: any, el: OptionModel, selected: boolean) => void} callback - Internal selection listener.
     */
    onInternalSelected(callback) {
        this.#privOnInternalSelected.push(callback);
    }
    
    /**
     * Registers a listener invoked when visibility changes (via setter `visible`).
     *
     * @param {(evtToken: any, model: OptionModel, visible: boolean) => void} callback - Visibility listener.
     */
    onVisibilityChanged(callback) {
        this.#privOnVisibilityChanged.push(callback);
    }
    
    /**
     * Hook called when the target <option> element changes.
     * Updates label content (HTML or text), image src/alt if present,
     * and synchronizes initial selected state to the view.
     */
    onTargetChanged() {
        const labelContent = this.view.getTag("LabelContent");
        if (labelContent) {
            if (this.options.allowHtml) {
                labelContent.innerHTML = this.text;
            }
            else {
                labelContent.textContent = this.textContent;
            }
        }

        const imageTag = this.view.getTag("OptionImage");
        if (imageTag && this.hasImage) {
            imageTag.src = this.imageSrc;
            imageTag.alt = this.text;
        }
        
        this.selectedNonTrigger = this.targetElement.selected;
    }
}