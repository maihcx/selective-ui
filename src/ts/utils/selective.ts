import { Libs } from "./libs";
import { iEvents } from "./ievents";
import { SelectBox } from "../components/selectbox";
import { ElementAdditionObserver } from "../services/ea-observer";
import { SelectiveActionApi, SelectiveOptions } from "../types/utils/selective.type";
import { BinderMap, PropertiesType } from "../types/utils/istorage.type";
import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";

/**
 * Selective
 *
 * Core orchestrator for the Selective UI library, managing lifecycle and bindings for enhanced `<select>` elements.
 *
 * ### Responsibility
 * - **Binding management**: Associates CSS selectors with {@link SelectiveOptions} configurations.
 * - **Lifecycle orchestration**: Drives the FSM (`NEW → INITIALIZED → MOUNTED → UPDATED → DESTROYED`).
 * - **Auto-rebinding**: Observes DOM additions via {@link ElementAdditionObserver} to apply bindings dynamically.
 * - **Action API aggregation**: Provides unified {@link SelectiveActionApi} for interacting with bound instances.
 * - **Cleanup**: Supports granular or global teardown via {@link destroy}.
 *
 * ### Lifecycle (Strict FSM)
 * - **Construction**: Calls {@link init} immediately, transitioning `NEW → INITIALIZED`.
 * - **{@link bind}**: First successful bind triggers {@link mount} (`INITIALIZED → MOUNTED`).
 * - **{@link update}**: Invoked after bindings change (rebind, observer detection, partial destroy).
 * - **{@link destroy}**: Supports partial (query/element) or global (all bindings) teardown.
 *
 * ### Binding flow
 * 1. **{@link bind}** merges options with defaults, registers query in {@link bindedQueries}.
 * 2. For each matching `<select>`, {@link applySelectBox} creates a {@link SelectBox} instance.
 * 3. Binder map stores `{ options, container, action, self }` via {@link Libs.setBinderMap}.
 * 4. `on.load` callbacks are scheduled and invoked after binding completes.
 *
 * ### Observer pattern
 * - **{@link Observer}**: Activates {@link ElementAdditionObserver} to detect new `<select>` elements.
 * - New elements matching registered queries auto-bind and trigger {@link update}.
 * - Disconnected during {@link destroyAll} or {@link destroyElement} (reconnects if bindings remain).
 *
 * ### Action API
 * - **{@link find}**: Queries bound instances, returns aggregated API (get/set properties + functions).
 * - **Get/set actions**: Proxy to first element (getter) or all elements (setter).
 * - **Function actions**: Invoke across all elements with event token flow control.
 *
 * ### Idempotency / No-ops
 * - {@link init} is no-op if not in {@link LifecycleState.NEW}.
 * - {@link mount} / {@link update} guard against invalid state transitions.
 * - {@link destroy} with `target !== null` triggers {@link update} (partial teardown).
 * - {@link destroyAll} is idempotent once {@link LifecycleState.DESTROYED}.
 *
 * ### DOM side effects
 * - Creates {@link SelectBox} instances (custom UI overlays).
 * - Wraps native `<select>` elements, hides originals (`display/visibility`).
 * - {@link destroyElement} restores original DOM structure (unwraps, re-shows select).
 * - {@link Observer} mutates DOM via `MutationObserver` callbacks.
 *
 * @extends Lifecycle
 * @see {@link SelectBox}
 * @see {@link ElementAdditionObserver}
 * @see {@link SelectiveActionApi}
 */
export class Selective extends Lifecycle {
    /**
     * Observer for detecting newly added `<select>` elements in the DOM.
     *
     * - Created during {@link Observer} if not already initialized.
     * - Auto-applies registered bindings to matching elements.
     * - Disconnected during {@link destroyAll} or {@link destroyElement}.
     *
     * @private
     */
    private EAObserver: ElementAdditionObserver;

    /**
     * Registry mapping CSS selectors to their {@link SelectiveOptions} configurations.
     *
     * - Populated during {@link bind}.
     * - Used by {@link Observer} to auto-bind new elements.
     * - Cleared during {@link destroyAll}, individual entries removed via {@link destroyByQuery}.
     *
     * @private
     */
    private bindedQueries: Map<string, SelectiveOptions> = new Map();

