import {Libs} from "./libs.js";
import {iEvents} from "./ievents.js";
import {SelectBox} from "../components/selectbox.js";
import { ElementAdditionObserver } from "../services/ea-observer.js";

/**
 * @class
 */
export class Selective {
    /** @type {ElementAdditionObserver} */
    EAObserver = null;

    static bindedQueries = new Map();

    /**
     * Binds Selective UI to all <select> elements matching the query.
     * Merges provided options with defaults, schedules `on.load` callbacks,
     * initializes each matching select, and records the binding for auto-rebinding.
     *
     * @param {string} query - CSS selector for target <select> elements.
     * @param {object} options - Configuration overrides merged with defaults.
     */
    static bind(query, options) {
        options = Libs.mergeConfig(Libs.getDefaultConfig(), options);

        this.bindedQueries.set(query, options);

        const superThis = this;
        const doneToken = Libs.randomString();
        Libs.timerProcess.setExecute(doneToken, () => {
            iEvents.callEvent([superThis.find(query)], ...options.on.load);
            Libs.timerProcess.clearExecute(doneToken);
            options.on.load = [];
        });
        
        /** @type {HTMLSelectElement[]} */
        const selectElements = /** @type {HTMLSelectElement[]} */ (Libs.getElements(query));
        
        selectElements.forEach(item => {
            (async() => {
                if ("SELECT" == item.tagName) {
                    Libs.removeUnbinderMap(item);
                    if (this.applySelectBox(item, options)) {
                        Libs.timerProcess.run(doneToken);
                    }
                }
            })();
        });

        if (!Libs.getBindedCommand().includes(query)) {
            Libs.getBindedCommand().push(query);
        }
    }

    
    /**
     * A dynamic action API object produced by `find()`.
     * Contains `isEmpty` plus dynamically attached properties (get/set or functions).
     * 
     * @typedef {Record<string, object> & { isEmpty: boolean }} ActionApi
     * 
     * Finds the first bound SelectBox actions for a given query (or all bound queries if "*").
     * Returns an API object with methods assembled from the bound action definitions.
     *
     * @param {string} [query="*"] - CSS selector or "*" to search all bound instances.
     * @returns {ActionApi} - Aggregated actions; {isEmpty:true} if none found.
     */
    static find(query = "*") {
        let actions = { isEmpty: true };

        if (query == "*") {
            query = Libs.getBindedCommand().join(", ");
            if (query == "") {
                return actions;
            }
        }

        const sels = /** @type {HTMLElement[]} */ (Libs.getElements(query));
        if (sels.length == 0) {
            return actions;
        }
    
        const binded = Libs.getBinderMap(sels[0]);
        if (!binded) {
            return actions;
        }
        
        for (let actionName in binded.action) {
            actions[actionName] = this.#getProperties(actionName, binded.action)
        }
        Object.keys(binded.action);
    
        if (actions) {
            /** @type {ActionApi} */
            let response = {};
            for (let actionKey in actions) {

                /** @type {IPropertiesType} */
                const action = actions[actionKey];
                
                switch (action.type) {
                    case "get-set":
                        this.#buildGetSetAction(response, action.name, sels);
                        break;
    
                    case "func":
                        this.#buildFuntionAction(response, action.name, sels);
                        break;
                
                    default:
                        break;
                }
            }
            
            response.isEmpty = false;
            return response;
        }
    }

