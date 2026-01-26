import { Libs } from "./libs";
import { iEvents } from "./ievents";
import { SelectBox } from "../components/selectbox";
import { ElementAdditionObserver } from "../services/ea-observer";
import { SelectiveActionApi, SelectiveOptions } from "../types/utils/selective.type";
import { BinderMap, PropertiesType } from "../types/utils/istorage.type";
import { Popup } from "../components/popup";

export class Selective {
    private EAObserver: ElementAdditionObserver;

    private bindedQueries: Map<string, SelectiveOptions> = new Map();

    /**
     * Binds Selective UI to all <select> elements matching the query.
     * Merges provided options with defaults, schedules `on.load` callbacks,
     * initializes each matching select, and records the binding for auto-rebinding.
     *
     * @param {string} query - CSS selector for target <select> elements.
     * @param {object} options - Configuration overrides merged with defaults.
     */
    public bind(query: string, options: SelectiveOptions): void {
        const merged = Libs.mergeConfig(Libs.getDefaultConfig(), options) as SelectiveOptions;

        // Ensure hooks exist
        merged.on = merged.on ?? {};
        merged.on.load = (merged.on.load ?? []) as Array<(...args: any[]) => void>;

        this.bindedQueries.set(query, merged);

        const doneToken = Libs.randomString();
        Libs.callbackScheduler.on(doneToken, () => {
            iEvents.callEvent([this.find(query)], ...(merged.on!.load));
            Libs.callbackScheduler.clear(doneToken);
            merged.on!.load = [];
        });

        const selectElements = Libs.getElements(query) as HTMLSelectElement[];
        selectElements.forEach((item) => {
            (async () => {
                if (item.tagName === "SELECT") {
                    Libs.removeUnbinderMap(item);
                    if (this.applySelectBox(item, merged)) {
                        Libs.callbackScheduler.run(doneToken);
                    }
                }
            })();
        });

        if (!Libs.getBindedCommand().includes(query)) {
            Libs.getBindedCommand().push(query);
        }
    }

    /**
     * Finds the first bound SelectBox actions for a given query (or all bound queries if "*").
     * Returns an API object with methods assembled from the bound action definitions.
     *
     * @param {string} [query="*"] - CSS selector or "*" to search all bound instances.
     * @returns {SelectiveActionApi} - Aggregated actions; {isEmpty:true} if none found.
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
     * Starts observing the document for newly added <select> elements and applies
     * Selective bindings automatically when they match previously bound queries.
     */
    public Observer(): void {
        this.EAObserver = new ElementAdditionObserver();
        this.EAObserver.onDetect((selectElement: HTMLSelectElement) => {
            this.bindedQueries.forEach((options, query) => {
                try {
                    if (selectElement.matches(query)) {
                        this.applySelectBox(selectElement, options);
                    }
                } catch (error) {
                    console.warn(`Invalid selector: ${query}`, error);
                }
            });
        });
        this.EAObserver.start("select");
    }

    /**
     * Destroys Selective instances. Supports:
     * - destroyAll(): when target is null,
     * - destroyByQuery(): when target is a selector string,
     * - destroyElement(): when target is an HTMLSelectElement.
     *
     * @param {null|string|HTMLSelectElement} target - Target to destroy.
     */
    public destroy(target: null | string | HTMLSelectElement = null): void {
        if (target === null) {
            this.destroyAll();
        } else if (typeof target === "string") {
            this.destroyByQuery(target);
        } else if (target instanceof HTMLSelectElement) {
            this.destroyElement(target);
        }
    }

    /**
     * Destroys all bound Selective instances and clears bindings/state.
     * Stops the ElementAdditionObserver.
     */
    private destroyAll(): void {
        const bindedCommands = Libs.getBindedCommand();
        bindedCommands.forEach((query: string) => this.destroyByQuery(query));

        this.bindedQueries.clear();
        Libs.getBindedCommand().length = 0;
        this.EAObserver?.stop();
    }