    /**
     * Creates a new Selective instance and immediately initializes it.
     *
     * Lifecycle progression:
     * `constructor()` → {@link init} (`NEW → INITIALIZED`)
     *
     * @returns {void}
     */
    constructor() {
        super();
        this.init();
    }

    /**
     * Initializes the Selective system.
     *
     * Behavior:
     * - No-op if not in {@link LifecycleState.NEW} (idempotent guard).
     * - Initializes {@link bindedQueries} as empty `Map`.
     * - Transitions `NEW → INITIALIZED` via `super.init()`.
     *
     * Notes:
     * - Does **not** bind any elements; call {@link bind} to start.
     * - Does **not** activate observer; call {@link Observer} separately.
     *
     * @public
     * @returns {void}
     * @override
     */
    public init(): void {
        if (!this.is(LifecycleState.NEW)) return;

        // Initialize core properties
        this.bindedQueries = new Map();

        super.init();
    }

    /**
     * Binds Selective UI to all `<select>` elements matching the query.
     *
     * Binding flow:
     * 1. Auto-initializes if in {@link LifecycleState.NEW}.
     * 2. Merges `options` with defaults via {@link Libs.mergeConfig}.
     * 3. Registers query in {@link bindedQueries}.
     * 4. Schedules `on.load` callbacks (invoked after binding completes).
     * 5. For each matching `<select>`, calls {@link applySelectBox}.
     * 6. Triggers {@link mount} if first successful bind.
     * 7. Triggers {@link update} if already {@link LifecycleState.MOUNTED}.
     *
     * `on.load` callback semantics:
     * - Receives {@link SelectiveActionApi} for all bound instances.
     * - Invoked asynchronously after all elements are processed.
     * - Cleared after invocation (one-time execution).
     *
     * Notes:
     * - Query is added to {@link Libs.getBindedCommand} for {@link Observer} tracking.
     * - Duplicate binds to the same query unbind previous instances first (via {@link applySelectBox}).
     *
     * @public
     * @param {string} query - CSS selector for target `<select>` elements.
     * @param {SelectiveOptions} options - Configuration overrides merged with defaults.
     * @returns {void}
     */
    public bind(query: string, options: SelectiveOptions): void {
        // Auto-init if not initialized
        if (this.is(LifecycleState.NEW)) {
            this.init();
        }

        const merged = Libs.mergeConfig(
            Libs.getDefaultConfig(),
            options,
        ) as SelectiveOptions;

        // Ensure hooks exist
        merged.on = merged.on ?? {};
        merged.on.load = (merged.on.load ?? []) as Array<(...args: any[]) => void>;

        this.bindedQueries.set(query, merged);

        const doneToken = Libs.randomString();
        Libs.callbackScheduler.on(doneToken, () => {
            iEvents.callEvent([this.find(query)], ...merged.on!.load);
            Libs.callbackScheduler.clear(doneToken);
            merged.on!.load = [];
        });

        const selectElements = Libs.getElements(query) as HTMLSelectElement[];
        let hasAnyBound = false;

        selectElements.forEach((item) => {
            (async () => {
                if (item.tagName === "SELECT") {
                    Libs.removeUnbinderMap(item);
                    if (this.applySelectBox(item, merged)) {
                        hasAnyBound = true;
                        Libs.callbackScheduler.run(doneToken);
                    }
                }
            })();
        });

        if (!Libs.getBindedCommand().includes(query)) {
            Libs.getBindedCommand().push(query);
        }

        // Mount if first bind and has elements
        if (this.is(LifecycleState.INITIALIZED) && hasAnyBound) {
            this.mount();
        }

        // Trigger update if already mounted
        if (this.is(LifecycleState.MOUNTED)) {
            this.update();
        }
    }

    /**
     * Transitions system to {@link LifecycleState.MOUNTED} state.
     *
     * Behavior:
     * - No-op if not in {@link LifecycleState.INITIALIZED} (strict FSM guard).
     * - Transitions `INITIALIZED → MOUNTED` via `super.mount()`.
     *
     * Notes:
     * - Typically triggered by {@link bind} on first successful binding.
     * - Indicates system has active bound elements and is ready for interactions.
     *
     * @public
     * @returns {void}
     * @override
     */
    public mount(): void {
        if (this.state !== LifecycleState.INITIALIZED) return;

        super.mount();
    }

