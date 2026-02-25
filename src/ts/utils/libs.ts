import { BinderMap } from "../types/utils/istorage.type";
import { MountViewResult, NodeSpec } from "../types/utils/libs.type";
import { iStorage } from "./istorage";
import { CallbackScheduler } from "./callback-scheduler";
import { SelectiveOptions } from "../types/utils/selective.type";

/**
 * @class
 */
export class Libs {
    private static _iStorage: iStorage | null = null;

    /**
     * Retrieves the shared iStorage instance (lazy-initialized singleton).
     *
     * @returns {iStorage} - The global storage utility used by Libs.
     */
    public static get iStorage(): iStorage {
        if (!this._iStorage) this._iStorage = new iStorage();
        return this._iStorage;
    }

    /**
     * Schedules and batches function executions keyed by name, with debounced timers.
     * Provides setExecute(), clearExecute(), and run() to manage deferred callbacks.
     */
    public static readonly callbackScheduler = new CallbackScheduler();

    /**
     * Deep-copies plain objects/arrays recursively. Returns primitives as-is.
     *
     * @param {T} obj - The source object or array.
     * @returns {T} - A deep-cloned copy.
     */
    public static jsCopyObject<T>(obj: T): T {
        if (obj === null || typeof obj !== "object") return obj;

        const copy: any = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                copy[key] = this.jsCopyObject(obj[key]);
            }
        }
        return copy as T;
    }

    /**
     * Generates a random alphanumeric string of given length.
     *
     * @param {number} [length=6] - Desired length.
     * @returns {string} - The generated string.
     */
    public static randomString(length: number = 6): string {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    /**
     * Resolves a selector, NodeList, or single HTMLElement into an array of elements.
     * Returns an empty array if nothing is found.
     *
     * @param {string|NodeListOf<HTMLElement>|HTMLElement|HTMLElement|ArrayLike<HTMLElement>|null} queryCommon - CSS selector, NodeList, or HTMLElement.
     * @returns {HTMLElement[]} - Array of matched elements (empty if none).
     */
    public static getElements<T extends HTMLElement[]>(
        queryCommon:
            | string
            | NodeListOf<HTMLElement>
            | Element
            | HTMLElement
            | ArrayLike<HTMLElement>
            | null
            | undefined
    ): T {
        if (!queryCommon) return [] as T;

        if (typeof queryCommon === "string") {
            const nodeList = document.querySelectorAll<HTMLElement>(queryCommon);
            return Array.from(nodeList) as T;
        }

        if (queryCommon instanceof HTMLElement) {
            return [queryCommon] as T;
        }

        // NodeList or array-like
        if (queryCommon instanceof NodeList || Array.isArray(queryCommon)) {
            return Array.from(queryCommon) as T;
        }

        return [] as T;
    }

    /**
     * Creates a new HTMLElement based on a NodeSpec and applies attributes, classes, styles, dataset, and events.
     *
     * @param {NodeSpec} data - Specification describing the element to create.
     * @returns {HTMLElement} - The created element.
     */
    public static nodeCreator<T extends HTMLElement>(data: Partial<NodeSpec> = {}): T {
        const nodeName = (data.node ?? "div") as string;
        return this.nodeCloner<T>(document.createElement(nodeName), data as NodeSpec, true);
    }

    /**
     * Clones an element (or converts a Node to HTMLElement) and applies NodeSpec options.
     * When systemNodeCreate=true, uses the provided node as-is.
     *
     * @param {HTMLElement} node - The element to clone or use.
     * @param {NodeSpec|null} _nodeOption - Options (classList, style, dataset, event, other props).
     * @param {boolean} systemNodeCreate - If true, do not clone; use original node.
     * @returns {HTMLElement} - The processed element.
     */
    public static nodeCloner<T extends HTMLElement>(node: HTMLElement = document.documentElement, _nodeOption: NodeSpec | null = null, systemNodeCreate = false): T {
        const nodeOption: Record<string, unknown> = { ...(_nodeOption ?? {}) };

        const element_creation: T = systemNodeCreate ? node as T : node.cloneNode(true) as T;

        const classList = nodeOption.classList;
        if (typeof classList === "string") {
            element_creation.classList.add(classList);
        } else if (Array.isArray(classList)) {
            element_creation.classList.add(...classList);
        }
        delete nodeOption.classList;

        (["style", "dataset"] as const).forEach((property) => {
            const value = nodeOption[property];
            if (value && typeof value === "object") {
                Object.assign(element_creation[property], value);
            }
            delete nodeOption[property];
        });

        if (nodeOption.role) {
            element_creation.setAttribute("role", String(nodeOption.role));
            delete nodeOption.role;
        }
        if (nodeOption.ariaLive) {
            element_creation.setAttribute("aria-live", String(nodeOption.ariaLive));
            delete nodeOption.ariaLive;
        }
        if (nodeOption.ariaLabelledby) {
            element_creation.setAttribute("aria-labelledby", String(nodeOption.ariaLabelledby));
            delete nodeOption.ariaLabelledby;
        }
        if (nodeOption.ariaControls) {
            element_creation.setAttribute("aria-controls", String(nodeOption.ariaControls));
            delete nodeOption.ariaControls;
        }
        if (nodeOption.ariaHaspopup) {
            element_creation.setAttribute("aria-haspopup", String(nodeOption.ariaHaspopup));
            delete nodeOption.ariaHaspopup;
        }
        if (nodeOption.ariaMultiselectable) {
            element_creation.setAttribute("aria-multiselectable", String(nodeOption.ariaMultiselectable));
            delete nodeOption.ariaMultiselectable;
        }
        if (nodeOption.ariaAutocomplete) {
            element_creation.setAttribute("aria-autocomplete", String(nodeOption.ariaAutocomplete));
            delete nodeOption.ariaAutocomplete;
        }

        if (nodeOption.event && typeof nodeOption.event === "object") {
            Object.entries(nodeOption.event as Record<string, EventListener>).forEach(([key, value]) => {
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
     * Recursively builds DOM nodes from a specification object, appends/prepends them
     * to an optional parent, and returns either a tag map or a full MountViewResult.
     *
     * @template TTags
     * @param {Object<string, any>} rawObj - Node spec (keys -> { tag, child }).
     * @param {HTMLElement|null} [parentE=null] - Parent to attach into; if null, returns root.
     * @param {boolean} [isPrepend=false] - If true, prepend; otherwise append.
     * @param {boolean} [isRecusive=false] - Internal flag for recursion control.
     * @param {TTags|Object} [recursiveTemp={}] - Accumulator for tag references.
     * @returns {TTags} - Tag map or the final mount result.
     */
    public static mountNode<TTags extends Record<string, any>>(
        rawObj: Record<string, any>,
        parentE: HTMLElement | null = null,
        isPrepend = false,
        isRecusive = false,
        recursiveTemp: any = {}
    ): TTags {
        let view: HTMLElement | null = null;

        for (const key in rawObj) {
            const singleObj = rawObj[key];
            const tag: HTMLElement =
                singleObj?.tag?.tagName ? (singleObj.tag as HTMLElement) : (this.nodeCreator(singleObj.tag) as HTMLElement);

            recursiveTemp[key] = tag;

            if (singleObj?.child) this.mountNode<TTags>(singleObj.child, tag, false, false, recursiveTemp);

            if (parentE) {
                if (isPrepend) parentE.prepend(tag);
                else parentE.append(tag);
            } else if (!isRecusive && !view) {
                view = tag;
            }
        }

        if (!isRecusive) {
            recursiveTemp.id = this.randomString(7);
            if (!parentE) {
                recursiveTemp = { tags: recursiveTemp, view };
            }
        }

        return recursiveTemp;
    }

    /**
     * Builds a configuration object by copying defaults and then overriding with
     * matching element properties or data-* attributes when present.
     *
     * @param {HTMLElement} element - Source element providing overrides.
     * @param {SelectiveOptions} options - Default configuration to be merged.
     * @returns {SelectiveOptions} - Final configuration after element overrides.
     */
    public static buildConfig(element: HTMLElement, options: SelectiveOptions): SelectiveOptions {
        const myOptions = this.jsCopyObject<SelectiveOptions>(options);

        for (const optionKey in myOptions) {
            const propValue = element[optionKey];
            if (propValue) {
                if (typeof myOptions[optionKey] === "boolean") {
                    myOptions[optionKey] = this.string2Boolean(propValue);
                }
                else {
                    myOptions[optionKey] = propValue;
                }
            } else if (typeof element?.dataset?.[optionKey] !== "undefined") {
                if (typeof myOptions[optionKey] === "boolean") {
                    myOptions[optionKey] = this.string2Boolean(element.dataset[optionKey]);
                } else {
                    myOptions[optionKey] = element.dataset[optionKey];
                }
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
    public static mergeConfig<T extends Record<string, any>>(...params: T[]): T {
        if (params.length === 0) return {} as T;
        if (params.length === 1) return this.jsCopyObject(params[0]);

        const level0 = this.jsCopyObject(params[0]);

        for (let index = 1; index < params.length; index++) {
            const cfg = params[index];
            for (const optionKey in cfg) {
                if (optionKey === "on") {
                    const cfgVar = cfg[optionKey];
                    for (const actKey in cfgVar) {
                        // Keep original behavior (push), do not change semantics.
                        level0[optionKey][actKey].push(cfgVar[actKey]);
                    }
                } else {
                    level0[optionKey] = cfg[optionKey];
                }
            }
        }

        return level0;
    }

    /**
     * Converts strings like "true", "1", "yes", "on" to boolean true; "false", "0",
     * "no", "off" to false. Non-strings are coerced via Boolean().
     *
     * @param {unknown} str - String or any value to convert.
     * @returns {boolean} - The normalized boolean.
     */
    public static string2Boolean(str: unknown): boolean {
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
     * @param {HTMLElement} element - HTMLElement key to remove from the binder map.
     * @returns {boolean} - True if an entry existed and was removed.
     */
    public static removeBinderMap(element: HTMLElement): boolean {
        return this.iStorage.bindedMap.delete(element);
    }

    /**
     * Retrieves the binder map entry associated with the given element.
     *
     * @param {HTMLElement} item - HTMLElement key whose binder map is requested.
     * @returns {BinderMap | any} - The stored binder map value or undefined if absent.
     */
    public static getBinderMap<T extends BinderMap | any>(item: HTMLElement): T {
        return this.iStorage.bindedMap.get(item) as T;
    }

    /**
     * Sets or updates the binder map entry for a given element.
     *
     * @param {HTMLElement} item - HTMLElement key to associate with the binder map.
     * @param {BinderMap} bindMap - Value to store in the binder map.
     */
    public static setBinderMap(item: HTMLElement, bindMap: BinderMap): void {
        this.iStorage.bindedMap.set(item, bindMap);
    }

    /**
     * Removes an unbinder map entry for the given element from the global storage.
     *
     * @param {HTMLElement} element - HTMLElement key to remove from the unbinder map.
     * @returns {boolean} - True if an entry existed and was removed.
     */
    public static removeUnbinderMap(element: HTMLElement): boolean {
        return this.iStorage.unbindedMap.delete(element);
    }

    /**
     * Retrieves the unbinder map entry associated with the given element.
     *
     * @param {HTMLElement} item - HTMLElement key whose unbinder map is requested.
     * @returns {unknown} - The stored unbinder map value or undefined if absent.
     */
    public static getUnbinderMap(item: HTMLElement): unknown {
        return this.iStorage.unbindedMap.get(item);
    }

    /**
     * Sets or updates the unbinder map entry for a given element.
     *
     * @param {HTMLElement} item - HTMLElement key to associate with the unbinder map.
     * @param {BinderMap} bindMap - Value to store in the unbinder map.
     */
    public static setUnbinderMap(item: HTMLElement, bindMap: BinderMap): void {
        this.iStorage.unbindedMap.set(item, bindMap);
    }

    /**
     * Returns the global default configuration used by the Selective UI system.
     *
     * @returns {object} - The default config object.
     */
    public static getDefaultConfig(): unknown {
        return this.iStorage.defaultConfig;
    }

    /**
     * Returns the global list of bound commands stored in the shared storage.
     *
     * @returns {string[]} - The bound command list.
     */
    public static getBindedCommand(): string[] {
        return this.iStorage.bindedCommand;
    }

    /**
     * Safely translates an HTML-like string to sanitized markup.
     *
     * @param {string} str_tag - The input string to sanitize/translate.
     * @returns {string} - Safe innerHTML string.
     */
    public static tagTranslate(str_tag: unknown): string {
        if (str_tag == null) return "";

        let s = String(str_tag)
            .replace(/<`/g, "<")
            .replace(/`>/g, ">")
            .replace(/\<\`/g, "<")
            .replace(/\`\>/g, ">")
            .trim();

        const doc = globalThis?.document;

        if (!doc || typeof doc.createElement !== "function") {
            s = s
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
                .replace(/<(object|embed|link)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
            s = s.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
            s = s.replace(/\s([a-z-:]+)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "");
            return s;
        }

        const tmp = doc.createElement("div");
        tmp.innerHTML = s;

        tmp.querySelectorAll("script, style, iframe, object, embed, link").forEach((n) => n.remove());

        tmp.querySelectorAll("*").forEach((n) => {
            for (const a of Array.from(n.attributes)) {
                const name = a.name ?? "";
                const value = a.value ?? "";
    
                if (/^on/i.test(name)) {
                    n.removeAttribute(name);
                    return;
                }
    
                if (/^(href|src|xlink:href)$/i.test(name) && /^javascript:/i.test(value)) {
                    n.removeAttribute(name);
                }
            }
        });

        return (tmp.innerHTML ?? "").trim();
    }

    /**
     * Strips all HTML from a string and returns trimmed plain text.
     *
     * @param {string} html - The HTML string to strip.
     * @returns {string} - The extracted plain text.
     */
    public static stripHtml(html: string): string {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        const text_tmp = tmp.textContent ?? tmp.innerText ?? "";
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
    public static string2normalize(str: unknown): string {
        if (str == null) return "";
        const s = String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.replace(/đ/g, "d").replace(/Đ/g, "d");
    }

    /**
     * Flattens a `<select>` element into an ordered array that includes optgroups
     * and their child options.
     *
     * Notes:
     * - Keeps original DOM order.
     * - Adds a non-standard `__parentGroup` pointer on options inside optgroups.
     *
     * @param {HTMLSelectElement} selectElement - The source select element.
     * @returns {Array<HTMLOptGroupElement | HTMLOptionElement>} Flattened node list.
     */
    public static parseSelectToArray(selectElement: HTMLSelectElement): Array<HTMLOptGroupElement | HTMLOptionElement> {
        const result: Array<HTMLOptGroupElement | HTMLOptionElement> = [];
        const children = selectElement.children;

        for (let childIndex = 0; childIndex < children.length; childIndex++) {
            const child = children[childIndex];
            if (child.tagName === "OPTGROUP") {
                const group = child as HTMLOptGroupElement;
                result.push(group);

                for (let optionIndex = 0; optionIndex < group.children.length; optionIndex++) {
                    const option = group.children[optionIndex];
                    option["__parentGroup"] = group;
                    result.push(option as HTMLOptionElement);
                };
            } else if (child.tagName === "OPTION") {
                result.push(child as HTMLOptionElement);
            }
        };

        return result;
    }

    /**
     * Detects whether the current environment is iOS (including iPad/iPhone/iPod, iOS browsers,
     * iPadOS on Mac with touch, standalone PWAs, and WebKit mobile heuristics).
     *
     * @returns {boolean} - True if the user agent/platform appears to be iOS; otherwise false.
     */
    public static IsIOS(): boolean {
        const ua = navigator.userAgent;
        return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    /**
     * Converts an arbitrary CSS size value into pixel units by measuring a temporary element.
     * Returns the computed pixel height as a string with "px" suffix.
     *
     * @param {string} value - Any valid CSS size (e.g., "2rem", "5vh", "12pt").
     * @returns {string} - The equivalent pixel value (e.g., "32px").
     */
    public static any2px(value: string): string {
        const v = String(value).trim();
        if (v.endsWith("px")) return v;
        if (v.endsWith("vh")) return (window.innerHeight * parseFloat(v)) / 100 + "px";
        if (v.endsWith("vw")) return (window.innerWidth * parseFloat(v)) / 100 + "px";

        // rem/em: use computed font-size of document root
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (v.endsWith("rem")) return fs * parseFloat(v) + "px";

        // fallback: DOM measure
        const el = this.nodeCreator({ node: "div", style: { height: v, opacity: "0" } });
        document.body.appendChild(el);
        const px = el.offsetHeight + "px";
        el.remove();
        return px;
    }
}