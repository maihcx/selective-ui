import { Libs } from "../utils/libs";
import { MountViewResult } from "../types/utils/libs.type";
import { NavigateHandler, SearchBoxTags, SearchHandler } from "../types/components/searchbox.type";
import { SelectiveOptions } from "../types/utils/selective.type";

export class SearchBox {
    /**
     * Creates a searchable input box component with optional configuration
     * and initializes it if options are provided.
     *
     * @param {object|null} [options=null] - Configuration (e.g., placeholder, accessibility IDs).
     */
    constructor(options: SelectiveOptions | null = null) {
        this.options = options;
        if (options) this.init(options);
    }

    /**
     * @type {MountViewResult<any> | null}
     */
    nodeMounted: MountViewResult<SearchBoxTags> | null = null;

    /**
     * @type {HTMLDivElement | null}
     */
    node: HTMLDivElement | null = null;

    /**
     * @type {HTMLInputElement | null}
     */
    SearchInput: HTMLInputElement | null = null;

    /**
     * @type {Function|null}
     */
    onSearch: SearchHandler | null = null;

    options: SelectiveOptions | null = null;

    onNavigate: NavigateHandler | null = null;
    onEnter: (() => void) | null = null;
    onEsc: (() => void) | null = null;

    /**
     * Initializes the search box DOM, sets ARIA attributes, and wires keyboard/mouse/input events.
     * Supports navigation (ArrowUp/ArrowDown/Tab), Enter, and Escape through callbacks.
     *
     * @param {object} options - Configuration including placeholder and SEID_LIST for aria-controls.
     */
    init(options: SelectiveOptions): void {
        this.nodeMounted = Libs.mountNode({
            SearchBox: {
                tag: { node: "div", classList: ["selective-ui-searchbox", "hide"] },
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
                            ariaAutocomplete: "list",
                        },
                    },
                },
            },
        }) as unknown as MountViewResult<SearchBoxTags>;

        this.node = this.nodeMounted.view as HTMLDivElement;
        this.SearchInput = this.nodeMounted.tags.SearchInput;

        let isControlKey = false;
        const inputEl = this.nodeMounted.tags.SearchInput;

        inputEl.addEventListener("mousedown", (e: MouseEvent) => {
            e.stopPropagation();
        });

        inputEl.addEventListener("mouseup", (e: MouseEvent) => {
            e.stopPropagation();
        });

        inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            isControlKey = false;

            if (e.key === "ArrowDown" || e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onNavigate?.(1);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onNavigate?.(-1);
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onEnter?.();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                isControlKey = true;
                this.onEsc?.();
            }
        });

        inputEl.addEventListener("input", () => {
            if (isControlKey) return;
            this.onSearch?.(inputEl.value, true);
        });
    }

    /**
     * Shows the search box, toggles read-only based on `options.searchable`,
     * and focuses the input when searchable.
     */
    show(): void {
        if (!this.node || !this.SearchInput || !this.options) return;

        this.node.classList.remove("hide");
        this.SearchInput.readOnly = !this.options.searchable;

        if (this.options.searchable) {
            requestAnimationFrame(() => {
                this.SearchInput?.focus();
            });
        }
    }

    /**
     * Hides the search box by adding the "hide" class.
     */
    hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Clears the current search value and optionally triggers the onSearch callback.
     *
     * @param {boolean} [isTrigger=true] - Whether to invoke onSearch with an empty string.
     */
    clear(isTrigger: boolean = true): void {
        if (!this.nodeMounted) return;
        this.nodeMounted.tags.SearchInput.value = "";
        this.onSearch?.("", isTrigger);
    }

    /**
     * Updates the input's placeholder text, stripping any HTML for safety.
     *
     * @param {string} value - The new placeholder text.
     */
    setPlaceHolder(value: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.placeholder = Libs.stripHtml(value);
    }

    /**
     * Sets the active descendant for ARIA to indicate which option is currently highlighted.
     *
     * @param {string} id - The DOM id of the active option element.
     */
    setActiveDescendant(id: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.setAttribute("aria-activedescendant", id);
    }
}