    /**
     * Signals a binding change has occurred.
     *
     * Behavior:
     * - No-op if not in {@link LifecycleState.MOUNTED} (strict FSM guard).
     * - Transitions `MOUNTED → UPDATED → MOUNTED` via `super.update()`.
     *
     * Triggered by:
     * - {@link bind} (when already mounted).
     * - {@link Observer} (new element auto-bound).
     * - {@link destroy} (partial teardown with remaining bindings).
     * - {@link rebind} (query re-registration).
     *
     * @public
     * @returns {void}
     * @override
     */
    public update(): void {
        if (this.state !== LifecycleState.MOUNTED) return;

        super.update();
    }

    /**
     * Finds and returns an aggregated action API for bound `<select>` instances.
     *
     * Query semantics:
     * - `"*"` → Searches all registered queries (via {@link Libs.getBindedCommand}).
     * - CSS selector → Searches matching elements.
     * - `HTMLElement` → Searches that specific element.
     *
     * Return value:
     * - `{ isEmpty: true }` if no bound instances found.
     * - {@link SelectiveActionApi} with aggregated actions from the **first** matching element's binder map.
     *
     * Action types:
     * - **get-set**: Property with getter/setter (via {@link buildGetSetAction}).
     * - **func**: Method (via {@link buildFuntionAction}).
     *
     * Notes:
     * - Only the **first** element's action API is used for type detection.
     * - Get/set actions proxy to first element (getter) or all elements (setter).
     * - Function actions invoke across all elements with event token flow control.
     *
     * @public
     * @param {string | HTMLElement} [query="*"] - CSS selector, `"*"`, or specific element.
     * @returns {SelectiveActionApi} Aggregated action API or `{ isEmpty: true }` if none found.
     */
    public find(query: string | HTMLElement = "*"): SelectiveActionApi {
        const empty: SelectiveActionApi = { isEmpty: true };

        if (query === "*") {
            query = Libs.getBindedCommand().join(", ");
            if (query === "") return empty;
        }

        const sels = Libs.getElements(query) as HTMLElement[];
        if (sels.length === 0) return empty;

        const binded = Libs.getBinderMap(sels[0]) as BinderMap | null;
        if (!binded || !binded.action) return empty;

        const actions: Record<string, PropertiesType> = {};
        for (const actionName in binded.action) {
            actions[actionName] = this.getProperties(actionName, binded.action);
        }

        const response: SelectiveActionApi = { isEmpty: false };
        for (const actionKey in actions) {
            const action = actions[actionKey];
            switch (action.type) {
                case "get-set":
                    this.buildGetSetAction(response, action.name, sels);
                    break;
                case "func":
                    this.buildFuntionAction(response, action.name, sels);
                    break;
                default:
                    break;
            }
        }

        return response;
    }

    /**
     * Activates auto-binding for newly added `<select>` elements.
     *
     * Behavior:
     * - Creates {@link ElementAdditionObserver} (if not already initialized).
     * - Registers callback to detect `<select>` additions via `MutationObserver`.
     * - For each new element, checks against all registered queries in {@link bindedQueries}.
     * - Applies bindings via {@link applySelectBox} for matching queries.
     * - Triggers {@link update} when new elements are bound.
     *
     * Notes:
     * - Observer is **not** started by default; must be explicitly invoked.
     * - Safe to call multiple times (observer instance is reused).
     * - Invalid selectors are caught and logged as warnings.
     *
     * @public
     * @returns {void}
     */
    public Observer(): void {
        if (!this.EAObserver) {
            this.EAObserver = new ElementAdditionObserver();
            this.EAObserver.onDetect((selectElement: HTMLSelectElement) => {
                this.bindedQueries.forEach((options, query) => {
                    try {
                        if (selectElement.matches(query)) {
                            this.applySelectBox(selectElement, options);

                            // Trigger update when new element is bound
                            if (this.is(LifecycleState.MOUNTED)) {
                                this.update();
                            }
                        }
                    } catch (error) {
                        console.warn(`Invalid selector: ${query}`, error);
                    }
                });
            });
        }

        this.EAObserver.connect("select");
    }

