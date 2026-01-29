import { Libs } from "../utils/libs";
import { MountViewResult } from "../types/utils/libs.type";
import { NavigateHandler, SearchBoxTags, SearchHandler } from "../types/components/searchbox.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * SearchBox
 *
 * DOM-driven, headless-friendly search input used by the Select UI to filter and
 * navigate option lists. This component owns a small DOM subtree and exposes
 * callback hooks for the host/controller layer to implement filtering, highlight,
 * and commit/cancel behaviors.
 *
 * ### Responsibility
 * - Render a `<input type="search">` wrapped by a container element.
 * - Apply ARIA attributes used by the surrounding listbox/popup integration.
 * - Convert DOM events into typed callbacks:
 *   - text input changes → {@link onSearch}
 *   - keyboard navigation (ArrowUp/ArrowDown/Tab) → {@link onNavigate}
 *   - commit (Enter) → {@link onEnter}
 *   - cancel (Escape) → {@link onEsc}
 * - Provide imperative UI helpers:
 *   - {@link show}/{@link hide} (visibility + focus/readOnly behavior)
 *   - {@link clear} (reset query and optionally trigger the search hook)
 *   - {@link setPlaceHolder} (safe placeholder update)
 *   - {@link setActiveDescendant} (ARIA highlight binding)
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`.
 * - If options are provided, {@link initialize} creates DOM and calls `init()`
 *   → transitions to `INITIALIZED`.
 * - This class does not override `update()`: runtime changes are performed via
 *   its imperative methods (e.g., {@link show}, {@link clear}, {@link setPlaceHolder}).
 * - {@link destroy} is terminal: removes DOM references and ends lifecycle.
 *   Subsequent calls become no-ops once {@link LifecycleState.DESTROYED}.
 *
 * ### Event Model / Ownership
 * - This component does **not** own filtering logic or selection state.
 * - All "meaningful actions" are emitted outward through callbacks (external events).
 * - It also performs event containment (`stopPropagation`) to avoid parent-level
 *   handlers (e.g., popup/list container) from intercepting interactions.
 *
 * ### a11y / DOM Side Effects
 * - Writes ARIA attributes such as `aria-controls`, `aria-autocomplete`, and
 *   `aria-activedescendant` onto the input element.
 * - Intercepts keyboard events and may call `preventDefault()` for navigation keys.
 *
 * @extends Lifecycle
 */
export class SearchBox extends Lifecycle {
    /**
     * Creates a new {@link SearchBox}.
     *
     * If `options` is provided, initialization is performed immediately (DOM is created
     * and `init()` is called). If `options` is `null`, the instance stays in `NEW` until
     * initialized elsewhere.
     *
     * @param options - Configuration such as placeholder, accessibility IDs, and flags.
     */
    constructor(options: SelectiveOptions | null = null) {
        super();
        this.options = options;
        if (options) this.initialize(options);
    }

    /**
     * The mount result returned by {@link Libs.mountNode}.
     *
     * Provides typed access to created DOM tags (e.g., `SearchInput`) and the root view.
     * `null` before initialization and after destruction.
     *
     * @internal
     */
    private nodeMounted: MountViewResult<SearchBoxTags> | null = null;

    /**
     * Root container node of this component.
     *
     * Created during {@link initialize} and removed during {@link destroy}.
     * Visibility is controlled by adding/removing the `hide` class.
     */
    public node: HTMLDivElement | null = null;

    /**
     * The `<input type="search">` element used to capture user queries.
     *
     * Cached for imperative operations (focus, placeholder updates, ARIA updates).
     * `null` before initialization and after destruction.
     *
     * @internal
     */
    private SearchInput: HTMLInputElement | null = null;

    /**
     * External "search changed" hook.
     *
     * Invoked when the user edits text (via the `input` event) and the edit is not
     * part of a handled control-key sequence (e.g., ArrowUp/Down/Tab/Enter/Escape).
     *
     * Ownership:
     * - Implementations typically filter adapter/model state and refresh the list.
     */
    public onSearch: SearchHandler | null = null;

    /**
     * Options snapshot used for behavior toggles and attributes.
     *
     * Key fields typically consumed here:
     * - `placeholder`: initial placeholder string
     * - `searchable`: toggles readOnly + focus behavior on {@link show}
     * - `SEID_LIST`: used as `aria-controls` value to bind to listbox container
     *
     * Cleared during {@link destroy}.
     *
     * @internal
     */
    private options: SelectiveOptions | null = null;

    /**
     * External navigation hook for list traversal.
     *
     * Called with:
     * - `+1` for forward (ArrowDown / Tab)
     * - `-1` for backward (ArrowUp)
     *
     * Typical consumers update highlight/active option in Adapter/RecyclerView.
     */
    public onNavigate: NavigateHandler | null = null;

    /**
     * External "commit" hook (Enter key).
     *
     * Typical consumers confirm selection of the highlighted option or submit the current state.
     */
    public onEnter: (() => void) | null = null;
    
    /**
     * External "cancel" hook (Escape key).
     *
     * Typical consumers close the popup, clear highlight, or reset interaction mode.
     */
    public onEsc: (() => void) | null = null;

    /**
     * Initializes DOM, ARIA attributes, and interaction listeners.
     *
     * DOM structure (conceptually):
     * - Root: `div.selective-ui-searchbox.hide`
     * - Child: `input[type="search"].selective-ui-searchbox-input`
     *
     * Accessibility attributes set on the input:
     * - `role="searchbox"`: announces search field semantics
     * - `aria-controls=options.SEID_LIST`: points to the list container (listbox)
     * - `aria-autocomplete="list"`: indicates suggestion results are list-driven
     *
     * Interaction model:
     * - Mouse down/up: stops propagation to prevent container/popup listeners from interfering.
     * - Keydown:
     *   - ArrowDown / Tab → emits {@link onNavigate}(+1)
     *   - ArrowUp → emits {@link onNavigate}(-1)
     *   - Enter → emits {@link onEnter}()
     *   - Escape → emits {@link onEsc}()
     *   Control keys are treated as "internal control events" and do not produce {@link onSearch}
     *   via the `input` listener (guarded by `isControlKey`).
     * - Input:
     *   - Emits {@link onSearch}(value, true) for text edits that are not control-key sequences.
     *
     * Side effects:
     * - Creates DOM nodes via {@link Libs.mountNode}.
     * - Attaches event listeners to the input element.
     * - Transitions lifecycle via `init()` at the end.
     *
     * @param options - Configuration including placeholder and listbox id used by `aria-controls`.
     * @internal
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

        // Prevent parent listeners (e.g., popup container) from intercepting mouse interactions.
        inputEl.addEventListener("mousedown", (e: MouseEvent) => {
            e.stopPropagation();
        });

        inputEl.addEventListener("mouseup", (e: MouseEvent) => {
            e.stopPropagation();
        });

        // Keyboard handling: navigation, commit, and cancel.
        // Control-key sequences are tracked to avoid emitting onSearch from the subsequent input event.
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

        // Text edits (ignore those attributable to control-key flows).
        inputEl.addEventListener("input", () => {
            if (isControlKey) return;
            this.onSearch?.(inputEl.value, true);
        });

        this.init();
    }

    /**
     * Shows the search box and prepares the input for interaction.
     *
     * Behavior:
     * - Removes the `hide` class from the root node.
     * - Toggles `readOnly` according to `options.searchable`.
     * - When searchable, schedules a focus on the next animation frame.
     *
     * No-ops if not initialized (missing {@link node}, {@link SearchInput}, or {@link options}).
     *
     * DOM side effects:
     * - May change focus.
     * - Mutates `readOnly` on the input element.
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
     * Hides the search box by adding the `hide` class to the root node.
     *
     * No-ops if {@link node} is `null`.
     */
    public hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Clears the current query and optionally notifies the host via {@link onSearch}.
     *
     * This method always resets the input's value to an empty string.
     * The `isTrigger` flag is forwarded to {@link onSearch} and can be used by the host
     * to differentiate external (programmatic) clearing from user-driven changes.
     *
     * No-ops if the component has not been initialized ({@link nodeMounted} is `null`).
     *
     * @param isTrigger - Whether to invoke {@link onSearch} with an empty string. Defaults to `true`.
     */
    public clear(isTrigger: boolean = true): void {
        if (!this.nodeMounted) return;
        this.nodeMounted.tags.SearchInput.value = "";
        this.onSearch?.("", isTrigger);
    }

    /**
     * Updates the input's placeholder text.
     *
     * Safety:
     * - HTML is stripped via {@link Libs.stripHtml} to avoid rendering markup in an attribute.
     *
     * No-ops if {@link SearchInput} is `null`.
     *
     * @param value - New placeholder text (may contain markup, which will be stripped).
     */
    public setPlaceHolder(value: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.placeholder = Libs.stripHtml(value);
    }

    /**
     * Sets `aria-activedescendant` to reflect the currently highlighted option in the list.
     *
     * This is typically used in conjunction with keyboard navigation to keep assistive
     * technologies informed about the active/highlighted item without moving DOM focus away
     * from the search input.
     *
     * No-ops if {@link SearchInput} is `null`.
     *
     * @param id - DOM id of the active option element.
     */
    public setActiveDescendant(id: string): void {
        if (!this.SearchInput) return;
        this.SearchInput.setAttribute("aria-activedescendant", id);
    }

    /**
     * Disposes DOM resources and terminates the lifecycle.
     *
     * Strict FSM / idempotency:
     * - If already {@link LifecycleState.DESTROYED}, returns immediately.
     *
     * Side effects:
     * - Removes the root DOM node from the document (if present).
     * - Clears references to DOM nodes and callbacks to enable garbage collection.
     * - Delegates to `super.destroy()` to finalize lifecycle transition.
     *
     * @override
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