    /**
     * Starts observing the document for newly added <select> elements and applies
     * Selective bindings automatically when they match previously bound queries.
     */
    static Observer() {
        this.EAObserver = new ElementAdditionObserver();
        this.EAObserver.onDetect((selectElement) => {
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
    static destroy(target = null) {
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
    static destroyAll() {
        const bindedCommands = Libs.getBindedCommand();
        
        bindedCommands.forEach(query => {
            this.destroyByQuery(query);
        });

        this.bindedQueries.clear();
        Libs.getBindedCommand().length = 0;

        this.EAObserver.stop();
    }

    /**
     * Destroys Selective instances bound to the specified query and removes
     * the query from the binding registry.
     *
     * @param {string} query - CSS selector whose Selective instances should be destroyed.
     */
    static destroyByQuery(query) {
        const selectElements = /** @type {HTMLSelectElement[]} */ (Libs.getElements(query));
        
        selectElements.forEach(element => {
            if (element.tagName === "SELECT") {
                this.destroyElement(element);
            }
        });

        this.bindedQueries.delete(query);
        const commands = Libs.getBindedCommand();
        const index = commands.indexOf(query);
        if (index > -1) {
            commands.splice(index, 1);
        }
    }

    /**
     * Destroys a single Selective instance attached to the given <select> element,
     * detaches UI, restores original select state, and removes binder map entry.
     *
     * @param {HTMLSelectElement} selectElement - The target <select> element to clean up.
     */
    static destroyElement(selectElement) {
        const bindMap = Libs.getBinderMap(selectElement);
        if (!bindMap) return;

        Libs.setUnbinderMap(selectElement, bindMap);

        const wasObserving = !!this.EAObserver;
        if (wasObserving) this.EAObserver.stop();

        try { bindMap.self.deInit?.(); } catch (_) {}

        const wrapper = bindMap.container?.element || selectElement.parentElement;

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
            this.EAObserver.start("select");
        }
    }

    /**
     * Unbinds a previously bound query from auto-apply and auto-observe lists.
     * Stops the observer when no bound queries remain.
     *
     * @param {string} query - The CSS selector to unbind.
     */
    // static unbind(query) {
    //     this.bindedQueries.delete(query);
        
    //     const commands = Libs.getBindedCommand();
    //     const index = commands.indexOf(query);
    //     if (index > -1) {
    //         commands.splice(index, 1);
    //     }

    //     if (this.bindedQueries.size === 0) {
    //         this.EAObserver.stop();
    //     }
    // }

    /**
     * Rebinds a query by destroying existing instances and binding anew
     * with the provided options.
     *
     * @param {string} query - CSS selector to rebind.
     * @param {object} options - Configuration for the new binding.
     */
    static rebind(query, options) {
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
    static applySelectBox(selectElement, options) {
        if (Libs.getBinderMap(selectElement) || Libs.getUnbinderMap(selectElement)) {
            return false;
        }
        
        const SEID = Libs.randomString(8);
        const options_cfg = Libs.buildConfig(selectElement, options);
        options_cfg.SEID = SEID
        options_cfg.SEID_LIST = `seui-${SEID}-optionlist`;
        options_cfg.SEID_HOLDER = `seui-${SEID}-placeholder`;
        const bindMap = {options: options_cfg};
        
        Libs.setBinderMap(selectElement, bindMap);
        const selectBox = new SelectBox(selectElement, this);
        bindMap.container = selectBox.container;
        bindMap.action = selectBox.getAction();
        bindMap.self = selectBox;

        selectBox.container.view.addEventListener("mouseup", () => {
            bindMap.action.toggle();
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
     * @typedef {Object} IPropertiesType
     * @property {string} type - One of "variable" | "get-set" | "func".
     * @property {string} name - The original action name.
     *
     * @param {string} actionName - The property key to inspect.
     * @param {*} action - The object containing the property.
     * @returns {IPropertiesType} - The derived property type and name.
     */
    static #getProperties(actionName, action) {
        const descriptor = Object.getOwnPropertyDescriptor(action, actionName);
        let type = "variable";

        if (descriptor.get || (descriptor.set && typeof action[actionName] !== "function")) {
            type = "get-set";
        }
        else if (typeof action[actionName] === "function") {
            type = "func";
        }

        return {
            type,
            name: actionName
        }
    }

    /**
     * Defines a get/set property on the target object that proxies to each bound element's action API.
     * Getter reads from the first element; setter writes the value to all elements.
     *
     * @param {Object} object - The target object to define the property on.
     * @param {string} name - The property name to expose.
     * @param {HTMLElement[]} els - The list of bound elements to proxy.
     */
    static #buildGetSetAction(object, name, els) {
        Object.defineProperty(object, name, {
            get() {
                const binded = Libs.getBinderMap(els[0]);
                return binded.action[name];
            },
            set(value) {
                els.forEach(el => {
                    const binded = Libs.getBinderMap(el);
                    if (binded) {
                        binded.action[name] = value;
                    }
                });
            },
            enumerable: true,
            configurable: true
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
    static #buildFuntionAction(object, name, els) {
        object[name] = (...params) => {
            for (let index = 0; index < els.length; index++) {
                const el = els[index];
                const binded = Libs.getBinderMap(el);
                if (!binded) {
                    continue;
                }
                const evtToken = iEvents.buildEventToken();
                binded.action[name](evtToken.callback, ...params)
                if (!evtToken.token.isContinue) {
                    break;
                }
            }
            return object;
        }
    }
}