import {Libs} from "../utils/libs.js";

/**
 * @class
 */
export class SearchBox {
    /**
     * Creates a searchable input box component with optional configuration
     * and initializes it if options are provided.
     *
     * @param {object|null} [options=null] - Configuration (e.g., placeholder, accessibility IDs).
     */
    constructor(options = null) {
        this.options = options;
        options && this.init(options);
    }

    /**
     * @type {MountViewResult<any>}
     */
    nodeMounted = null;

    /**
     * @type {HTMLDivElement}
     */
    node = null;

    /**
     * @type {HTMLInputElement}
     */
    SearchInput = null;

    /**
     * @type {Function|null}
     */
    onSearch = null;

    options = null;

    onNavigate = null;
    onEnter = null;
    onEsc = null;
    
    /**
     * Initializes the search box DOM, sets ARIA attributes, and wires keyboard/mouse/input events.
     * Supports navigation (ArrowUp/ArrowDown/Tab), Enter, and Escape through callbacks.
     *
     * @param {object} options - Configuration including placeholder and SEID_LIST for aria-controls.
     */
    init(options) {
        this.nodeMounted = Libs.mountNode({
            SearchBox: {
                tag: {node: "div", classList: ["selective-ui-searchbox", "hide"]},
                child: {
                    SearchInput: {
                        tag: {
                            id: Libs.randomString(), 
                            node: "input", 
                            type: "search", 
                            classList: ["selective-ui-searchbox-input"], 
                            placeholder: options.placeholder, 
                            role: "searchbox",
                            ariaControls: options.SEID_LIST,
                            ariaAutocomplete: "list"
                        }
                    }
                }
            }
        });
        this.node = /** @type {HTMLDivElement} */ (this.nodeMounted.view);
        this.SearchInput = this.nodeMounted.tags.SearchInput;

        let isControlKey = false;

        /** @type {HTMLInputElement} */
        const SearchInput = this.nodeMounted.tags.SearchInput;

        SearchInput.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        SearchInput.addEventListener("mouseup", (e) => {
            e.stopPropagation();
        });
        SearchInput.addEventListener("keydown", (e) => {
            isControlKey = false;
            if (e.key === "ArrowDown" || e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onNavigate?.(1);
            } 
            else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onNavigate?.(-1);
            } 
            else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onEnter?.();
            }
            else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onEsc?.();
            }
        });
        SearchInput.addEventListener("input", (e) => {
            if (isControlKey) {
                return;
            }
            
            this.onSearch && this.onSearch(this.nodeMounted.tags.SearchInput.value, true);
        });
    }

    /**
     * Shows the search box, toggles read-only based on `options.searchable`,
     * and focuses the input when searchable.
     */
    show() {
        this.node.classList.remove("hide");
        this.SearchInput.readOnly = !this.options.searchable;
        if (this.options.searchable) {
            requestAnimationFrame(() => {
                this.SearchInput.focus();
            });
        }
    }

    /**
     * Hides the search box by adding the "hide" class.
     */
    hide() {
        this.node.classList.add("hide");
    }

    /**
     * Clears the current search value and optionally triggers the onSearch callback.
     *
     * @param {boolean} [isTrigger=true] - Whether to invoke onSearch with an empty string.
     */
    clear(isTrigger = true) {
        this.nodeMounted.tags.SearchInput.value = "";
        this.onSearch && this.onSearch("", isTrigger);
    }

    /**
     * Updates the input's placeholder text, stripping any HTML for safety.
     *
     * @param {string} value - The new placeholder text.
     */
    setPlaceHolder(value) {
        this.SearchInput.placeholder = Libs.stripHtml(value);
    }

    /**
     * Sets the active descendant for ARIA to indicate which option is currently highlighted.
     *
     * @param {string} id - The DOM id of the active option element.
     */
    setActiveDescendant(id) {
        this.SearchInput.setAttribute("aria-activedescendant", id);
    }
}