    /**
     * Destroys Selective instances bound to the specified query and removes
     * the query from the binding registry.
     *
     * @param {string} query - CSS selector whose Selective instances should be destroyed.
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
     * Destroys a single Selective instance attached to the given <select> element,
     * detaches UI, restores original select state, and removes binder map entry.
     *
     * @param {HTMLSelectElement} selectElement - The target <select> element to clean up.
     */
    private destroyElement(selectElement: HTMLSelectElement): void {
        const bindMap = Libs.getBinderMap(selectElement) as BinderMap | null;
        if (!bindMap) return;

        const popup = bindMap.container?.popup as Popup | null;
        popup?.destroy();

        Libs.setUnbinderMap(selectElement, bindMap);

        const wasObserving = !!this.EAObserver;
        if (wasObserving) this.EAObserver?.stop();

        try {
            bindMap.self?.deInit?.();
        } catch (_) { }

        const wrapper: HTMLElement | null =
            (bindMap.container?.element as HTMLElement | undefined) ?? selectElement.parentElement;

        selectElement.style.display = "";
        selectElement.style.visibility = "";
        selectElement.disabled = false;
        delete selectElement.dataset.selectiveId;

        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.replaceChild(selectElement, wrapper);
        } else {
            document.body.appendChild(selectElement);
        }

        Libs.removeBinderMap(selectElement);

        if (wasObserving && this.bindedQueries.size > 0) {
            this.EAObserver?.start("select");
        }
    }

    /**
     * Rebinds a query by destroying existing instances and binding anew
     * with the provided options.
     *
     * @param {string} query - CSS selector to rebind.
     * @param {object} options - Configuration for the new binding.
     */
    public rebind(query: string, options: SelectiveOptions): void {
        this.destroyByQuery(query);
        this.bind(query, options);
    }

    /**
     * Applies SelectBox enhancement to a single <select> element:
     * builds per-instance IDs, merges element dataset into options,
     * creates SelectBox, stores binder map with action API, and wires toggle on mouseup.
     *
     * @param {HTMLSelectElement} selectElement - The native <select> to enhance.
     * @param {object} options - Configuration used for this instance.
     * @returns {boolean} - False if already bound; true if successfully applied.
     */
    private applySelectBox(selectElement: HTMLSelectElement, options: SelectiveOptions): boolean {
        if (Libs.getBinderMap(selectElement) || Libs.getUnbinderMap(selectElement)) {
            return false;
        }

        const SEID = Libs.randomString(8);
        const options_cfg = Libs.buildConfig(selectElement, options) as SelectiveOptions;

        options_cfg.SEID = SEID;
        options_cfg.SEID_LIST = `seui-${SEID}-optionlist`;
        options_cfg.SEID_HOLDER = `seui-${SEID}-placeholder`;

        const bindMap: BinderMap = { options: options_cfg };
        Libs.setBinderMap(selectElement, bindMap);

        const selectBox = new SelectBox(selectElement, this);
        bindMap.container = selectBox.container;
        bindMap.action = selectBox.getAction();
        bindMap.self = selectBox;

        selectBox.container.view.addEventListener("mouseup", () => {
            bindMap.action?.toggle?.();
        });

        return true;
    }

    /**
     * Determines the property type for an action name on the provided object.
     * Classifies as:
     * - "get-set" when a getter exists (or a setter with non-function value),
     * - "func" when the property is a function,
     * - "variable" otherwise.
     *
     * @param {string} actionName - The property key to inspect.
     * @param {*} action - The object containing the property.
     * @returns {PropertiesType} - The derived property type and name.
     */
    private getProperties(actionName: string, action: Record<string, any>): PropertiesType {
        const descriptor = Object.getOwnPropertyDescriptor(action, actionName);
        let type: PropertiesType["type"] = "variable";

        if (descriptor?.get || (descriptor?.set && typeof action[actionName] !== "function")) {
            type = "get-set";
        } else if (typeof action[actionName] === "function") {
            type = "func";
        }

        return { type, name: actionName };
    }

    /**
     * Defines a get/set property on the target object that proxies to each bound element's action API.
     * Getter reads from the first element; setter writes the value to all elements.
     *
     * @param {Object} object - The target object to define the property on.
     * @param {string} name - The property name to expose.
     * @param {HTMLElement[]} els - The list of bound elements to proxy.
     */
    private buildGetSetAction(object: Record<string, any>, name: string, els: HTMLElement[]): void {
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
     * Creates a function on the target object that invokes the corresponding action
     * across all bound elements in order, respecting the event token flow control.
     * Stops iteration if the token indicates propagation should not continue.
     *
     * @param {Object} object - The target object to attach the function to.
     * @param {string} name - The function name to expose.
     * @param {HTMLElement[]} els - The list of bound elements to invoke against.
     */
    private buildFuntionAction(object: Record<string, any>, name: string, els: HTMLElement[]): void {
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