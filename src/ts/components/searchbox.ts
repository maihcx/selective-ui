import { Libs } from "../utils/libs";
import { MountViewResult } from "../types/utils/libs.type";
import { NavigateHandler, SearchBoxTags, SearchHandler } from "../types/components/searchbox.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * Searchable input component for the Select UI.
 *
 * Responsibilities:
 * - Render a search input field with proper ARIA attributes
 * - Dispatch typed events for search, navigation, Enter, and Escape
 * - Support showing/hiding and dynamic placeholder updates
 *
 * Lifecycle:
 * - Constructed with optional options → initialized → `init()`
 * - Consumers wire callbacks (`onSearch`, `onNavigate`, `onEnter`, `onEsc`)
 *
 * @extends Lifecycle
 */
export class SearchBox extends Lifecycle {
    /**
     * Creates a searchable input box component with optional configuration
     * and initializes it if options are provided.
     *
     * @param options - Configuration (e.g., placeholder, accessibility IDs).
     */
    constructor(options: SelectiveOptions | null = null) {
        super();
        this.options = options;
        if (options) this.initialize(options);
    }

    /** Internal reference to the mounted node structure with typed tags. */
    private nodeMounted: MountViewResult<SearchBoxTags> | null = null;

    /** Root container element for the search box component. */
    public node: HTMLDivElement | null = null;

    /** Reference to the input element (`type="search"`). */
    private SearchInput: HTMLInputElement | null = null;

    /** Callback fired on input changes (when not a control key event). */
    public onSearch: SearchHandler | null = null;

    /** Current configuration options (placeholder, IDs, searchable flag, etc.). */
    private options: SelectiveOptions | null = null;

    /** Callback to handle list navigation: +1 for next, -1 for previous. */
    public onNavigate: NavigateHandler | null = null;

    /** Callback fired on Enter. Typically used to confirm a selection. */
    public onEnter: (() => void) | null = null;
    
    /** Callback fired on Escape. Typically used to dismiss a popup. */
    public onEsc: (() => void) | null = null;

    /**
     * Initializes the search box DOM, sets ARIA attributes, and wires keyboard/mouse/input events.
     *
     * Accessibility:
     * - `role="searchbox"`
     * - `aria-controls` references the listbox container by ID
     * - `aria-autocomplete="list"` indicates list-based suggestions/results
     *
     * Keyboard support:
     * - ArrowDown / Tab → navigate forward
     * - ArrowUp → navigate backward
     * - Enter → confirm action
     * - Escape → cancel/close action
     *
     * @param options - Configuration including placeholder and `SEID_LIST` for `aria-controls`.
     */
    private initialize(options: SelectiveOptions): void {
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
        }) as MountViewResult<SearchBoxTags>;

        this.node = this.nodeMounted.view as HTMLDivElement;
        this.SearchInput = this.nodeMounted.tags.SearchInput;

        let isControlKey = false;
        const inputEl = this.nodeMounted.tags.SearchInput;

        // Prevent parent listeners from intercepting mouse interactions.
        inputEl.addEventListener("mousedown", (e: MouseEvent) => {
            e.stopPropagation();
        });

        inputEl.addEventListener("mouseup", (e: MouseEvent) => {
            e.stopPropagation();
        });

        // Keyboard handling: navigation, submit, and cancel.
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

            // Ensure events don't bubble to container-level listeners.
            e.stopPropagation();
        });

        // Text input changes (ignore control-key initiated sequences).
        inputEl.addEventListener("input", () => {
            if (isControlKey) return;
            this.onSearch?.(inputEl.value, true);
        });

        this.init();
    }

    /**
     * Shows the search box, toggles `readOnly` based on `options.searchable`,
     * and focuses the input when searchable.
     */
    public show(): void {
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
     * Hides the search box by adding the `hide` class.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Clears the current search value and optionally triggers the `onSearch` callback.
     *
     * @param isTrigger - Whether to invoke `onSearch` with an empty string. Defaults to `true`.
     */
    public clear(isTrigger: boolean = true): void {
        if (!this.nodeMounted) return;
        this.nodeMounted.tags.SearchInput.value = "";
        this.onSearch?.("", isTrigger);
    }

    /**
     * Updates the input's placeholder text, stripping any HTML for safety.
     *
     * @param value - The new placeholder text.
     */
    public setPlaceHolder(value: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.placeholder = Libs.stripHtml(value);
    }

    /**
     * Sets the active descendant for ARIA to indicate the currently highlighted option.
     *
     * @param id - The DOM id of the active option element.
     */
    public setActiveDescendant(id: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.setAttribute("aria-activedescendant", id);
    }

    /**
     * Destroys the search box and releases resources.
     *
     * - Removes the root DOM node
     * - Clears references to DOM and callbacks
     * - Ends the lifecycle
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
                
        this.node?.remove();
        this.nodeMounted = null;
        this.node = null;
        this.SearchInput = null;
        this.onSearch = null;
        this.options = null;
        this.onNavigate = null;
        this.onEnter = null;
        this.onEsc = null;

        super.destroy();
    }
}