    /**
     * Destroys Selective instances with granular or global scope.
     *
     * Overload semantics:
     * - `destroy()` or `destroy(null)` → {@link destroyAll} (global teardown).
     * - `destroy(query: string)` → {@link destroyByQuery} (query-scoped teardown).
     * - `destroy(element: HTMLSelectElement)` → {@link destroyElement} (element-scoped teardown).
     *
     * Partial teardown behavior:
     * - For query/element targets, triggers {@link update} if still {@link LifecycleState.MOUNTED}.
     * - Global teardown transitions to {@link LifecycleState.DESTROYED}.
     *
     * @public
     * @param {null | string | HTMLSelectElement} [target=null] - Destruction scope.
     * @returns {void}
     */
    public destroy(target: null | string | HTMLSelectElement = null): void {
        if (target === null) {
            this.destroyAll();
        } else if (typeof target === "string") {
            this.destroyByQuery(target);
        } else if (target instanceof HTMLSelectElement) {
            this.destroyElement(target);
        }

        // Trigger update after partial destroy
        if (target !== null && this.is(LifecycleState.MOUNTED)) {
            this.update();
        }
    }

    /**
     * Destroys all bound Selective instances and releases global resources.
     *
     * Teardown flow:
     * 1. Iterates all registered queries and calls {@link destroyByQuery}.
     * 2. Clears {@link bindedQueries} and {@link Libs.getBindedCommand}.
     * 3. Disconnects {@link EAObserver} (stops auto-binding).
     * 4. Transitions to {@link LifecycleState.DESTROYED} via `super.destroy()`.
     *
     * Idempotency:
     * - No-op if already {@link LifecycleState.DESTROYED}.
     *
     * @private
     * @returns {void}
     */
    private destroyAll(): void {
        if (this.state === LifecycleState.DESTROYED) return;

        const bindedCommands = Libs.getBindedCommand();
        bindedCommands.forEach((query: string) => this.destroyByQuery(query));

        this.bindedQueries.clear();
        Libs.getBindedCommand().length = 0;
        this.EAObserver?.disconnect();

        // Call parent lifecycle destroy
        super.destroy();
    }

    /**
     * Destroys all Selective instances bound to a specific query.
     *
     * Teardown flow:
     * 1. Calls {@link destroyElement} for each matching `<select>` element.
     * 2. Removes query from {@link bindedQueries}.
     * 3. Removes query from {@link Libs.getBindedCommand}.
     *
     * Notes:
     * - Does **not** trigger {@link update}; caller is responsible.
     * - Safe to call on non-existent queries (no-op).
     *
     * @private
     * @param {string} query - CSS selector whose instances should be destroyed.
     * @returns {void}
     */
    private destroyByQuery(query: string): void {
        const selectElements = Libs.getElements(query) as HTMLSelectElement[];
        selectElements.forEach((element) => {
            if (element.tagName === "SELECT") this.destroyElement(element);
        });

        this.bindedQueries.delete(query);

        const commands = Libs.getBindedCommand();
        const index = commands.indexOf(query);
        if (index > -1) commands.splice(index, 1);
    }

