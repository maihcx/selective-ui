import {iStorage} from "./istorage.js";

/**
 * @class
 */
export class Libs {
    /** @type {iStorage} */
    static #iStorage = null;
    
    /**
     * Retrieves the shared iStorage instance (lazy-initialized singleton).
     *
     * @returns {iStorage} - The global storage utility used by Libs.
     */
    static get iStorage() {
        !this.#iStorage && (this.#iStorage = new iStorage());
        return this.#iStorage;
    }

    /**
     * Schedules and batches function executions keyed by name, with debounced timers.
     * Provides setExecute(), clearExecute(), and run() to manage deferred callbacks.
     */
    static timerProcess = {
        executeStored: {}, 
        setExecute: function(keyExecute, execute, timeout = 50, once = false) {
            if (!this.executeStored[keyExecute]) {
                this.executeStored[keyExecute] = [];
            }
            this.executeStored[keyExecute].push({execute: execute, timeout: timeout, once: once});
        }, clearExecute: function(keyExecute) {
            delete this.executeStored[keyExecute];
        }, run: function(keyExecute, ...params) {
            let executes = this.executeStored[keyExecute];

            if (!this.timerRunner[keyExecute]) {
                this.timerRunner[keyExecute] = {};
            }
            
            for (const key in executes) {
                const execute = executes[key];

                if (!this.timerRunner[keyExecute][key]) {
                    this.timerRunner[keyExecute][key] = {};
                }

                if (execute) {
                    clearTimeout(this.timerRunner[keyExecute][key]);
                    this.timerRunner[keyExecute][key] = setTimeout(() => {
                        execute && execute.execute(params.length > 0 ? params : null);
                        execute.once && (delete this.executeStored[keyExecute][key]);
                    }, execute.timeout);
                }
            }
        }, timerRunner: {}
    }

    /**
     * Checks whether a value is null/undefined/empty-string/"0"/0.
     * Booleans are always considered non-empty.
     *
     * @param {any} value - The value to test.
     * @returns {boolean} - True if considered empty; otherwise false.
     */
    static isNullOrEmpty(value) {
        if (typeof value === "boolean") return false;
        return value == null || value === "" || value === 0 || value === "0";
    }

    /**
     * Deep-copies plain objects/arrays recursively. Returns primitives as-is.
     *
     * @param {any} obj - The source object or array.
     * @returns {any} - A deep-cloned copy.
     */
    static jsCopyObject(obj) {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }

        let copy = Array.isArray(obj) ? [] : {};

        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                copy[key] = this.jsCopyObject(obj[key]);
            }
        }

        return copy;
    }

    /**
     * Generates a random alphanumeric string of given length.
     *
     * @param {number} [length=6] - Desired length.
     * @returns {string} - The generated string.
     */
    static randomString(length = 6) {
        let result           = "";
        let characters       = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let charactersLength = characters.length;
        for ( let i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    /**
     * Resolves a selector, NodeList, or single Element into an array of elements.
     * Returns an empty array if nothing is found.
     *
     * @param {string|NodeList|Element|HTMLElement|null} queryCommon - CSS selector, NodeList, or Element.
     * @returns {Element[]|HTMLElement[]|Node[]} - Array of matched elements (empty if none).
     */
    static getElements(queryCommon) {
        if (!queryCommon) return [];

        if (typeof queryCommon === "string") {
            const nodeList = document.querySelectorAll(queryCommon);
            return Array.from(nodeList);
        }

        if (queryCommon instanceof Element) {
            return [queryCommon];
        }

        if (queryCommon instanceof NodeList || Array.isArray(queryCommon)) {
            return Array.from(queryCommon);
        }

        return [];
    }

    /**
     * Creates a new Element based on a NodeSpec and applies attributes, classes, styles, dataset, and events.
     *
     * @param {NodeSpec} data - Specification describing the element to create.
     * @returns {Element} - The created element.
     */
    static nodeCreator(data = {}) {
        return this.nodeCloner(document.createElement(data.node), data, true);
    }

    /**
     * Clones an element (or converts a Node to Element) and applies NodeSpec options.
     * When systemNodeCreate=true, uses the provided node as-is.
     *
     * @param {Element} node - The element to clone or use.
     * @param {NodeSpec} _nodeOption - Options (classList, style, dataset, event, other props).
     * @param {boolean} systemNodeCreate - If true, do not clone; use original node.
     * @returns {Element} - The processed element.
     */
    static nodeCloner(node = document.documentElement, _nodeOption = null, systemNodeCreate = false) {
        const nodeOption = { ..._nodeOption };
        
        /** @type {Element} */
        const element_creation = systemNodeCreate ? node : this.nodeToElement(node.cloneNode(true));

        if (typeof nodeOption.classList === "string") {
            element_creation.classList.add(nodeOption.classList);
        } else if (Array.isArray(nodeOption.classList)) {
            element_creation.classList.add(...nodeOption.classList);
        }
        delete nodeOption.classList;

        ["style", "dataset"].forEach(property => {
            Object.assign(element_creation[property], nodeOption[property]);
            delete nodeOption[property];
        });

        if (nodeOption.role) {
            element_creation.setAttribute("role", nodeOption.role);
            delete nodeOption.role;
        }

        if (nodeOption.ariaLive) {
            element_creation.setAttribute("aria-live", nodeOption.ariaLive);
            delete nodeOption.ariaLive;
        }

        if (nodeOption.ariaLabelledby) {
            element_creation.setAttribute("aria-labelledby", nodeOption.ariaLabelledby);
            delete nodeOption.ariaLabelledby;
        }

        if (nodeOption.ariaControls) {
            element_creation.setAttribute("aria-controls", nodeOption.ariaControls);
            delete nodeOption.ariaControls;
        }

        if (nodeOption.ariaHaspopup) {
            element_creation.setAttribute("aria-haspopup", nodeOption.ariaHaspopup);
            delete nodeOption.ariaHaspopup;
        }

        if (nodeOption.ariaMultiselectable) {
            element_creation.setAttribute("aria-multiselectable", nodeOption.ariaMultiselectable);
            delete nodeOption.ariaMultiselectable;
        }

        if (nodeOption.ariaAutocomplete) {
            element_creation.setAttribute("aria-autocomplete", nodeOption.ariaAutocomplete);
            delete nodeOption.ariaAutocomplete;
        }

        if (nodeOption.event) {
            Object.entries(nodeOption.event).forEach(([key, value]) => {
                element_creation.addEventListener(key, value);
            });
            delete nodeOption.event;
        }

        Object.entries(nodeOption).forEach(([key, value]) => {
            if (value === null) {
                element_creation.removeAttribute(key);
            } else {
                element_creation[key] = value;
            }
        });

        return element_creation;
    }

    /**
     * Ensures the given Node is an Element; throws if not.
     *
     * @param {Node} node - The node to validate.
     * @returns {Element} - The element cast.
     * @throws {TypeError} - If node is not an Element.
     */
    static nodeToElement(node) {
        if (node instanceof Element) {
            return node;
        }
        throw new TypeError("Node is not an Element");
    }


    /**
     * Mounts a view from a plain object specification and returns a typed result
     * containing the root element and a tag map.
     *
     * @template TTags
     * @param {Object} rawObj - The specification describing elements and tags.
     * @returns {MountViewResult<TTags>} - The mounted view and its tag references.
     */
    static mountView(rawObj) {
        return /** @type {MountViewResult<TTags>} */ (
            this.mountNode(rawObj)
        );
    }

    /**
     * Recursively builds DOM nodes from a specification object, appends/prepends them
     * to an optional parent, and returns either a tag map or a full MountViewResult.
     *
     * @template TTags
     * @param {Object<string, any>} rawObj - Node spec (keys -> { tag, child }).
     * @param {Element|null} [parentE=null] - Parent to attach into; if null, returns root.
     * @param {boolean} [isPrepend=false] - If true, prepend; otherwise append.
     * @param {boolean} [isRecusive=false] - Internal flag for recursion control.
     * @param {TTags|Object} [recursiveTemp={}] - Accumulator for tag references.
     * @returns {MountViewResult<TTags>|TTags} - Tag map or the final mount result.
     */
    static mountNode(rawObj, parentE = null, isPrepend = false, isRecusive = false, recursiveTemp = {}) {
        let view = null;
        for (let key in rawObj) {
            const singleObj = rawObj[key];
            
            const tag = (singleObj.tag?.tagName) ? singleObj.tag : this.nodeCreator(singleObj.tag);
            recursiveTemp[key] = tag;
            singleObj.child && this.mountNode(singleObj.child, tag, false, false, recursiveTemp);

            if (parentE) {
                if (isPrepend) {
                    parentE.prepend(tag);
                }
                else {
                    parentE.append(tag);
                }
            }
            else if (!isRecusive && !view) {
                view = tag;
            }
        }
        if (!isRecusive) {
            recursiveTemp.id = this.randomString(7);

            if (!parentE) {
                recursiveTemp = {tags: recursiveTemp, view: view}
            }
        }
        return recursiveTemp;
    }

    /**
     * Applies inline CSS styles to all matched elements. Accepts either a style
     * object or a single property + value pair.
     *
     * @param {string|NodeList|HTMLElement} queryCommon - Selector or element(s).
     * @param {Record<string, string>|string} styles - Style object or a single property name.
     * @param {string|null} [value=null] - Value for the single property form.
     */
    static setStyle(queryCommon, styles, value = null) {
        const apply_styles = typeof styles === "string" ? { [styles]: value } : { ...styles },
                queryItems = this.getElements(queryCommon);

        if (queryItems && typeof queryItems == "object"){
            for (let i = 0; i < queryItems.length; i++){
                const item = queryItems[i];
                if (item) {
                    Object.assign(item["style"], apply_styles);
                }
            }
        }
    }

    /**
     * Builds a configuration object by copying defaults and then overriding with
     * matching element properties or data-* attributes when present.
     *
     * @param {HTMLElement} element - Source element providing overrides.
     * @param {object} options - Default configuration to be merged.
     * @returns {object} - Final configuration after element overrides.
     */
    static buildConfig(element, options) {
        let myOptions = this.jsCopyObject(options);

        for (let optionKey in myOptions) {
            if (element[optionKey]) {
                myOptions[optionKey] = element[optionKey];
            }
            else if (typeof element?.dataset[optionKey] !== "undefined") {
                myOptions[optionKey] = element.dataset[optionKey];
            }
        }
        return myOptions;
    }

    /**
     * Deep-merges multiple configuration objects. Special-cases the `on` field
     * by concatenating event handler arrays; other keys are overwritten.
     *
     * @param {...object} params - Config objects in priority order (leftmost is base).
     * @returns {object} - Merged configuration object.
     */
    static mergeConfig(...params) {
        if (params.length == 0) {
            return {};
        }
        if (params.length == 1) {
            return this.jsCopyObject(params[0]);
        }
        else {
            const level0 = this.jsCopyObject(params[0]);
            for (let index = 1; index < params.length; index++) {
                const cfg = params[index];

                for (let optionKey in cfg) {
                    if (optionKey == "on") {
                        const cfgVar = cfg[optionKey];
                        for (let actKey in cfgVar) {
                            level0[optionKey][actKey].push(cfgVar[actKey]);
                        }
                    }
                    else {
                        level0[optionKey] = cfg[optionKey];
                    }
                }
            }
            return level0;
        }
    }

    /**
     * Converts strings like "true", "1", "yes", "on" to boolean true; "false", "0",
     * "no", "off" to false. Non-strings are coerced via Boolean().
     *
     * @param {unknown} str - String or any value to convert.
     * @returns {boolean} - The normalized boolean.
     */
    static string2Boolean(str) {
        if (typeof str === "boolean") return str;
        if (typeof str !== "string") return Boolean(str);

        switch (str.trim().toLowerCase()) {
            case "true":
            case "1":
            case "yes":
            case "on":
                return true;
            case "false":
            case "0":
            case "no":
            case "off":
                return false;
            default:
                return false;
        }
    }

    /**
     * Removes a binder map entry for the given element from the global storage.
     *
     * @param {HTMLElement} element - Element key to remove from the binder map.
     * @returns {boolean} - True if an entry existed and was removed.
     */
    static removeBinderMap(element) {
        return this.iStorage.bindedMap.delete(element);
    }

    /**
     * Retrieves the binder map entry associated with the given element.
     *
     * @param {HTMLElement} item - Element key whose binder map is requested.
     * @returns {any} - The stored binder map value or undefined if absent.
     */
    static getBinderMap(item) {
        return this.iStorage.bindedMap.get(item);
    }
    
    /**
     * Sets or updates the binder map entry for a given element.
     *
     * @param {HTMLElement} item - Element key to associate with the binder map.
     * @param {any} bindMap - Value to store in the binder map.
     */
    static setBinderMap(item, bindMap) {
        this.iStorage.bindedMap.set(item, bindMap);
    }

    /**
     * Removes a binder map entry for the given element from the global storage.
     *
     * @param {HTMLElement} element - Element key to remove from the binder map.
     * @returns {boolean} - True if an entry existed and was removed.
     */
    static removeUnbinderMap(element) {
        return this.iStorage.unbindedMap.delete(element);
    }

    /**
     * Retrieves the binder map entry associated with the given element.
     *
     * @param {HTMLElement} item - Element key whose binder map is requested.
     * @returns {any} - The stored binder map value or undefined if absent.
     */
    static getUnbinderMap(item) {
        return this.iStorage.unbindedMap.get(item);
    }
    
    /**
     * Sets or updates the binder map entry for a given element.
     *
     * @param {HTMLElement} item - Element key to associate with the binder map.
     * @param {any} bindMap - Value to store in the binder map.
     */
    static setUnbinderMap(item, bindMap) {
        this.iStorage.unbindedMap.set(item, bindMap);
    }

    /**
     * Returns the global default configuration used by the Selective UI system.
     *
     * @returns {object} - The default config object.
     */
    static getDefaultConfig() {
        return this.iStorage.defaultConfig;
    }

    /**
     * Returns the global list of bound commands stored in the shared storage.
     *
     * @returns {any[]} - The bound command list.
     */
    static getBindedCommand() {
        return this.iStorage.bindedCommand;
    }

    /**
     * Safely translates an HTML-like string to sanitized markup:
     * - decodes custom &lt;`/`&gt; placeholders,
     * - strips <script> tags,
     * - removes event and javascript: attributes from all nodes.
     *
     * @param {string} str_tag - The input string to sanitize/translate.
     * @returns {string} - Safe innerHTML string.
     */
    static tagTranslate(str_tag) {
        if (str_tag == null) return "";

        str_tag = String(str_tag).replace(/&lt;`/g, "<").replace(/`&gt;/g, ">").replace(/<`/g, "<").replace(/`>/g, ">").trim();

        const doc = globalThis?.document;

        if (!doc || typeof doc.createElement !== "function") {
            str_tag = str_tag
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
            .replace(/<(object|embed|link)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
            str_tag = str_tag.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
            str_tag = str_tag.replace(/\s([a-z-:]+)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "");
            return str_tag;
        }

        const tmp = doc.createElement("div");
        tmp.innerHTML = str_tag;

        tmp.querySelectorAll("script, style, iframe, object, embed, link").forEach(n => n.remove());

        tmp.querySelectorAll("*").forEach(n => {
            [...n.attributes].forEach(a => {
            const name = a.name || "";
            const value = a.value || "";
            if (/^on/i.test(name)) {
                n.removeAttribute(name);
                return;
            }
            if (/^(href|src|xlink:href)$/i.test(name) && /^javascript:/i.test(value)) {
                n.removeAttribute(name);
            }
            });
        });

        return (tmp.innerHTML || "").trim();
    }

    /**
     * Strips all HTML from a string and returns trimmed plain text.
     *
     * @param {string} html - The HTML string to strip.
     * @returns {string} - The extracted plain text.
     */
    static stripHtml(html) {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        let text_tmp = tmp.textContent || tmp.innerText || "";
        tmp.remove();
        return text_tmp.trim();
    }

    /**
     * Normalizes a Vietnamese string by removing diacritics and special combining marks,
     * returning a lowercase non-accent version for searching/matching.
     *
     * @param {string} str - The input text.
     * @returns {string} - The diacritic-free lowercase string.
     */
    static string2normalize(str) {
        if (str == null) return '';
        const s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.replace(/đ/g, 'd').replace(/Đ/g, 'd');
    }

    /**
     * Parse select element to array (including optgroups)
     * @param {HTMLSelectElement} selectElement
     * @returns {Array<HTMLOptGroupElement|HTMLOptionElement>}
     */
    static parseSelectToArray(selectElement) {
        const result = [];
        const children = Array.from(selectElement.children);

        children.forEach(child => {
            if (child.tagName === "OPTGROUP") {
                result.push(child);
                
                Array.from(child.children).forEach(option => {
                    option["__parentGroup"] = child;
                    result.push(option);
                });
            } else if (child.tagName === "OPTION") {
                result.push(child);
            }
        });

        return result;
    }

    
    /**
     * Detects whether the current environment is iOS (including iPad/iPhone/iPod, iOS browsers,
     * iPadOS on Mac with touch, standalone PWAs, and WebKit mobile heuristics). Caches the result
     * for subsequent calls to avoid re-computation.
     *
     * @returns {boolean} - True if the user agent/platform appears to be iOS; otherwise false.
     */
    
    static IsIOS() {
        const ua = navigator.userAgent;
        return /iP(hone|ad|od)/.test(ua) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Converts an arbitrary CSS size value into pixel units by measuring a temporary element.
     * Returns the computed pixel height as a string with "px" suffix.
     *
     * @param {string} value - Any valid CSS size (e.g., "2rem", "5vh", "12pt").
     * @returns {string} - The equivalent pixel value (e.g., "32px").
     */
    
    static any2px(value) {
        const v = String(value).trim();
        if (v.endsWith('px')) return v;
        if (v.endsWith('vh')) return (window.innerHeight * parseFloat(v)/100) + 'px';
        if (v.endsWith('vw')) return (window.innerWidth  * parseFloat(v)/100) + 'px';
        // ... rem/em: lấy computed font-size thân document
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (v.endsWith('rem')) return (fs * parseFloat(v)) + 'px';
        // fallback: đo DOM (hiếm)
        const el = /** @type {HTMLElement} */ (this.nodeCreator({node:'div', style:{height:v, opacity:0}}));
        document.body.appendChild(el);
        const px = el.offsetHeight + 'px';
        el.remove();
        return px;
    }
}