    /**
     * Destroys a single Selective instance and restores the native `<select>` element.
     *
     * Teardown flow:
     * 1. Retrieves binder map via {@link Libs.getBinderMap}.
     * 2. Stores unbinder map for potential re-binding prevention.
     * 3. Temporarily disconnects {@link EAObserver} (prevents re-binding during DOM mutation).
     * 4. Calls `SelectBox.deInit()` (custom teardown hook).
     * 5. Unwraps the `<select>` from its container (restores to original parent).
     * 6. Restores `<select>` visibility (`display`, `visibility`, `disabled`).
     * 7. Removes binder map and dataset attributes.
     * 8. Reconnects {@link EAObserver} if bindings remain.
     * 9. Calls `SelectBox.destroy()` (lifecycle cleanup).
     *
     * DOM side effects:
     * - Removes wrapper container, re-inserts `<select>` into original position.
     * - Resets inline styles and dataset.
     *
     * Notes:
     * - Safe to call on unbound elements (no-op if binder map missing).
     * - Errors in `deInit()` are silently caught.
     *
     * @private
     * @param {HTMLSelectElement} selectElement - Target `<select>` element to clean up.
     * @returns {void}
     */
    private destroyElement(selectElement: HTMLSelectElement): void {
        const bindMap = Libs.getBinderMap(selectElement) as BinderMap | null;
        if (!bindMap) return;

        const selfBox = bindMap.self as SelectBox | null;

        Libs.setUnbinderMap(selectElement, bindMap);

        const wasObserving = !!this.EAObserver;
        if (wasObserving) this.EAObserver?.disconnect();

        try {
            bindMap.self?.deInit?.();
        } catch (_) {}

        const wrapper: HTMLElement | null =
            (bindMap.container?.element as HTMLElement | undefined) ??
            selectElement.parentElement;

        selectElement.style.display = "";
        selectElement.style.visibility = "";
        selectElement.disabled = false;
        delete selectElement.dataset.selectiveId;

        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.replaceChild(selectElement, wrapper);
        } else {
            selectElement.appendChild(selectElement);
        }

        Libs.removeBinderMap(selectElement);

        if (wasObserving && this.bindedQueries.size > 0) {
            this.EAObserver?.connect("select");
        }

        selfBox?.destroy?.();
    }

    /**
     * Rebinds a query by destroying existing instances and applying new options.
     *
     * Implementation:
     * - Calls {@link destroyByQuery} to teardown existing bindings.
     * - Calls {@link bind} with updated `options`.
     * - Triggers {@link update} if {@link LifecycleState.MOUNTED}.
     *
     * Use case:
     * - Update configuration for a query without manual destroy + bind calls.
     *
     * @public
     * @param {string} query - CSS selector to rebind.
     * @param {SelectiveOptions} options - New configuration for the binding.
     * @returns {void}
     */
    public rebind(query: string, options: SelectiveOptions): void {
        this.destroyByQuery(query);
        this.bind(query, options);

        // Trigger update after rebind
        if (this.is(LifecycleState.MOUNTED)) {
            this.update();
        }
    }

    /**
     * Applies {@link SelectBox} enhancement to a single `<select>` element.
     *
     * Application flow:
     * 1. Guards against duplicate bindings (checks binder/unbinder maps).
     * 2. Generates unique instance ID (SEID) and element IDs.
     * 3. Merges element `dataset` into options via {@link Libs.buildConfig}.
     * 4. Stores initial binder map with options.
     * 5. Creates {@link SelectBox} instance, wires `onMount` handler for UI interactions.
     * 6. Calls `SelectBox.mount()` to activate lifecycle.
     * 7. Stores final binder map with `{ container, action, self }`.
     *
     * `onMount` behavior:
     * - Wires `mouseup` event on view to toggle dropdown via `bindMap.action.toggle()`.
     *
     * Return value:
     * - `false` if element already bound (no-op).
     * - `true` if successfully applied.
     *
     * @private
     * @param {HTMLSelectElement} selectElement - Native `<select>` to enhance.
     * @param {SelectiveOptions} options - Configuration for this instance.
     * @returns {boolean} `false` if already bound; `true` if successfully applied.
     */
    private applySelectBox(
        selectElement: HTMLSelectElement,
        options: SelectiveOptions,
    ): boolean {
        if (
            Libs.getBinderMap(selectElement) ||
            Libs.getUnbinderMap(selectElement)
        ) {
            return false;
        }

        const SEID = Libs.randomString(8);
        const options_cfg = Libs.buildConfig(
            selectElement,
            options,
        ) as SelectiveOptions;

        options_cfg.SEID = SEID;
        options_cfg.SEID_LIST = `seui-${SEID}-optionlist`;
        options_cfg.SEID_HOLDER = `seui-${SEID}-placeholder`;

        const bindMap: BinderMap = { options: options_cfg };
        Libs.setBinderMap(selectElement, bindMap);

        // Create SelectBox with lifecycle
        const selectBox = new SelectBox(selectElement, this);

        selectBox.on("onMount", () => {
            if (selectBox.container.view) {
                selectBox.container.view.addEventListener("mouseup", () => {
                    bindMap.action?.toggle?.();
                });
            }
        });

        // Mount the SelectBox
        selectBox.mount();

        bindMap.container = selectBox.container;
        bindMap.action = selectBox.getAction();
        bindMap.self = selectBox;

        return true;
    }

    /**
     * Determines the property type of an action for API classification.
     *
     * Classification rules:
     * - **"get-set"**: Property has a getter, **or** has a setter with non-function value.
     * - **"func"**: Property value is a function.
     * - **"variable"**: Fallback for plain data properties.
     *
     * Notes:
     * - Uses `Object.getOwnPropertyDescriptor` for accurate accessor detection.
     * - Return value drives {@link buildGetSetAction} vs {@link buildFuntionAction}.
     *
     * @private
     * @param {string} actionName - Property key to inspect.
     * @param {Record<string, any>} action - Object containing the property.
     * @returns {PropertiesType} Derived property type and name.
     */
    private getProperties(
        actionName: string,
        action: Record<string, any>,
    ): PropertiesType {
        const descriptor = Object.getOwnPropertyDescriptor(action, actionName);
        let type: PropertiesType["type"] = "variable";

        if (
            descriptor?.get ||
            (descriptor?.set && typeof action[actionName] !== "function")
        ) {
            type = "get-set";
        } else if (typeof action[actionName] === "function") {
            type = "func";
        }

        return { type, name: actionName };
    }

    /**
     * Defines a get/set property on the target object that proxies to bound elements.
     *
     * Behavior:
     * - **Getter**: Reads from the **first** element's action API.
     * - **Setter**: Writes to **all** elements' action APIs.
     *
     * Implementation:
     * - Uses `Object.defineProperty` with custom accessors.
     * - Retrieves binder map via {@link Libs.getBinderMap} on each access.
     *
     * Use case:
     * - Unified API for properties like `selectedValue`, `disabled`, etc.
     *
     * @private
     * @param {Record<string, any>} object - Target object to define the property on.
     * @param {string} name - Property name to expose.
     * @param {HTMLElement[]} els - List of bound elements to proxy.
     * @returns {void}
     */
    private buildGetSetAction(
        object: Record<string, any>,
        name: string,
        els: HTMLElement[],
    ): void {
        Object.defineProperty(object, name, {
            get() {
                const binded = Libs.getBinderMap(els[0]) as BinderMap;
                return binded.action?.[name];
            },
            set(value: any) {
                els.forEach((el) => {
                    const binded = Libs.getBinderMap(el) as BinderMap | null;
                    if (binded?.action) binded.action[name] = value;
                });
            },
            enumerable: true,
            configurable: true,
        });
    }

    /**
     * Creates a function on the target object that invokes actions across all bound elements.
     *
     * Invocation flow:
     * 1. Iterates through `els` in order.
     * 2. For each element, retrieves binder map and action API.
     * 3. Creates event token via {@link iEvents.buildEventToken}.
     * 4. Invokes `action[name](callback, ...params)`.
     * 5. Stops iteration if `token.isContinue === false` (propagation stopped).
     * 6. Returns first non-null result, or `object` (for chaining).
     *
     * Flow control:
     * - Actions can halt execution via `callback.stopPropagation()` or `callback.cancel()`.
     * - Only the **first** non-null return value is captured.
     *
     * Use case:
     * - Methods like `toggle()`, `open()`, `close()` that should propagate across instances.
     *
     * @private
     * @param {Record<string, any>} object - Target object to attach the function to.
     * @param {string} name - Function name to expose.
     * @param {HTMLElement[]} els - List of bound elements to invoke against.
     * @returns {void}
     */
    private buildFuntionAction(
        object: Record<string, any>,
        name: string,
        els: HTMLElement[],
    ): void {
        object[name] = (...params: any[]) => {
            let resp = null;
            for (let index = 0; index < els.length; index++) {
                const el = els[index];
                const binded = Libs.getBinderMap(el) as BinderMap | null;
                if (!binded?.action) continue;

                const evtToken = iEvents.buildEventToken();
                resp ??= binded.action[name](evtToken.callback, ...params);

                if (!evtToken.token.isContinue) break;
            }
            return resp ?? object;
        };
    }
}