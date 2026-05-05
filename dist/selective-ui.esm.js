/*! Selective UI v1.4.1 | MIT License */
/**
 * @class
 */
class iStorage {
    constructor() {
        this.defaultConfig = {
            accessoryVisible: true,
            virtualScroll: true,
            accessoryStyle: "top",
            multiple: false,
            minWidth: "50px",
            width: "0px",
            offsetWidth: null,
            minHeight: "30px",
            height: "30px",
            panelHeight: "220px",
            panelMinHeight: "100px",
            disabled: false,
            readonly: false,
            selectall: true,
            keepSelected: true,
            placeholder: "Select value",
            altMask: "",
            autoclose: false,
            autoscroll: true,
            autofocus: true,
            searchable: true,
            loadingfield: true,
            preload: false,
            visible: true,
            skipError: false,
            customDelimiter: ",",
            textLoading: "Processing...",
            textNoData: "No data available",
            textNotFound: "Not found",
            textSelectAll: "Select all",
            textDeselectAll: "Deselect all",
            textAccessoryDeselect: "Deselect: ",
            animationtime: 200, // milliseconds
            delaysearchtime: 200, // milliseconds
            allowHtml: false,
            maxSelected: 0,
            labelHalign: "left",
            labelValign: "center",
            imageMode: false,
            imageWidth: "60px",
            imageHeight: "60px",
            imageBorderRadius: "4px",
            imagePosition: "right",
            ajax: null,
            on: {
                load: [],
                beforeShow: [],
                show: [],
                beforeChange: [],
                change: [],
                beforeClose: [],
                close: [],
            },
        };
        /** Bound instance map (keyed by select element). */
        this.bindedMap = new Map();
        /** Unbind cache map (keyed by select element). */
        this.unbindedMap = new Map();
        /** List of bound selectors/commands. */
        this.bindedCommand = [];
    }
}

/**
 * CallbackScheduler
 *
 * Debounced multi-callback orchestrator with per-callback independent scheduling.
 *
 * ### Responsibility
 * - Registers multiple callbacks under named keys ({@link TimerKey}).
 * - Schedules each callback with its own debounce timer (independent delays per callback).
 * - Supports "run-once" semantics via `options.once`.
 * - Batches callback execution via {@link run}, passing a shared payload to all callbacks in a key group.
 *
 * ### Scheduling strategy
 * - **Per-callback debounce**: Each registered callback has its own timer (tracked by index).
 * - **Debounce reset**: Calling {@link run} again before a callback's timeout clears its previous timer.
 * - **Async-aware**: Callbacks may return `Promise`; execution waits for resolution before cleanup.
 *
 * ### Lifecycle
 * - **{@link on}**: Registers a callback under a key (appends to bucket in registration order).
 * - **{@link run}**: Schedules all non-removed callbacks under a key with independent timers.
 * - **{@link off}** / **{@link clear}**: Cancels active timers and removes callbacks.
 *
 * ### Index stability
 * - Callbacks are stored in a sparse array (via `Array<StoredEntry | undefined>`).
 * - "Once" callbacks become `undefined` after execution but **do not shift indices**.
 * - This preserves timer bookkeeping in {@link timerRunner}.
 *
 * ### Payload semantics
 * - `run(key)` → callbacks receive `null`
 * - `run(key, ...params)` → callbacks receive `params` as an array
 *
 * ### No-op / Idempotency
 * - {@link run} with no registered callbacks returns a resolved `Promise<void>`.
 * - {@link off} and {@link clear} are safe to call multiple times (clear timers only if present).
 *
 * @class
 */
class CallbackScheduler {
    constructor() {
        /**
         * Sparse array storage for callbacks, keyed by {@link TimerKey}.
         *
         * Structure:
         * - Each key maps to an ordered array of {@link StoredEntry} or `undefined`.
         * - `undefined` slots indicate "once" callbacks that have already executed.
         * - Indices are never removed to preserve timer bookkeeping stability.
         *
         * @private
         */
        this.executeStored = new Map();
        /**
         * Per-callback timer registry.
         *
         * Structure:
         * - **Outer Map**: Groups timers by {@link TimerKey}.
         * - **Inner Map**: Maps callback index → active `setTimeout` handle.
         *
         * Notes:
         * - Each callback index has its own independent debounce timer.
         * - Timers are cleared and replaced on subsequent {@link run} calls.
         * - Cleaned up during {@link off} or after "once" callback execution.
         *
         * @private
         */
        this.timerRunner = new Map();
    }
    /**
     * Registers a callback under a key with optional debounce and "once" semantics.
     *
     * Behavior:
     * - Callbacks are appended to the key's bucket in registration order.
     * - Each callback receives its own debounce timer (default: `50ms`).
     * - `options.once = true` removes the callback after its first execution (slot becomes `undefined`).
     *
     * Notes:
     * - Multiple callbacks under the same key execute independently with separate timers.
     * - Registration does **not** start any timers; call {@link run} to schedule execution.
     *
     * @public
     * @param {TimerKey} key - Group identifier for callbacks.
     * @param {(payload?: any[]) => void} callback - Function to execute after debounce timeout.
     * @param {TimerOptions} [options={}] - Scheduling options (`debounce`, `once`).
     * @returns {void}
     */
    on(key, callback, options = {}) {
        const timeout = options.debounce ?? 50;
        const once = options.once ?? false;
        if (!this.executeStored.has(key))
            this.executeStored.set(key, []);
        const bucket = this.executeStored.get(key);
        bucket.push({ callback, timeout, once });
    }
    /**
     * Removes all callbacks and active timers associated with a key.
     *
     * Behavior:
     * - Clears all pending timers for the key (prevents stale executions).
     * - Deletes the key's callback bucket and timer registry.
     * - Idempotent: safe to call multiple times or on non-existent keys.
     *
     * @public
     * @param {TimerKey} key - Key whose callbacks and timers will be removed.
     * @returns {void}
     */
    off(key) {
        const runner = this.timerRunner.get(key);
        if (runner) {
            for (const t of runner.values())
                clearTimeout(t);
            runner.clear();
            this.timerRunner.delete(key);
        }
        this.executeStored.delete(key);
    }
    /**
     * Schedules execution for all registered callbacks under a key.
     *
     * Scheduling rules:
     * - Each callback runs after its own debounce delay (independent timers per index).
     * - Calling `run()` again before a callback's timeout **clears and resets** that timer.
     * - Callbacks receive a shared payload derived from `params`.
     *
     * Payload semantics:
     * - `run(key)` → callbacks receive `null`
     * - `run(key, ...params)` → callbacks receive `params` as an array
     *
     * "Once" callbacks:
     * - After execution, entries with `once = true` are set to `undefined` (index preserved).
     * - Their timers are deleted from {@link timerRunner}.
     *
     * Async handling:
     * - If a callback returns a `Promise`, execution waits for resolution before cleanup.
     * - Errors are silently caught (empty `catch` block).
     *
     * Return value:
     * - Returns a `Promise<void>` that resolves when all scheduled callbacks complete.
     * - If no callbacks are registered, returns an immediately resolved `Promise<void>`.
     *
     * @public
     * @param {TimerKey} key - Key whose callbacks will be scheduled.
     * @param {...any[]} params - Parameters passed as a shared payload to all callbacks.
     * @returns {Promise<void>} Promise resolving when all callbacks finish execution.
     */
    run(key, ...params) {
        const executes = this.executeStored.get(key);
        if (!executes || executes.length === 0) {
            return Promise.resolve();
        }
        if (!this.timerRunner.has(key)) {
            this.timerRunner.set(key, new Map());
        }
        const runner = this.timerRunner.get(key);
        const tasks = [];
        for (let i = 0; i < executes.length; i++) {
            const entry = executes[i];
            if (!entry)
                continue;
            const prev = runner.get(i);
            if (prev)
                clearTimeout(prev);
            const task = new Promise((resolve) => {
                const timer = setTimeout(async () => {
                    try {
                        const resp = entry.callback(params.length > 0 ? params : null);
                        if (resp instanceof Promise) {
                            await resp;
                        }
                    }
                    catch {
                    }
                    finally {
                        if (entry.once) {
                            executes[i] = undefined;
                            const current = runner.get(i);
                            if (current)
                                clearTimeout(current);
                            runner.delete(i);
                        }
                        resolve();
                    }
                }, entry.timeout);
                runner.set(i, timer);
            });
            tasks.push(task);
        }
        return Promise.all(tasks).then(() => void 0);
    }
    /**
     * Clears callbacks and timers for a specific key or all keys.
     *
     * Behavior:
     * - **With `key`**: Delegates to {@link off} (clears only that key).
     * - **Without `key`**: Clears all keys by iterating over a snapshot of {@link executeStored}.
     *
     * Notes:
     * - Uses a snapshot (`Array.from(...)`) to avoid mutation issues during iteration.
     * - Idempotent: safe to call multiple times.
     *
     * @public
     * @param {TimerKey} [key] - When provided, clears only that key; otherwise clears all keys.
     * @returns {void}
     */
    clear(key) {
        if (key !== undefined) {
            this.off(key);
            return;
        }
        // Iterate over a snapshot of keys because `off()` mutates the maps.
        for (const k of Array.from(this.executeStored.keys())) {
            this.off(k);
        }
    }
}

/**
 * @class
 */
class Libs {
    /**
     * Retrieves the shared iStorage instance (lazy-initialized singleton).
     *
     * @returns {iStorage} - The global storage utility used by Libs.
     */
    static get iStorage() {
        if (!this._iStorage)
            this._iStorage = new iStorage();
        return this._iStorage;
    }
    /**
     * Deep-copies plain objects/arrays recursively. Returns primitives as-is.
     *
     * @param {T} obj - The source object or array.
     * @returns {T} - A deep-cloned copy.
     */
    static jsCopyObject(obj) {
        if (obj === null || typeof obj !== "object")
            return obj;
        const copy = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
    static getElements(queryCommon) {
        if (!queryCommon)
            return [];
        if (typeof queryCommon === "string") {
            const nodeList = document.querySelectorAll(queryCommon);
            return Array.from(nodeList);
        }
        if (queryCommon instanceof HTMLElement) {
            return [queryCommon];
        }
        // NodeList or array-like
        if (queryCommon instanceof NodeList || Array.isArray(queryCommon)) {
            return Array.from(queryCommon);
        }
        return [];
    }
    /**
     * Creates a new HTMLElement based on a NodeSpec and applies attributes, classes, styles, dataset, and events.
     *
     * @param {NodeSpec} data - Specification describing the element to create.
     * @returns {HTMLElement} - The created element.
     */
    static nodeCreator(data = {}) {
        const nodeName = (data.node ?? "div");
        return this.nodeCloner(document.createElement(nodeName), data, true);
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
    static nodeCloner(node = document.documentElement, _nodeOption, systemNodeCreate = false) {
        const nodeOption = { ...(_nodeOption ?? {}) };
        const element_creation = systemNodeCreate
            ? node
            : node.cloneNode(true);
        const classList = nodeOption.classList;
        if (typeof classList === "string") {
            element_creation.classList.add(classList);
        }
        else if (Array.isArray(classList)) {
            element_creation.classList.add(...classList);
        }
        delete nodeOption.classList;
        ["style", "dataset"].forEach((property) => {
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
            Object.entries(nodeOption.event).forEach(([key, value]) => {
                element_creation.addEventListener(key, value);
            });
            delete nodeOption.event;
        }
        Object.entries(nodeOption).forEach(([key, value]) => {
            if (value === null) {
                element_creation.removeAttribute(key);
            }
            else {
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
    static mountNode(rawObj, parentE, isPrepend = false, isRecusive = false, recursiveTemp = {}) {
        let view = null;
        for (const key in rawObj) {
            const singleObj = rawObj[key];
            const tag = singleObj?.tag?.tagName
                ? singleObj.tag
                : this.nodeCreator(singleObj.tag);
            recursiveTemp[key] = tag;
            if (singleObj?.child)
                this.mountNode(singleObj.child, tag, false, false, recursiveTemp);
            if (parentE) {
                if (isPrepend)
                    parentE.prepend(tag);
                else
                    parentE.append(tag);
            }
            else if (!isRecusive && !view) {
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
    static buildConfig(element, options) {
        const myOptions = this.jsCopyObject(options);
        for (const optionKey in myOptions) {
            const propValue = element[optionKey];
            if (propValue) {
                if (typeof myOptions[optionKey] === "boolean") {
                    myOptions[optionKey] = this.string2Boolean(propValue);
                }
                else {
                    myOptions[optionKey] = propValue;
                }
            }
            else if (typeof element?.dataset?.[optionKey] !== "undefined") {
                if (typeof myOptions[optionKey] === "boolean") {
                    myOptions[optionKey] = this.string2Boolean(element.dataset[optionKey]);
                }
                else {
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
    static mergeConfig(...params) {
        if (params.length === 0)
            return {};
        if (params.length === 1)
            return this.jsCopyObject(params[0]);
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
                }
                else {
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
    static string2Boolean(str) {
        if (typeof str === "boolean")
            return str;
        if (typeof str !== "string")
            return Boolean(str);
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
    static removeBinderMap(element) {
        return this.iStorage.bindedMap.delete(element);
    }
    /**
     * Retrieves the binder map entry associated with the given element.
     *
     * @param {HTMLElement} item - HTMLElement key whose binder map is requested.
     * @returns {BinderMap | any} - The stored binder map value or undefined if absent.
     */
    static getBinderMap(item) {
        return this.iStorage.bindedMap.get(item);
    }
    /**
     * Sets or updates the binder map entry for a given element.
     *
     * @param {HTMLElement} item - HTMLElement key to associate with the binder map.
     * @param {BinderMap} bindMap - Value to store in the binder map.
     */
    static setBinderMap(item, bindMap) {
        this.iStorage.bindedMap.set(item, bindMap);
    }
    /**
     * Removes an unbinder map entry for the given element from the global storage.
     *
     * @param {HTMLElement} element - HTMLElement key to remove from the unbinder map.
     * @returns {boolean} - True if an entry existed and was removed.
     */
    static removeUnbinderMap(element) {
        return this.iStorage.unbindedMap.delete(element);
    }
    /**
     * Retrieves the unbinder map entry associated with the given element.
     *
     * @param {HTMLElement} item - HTMLElement key whose unbinder map is requested.
     * @returns {unknown} - The stored unbinder map value or undefined if absent.
     */
    static getUnbinderMap(item) {
        return this.iStorage.unbindedMap.get(item);
    }
    /**
     * Sets or updates the unbinder map entry for a given element.
     *
     * @param {HTMLElement} item - HTMLElement key to associate with the unbinder map.
     * @param {BinderMap} bindMap - Value to store in the unbinder map.
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
     * @returns {string[]} - The bound command list.
     */
    static getBindedCommand() {
        return this.iStorage.bindedCommand;
    }
    /**
     * Safely translates an HTML-like string to sanitized markup.
     *
     * @param {string} str_tag - The input string to sanitize/translate.
     * @returns {string} - Safe innerHTML string.
     */
    static tagTranslate(str_tag) {
        if (str_tag == null)
            return "";
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
                if (/^(href|src|xlink:href)$/i.test(name) &&
                    /^javascript:/i.test(value)) {
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
    static stripHtml(html) {
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
    static string2normalize(str) {
        if (str == null)
            return "";
        const s = String(str)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
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
    static parseSelectToArray(selectElement) {
        const result = [];
        const children = selectElement.children;
        for (let childIndex = 0; childIndex < children.length; childIndex++) {
            const child = children[childIndex];
            if (child.tagName === "OPTGROUP") {
                const group = child;
                result.push(group);
                for (let optionIndex = 0; optionIndex < group.children.length; optionIndex++) {
                    const option = group.children[optionIndex];
                    option["__parentGroup"] = group;
                    result.push(option);
                }
            }
            else if (child.tagName === "OPTION") {
                result.push(child);
            }
        }
        return result;
    }
    /**
     * Detects whether the current environment is iOS (including iPad/iPhone/iPod, iOS browsers,
     * iPadOS on Mac with touch, standalone PWAs, and WebKit mobile heuristics).
     *
     * @returns {boolean} - True if the user agent/platform appears to be iOS; otherwise false.
     */
    static IsIOS() {
        const ua = navigator.userAgent;
        return (/iP(hone|ad|od)/.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
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
        if (v.endsWith("px"))
            return v;
        if (v.endsWith("vh"))
            return (window.innerHeight * parseFloat(v)) / 100 + "px";
        if (v.endsWith("vw"))
            return (window.innerWidth * parseFloat(v)) / 100 + "px";
        // rem/em: use computed font-size of document root
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (v.endsWith("rem"))
            return fs * parseFloat(v) + "px";
        // fallback: DOM measure
        const el = this.nodeCreator({
            node: "div",
            style: { height: v, opacity: "0" },
        });
        document.body.appendChild(el);
        const px = el.offsetHeight + "px";
        el.remove();
        return px;
    }
}
/**
 * Schedules and batches function executions keyed by name, with debounced timers.
 * Provides setExecute(), clearExecute(), and run() to manage deferred callbacks.
 */
Libs.callbackScheduler = new CallbackScheduler();

/**
 * iEvents
 *
 * Lightweight event utility that standardizes a "token-controlled" handler pipeline and
 * provides small helpers for DOM dispatch and batch-calling functions.
 *
 * The core idea is a **shared event token** passed to handlers via a controller callback:
 * - `stopPropagation()` stops invoking subsequent handlers (pipeline short-circuit).
 * - `cancel()` marks the token as canceled and also stops propagation.
 *
 * ### Responsibility
 * - Create a per-dispatch control token via {@link buildEventToken}.
 * - Execute handlers sequentially with short-circuit rules via {@link callEvent}.
 * - Dispatch native DOM events via {@link trigger}.
 * - Execute an array of functions safely (skip non-functions) via {@link callFunctions}.
 *
 * ### Lifecycle / Idempotency
 * - Pure static utility: no instance state, no lifecycle.
 * - {@link callFunctions} is tolerant/no-op when `funcs` is not an array.
 * - {@link callEvent} is tolerant/no-op for non-function entries in `handles`.
 *
 * ### Event / Hook Flow
 * {@link callEvent}:
 * 1) {@link buildEventToken} → `(token, callback)`
 * 2) Iterate handlers in order:
 *    handler(callback, ...params?)
 *    → if `token.isCancel === true` OR `token.isContinue === false`, stop iterating
 * 3) Return `token` to the caller for inspection.
 *
 * ### Control semantics (important)
 * - **Continue (token.isContinue)**: defaults to `true`. Set to `false` by `stopPropagation()` or `cancel()`.
 * - **Cancel (token.isCancel)**: defaults to `false`. Set to `true` only by `cancel()`.
 * - `cancel()` implies `stopPropagation()` (i.e., cancels and stops further handlers).
 *
 * ### DOM / Side-effect Notes
 * - {@link trigger} creates a new native {@link Event} and dispatches it on the provided target.
 * - {@link callEvent} and {@link callFunctions} do not touch the DOM; they only call functions.
 *
 * @see {@link IEventToken}
 * @see {@link IEventCallback}
 */
class iEvents {
    /**
     * Creates a new event token and its controller callback.
     *
     * ### Purpose
     * - The returned `token` is **read-only** (via getters) from the handler perspective.
     * - The returned `callback` is the only way to mutate internal token state.
     *
     * ### Token rules
     * - Starts with `{ isContinue: true, isCancel: false }`.
     * - `callback.stopPropagation()` → `isContinue = false`.
     * - `callback.cancel()` → `isCancel = true` and `isContinue = false`.
     *
     * @returns An object containing:
     * - `token`: immutable view of the dispatch state.
     * - `callback`: controller passed into handlers to modify dispatch flow.
     */
    static buildEventToken() {
        const privToken = { isContinue: true, isCancel: false };
        const token = {
            get isContinue() {
                return privToken.isContinue;
            },
            get isCancel() {
                return privToken.isCancel;
            },
        };
        const callback = {
            stopPropagation() {
                privToken.isContinue = false;
            },
            cancel() {
                privToken.isCancel = true;
                privToken.isContinue = false;
            },
        };
        return { token, callback };
    }
    /**
     * Invokes event handlers sequentially (in-order) with a shared control callback.
     *
     * Handlers are invoked until:
     * - A handler calls `callback.stopPropagation()` (sets `token.isContinue = false`), or
     * - A handler calls `callback.cancel()` (sets `token.isCancel = true` and stops propagation), or
     * - The handler list is exhausted.
     *
     * ### Parameter passing
     * - If `params` is a non-null array, each handler is called as: `handler(callback, ...params)`.
     * - Otherwise, handlers are called as: `handler(callback)`.
     *
     * ### Tolerance behavior
     * - Non-function entries in `handles` are skipped (no-ops).
     *
     * @template TParams - Tuple type representing the extra handler parameters.
     * @param params - Optional tuple of parameters forwarded to handlers; pass `null` to send no params.
     * @param handles - List of handlers (or unknown entries; non-functions are ignored).
     * @returns The {@link IEventToken} describing the final dispatch state.
     */
    static callEvent(params, ...handles) {
        const { token, callback } = this.buildEventToken();
        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];
            if (typeof handle !== "function")
                continue;
            if (params && Array.isArray(params)) {
                handle(callback, ...params);
            }
            else {
                handle(callback);
            }
            if (token.isCancel || !token.isContinue)
                break;
        }
        return token;
    }
    /**
     * Dispatches a native DOM {@link Event} on the provided target.
     *
     * ### Side effects
     * - Creates a new `Event(eventType, opts)` and synchronously dispatches it via `dispatchEvent`.
     *
     * @param element - Dispatch target (`HTMLElement`, `Window`, or `Document`).
     * @param eventType - Event type string (e.g., `"change"`, `"input"`, `"scroll"`).
     * @param opts - Standard {@link EventInit} options (defaults to `{ bubbles: true, cancelable: true }`).
     * @returns The created and dispatched {@link Event} instance.
     */
    static trigger(element, eventType, opts = { bubbles: true, cancelable: true }) {
        const evt = new Event(eventType, opts);
        element.dispatchEvent(evt);
        return evt;
    }
    /**
     * Executes a list of functions in-order with the provided parameters.
     *
     * ### Tolerance behavior
     * - No-ops if `funcs` is not an array.
     * - Skips non-function entries.
     *
     * @template TParams - Tuple type of the arguments passed to each function.
     * @param funcs - Array of functions (or unknown entries; non-functions are ignored).
     * @param params - Arguments forwarded to each function.
     */
    static callFunctions(funcs, ...params) {
        if (!Array.isArray(funcs))
            return;
        for (const fn of funcs) {
            if (typeof fn !== "function")
                continue;
            fn(...params);
        }
    }
}

/**
 * Refresher
 *
 * Small DOM utility responsible for synchronizing the rendered Select UI container size
 * with the bound native `<select>` element and its configured sizing constraints.
 *
 * ### Responsibility
 * - Read sizing configuration from the select's binder map (`Libs.getBinderMap(select).options`).
 * - Derive width/height from either:
 *   - explicit `options.width` / `options.height` when provided, or
 *   - the select element's current rendered size (`offsetWidth/offsetHeight`) with a computed-style fallback.
 * - Apply the resolved `width/height` plus `minWidth/minHeight` constraints to the view panel element.
 *
 * ### DOM side effects
 * - Mutates `view.style` (`width`, `height`, `minWidth`, `minHeight`) via `Object.assign`.
 *
 * ### No-op behavior
 * - If the select is not bound (missing binder map or options), this utility does nothing.
 */
class Refresher {
    /**
     * Updates the view panel size to match the source `<select>` and configuration options.
     *
     * Resolution order:
     * 1) Start from `select.offsetWidth/offsetHeight`.
     * 2) If offsets are `0px` and computed styles are not `"auto"`, fall back to computed `width/height`.
     * 3) If `options.width/options.height` parse as positive integers, use those explicit values instead.
     * 4) Apply `minWidth/minHeight` constraints from options.
     *
     * Notes:
     * - `options.width/options.height` are treated as CSS strings, but are considered "enabled"
     *   only when `parseInt(..., 10) > 0`.
     *
     * @param select - Native `<select>` element used as the sizing reference and option source.
     * @param view - View panel element whose inline styles will be updated.
     */
    static resizeBox(select, view) {
        const bindedMap = Libs.getBinderMap(select);
        if (!bindedMap?.options)
            return;
        const options = bindedMap.options;
        const minWidth = options.minWidth;
        const minHeight = options.minHeight;
        const cfgWidth = Number.parseInt(options.width, 10);
        const cfgHeight = Number.parseInt(options.height, 10);
        let width = `${select.offsetWidth}px`;
        let height = `${select.offsetHeight}px`;
        const cstyle = getComputedStyle(select);
        if (width === "0px" && cstyle.width !== "auto")
            width = cstyle.width;
        if (height === "0px" && cstyle.height !== "auto")
            height = cstyle.height;
        if (cfgWidth > 0)
            width = options.width;
        if (cfgHeight > 0)
            height = options.height;
        Object.assign(view.style, { width, height, minWidth, minHeight });
    }
}

/**
 * Enumerates the finite lifecycle states used across core classes (e.g., View/Model).
 *
 * State flow (happy path):
 * NEW → INITIALIZED → MOUNTED → UPDATED → DESTROYED
 *
 * Notes:
 * - `UPDATED` may be emitted multiple times after mount, depending on implementation.
 * - `DESTROYED` is terminal; no further transitions should occur.
 */
var LifecycleState;
(function (LifecycleState) {
    /** The instance has been created but not initialized. */
    LifecycleState["NEW"] = "new";
    /** Initialization logic has completed; ready to be mounted. */
    LifecycleState["INITIALIZED"] = "initialized";
    /** The instance is mounted/attached to its environment (e.g., DOM). */
    LifecycleState["MOUNTED"] = "mounted";
    /**
     * The instance has been updated at least once after being mounted.
     * Further updates typically keep the state at UPDATED.
     */
    LifecycleState["UPDATED"] = "updated";
    /** Teardown has run; resources/hooks have been released. */
    LifecycleState["DESTROYED"] = "destroyed";
})(LifecycleState || (LifecycleState = {}));

/**
 * Minimal lifecycle finite-state machine (FSM) with a lightweight hook system.
 *
 * ### Responsibility
 * - Provide a **strict**, **guarded** lifecycle FSM:
 *   `NEW → INITIALIZED → MOUNTED → UPDATED → DESTROYED`
 * - Provide an in-memory hook registry to observe lifecycle transitions:
 *   `onInit`, `onMount`, `onUpdate`, `onDestroy`
 *
 * This class is designed to be extended by core primitives (Model/View/Adapter/Controller)
 * so they share consistent lifecycle semantics without coupling to any rendering runtime.
 *
 * ### FSM & Idempotency
 * - `init()` is **idempotent**: only transitions `NEW → INITIALIZED`; otherwise **no-op**.
 * - `mount()` is **guarded**: only transitions `INITIALIZED → MOUNTED`; otherwise **no-op**.
 * - `update()` is **repeatable** once mounted: allowed in `MOUNTED` and `UPDATED`.
 *   It always emits `onUpdate` and keeps state at `UPDATED`.
 * - `destroy()` is **idempotent**: once `DESTROYED`, subsequent calls are **no-op**.
 *
 * ### Hook semantics
 * - Hooks are stored in a `Set` per hook name:
 *   - de-duplicates identical callback references,
 *   - preserves insertion order for deterministic execution.
 * - Hook callbacks receive a {@link LifecycleHookContext} containing:
 *   - `state` (current state after transition),
 *   - `prevState` (state prior to the transition).
 * - Hook exceptions are caught and forwarded to {@link handleHookError},
 *   preventing a single subscriber from breaking the lifecycle flow.
 *
 * ### Memory & teardown
 * - All registered hooks are cleared on `destroy()` via {@link clearHooks}.
 * - Post-destroy calls to lifecycle methods do not emit further hooks.
 *
 * @see {@link LifecycleState}
 * @see {@link LifecycleHooks}
 * @see {@link LifecycleHookContext}
 */
class Lifecycle {
    /**
     * Constructs the lifecycle manager and pre-registers hook containers.
     *
     * No hooks are executed during construction; consumers must call
     * {@link init}, {@link mount}, {@link update}, or {@link destroy}.
     */
    constructor() {
        /**
         * Current lifecycle state.
         *
         * Starts at {@link LifecycleState.NEW} and transitions through the FSM via
         * {@link init}, {@link mount}, {@link update}, {@link destroy}.
         */
        this.state = LifecycleState.NEW;
        /**
         * Registered lifecycle hooks.
         *
         * Uses a Set per hook to:
         * - Avoid duplicate registrations
         * - Preserve insertion order for deterministic execution
         *
         * @remarks
         * This map is initialized with keys for all supported hooks in the constructor.
         * Callbacks are cleared on {@link destroy}.
         */
        this.hooks = new Map();
        this.hooks.set("onInit", new Set());
        this.hooks.set("onMount", new Set());
        this.hooks.set("onUpdate", new Set());
        this.hooks.set("onDestroy", new Set());
    }
    /**
     * Subscribes a callback to a lifecycle hook.
     *
     * Hook callbacks are invoked in insertion order. Duplicate callback references are ignored
     * due to Set semantics.
     *
     * @param {LifecycleHookName} hook - Hook name to subscribe to.
     * @param {(ctx: LifecycleHookContext) => void} fn - Callback invoked when the hook is emitted.
     * @returns {this} The current instance (chainable).
     */
    on(hook, fn) {
        this.hooks.get(hook).add(fn);
        return this;
    }
    /**
     * Unsubscribes a previously registered callback from a lifecycle hook.
     *
     * Safe to call even if the callback was never registered (no-op).
     *
     * @param {LifecycleHookName} hook - Hook name to unsubscribe from.
     * @param {(ctx: LifecycleHookContext) => void} fn - Callback to remove.
     * @returns {this} The current instance (chainable).
     */
    off(hook, fn) {
        this.hooks.get(hook).delete(fn);
        return this;
    }
    /**
     * Emits a lifecycle hook by executing all registered callbacks for that hook.
     *
     * Execution model:
     * - Callbacks run in insertion order.
     * - Errors thrown by callbacks are caught and forwarded to {@link handleHookError}.
     *
     * @param {LifecycleHookName} hook - The hook to emit.
     * @param {LifecycleState} prevState - The state prior to the transition.
     * @returns {void}
     *
     * @internal
     * Prefer invoking the public lifecycle methods ({@link init}, {@link mount}, {@link update}, {@link destroy})
     * which call `emit()` at the correct time and enforce FSM guards.
     */
    emit(hook, prevState) {
        const ctx = {
            state: this.state,
            prevState,
        };
        for (const fn of this.hooks.get(hook)) {
            try {
                fn(ctx);
            }
            catch (err) {
                this.handleHookError(err, hook);
            }
        }
    }
    /**
     * Handles errors thrown by lifecycle hook callbacks.
     *
     * Default behavior logs to `console.error` with a hook-scoped prefix.
     * Subclasses may override to integrate with application logging/telemetry.
     *
     * @param {unknown} error - Error thrown by a hook callback.
     * @param {LifecycleHookName} hook - Hook name during which the error occurred.
     * @returns {void}
     * @protected
     */
    handleHookError(error, hook) {
        console.error(`[Lifecycle:${hook}]`, error);
    }
    /**
     * Transitions `NEW → INITIALIZED` and emits `onInit`.
     *
     * Idempotent: **no-op** unless current state is {@link LifecycleState.NEW}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onInit}
     */
    init() {
        if (this.state !== LifecycleState.NEW)
            return;
        const prev = this.state;
        this.state = LifecycleState.INITIALIZED;
        this.emit("onInit", prev);
    }
    /**
     * Transitions `INITIALIZED → MOUNTED` and emits `onMount`.
     *
     * Guarded: **no-op** unless current state is {@link LifecycleState.INITIALIZED}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onMount}
     */
    mount() {
        if (this.state !== LifecycleState.INITIALIZED)
            return;
        const prev = this.state;
        this.state = LifecycleState.MOUNTED;
        this.emit("onMount", prev);
    }
    /**
     * Emits `onUpdate` and transitions to/keeps state `UPDATED`.
     *
     * Allowed states:
     * - `MOUNTED` → `UPDATED`
     * - `UPDATED` → `UPDATED` (repeatable updates still emit)
     *
     * Guarded: **no-op** unless current state is `MOUNTED` or `UPDATED`.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onUpdate}
     */
    update() {
        if (this.state !== LifecycleState.MOUNTED &&
            this.state !== LifecycleState.UPDATED) {
            return;
        }
        const prev = this.state;
        this.state = LifecycleState.UPDATED;
        this.emit("onUpdate", prev);
    }
    /**
     * Transitions to `DESTROYED`, emits `onDestroy`, then clears all hook registrations.
     *
     * Idempotent: **no-op** if already {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onDestroy}
     */
    destroy() {
        if (this.state === LifecycleState.DESTROYED)
            return;
        const prev = this.state;
        this.state = LifecycleState.DESTROYED;
        this.emit("onDestroy", prev);
        this.clearHooks();
    }
    /**
     * Returns the current lifecycle state.
     *
     * @returns {LifecycleState} Current FSM state.
     */
    getState() {
        return this.state;
    }
    /**
     * Checks whether the lifecycle is in the specified state.
     *
     * @param {LifecycleState} state - State to compare against.
     * @returns {boolean} `true` if current state matches; otherwise `false`.
     */
    is(state) {
        return this.state === state;
    }
    /**
     * Clears all registered lifecycle hooks.
     *
     * Called automatically during {@link destroy}. After clearing, the hook containers remain
     * allocated (map keys persist) but contain no subscribers.
     *
     * @returns {void}
     * @private
     */
    clearHooks() {
        for (const set of this.hooks.values()) {
            set.clear();
        }
    }
}

/**
 * PlaceHolder
 *
 * DOM-driven placeholder view for the Select UI when no value is selected.
 * This component is intentionally minimal: it owns a single DOM node and exposes
 * getter/setter APIs for the placeholder content.
 *
 * ### Responsibility
 * - Create and own the placeholder DOM element (`.seui-placeholder`).
 * - Render placeholder content from {@link SelectiveOptions.placeholder}.
 * - Support runtime updates via {@link set}, optionally persisting into options.
 * - Participate in the shared {@link Lifecycle} FSM.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`.
 * - {@link initialize} creates DOM and calls `init()` → transitions to `INITIALIZED`.
 * - Updates are data-driven via {@link set}; this class does not override `update()`.
 * - {@link destroy} removes the DOM node and clears references; repeat calls are no-ops
 *   once {@link LifecycleState.DESTROYED}.
 *
 * ### DOM / Rendering Notes
 * - Content is written through `innerHTML` (DOM side effect).
 * - {@link Libs.tagTranslate} is applied to the incoming value before rendering.
 * - When `options.allowHtml` is falsy, HTML is stripped via {@link Libs.stripHtml}
 *   to reduce injection risk. When truthy, translated HTML is rendered as-is.
 *
 * @extends Lifecycle
 */
class PlaceHolder extends Lifecycle {
    /**
     * Creates a new {@link PlaceHolder}.
     *
     * If `options` is provided, the component initializes immediately and enters the
     * {@link Lifecycle} by calling `init()` internally. If `options` is `null`, the
     * instance remains in `NEW` until initialized elsewhere (by design).
     *
     * @param options - Select UI options containing placeholder content and rendering flags.
     */
    constructor(options) {
        super();
        if (options)
            this.initialize(options);
    }
    /**
     * Builds the placeholder DOM node and starts the lifecycle.
     *
     * Side effects:
     * - Creates a `div.seui-placeholder` node via {@link Libs.nodeCreator}.
     * - Writes initial placeholder content into `innerHTML`.
     * - Transitions the lifecycle by calling `init()`.
     *
     * @param options - Options providing placeholder content and rendering behavior.
     * @internal
     */
    initialize(options) {
        this.node = Libs.nodeCreator({
            node: "div",
            classList: "seui-placeholder",
            innerHTML: options.placeholder,
        });
        this.options = options;
        this.init();
    }
    /**
     * Returns the current placeholder content as stored in {@link options}.
     *
     * This method does not read from the DOM; it returns the configuration value.
     *
     * @returns The configured placeholder string, or an empty string if uninitialized.
     */
    get() {
        return this.options?.placeholder ?? "";
    }
    /**
     * Updates the rendered placeholder content.
     *
     * Behavior:
     * - No-ops if the component is not initialized (`node`/`options` missing).
     * - Optionally persists the new value back into {@link options.placeholder}.
     * - Applies {@link Libs.tagTranslate} before rendering.
     * - Renders using `innerHTML`:
     *   - If `options.allowHtml` is truthy, renders translated HTML.
     *   - Otherwise, strips HTML via {@link Libs.stripHtml} and renders safe text/markup.
     *
     * @param value - New placeholder content to render.
     * @param isSave - When `true` (default), also updates {@link options.placeholder}.
     */
    set(value, isSave = true) {
        if (!this.node || !this.options)
            return;
        if (isSave) {
            this.options.placeholder = value;
        }
        const translated = Libs.tagTranslate(value);
        this.node.innerHTML = this.options.allowHtml
            ? translated
            : Libs.stripHtml(translated);
    }
    /**
     * Disposes the placeholder DOM and terminates the lifecycle.
     *
     * Strict FSM / idempotency:
     * - If already {@link LifecycleState.DESTROYED}, returns immediately.
     *
     * Side effects:
     * - Removes {@link node} from the DOM (if present).
     * - Clears references to allow garbage collection.
     *
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.node?.remove();
        this.node = null;
        this.options = null;
        super.destroy();
    }
}

/**
 * Minimal directive primitive for small interactive UI controls.
 *
 * A **Directive** is a lightweight, DOM-driven control that:
 * - Owns a single root {@link HTMLElement} ({@link node})
 * - Participates in the core lifecycle FSM via {@link Lifecycle}
 * - Encapsulates behavior (state toggles / event wiring) rather than complex rendering
 *
 * This implementation models a generic “toggle” affordance (commonly used to open/close a dropdown),
 * leaving styling and actual open/close mechanics to higher-level components.
 *
 * ### Lifecycle (Strict-ish FSM)
 * - Construction calls {@link init} immediately.
 * - {@link init} creates the DOM node, transitions `NEW → INITIALIZED`, then calls {@link mount}
 *   (resulting in `MOUNTED`).
 * - {@link destroy} removes the node and transitions to `DESTROYED` (idempotent guard).
 *
 * ### Idempotency / No-ops
 * - {@link setDropdown} is purely a DOM class toggle and is safe to call repeatedly.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - The root node is created with `role="button"` and an `aria-label`.
 * - Visual state is represented by toggling a CSS class (`"drop-down"`).
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 */
class Directive extends Lifecycle {
    /**
     * Creates a new Directive and immediately initializes it.
     *
     * Lifecycle progression:
     * `constructor()` → {@link init} → {@link mount}
     *
     * @returns {void}
     */
    constructor() {
        super();
        this.init();
    }
    /**
     * Initializes the directive's DOM structure and advances lifecycle state.
     *
     * Side effects:
     * - Creates a single clickable root element via {@link Libs.nodeCreator}.
     * - Applies `role="button"` and `aria-label` for accessibility.
     * - Transitions `NEW → INITIALIZED → MOUNTED` by calling `super.init()` then {@link mount}.
     *
     * @returns {void}
     * @override
     */
    init() {
        // Libs.nodeCreator returns Element, but this node
        // is guaranteed to be an HTMLElement in this context.
        this.node = Libs.nodeCreator({
            node: "div",
            classList: "seui-directive",
            role: "button",
            ariaLabel: "Toggle dropdown",
        });
        super.init();
        this.mount();
    }
    /**
     * Updates the directive's visual "dropdown open" state.
     *
     * Implementation:
     * - Toggles the `"drop-down"` CSS class on {@link node}.
     * - Presentation is expected to be handled purely via CSS.
     *
     * @param {boolean} value - `true` to indicate dropdown is open; `false` otherwise.
     * @returns {void}
     */
    setDropdown(value) {
        this.node.classList.toggle("drop-down", !!value);
    }
    /**
     * Destroys the directive and releases DOM resources.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Removes {@link node} from the DOM.
     * - Clears references and completes teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.node.remove();
        this.node = null;
        super.destroy();
    }
}

/**
 * OptionHandle
 *
 * Headless-friendly, DOM-driven UI control that exposes bulk selection actions
 * ("Select all" / "Deselect all") for multiple-selection experiences.
 *
 * ### Responsibility
 * - Creates and owns a small DOM subtree (root + two action elements).
 * - Exposes registration APIs for action callbacks (`onSelectAll`, `onDeSelectAll`).
 * - Reflects feature flags from {@link SelectiveOptions} by showing/hiding itself.
 * - Participates in the library {@link Lifecycle} finite-state machine (FSM).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`.
 * - {@link initialize} builds DOM and calls `init()` → transitions to `INITIALIZED`.
 * - {@link update} is safe to call repeatedly; it re-evaluates visibility and then
 *   delegates to `super.update()` (idempotent once in `UPDATED`).
 * - {@link destroy} is a terminal transition; subsequent calls are no-ops.
 *
 * ### Event / Callback Flow
 * - User interaction is handled via DOM `onclick` handlers bound during initialization.
 * - On click, this component dispatches callbacks through {@link iEvents.callFunctions}.
 * - This class does not own selection state; it only emits intent via callbacks.
 *
 * ### Visibility Contract
 * Visible only when BOTH flags are enabled:
 * - `options.multiple` truthy (after {@link Libs.string2Boolean} coercion)
 * - `options.selectall` truthy (after {@link Libs.string2Boolean} coercion)
 *
 * ### DOM / a11y Notes
 * - Uses `<a>` elements as action triggers. This is a DOM-side effect and may have
 *   accessibility implications depending on `href`, keyboard handling, and ARIA.
 *
 * @extends Lifecycle
 */
class OptionHandle extends Lifecycle {
    /**
     * Creates an {@link OptionHandle}.
     *
     * If `options` is provided, the instance immediately performs {@link initialize}
     * and enters the {@link Lifecycle} (calls `init()` internally).
     * If `options` is `null`, the instance stays in `NEW` until initialized elsewhere.
     *
     * @param options - Feature flags and labels for the two actions.
     */
    constructor(options) {
        super();
        /**
         * Callback list invoked when the "Select all" control is activated.
         *
         * Callbacks are invoked via {@link iEvents.callFunctions}. This component does not
         * interpret arguments; it delegates invocation semantics to the dispatcher helper.
         *
         * @internal
         */
        this.actionOnSelectAll = [];
        /**
         * Callback list invoked when the "Deselect all" control is activated.
         *
         * Callbacks are invoked via {@link iEvents.callFunctions}. This component does not
         * interpret arguments; it delegates invocation semantics to the dispatcher helper.
         *
         * @internal
         */
        this.actionOnDeSelectAll = [];
        if (options)
            this.initialize(options);
    }
    /**
     * Initializes DOM and binds event handlers.
     *
     * DOM structure (conceptually):
     * - Root: `div.seui-option-handle.hide`
     * - Child: `a.seui-option-handle-item` ("Select all")
     * - Child: `a.seui-option-handle-item` ("Deselect all")
     *
     * Click handlers:
     * - "Select all" → dispatches {@link actionOnSelectAll} via {@link iEvents.callFunctions}
     * - "Deselect all" → dispatches {@link actionOnDeSelectAll} via {@link iEvents.callFunctions}
     *
     * Side effects:
     * - Creates DOM nodes (via {@link Libs.mountNode})
     * - Transitions lifecycle by calling `init()` at the end
     *
     * @param options - Configuration providing labels and feature flags.
     * @internal
     */
    initialize(options) {
        this.nodeMounted = Libs.mountNode({
            OptionHandle: {
                tag: { node: "div", classList: ["seui-option-handle", "hide"] },
                child: {
                    SelectAll: {
                        tag: {
                            node: "a",
                            classList: "seui-option-handle-item",
                            textContent: options.textSelectAll,
                            onclick: () => {
                                iEvents.callFunctions(this.actionOnSelectAll);
                            },
                        },
                    },
                    DeSelectAll: {
                        tag: {
                            node: "a",
                            classList: "seui-option-handle-item",
                            textContent: options.textDeselectAll,
                            onclick: () => {
                                iEvents.callFunctions(this.actionOnDeSelectAll);
                            },
                        },
                    },
                },
            },
        });
        this.node = this.nodeMounted.view;
        this.options = options;
        this.init();
    }
    /**
     * Computes whether this control is enabled/available under current configuration.
     *
     * This method performs a boolean coercion using {@link Libs.string2Boolean} to
     * support string-like flags in {@link SelectiveOptions}.
     *
     * No-ops:
     * - Returns `false` when {@link options} has not been set.
     *
     * @returns `true` when both `multiple` and `selectall` are enabled; otherwise `false`.
     * @internal
     */
    available() {
        if (!this.options)
            return false;
        return (Libs.string2Boolean(this.options.multiple) &&
            Libs.string2Boolean(this.options.selectall));
    }
    /**
     * Re-evaluates visibility and advances the lifecycle update step.
     *
     * Behavior:
     * - If {@link node} exists, toggles the `hide` class based on {@link available}.
     * - Always delegates to `super.update()` to participate in the FSM transition.
     *
     * Idempotency:
     * - Repeated calls remain safe; DOM class toggling is stable and the underlying
     *   {@link Lifecycle} update is expected to be idempotent after the first transition.
     *
     * @override
     */
    update() {
        if (this.node) {
            if (this.available()) {
                this.show();
            }
            else {
                this.hide();
            }
        }
        super.update();
    }
    /**
     * Shows the control by removing the `hide` CSS class on the root node.
     *
     * No-ops when {@link node} is `null`.
     */
    show() {
        if (!this.node)
            return;
        this.node.classList.remove("hide");
    }
    /**
     * Hides the control by adding the `hide` CSS class on the root node.
     *
     * No-ops when {@link node} is `null`.
     */
    hide() {
        if (!this.node)
            return;
        this.node.classList.add("hide");
    }
    /**
     * Registers a callback for the external "Select all" intent.
     *
     * Notes:
     * - This is an "external event" hook: it notifies the host/controller layer that a
     *   bulk action was requested. This component does not mutate selection state itself.
     * - Callbacks are executed by {@link iEvents.callFunctions} when the corresponding
     *   DOM control is activated.
     *
     * @param action - Callback invoked on activation; ignored when not a function.
     */
    onSelectAll(action) {
        if (typeof action === "function") {
            this.actionOnSelectAll.push(action);
        }
    }
    /**
     * Registers a callback for the external "Deselect all" intent.
     *
     * Notes:
     * - This is an "external event" hook: it notifies the host/controller layer that a
     *   bulk deselection was requested. This component does not mutate selection state itself.
     * - Callbacks are executed by {@link iEvents.callFunctions} when the corresponding
     *   DOM control is activated.
     *
     * @param action - Callback invoked on activation; ignored when not a function.
     */
    onDeSelectAll(action) {
        if (typeof action === "function") {
            this.actionOnDeSelectAll.push(action);
        }
    }
    /**
     * Tears down DOM resources and terminates the lifecycle.
     *
     * Strict FSM / idempotency:
     * - If already in {@link LifecycleState.DESTROYED}, this method returns immediately.
     *
     * Side effects:
     * - Removes the root DOM node from the document (if present).
     * - Clears references to options and callback lists to allow GC.
     * - Delegates to `super.destroy()` to finalize the lifecycle transition.
     *
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.node.remove();
        this.options = null;
        this.actionOnSelectAll = null;
        this.actionOnDeSelectAll = null;
        this.node = null;
        super.destroy();
    }
}

/**
 * Lightweight UI state box that renders contextual "empty" feedback.
 *
 * ### Responsibility
 * - Owns a single DOM node that can be shown/hidden to communicate:
 *   - **No data** (no options available)
 *   - **Not found** (search produced zero visible results)
 * - Exposes a minimal imperative API (`show`, `hide`, `isVisible`) used by higher-level
 *   controllers/components (e.g., popup/search flows).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`. When `options` are provided, {@link initialize} is called and the
 *   instance transitions to `INITIALIZED` via {@link Lifecycle.init}.
 * - This component does not automatically mount itself into a container; consumers are expected
 *   to append {@link node} where appropriate.
 * - {@link destroy} removes the node and transitions to `DESTROYED`.
 *
 * ### Idempotency / No-ops
 * - {@link show} and {@link hide} are **no-ops** until {@link node} exists.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - Uses `role="status"` and `aria-live="polite"` so screen readers announce changes without
 *   interrupting the user.
 * - Visibility is controlled via the `"hide"` CSS class; hiding does not remove the element.
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 * @see {@link EmptyStateType}
 */
class EmptyState extends Lifecycle {
    /**
     * Creates a new {@link EmptyState}.
     *
     * If `options` are provided, initialization runs immediately (creates {@link node} and
     * transitions to `INITIALIZED`).
     *
     * @param {SelectiveOptions} [options=null] - Configuration containing empty state messages.
     */
    constructor(options) {
        super();
        if (options)
            this.initialize(options);
    }
    /**
     * Initializes internal resources for this component.
     *
     * Side effects:
     * - Creates the root `div` node with `role="status"` and `aria-live="polite"`.
     * - Applies base CSS classes: `"seui-empty-state"` and `"hide"`.
     * - Stores the options reference and calls {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object containing empty state messages.
     * @returns {void}
     */
    initialize(options) {
        this.options = options;
        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["seui-empty-state", "hide"],
            role: "status",
            ariaLive: "polite",
        });
        this.init();
    }
    /**
     * Shows the empty state message for the given scenario.
     *
     * - `"nodata"`: uses `options.textNoData`
     * - `"notfound"`: uses `options.textNotFound`
     *
     * No-op if {@link node} or {@link options} are not initialized.
     *
     * @param {EmptyStateType} [type="nodata"] - Which empty state message to display.
     * @returns {void}
     */
    show(type = "nodata") {
        if (!this.node || !this.options)
            return;
        const text = type === "notfound"
            ? this.options.textNotFound
            : this.options.textNoData;
        this.node.textContent = text;
        this.node.classList.remove("hide");
    }
    /**
     * Hides the empty state node by applying the `"hide"` CSS class.
     *
     * This does not remove the element from the DOM.
     * No-op if {@link node} is not initialized.
     *
     * @returns {void}
     */
    hide() {
        if (!this.node)
            return;
        this.node.classList.add("hide");
    }
    /**
     * Whether the empty state is currently visible.
     *
     * @returns {boolean} `true` when {@link node} exists and does not have the `"hide"` class.
     */
    get isVisible() {
        return !!this.node && !this.node.classList.contains("hide");
    }
    /**
     * Releases resources owned by this component.
     *
     * - Removes the root DOM node (if present).
     * - Clears stored options and internal references.
     * - Transitions to `DESTROYED`.
     *
     * Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.options = null;
        this.node?.remove();
        this.node = null;
        super.destroy();
    }
}

/**
 * Lightweight UI state box that renders a "loading" indicator while data is being fetched,
 * processed, or updated asynchronously.
 *
 * ### Responsibility
 * - Owns a single DOM node representing the loading state.
 * - Exposes an imperative API (`show`, `hide`, `isVisible`) to be driven by higher-level
 *   controllers (e.g., AJAX search / pagination) and containers (e.g., Popup).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed in `NEW`. When `options` are provided, {@link initialize} is invoked and the
 *   instance transitions to `INITIALIZED` via {@link Lifecycle.init}.
 * - This component does **not** attach itself to the DOM; consumers append {@link node} to the
 *   desired container.
 * - {@link destroy} removes the node, clears references, and transitions to `DESTROYED`.
 *
 * ### Idempotency / No-ops
 * - {@link show} and {@link hide} are **no-ops** until {@link node} exists.
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 *
 * ### Accessibility / DOM side effects
 * - Uses `role="status"` and `aria-live="polite"` so assistive technologies announce changes
 *   without interrupting the user.
 * - Visibility is controlled via the `"hide"` CSS class; hiding does not remove the element.
 * - The `"small"` CSS class is toggled by {@link show} to support a compact loading indicator
 *   when items are already present.
 *
 * @extends Lifecycle
 * @see {@link LifecycleState}
 */
class LoadingState extends Lifecycle {
    /**
     * Creates a new {@link LoadingState}.
     *
     * If `options` are provided, initialization runs immediately (creates {@link node} and
     * transitions to `INITIALIZED`).
     *
     * @param {SelectiveOptions} [options=null] - Configuration containing the loading message text.
     */
    constructor(options) {
        super();
        if (options)
            this.initialize(options);
    }
    /**
     * Initializes internal resources for this component.
     *
     * Side effects:
     * - Creates the root `div` node with base CSS classes: `"seui-loading-state"` and `"hide"`.
     * - Sets initial text to `options.textLoading`.
     * - Applies `role="status"` and `aria-live="polite"`.
     * - Stores the options reference and calls {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object containing loading text.
     * @returns {void}
     */
    initialize(options) {
        this.options = options;
        this.node = Libs.nodeCreator({
            node: "div",
            classList: ["seui-loading-state", "hide"],
            textContent: options.textLoading,
            role: "status",
            ariaLive: "polite",
        });
        this.init();
    }
    /**
     * Shows the loading indicator.
     *
     * Behavior:
     * - Updates the text to the latest `options.textLoading` (in case options changed).
     * - Toggles the `"small"` CSS class when `hasItems` is true to display a compact variant.
     * - Removes the `"hide"` class to make the node visible.
     *
     * No-op if {@link node} or {@link options} are not initialized.
     *
     * @param {boolean} hasItems - Whether existing items are already present (enables compact loading style).
     * @returns {void}
     */
    show(hasItems) {
        if (!this.node || !this.options)
            return;
        this.node.textContent = this.options.textLoading;
        this.node.classList.toggle("small", !!hasItems);
        this.node.classList.remove("hide");
    }
    /**
     * Hides the loading indicator by applying the `"hide"` CSS class.
     *
     * This does not remove the element from the DOM.
     * No-op if {@link node} is not initialized.
     *
     * @returns {void}
     */
    hide() {
        if (!this.node)
            return;
        this.node.classList.add("hide");
    }
    /**
     * Whether the loading indicator is currently visible.
     *
     * @returns {boolean} `true` when {@link node} exists and does not have the `"hide"` class.
     */
    get isVisible() {
        return !!this.node && !this.node.classList.contains("hide");
    }
    /**
     * Releases resources owned by this component.
     *
     * - Removes the root DOM node (if present).
     * - Clears stored options and internal references.
     * - Transitions to `DESTROYED`.
     *
     * Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.options = null;
        this.node?.remove();
        this.node = null;
        super.destroy();
    }
}

/**
 * ResizeObserverService
 *
 * Lightweight DOM observation service that consolidates multiple layout-change signals
 * into a single `onChanged(metrics)` hook.
 *
 * This is a headless utility (no rendering). It binds to one DOM element at a time,
 * derives a normalized {@link ElementMetrics} snapshot, and emits it to consumers.
 *
 * ### Responsibility
 * - Observe one bound DOM element for layout-affecting changes.
 * - Normalize native signals into a consistent metrics payload:
 *   - `ResizeObserver` → element box size changes
 *   - `MutationObserver` (attributes: `style`, `class`) → style-driven layout changes
 *   - `window` scroll/resize → viewport/layout shifts
 *   - `visualViewport` scroll/resize (when available) → zoom/keyboard/viewport changes
 * - Compute and emit metrics:
 *   - geometry from `getBoundingClientRect()`
 *   - padding/border/margin from `getComputedStyle()` (when available)
 *
 * ### Lifecycle behavior (service-level)
 * - `constructor()` initializes internal state and binds a stable handler reference.
 * - `connect(element)` attaches observers/listeners and starts emitting metric updates.
 * - `trigger()` forces an immediate metric snapshot emission.
 * - `disconnect()` detaches observers/listeners, clears references, and disables further emissions.
 *
 * ### Internal vs external signals
 * - **Internal signals**: `ResizeObserver` and `MutationObserver` callbacks.
 * - **External signals**: `window` / `visualViewport` scroll/resize events.
 * All signals funnel through the same internal handler and produce the same {@link ElementMetrics}.
 *
 * ### No-op / fallback behavior
 * - If the bound element is missing or not measurable, a zeroed {@link ElementMetrics} object is emitted.
 * - `disconnect()` is tolerant to being called when not connected.
 *
 * ### Idempotency notes
 * - `disconnect()` is effectively idempotent (safe to call multiple times).
 * - `connect()` is **not** idempotent: repeated calls without `disconnect()` will add duplicate
 *   observers/listeners and may result in amplified callbacks.
 *
 * ### DOM / environment side effects
 * - Adds/removes global listeners on `window` and optionally `window.visualViewport`.
 * - Creates and disconnects `ResizeObserver` and `MutationObserver` instances.
 * - Does not mutate the observed element; only reads layout/style information.
 *
 * @see {@link ElementMetrics}
 */
class ResizeObserverService {
    /**
     * Creates the service and binds internal handlers.
     *
     * ### Behavior
     * - Sets {@link isInit} to `true`.
     * - Binds {@link updateChanged} to a stable function reference stored in {@link boundUpdateChanged}.
     *
     * @remarks
     * This constructor does not attach any DOM observers; observation begins at {@link connect}.
     */
    constructor() {
        /**
         * Initialization flag set by the constructor.
         *
         * @remarks
         * This flag indicates the instance has been constructed and its internal handler bound.
         * It does **not** indicate that observers are currently attached (see {@link connect}).
         */
        this.isInit = false;
        this.isInit = true;
        this.boundUpdateChanged = this.updateChanged.bind(this);
    }
    /**
     * Hook invoked whenever the service emits a new metrics snapshot.
     *
     * ### Contract
     * - Receives a fully shaped {@link ElementMetrics} object.
     * - Numeric values are parsed to numbers (CSS pixels).
     * - When no measurable element is bound, values are zeroed.
     *
     * @param metrics - Snapshot of geometry and box edges (padding/border/margin).
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChanged(metrics) { }
    /**
     * Computes metrics for the current {@link element} and forwards them to {@link onChanged}.
     *
     * ### Computation
     * - `getBoundingClientRect()` → `width`, `height`, `top`, `left`
     * - `getComputedStyle()` (if available) → padding, border widths, margins
     *
     * ### Fallback behavior
     * - If `element` is null/invalid or lacks `getBoundingClientRect`, emits a zeroed metrics object.
     * - If `window.getComputedStyle` is unavailable, padding/border/margin values default to `0`.
     *
     * @remarks
     * This method is the single funnel for all observation signals (internal + external).
     */
    updateChanged() {
        const el = this.element;
        if (!el || typeof el.getBoundingClientRect !== "function") {
            const defaultMetrics = {
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                border: { top: 0, right: 0, bottom: 0, left: 0 },
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
            };
            this.onChanged(defaultMetrics);
            return;
        }
        const rect = el.getBoundingClientRect();
        const style = typeof window !== "undefined" &&
            typeof window.getComputedStyle === "function"
            ? window.getComputedStyle(el)
            : null;
        const metrics = {
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            top: rect?.top ?? 0,
            left: rect?.left ?? 0,
            padding: {
                top: parseFloat(style?.paddingTop ?? "0"),
                right: parseFloat(style?.paddingRight ?? "0"),
                bottom: parseFloat(style?.paddingBottom ?? "0"),
                left: parseFloat(style?.paddingLeft ?? "0"),
            },
            border: {
                top: parseFloat(style?.borderTopWidth ?? "0"),
                right: parseFloat(style?.borderRightWidth ?? "0"),
                bottom: parseFloat(style?.borderBottomWidth ?? "0"),
                left: parseFloat(style?.borderLeftWidth ?? "0"),
            },
            margin: {
                top: parseFloat(style?.marginTop ?? "0"),
                right: parseFloat(style?.marginRight ?? "0"),
                bottom: parseFloat(style?.marginBottom ?? "0"),
                left: parseFloat(style?.marginLeft ?? "0"),
            },
        };
        this.onChanged(metrics);
    }
    /**
     * Manually emits a metrics snapshot for the current element.
     *
     * ### No-op / fallback behavior
     * - If not connected or element is not measurable, a zeroed metrics object is emitted.
     */
    trigger() {
        this.updateChanged();
    }
    /**
     * Attaches observers and listeners to begin emitting metric updates for the given element.
     *
     * ### Observed signals
     * - `ResizeObserver` on the element
     * - `MutationObserver` on the element (attributes: `style`, `class`)
     * - `window`:
     *   - `scroll` (capture phase) to detect scroll-driven layout shifts
     *   - `resize` to detect viewport size changes
     * - `window.visualViewport` (when available):
     *   - `resize` and `scroll` for mobile zoom / virtual keyboard adjustments
     *
     * @param element - DOM element to observe. Must be an `Element`.
     * @throws {Error} If `element` is not an instance of `Element`.
     *
     * @remarks
     * Not idempotent. Call {@link disconnect} before calling `connect()` again to avoid duplicates.
     */
    connect(element) {
        if (!(element instanceof HTMLElement)) {
            throw new Error("Invalid element");
        }
        this.element = element;
        this.resizeObserver = new ResizeObserver(this.boundUpdateChanged);
        this.resizeObserver.observe(element);
        this.mutationObserver = new MutationObserver(this.boundUpdateChanged);
        this.mutationObserver.observe(element, {
            attributes: true,
            attributeFilter: ["style", "class"],
        });
        window.addEventListener("scroll", this.boundUpdateChanged, true);
        window.addEventListener("resize", this.boundUpdateChanged);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this.boundUpdateChanged);
            window.visualViewport.addEventListener("scroll", this.boundUpdateChanged);
        }
    }
    /**
     * Detaches all observers and listeners, clears internal references, and disables emissions.
     *
     * ### Behavior
     * - Disconnects `ResizeObserver` and `MutationObserver` (if present).
     * - Removes `window` / `visualViewport` listeners.
     * - Resets {@link onChanged} to a no-op to prevent callbacks after teardown.
     * - Clears {@link element} and releases observer instances for GC.
     *
     * ### Idempotency
     * - Safe to call multiple times (platform APIs tolerate redundant disconnect/removals).
     */
    disconnect() {
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        this.onChanged = (_metrics) => { };
        window.removeEventListener("scroll", this.boundUpdateChanged, true);
        window.removeEventListener("resize", this.boundUpdateChanged);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this.boundUpdateChanged);
            window.visualViewport.removeEventListener("scroll", this.boundUpdateChanged);
        }
        this.resizeObserver = null;
        this.mutationObserver = null;
        this.element = null;
    }
}

/**
 * Popup panel that renders and manages the dropdown surface.
 *
 * Responsibilities:
 * - Build and attach the dropdown DOM structure
 * - Integrate state components (OptionHandle, LoadingState, EmptyState)
 * - Bind to ModelManager resources (adapter + recycler view)
 * - Handle virtual scrolling and infinite scroll
 * - Compute placement (top/bottom) and animate open/close/resize via Effector
 * - Keep "empty/not found" states in sync with adapter visibility stats
 *
 * Lifecycle:
 * - Created via constructor → `initialize()` (when args provided) → `init()` → `mount()`
 * - `open()` attaches and animates the panel
 * - `close()` collapses the panel
 * - `destroy()` fully tears down all resources
 *
 * @extends Lifecycle
 */
class Popup extends Lifecycle {
    /**
     * Creates a Popup instance that manages the dropdown panel for a Select-like UI.
     *
     * If `select` and `options` are provided, the popup is initialized immediately.
     *
     * @param select - Source `<select>` element this popup is bound to.
     * @param options - Configuration options (panel sizing, flags, texts, etc.).
     * @param modelManager - Model manager that supplies the adapter and recycler view.
     */
    constructor(select, options, modelManager) {
        super();
        /** Indicates whether the popup DOM has been attached to the document body at least once */
        this.isCreated = false;
        /** Default virtual scroll configuration (tuned for typical option heights) */
        this.virtualScrollConfig = {
            /** Estimated item height in pixels (improves initial layout calculation) */
            estimateItemHeight: 36,
            /** Number of extra items to render above/below the viewport */
            overscan: 8,
            /** Whether the list contains items with dynamic (non-uniform) heights */
            dynamicHeights: true,
        };
        this.modelManager = modelManager;
        if (select && options) {
            this.initialize(select, options);
        }
    }
    /**
     * Initializes the popup UI:
     * - Creates the container and child components (OptionHandle, LoadingState, EmptyState)
     * - Binds to ModelManager resources (adapter/recyclerView)
     * - Enables empty-state synchronization with adapter
     * - Applies virtual scroll options (when enabled)
     *
     * @param select - The source select element to bind.
     * @param options - Panel configuration (dimensions, IDs, labels, flags).
     * @throws Error if a ModelManager is not provided.
     */
    initialize(select, options) {
        if (!this.modelManager)
            throw new Error("Popup requires a ModelManager instance.");
        this.optionHandle = new OptionHandle(options);
        this.emptyState = new EmptyState(options);
        this.loadingState = new LoadingState(options);
        const nodeMounted = Libs.mountNode({
            PopupContainer: {
                tag: {
                    node: "div",
                    classList: "seui-popup",
                    style: { maxHeight: options.panelHeight },
                },
                child: {
                    OptionHandle: { tag: this.optionHandle.node },
                    OptionsContainer: {
                        tag: {
                            id: options.SEID_LIST,
                            node: "div",
                            classList: "seui-options-container",
                            role: "listbox",
                        },
                    },
                    LoadingState: { tag: this.loadingState.node },
                    EmptyState: { tag: this.emptyState.node },
                },
            },
        }, null);
        this.node = nodeMounted.view;
        this.optionsContainer = nodeMounted.tags
            .OptionsContainer;
        this.parent = Libs.getBinderMap(select);
        this.options = options;
        this.init();
        const recyclerViewOpt = options.virtualScroll
            ? {
                scrollEl: this.node,
                estimateItemHeight: this.virtualScrollConfig.estimateItemHeight,
                overscan: this.virtualScrollConfig.overscan,
                dynamicHeights: this.virtualScrollConfig.dynamicHeights,
            }
            : {};
        // Load ModelManager resources into the list container
        this.modelManager.load(this.optionsContainer, { isMultiple: options.multiple, options: options }, recyclerViewOpt);
        const MMResources = this.modelManager.getResources();
        this.optionAdapter = MMResources.adapter;
        this.recyclerView = MMResources.recyclerView;
        this.optionHandle.onSelectAll(() => {
            MMResources.adapter.checkAll(true);
        });
        this.optionHandle.onDeSelectAll(() => {
            MMResources.adapter.checkAll(false);
        });
        this.setupEmptyStateLogic();
        this.mount();
    }
    /**
     * Shows the loading state and temporarily suspends adapter/model events.
     *
     * Behavior:
     * - Cancels any pending hide-timeout
     * - Instructs `ModelManager` to skip events
     * - Shows loading indicator (compact mode if there are visible items)
     * - Triggers a resize to accommodate layout changes
     */
    async showLoading() {
        if (!this.options ||
            !this.loadingState ||
            !this.optionHandle ||
            !this.optionAdapter ||
            !this.modelManager)
            return;
        if (this.hideLoadHandle)
            clearTimeout(this.hideLoadHandle);
        this.modelManager.skipEvent(true);
        if (Libs.string2Boolean(this.options.loadingfield) === false)
            return;
        this.emptyState.hide();
        this.loadingState.show(this.optionAdapter.getVisibilityStats().hasVisible);
        this.triggerResize();
    }
    /**
     * Hides the loading state (after a configured delay), resumes events, syncs empty state,
     * and triggers a resize.
     *
     * Debounce: Uses `animationtime` as a short delay before hiding the loading indicator.
     */
    async hideLoading() {
        if (!this.options ||
            !this.loadingState ||
            !this.optionAdapter ||
            !this.modelManager)
            return;
        if (this.hideLoadHandle)
            clearTimeout(this.hideLoadHandle);
        this.hideLoadHandle = setTimeout(() => {
            this.modelManager?.skipEvent(false);
            this.loadingState?.hide();
            const stats = this.optionAdapter?.getVisibilityStats();
            this.updateEmptyState(stats ?? undefined);
            this.triggerResize();
        }, this.options.animationtime);
    }
    /**
     * Subscribes to adapter events to keep the empty state synchronized.
     *
     * - `onVisibilityChanged`: updates empty/not-found visibility
     * - `onPropChanged('items')`: updates visibility after items are mutated
     */
    setupEmptyStateLogic() {
        if (!this.optionAdapter)
            return;
        this.optionAdapter.onVisibilityChanged((stats) => {
            this.updateEmptyState(stats);
        });
        this.optionAdapter.onPropChanged("items", () => {
            const stats = this.optionAdapter.getVisibilityStats();
            this.updateEmptyState(stats);
            this.triggerResize();
        });
    }
    /**
     * Updates the empty/not-found state and the options container visibility.
     *
     * Rules:
     * - `isEmpty` → show "No data", hide options & handle
     * - `!hasVisible` → show "Not found", hide options & handle
     * - otherwise → show options, hide empty state, refresh handle
     *
     * @param stats - Optionally provide precomputed visibility stats.
     */
    updateEmptyState(stats) {
        if (!this.optionAdapter ||
            !this.emptyState ||
            !this.optionHandle ||
            !this.optionsContainer)
            return;
        const s = stats ?? this.optionAdapter.getVisibilityStats();
        if (s.isEmpty) {
            this.emptyState.show("nodata");
            this.optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        }
        else if (!s.hasVisible) {
            this.emptyState.show("notfound");
            this.optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        }
        else {
            this.emptyState.hide();
            this.optionsContainer.classList.remove("hide");
            this.optionHandle.update();
        }
    }
    /**
     * Subscribes to adapter property pre-change notifications.
     *
     * @param propName - Adapter property name to observe.
     * @param callback - Handler invoked before the property changes.
     */
    onAdapterPropChanging(propName, callback) {
        this.optionAdapter?.onPropChanging(propName, callback);
    }
    /**
     * Subscribes to adapter property post-change notifications.
     *
     * @param propName - Adapter property name to observe.
     * @param callback - Handler invoked after the property changes.
     */
    onAdapterPropChanged(propName, callback) {
        this.optionAdapter?.onPropChanged(propName, callback);
    }
    /**
     * Injects an effector service used for size measurement and animations.
     *
     * @param effectorSvc - Effector instance to bind to the popup element.
     */
    setupEffector(effectorSvc) {
        this.effSvc = effectorSvc;
    }
    /**
     * Loads and initializes the popup (one-time setup):
     * - Appends the popup node to `document.body`
     * - Initializes the resize observer service
     * - Binds the effect service to the popup element
     * - Blocks mousedown events inside the popup to prevent auto-close
     *
     * Safely no-ops when the popup has already been created
     * or required dependencies are missing.
     */
    load() {
        if (!this.node || !this.parent || !this.effSvc)
            return;
        if (this.isCreated)
            return;
        document.body.appendChild(this.node);
        this.isCreated = true;
        this.resizeObser = new ResizeObserverService();
        this.effSvc.setElement(this.node);
        this.node.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
    }
    /**
     * Opens (expands) the popup:
     * - Ensures the popup is loaded and initialized
     * - Synchronizes option handle visibility
     * - Optionally evaluates and applies the empty/not-found state
     * - Computes placement relative to the parent anchor
     * - Runs the expand animation
     * - Connects the resize observer after animation completes
     * - Resumes the recycler view
     *
     * Safely no-ops when required dependencies are missing.
     *
     * @param callback - Optional callback invoked when the opening animation completes.
     * @param isShowEmptyState - If true, applies the empty/not-found state before animation.
     */
    open(callback, isShowEmptyState) {
        if (!this.node ||
            !this.options ||
            !this.optionHandle ||
            !this.parent ||
            !this.effSvc)
            return;
        // Ensure one-time initialization
        this.load();
        // Sync option visibility state
        this.optionHandle.update();
        // Apply empty state if requested
        if (isShowEmptyState) {
            this.updateEmptyState();
        }
        // Compute placement based on parent anchor
        const location = this.getParentLocation();
        const { position, top, maxHeight, realHeight } = this.calculatePosition(location);
        // Run expand animation
        this.effSvc.expand({
            duration: this.options.animationtime,
            display: "flex",
            width: location.width,
            left: location.left,
            top,
            maxHeight,
            realHeight,
            position,
            onComplete: () => {
                if (!this.resizeObser || !this.parent)
                    return;
                // Recompute position on parent resize to keep behavior consistent
                this.resizeObser.onChanged = (_metrics) => {
                    const loc = this.getParentLocation();
                    this.handleResize(loc);
                };
                this.resizeObser.connect(this.parent.container.tags.ViewPanel);
                callback?.();
                // Resume recycler view rendering after animation
                const rv = this.recyclerView;
                rv?.resume?.();
            },
        });
    }
    /**
     * Closes (collapses) the popup:
     * - Suspends the recycler view
     * - Disconnects the resize observer
     * - Runs the collapse animation
     *
     * Safely no-ops when the popup has not been created.
     *
     * @param callback - Optional callback invoked when the closing animation completes.
     */
    close(callback) {
        if (!this.isCreated ||
            !this.options ||
            !this.resizeObser ||
            !this.effSvc)
            return;
        const rv = this.recyclerView;
        rv?.suspend?.();
        this.resizeObser.disconnect();
        this.effSvc.collapse({
            duration: this.options.animationtime,
            onComplete: callback ?? undefined,
        });
    }
    /**
     * Programmatically triggers a resize recalculation (if created),
     * causing the popup to recompute placement and dimensions.
     */
    triggerResize() {
        if (this.isCreated)
            this.resizeObser?.trigger();
    }
    /**
     * Enables infinite scrolling:
     * - Listens to scroll events on the popup container
     * - When within 100px of the bottom, attempts to load more items (if enabled and not already loading)
     *
     * @param searchController - Provides pagination state and a `loadMore()` method.
     * @param _options - Optional SelectiveOptions (reserved for future tuning).
     */
    setupInfiniteScroll(searchController, _options) {
        if (!this.node)
            return;
        this.scrollListener = async () => {
            const state = searchController.getPaginationState();
            if (!state.isPaginationEnabled)
                return;
            const container = this.node;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            // Near-bottom threshold: 100px
            if (scrollHeight - scrollTop - clientHeight < 100) {
                if (!state.isLoading && state.hasMore) {
                    const result = await searchController.loadMore();
                    if (!result.success && result.message) {
                        // Keep original behavior.
                        console.log("Load more:", result.message);
                    }
                }
            }
        };
        this.node.addEventListener("scroll", this.scrollListener);
    }
    /**
     * Completely tears down the popup and releases all resources.
     *
     * Operations:
     * - Clear pending timeouts
     * - Remove event listeners (scroll, mousedown)
     * - Disconnect resize observer
     * - Unbind effector from the element
     * - Remove DOM node (replace-with-clone fallback)
     * - Reset ModelManager event skipping
     * - Clear recycler view, adapter, and child components
     * - Null out references to avoid leaks and mark as not created
     *
     * Idempotent: safe to call multiple times.
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        clearTimeout(this.hideLoadHandle);
        this.hideLoadHandle = null;
        if (this.node && this.scrollListener) {
            this.node.removeEventListener("scroll", this.scrollListener);
            this.scrollListener = null;
        }
        this.emptyState.destroy();
        this.loadingState.destroy();
        this.optionHandle.destroy();
        this.resizeObser?.disconnect?.();
        this.effSvc?.setElement?.(null);
        this.modelManager?.skipEvent?.(false);
        this.recyclerView?.clear?.();
        this.node?.remove?.();
        if (this.node) {
            try {
                const clone = Libs.nodeCloner(this.node);
                this.node.replaceWith(clone);
                clone.remove();
            }
            catch (_) {
                this.node.remove();
            }
        }
        this.node = null;
        this.optionsContainer = null;
        this.modelManager = null;
        this.optionHandle = null;
        this.emptyState = null;
        this.loadingState = null;
        this.parent = null;
        this.options = null;
        this.isCreated = false;
        this.effSvc = null;
        this.resizeObser = null;
        this.recyclerView = null;
        this.optionAdapter = null;
        super.destroy();
    }
    /**
     * Computes the parent panel's location and box metrics
     * (size, position, padding, border). Accounts for iOS visual viewport offsets.
     */
    getParentLocation() {
        const viewPanel = this.parent.container.tags.ViewPanel;
        const rect = viewPanel.getBoundingClientRect();
        const style = window.getComputedStyle(viewPanel);
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            padding: {
                top: parseFloat(style.paddingTop),
                right: parseFloat(style.paddingRight),
                bottom: parseFloat(style.paddingBottom),
                left: parseFloat(style.paddingLeft),
            },
            border: {
                top: parseFloat(style.borderTopWidth),
                right: parseFloat(style.borderRightWidth),
                bottom: parseFloat(style.borderBottomWidth),
                left: parseFloat(style.borderLeftWidth),
            },
        };
    }
    /**
     * Determines popup placement (top/bottom) and height constraints based on:
     * - Available viewport space above/below the anchor
     * - Content size from effector's hidden measurement
     * - Configured min/max heights
     *
     * Returns the final placement, top offset, and computed heights.
     */
    calculatePosition(location) {
        const vv = window.visualViewport;
        const is_ios = Libs.IsIOS();
        const viewportHeight = vv?.height ?? window.innerHeight;
        const gap = 3;
        const safeMargin = 15;
        const dimensions = this.effSvc.getHiddenDimensions("flex");
        const contentHeight = dimensions.scrollHeight;
        const configMaxHeight = parseFloat(this.options?.panelHeight ?? "220") || 220;
        const configMinHeight = parseFloat(this.options?.panelMinHeight ?? "100") || 100;
        const spaceBelow = viewportHeight - (location.top + location.height) - gap;
        const spaceAbove = location.top - gap;
        let position = "bottom";
        let maxHeight = configMaxHeight;
        let realHeight = Math.min(contentHeight, maxHeight);
        const heightOri = spaceBelow - safeMargin;
        if (realHeight >= configMinHeight
            ? heightOri >= configMinHeight
            : heightOri >= realHeight) {
            position = "bottom";
            maxHeight = Math.min(spaceBelow - safeMargin, configMaxHeight);
        }
        else if (spaceAbove >= Math.max(realHeight, configMinHeight)) {
            position = "top";
            maxHeight = Math.min(spaceAbove - safeMargin, configMaxHeight);
        }
        else {
            if (spaceBelow >= spaceAbove) {
                position = "bottom";
                maxHeight = Math.max(spaceBelow - safeMargin, configMinHeight);
            }
            else {
                position = "top";
                maxHeight = Math.max(spaceAbove - safeMargin, configMinHeight);
            }
        }
        realHeight = Math.min(contentHeight, maxHeight);
        const viewportOffsetY = vv && is_ios ? vv.offsetTop : 0;
        const top = position === "bottom"
            ? location.top + location.height + gap + viewportOffsetY
            : location.top - realHeight - gap + viewportOffsetY;
        return { position, top, maxHeight, realHeight, contentHeight };
    }
    /**
     * Handles parent resize by recalculating placement and dimensions,
     * then animates the popup to the new size and position.
     */
    handleResize(location) {
        if (!this.options || !this.effSvc)
            return;
        const { position, top, maxHeight, realHeight } = this.calculatePosition(location);
        this.effSvc.resize({
            duration: this.options.animationtime,
            width: location.width,
            left: location.left,
            top,
            maxHeight,
            realHeight,
            position,
            animate: true,
        });
    }
}

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
class SearchBox extends Lifecycle {
    /**
     * Creates a new {@link SearchBox}.
     *
     * If `options` is provided, initialization is performed immediately (DOM is created
     * and `init()` is called). If `options` is `null`, the instance stays in `NEW` until
     * initialized elsewhere.
     *
     * @param options - Configuration such as placeholder, accessibility IDs, and flags.
     */
    constructor(options) {
        super();
        this.options = options;
        if (options)
            this.initialize(options);
    }
    /**
     * Initializes DOM, ARIA attributes, and interaction listeners.
     *
     * DOM structure (conceptually):
     * - Root: `div.seui-searchbox.hide`
     * - Child: `input[type="search"].seui-searchbox-input`
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
    initialize(options) {
        this.nodeMounted = Libs.mountNode({
            SearchBox: {
                tag: { node: "div", classList: ["seui-searchbox", "hide"] },
                child: {
                    SearchInput: {
                        tag: {
                            id: Libs.randomString(),
                            node: "input",
                            type: "search",
                            classList: ["seui-searchbox-input"],
                            placeholder: options.placeholder,
                            role: "searchbox",
                            ariaControls: options.SEID_LIST,
                            ariaAutocomplete: "list",
                        },
                    },
                },
            },
        });
        this.node = this.nodeMounted.view;
        this.SearchInput = this.nodeMounted.tags.SearchInput;
        let isControlKey = false;
        const inputEl = this.nodeMounted.tags.SearchInput;
        // Prevent parent listeners (e.g., popup container) from intercepting mouse interactions.
        inputEl.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        inputEl.addEventListener("mouseup", (e) => {
            e.stopPropagation();
        });
        // Keyboard handling: navigation, commit, and cancel.
        // Control-key sequences are tracked to avoid emitting onSearch from the subsequent input event.
        inputEl.addEventListener("keydown", (e) => {
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
            // Ensure events don't bubble to container-level listeners.
            e.stopPropagation();
        });
        // Text edits (ignore those attributable to control-key flows).
        inputEl.addEventListener("input", () => {
            if (isControlKey)
                return;
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
    show() {
        if (!this.node || !this.SearchInput || !this.options)
            return;
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
    hide() {
        if (!this.node)
            return;
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
    clear(isTrigger = true) {
        if (!this.nodeMounted)
            return;
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
    setPlaceHolder(value) {
        if (!this.SearchInput)
            return;
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
    setActiveDescendant(id) {
        if (!this.SearchInput)
            return;
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
    destroy() {
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

/**
 * Creates an {@link EffectorInterface} bound to a target element (optional).
 *
 * This is a small DOM utility that encapsulates common expand/collapse/resize/swipe animations
 * by applying inline styles + CSS transitions and coordinating them with `requestAnimationFrame`
 * and `setTimeout`.
 *
 * ### Responsibility
 * - Provide a chainable animation controller for a single HTMLElement.
 * - Coordinate transition setup and teardown using timeouts (not `transitionend` events).
 * - Expose an `isAnimating` flag for coarse-grained state checks.
 *
 * ### Binding contract
 * - If `query` is provided, it is resolved immediately via {@link EffectorImpl.setElement}.
 * - If `query` is omitted or null, the returned effector must be bound later via `setElement`
 *   before animation methods can take effect (they will otherwise no-op).
 *
 * @param query - CSS selector or element to control. When `null`, the effector is unbound.
 * @returns An effector instance implementing {@link EffectorInterface}.
 */
function Effector(query) {
    return new EffectorImpl(query ?? null);
}
/**
 * Internal implementation of {@link EffectorInterface}.
 *
 * This class performs DOM mutations (inline styles + class toggles) to animate a target element.
 * It is intentionally imperative and does not manage layout or state outside of animation concerns.
 *
 * ### Timing model
 * - Uses `requestAnimationFrame` to ensure initial styles are applied before starting transitions.
 * - Uses `setTimeout(duration)` to finalize state and call `onComplete`.
 *   (i.e., completion is time-based, not event-based.)
 *
 * @implements EffectorInterface
 * @internal
 */
class EffectorImpl {
    /**
     * Creates an effector instance optionally bound to an element.
     *
     * ### Side effects
     * - When a `query` is provided, immediately resolves/binds the element via {@link setElement}.
     *
     * @param query - CSS selector or element to control. When `null`, instance starts unbound.
     */
    constructor(query) {
        /**
         * Internal animation flag set while a timed animation is in-flight.
         *
         * Exposed via {@link isAnimating}. Reset by {@link cancel} and when animations complete.
         */
        this._isAnimating = false;
        if (query)
            this.setElement(query);
    }
    /**
     * Binds the effector to a target element.
     *
     * Resolution behavior:
     * - When `query` is a string, uses `document.querySelector`.
     * - When `query` is an element, uses it directly.
     *
     * Notes:
     * - If a selector does not resolve to an {@link HTMLElement}, binding is skipped and the
     *   effector remains unchanged.
     *
     * @param query - CSS selector or the HTMLElement to bind.
     */
    setElement(query) {
        if (typeof query === "string") {
            const el = document.querySelector(query);
            if (el instanceof HTMLElement)
                this.element = el;
            return;
        }
        this.element = query;
    }
    /**
     * Cancels any pending animation/resize timers and resets the animation state.
     *
     * This is the primary "escape hatch" to stop in-flight transitions scheduled by this effector.
     *
     * ### Behavior
     * - Clears internal timeouts (`timeOut`, `resizeTimeout`) if present.
     * - Resets {@link _isAnimating} to `false`.
     *
     * @returns The current instance (chainable).
     */
    cancel() {
        if (this.timeOut) {
            clearTimeout(this.timeOut);
            this.timeOut = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        this._isAnimating = false;
        return this;
    }
    /**
     * Measures dimensions of a (potentially hidden) element by temporarily applying "measuring styles".
     *
     * This helper is used to compute width/height/scrollHeight without leaving the element visible.
     *
     * ### Side effects
     * - Temporarily mutates inline styles (`display`, `visibility`, `position`, `height`, `width`).
     * - Restores the original inline styles before returning.
     *
     * No-ops:
     * - If the target {@link element} is not bound, returns `{ width: 0, height: 0, scrollHeight: 0 }`.
     *
     * @param display - The display style to use for measurement (defaults to `"flex"`).
     * @returns A dimension snapshot including `scrollHeight` adjusted for vertical borders.
     */
    getHiddenDimensions(display = "flex") {
        // Guard: element may not be set yet.
        if (!this.element)
            return { width: 0, height: 0, scrollHeight: 0 };
        const originalStyles = {
            display: this.element.style.display,
            visibility: this.element.style.visibility,
            position: this.element.style.position,
            height: this.element.style.height,
            width: this.element.style.width,
        };
        Object.assign(this.element.style, {
            display,
            visibility: "hidden",
            position: "fixed",
            height: "fit-content",
            width: "fit-content",
        });
        const cs = window.getComputedStyle(this.element);
        const borderTopWidth = parseFloat(cs.borderTopWidth);
        const borderBottomWidth = parseFloat(cs.borderBottomWidth);
        const scrollHeight = this.element.scrollHeight + borderTopWidth + borderBottomWidth;
        const rect = this.element.getBoundingClientRect();
        const dimensions = {
            width: rect.width,
            height: rect.height + borderTopWidth + borderBottomWidth,
            scrollHeight,
        };
        Object.assign(this.element.style, originalStyles);
        return dimensions;
    }
    /**
     * Runs an "expand/open" transition.
     *
     * The element is first placed into an initial collapsed state (`height: 0`, `opacity: 0`)
     * and then transitioned to its target geometry.
     *
     * ### Side effects
     * - Mutates inline styles (`display`, `width`, `left`, `top`, `maxHeight`, `height`, `opacity`, `overflow`, `transition`).
     * - Toggles position classes (`position-top` / `position-bottom`) based on config.
     *
     * ### Completion model
     * - Uses `setTimeout(duration)` to finalize (`transition: none`) and invoke `onComplete`.
     * - Does not listen for `transitionend`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Expand animation parameters and completion callback.
     * @returns The current instance (chainable).
     */
    expand(config) {
        if (!this.element)
            return this;
        this.cancel();
        this._isAnimating = true;
        const { duration = 200, display = "flex", width, left, top, maxHeight, realHeight, position = "bottom", onComplete, } = config;
        const initialTop = position === "bottom" ? top : top + realHeight;
        Object.assign(this.element.style, {
            display,
            width: `${width}px`,
            left: `${left}px`,
            top: `${initialTop}px`,
            maxHeight: `${maxHeight}px`,
            height: "0px",
            opacity: "0",
            overflow: "hidden",
            transition: "none",
        });
        this.element.classList.toggle("position-top", position === "top");
        this.element.classList.toggle("position-bottom", position === "bottom");
        requestAnimationFrame(() => {
            const isScrollable = realHeight >= maxHeight;
            Object.assign(this.element.style, {
                transition: `top ${duration}ms, height ${duration}ms, opacity ${duration}ms`,
                top: `${top}px`,
                height: `${realHeight}px`,
                opacity: "1",
                overflow: isScrollable ? "auto" : "hidden",
            });
            this.timeOut = setTimeout(() => {
                this.element.style.transition = "none";
                this._isAnimating = false;
                onComplete?.();
            }, duration);
        });
        return this;
    }
    /**
     * Runs a "collapse/close" transition.
     *
     * The element is transitioned to `height: 0` and `opacity: 0`, then hidden via `display: none`.
     *
     * ### Side effects
     * - Mutates inline styles (`height`, `top`, `opacity`, `overflow`, `transition`, then `display`).
     * - Reads current geometry via `offsetHeight` / `offsetTop` and scrollability via `scrollHeight`.
     *
     * ### Completion model
     * - Uses `setTimeout(duration)` to finalize and invoke `onComplete`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Collapse animation parameters and completion callback.
     * @returns The current instance (chainable).
     */
    collapse(config) {
        if (!this.element)
            return this;
        this.cancel();
        this._isAnimating = true;
        const { duration = 200, onComplete } = config;
        const currentHeight = this.element.offsetHeight;
        const currentTop = this.element.offsetTop;
        const position = this.element.classList.contains("position-top")
            ? "top"
            : "bottom";
        const isScrollable = this.element.scrollHeight - this.element.offsetHeight > 0;
        const finalTop = position === "top" ? currentTop + currentHeight : currentTop;
        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `height ${duration}ms, top ${duration}ms, opacity ${duration}ms`,
                height: "0px",
                top: `${finalTop}px`,
                opacity: "0",
                overflow: isScrollable ? "auto" : "hidden",
            });
            this.timeOut = setTimeout(() => {
                Object.assign(this.element.style, {
                    display: "none",
                    transition: "none",
                });
                this._isAnimating = false;
                onComplete?.();
            }, duration);
        });
        return this;
    }
    /**
     * Runs a horizontal "swipe-in" animation (reveals element by expanding width).
     *
     * The element is measured using {@link getHiddenDimensions} and then transitioned from `width: 0`
     * to the measured width.
     *
     * ### Side effects
     * - Mutates inline styles (`display`, `width`, `overflow`, `transition`).
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Swipe parameters (`duration`, `display`) and completion callback.
     * @returns The current instance (chainable).
     */
    showSwipeWidth(config) {
        if (!this.element)
            return this;
        this.cancel();
        this._isAnimating = true;
        const { duration = 200, display = "block", onComplete } = config;
        Object.assign(this.element.style, {
            transition: "none",
            display,
            width: "fit-content",
        });
        const maxWidth = this.getHiddenDimensions(display).width;
        Object.assign(this.element.style, { width: "0px" });
        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `width ${duration}ms`,
                width: `${maxWidth}px`,
                overflow: "hidden",
            });
        });
        this.timeOut = setTimeout(() => {
            Object.assign(this.element.style, {
                width: "",
                overflow: "",
                transition: "",
            });
            this._isAnimating = false;
            onComplete?.();
        }, duration);
        return this;
    }
    /**
     * Runs a horizontal "swipe-out" animation (hides element by collapsing width).
     *
     * The element is measured using {@link getHiddenDimensions} and then transitioned from
     * the measured width down to `width: 0`.
     *
     * ### Side effects
     * - Mutates inline styles (`width`, `overflow`, `transition`, and clears `display` on completion).
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Swipe parameters (`duration`) and completion callback.
     * @returns The current instance (chainable).
     */
    hideSwipeWidth(config) {
        if (!this.element)
            return this;
        this.cancel();
        this._isAnimating = true;
        const { duration = 200, onComplete } = config;
        const maxWidth = this.getHiddenDimensions().width;
        Object.assign(this.element.style, {
            transition: "none",
            width: `${maxWidth}px`,
        });
        requestAnimationFrame(() => {
            Object.assign(this.element.style, {
                transition: `width ${duration}ms`,
                width: "0px",
                overflow: "hidden",
            });
        });
        this.timeOut = setTimeout(() => {
            Object.assign(this.element.style, {
                width: "",
                overflow: "",
                transition: "",
                display: "",
            });
            this._isAnimating = false;
            onComplete?.();
        }, duration);
        return this;
    }
    /**
     * Runs a resize/reposition update for an already-visible element.
     *
     * Intended for "content changed" scenarios (e.g., list height changes, position flips).
     *
     * ### Behavior
     * - Updates size/position-related inline styles (width/left/top/maxHeight/height/overflowY).
     * - Optionally animates the transition (based on `animate` and heuristic diffs).
     * - When position flips (top ↔ bottom), a more explicit transition may be applied.
     *
     * ### Completion model
     * - Uses timeouts to clear the `transition` style and call `onComplete`.
     * - Does not listen for `transitionend`.
     *
     * No-ops:
     * - If {@link element} is not bound, returns immediately.
     *
     * @param config - Resize parameters including geometry, animation flags, and completion callback.
     * @returns The current instance (chainable).
     */
    resize(config) {
        if (!this.element)
            return this;
        this.cancel();
        const { duration = 200, width, left, top, maxHeight, realHeight, position = "bottom", animate = true, onComplete, } = config;
        const currentPosition = this.element.classList.contains("position-top")
            ? "top"
            : "bottom";
        const isPositionChanged = currentPosition !== position;
        const isScrollable = this.element.scrollHeight > maxHeight;
        this.element.classList.toggle("position-top", position === "top");
        this.element.classList.toggle("position-bottom", position === "bottom");
        if (isPositionChanged) {
            this.element.style.transition = `top ${duration}ms ease-out, height ${duration}ms ease-out, max-height ${duration}ms ease-out;`;
        }
        requestAnimationFrame(() => {
            const styles = {
                width: `${width}px`,
                left: `${left}px`,
                top: `${top}px`,
                maxHeight: `${maxHeight}px`,
                height: `${realHeight}px`,
                overflowY: isScrollable ? "auto" : "hidden",
            };
            const heightDiff = Math.abs(this.element.offsetHeight - realHeight);
            if (animate && (isPositionChanged || heightDiff > 5)) {
                styles.transition = `height ${duration}ms, top ${duration}ms`;
            }
            else {
                this.resizeTimeout = setTimeout(() => {
                    if (this.element?.style) {
                        this.element.style.transition = null;
                    }
                }, duration);
            }
            Object.assign(this.element.style, styles);
            if (animate && (isPositionChanged || heightDiff > 1)) {
                this.resizeTimeout = setTimeout(() => {
                    this.element.style.transition = null;
                    if (isPositionChanged)
                        delete this.element.style.transition;
                    onComplete?.();
                }, duration);
            }
            else {
                if (isPositionChanged)
                    delete this.element.style.transition;
                onComplete?.();
            }
        });
        return this;
    }
    /**
     * Indicates whether this effector currently considers itself in an active animation window.
     *
     * Notes:
     * - This flag is time-based and is cleared when internal timeouts complete or when {@link cancel} is called.
     * - It does not guarantee that the browser is still transitioning (no `transitionend` tracking).
     *
     * @returns `true` while an animation is in-flight; otherwise `false`.
     */
    get isAnimating() {
        return this._isAnimating;
    }
}

/**
 * Base model primitive that binds a domain object to a target DOM element and an optional View.
 *
 * This class is the **Model** part of the library's Model/View separation:
 * - The **Model** owns references to the authoritative DOM source (`targetElement`) and configuration (`options`).
 * - The **View** (if attached) owns rendering and DOM event wiring for the model.
 * - Higher-level infrastructure (e.g., Adapter / RecyclerView) orchestrates when models are created,
 *   bound to views, and updated.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor calls {@link Lifecycle.init} immediately, transitioning `NEW → INITIALIZED`.
 * - This base model does not call `mount()` by itself; mounting is typically handled by the View layer.
 * - {@link updateTarget} triggers {@link Lifecycle.update}, which emits `onUpdate` lifecycle hooks in
 *   `MOUNTED/UPDATED` states (and is guarded otherwise).
 * - {@link destroy} transitions to `DESTROYED`, clears references, and destroys the associated view.
 *
 * ### Idempotency / No-ops
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 * - {@link updateTarget} is safe to call multiple times; consumers should treat repeated assignments
 *   as a no-op when the target does not change (this base class does not compare equality).
 *
 * ### Ownership & side effects
 * - This model **owns** its `view` reference and will call `view.destroy()` during {@link destroy}.
 * - The model itself does not mutate the DOM, except reading from `targetElement` (e.g., {@link value}).
 *   Any DOM side effects are expected to live in the View implementation.
 *
 * @template TTarget - The DOM element type this model is bound to (e.g., HTMLOptionElement).
 * @template TTags - Named element map used by the view (view-specific DOM handles).
 * @template TView - View implementation associated with this model.
 * @template TOptions - Configuration/options type carried by the model.
 *
 * @implements {ModelContract<TTarget, TView>}
 * @extends Lifecycle
 * @see {@link ViewContract}
 * @see {@link LifecycleState}
 */
class Model extends Lifecycle {
    /**
     * Returns the current "value" associated with the bound target element.
     *
     * Implementation note:
     * - Reads from the target element's `"value"` attribute via `getAttribute("value")`.
     * - Returns `null` when no target is bound or the attribute is not present.
     *
     * @returns {string | null | string[]} The value representation of the target element.
     */
    get value() {
        return this.targetElement?.getAttribute("value") ?? null;
    }
    /**
     * Creates a new model instance and initializes lifecycle state.
     *
     * - Captures {@link options}.
     * - Optionally binds an initial {@link targetElement} and {@link view}.
     * - Calls {@link Lifecycle.init} immediately (`NEW → INITIALIZED`).
     *
     * @param {TOptions} options - Configuration options for the model.
     * @param {TTarget} [targetElement=null] - Optional DOM element to bind.
     * @param {TView} [view=null] - Optional view responsible for rendering this model.
     */
    constructor(options, targetElement, view) {
        super();
        /**
         * Position index used by list infrastructure for ordering/tracking.
         * Semantics are library-specific (e.g., top-level index or adapter position).
         */
        this.position = -1;
        /**
         * Indicates whether this model has completed its initial binding step.
         * Typically set by the adapter/view binding layer to prevent duplicate listener wiring.
         */
        this.isInit = false;
        /**
         * Indicates whether this model has been removed/destroyed from the active dataset.
         * Set to `true` during {@link destroy}.
         */
        this.isRemoved = false;
        this.options = options;
        this.targetElement = targetElement;
        this.view = view;
        this.init();
    }
    /**
     * Rebinds this model to a new target DOM element and marks the model as updated.
     *
     * Typical usage:
     * - Reconciliation when the underlying DOM node is replaced (e.g., `<option>` node recreated).
     * - Keeping model identity stable while swapping its backing DOM node.
     *
     * Side effects:
     * - Assigns {@link targetElement}.
     * - Calls {@link Lifecycle.update} (guarded by lifecycle state).
     *
     * @param {TTarget} targetElement - The new DOM element to associate with this model.
     * @returns {void}
     */
    updateTarget(targetElement) {
        this.targetElement = targetElement;
        this.update();
    }
    /**
     * Destroys this model and releases owned resources.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Clears {@link targetElement}.
     * - Destroys the associated {@link view} (if present) and clears the reference.
     * - Marks {@link isRemoved} as `true`.
     * - Calls {@link Lifecycle.destroy} to transition to `DESTROYED` and clear hooks.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.targetElement = null;
        this.view?.destroy();
        this.view = null;
        this.isRemoved = true;
        super.destroy();
    }
}

/**
 * Domain model for a native `<optgroup>` element.
 *
 * This model represents a **group header** plus its **child options** and is used by
 * adapters/recyclers to render grouped lists (e.g., {@link GroupView} + {@link OptionModel} rows).
 *
 * ### Responsibility
 * - Mirror and synchronize state derived from the backing `<optgroup>`:
 *   - `label` from `optgroup.label`
 *   - `collapsed` from `optgroup.dataset.collapsed` (string → boolean)
 * - Own and manage the group’s child {@link OptionModel} collection, including back-references.
 * - Provide derived selectors for consumer logic: `value`, `selectedItems`, `visibleItems`, `hasVisibleItems`.
 * - Emit collapsed-state change notifications to subscribers via `onCollapsedChanged(...)`.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor delegates to {@link Model} and initializes base lifecycle (`NEW → INITIALIZED`).
 * - {@link init} reads initial state from the target element and transitions to `MOUNTED`.
 * - {@link update} keeps the attached {@link GroupView} in sync (label + collapsed state).
 * - {@link destroy} destroys all child options and transitions to `DESTROYED` (idempotent).
 *
 * ### Relationships
 * - **Model ↔ View**: `view` (when assigned) is a {@link GroupView} responsible for DOM updates.
 * - **Group ↔ Options**: `items` contains child {@link OptionModel}s; each option holds `option.group`.
 * - **Adapter/Recycler**: binders (e.g., MixedAdapter) call `addItem/removeItem`, set `view`,
 *   and invoke {@link updateVisibility} based on filtering/virtualization outcomes.
 *
 * ### Events / Hooks
 * - Collapsed changes are dispatched through {@link iEvents.callEvent} to callbacks registered via
 *   {@link onCollapsedChanged}. These callbacks receive an `evtToken` for iEvents chaining/cancellation,
 *   the model, and the new collapsed state.
 *
 * @extends {Model<HTMLOptGroupElement, GroupViewTags, GroupView, SelectiveOptions>}
 * @see {@link OptionModel}
 * @see {@link GroupView}
 */
class GroupModel extends Model {
    /**
     * Creates a group model from configuration and an optional `<optgroup>` element.
     *
     * @param {SelectiveOptions} options - Shared configuration for models/views.
     * @param {HTMLOptGroupElement} [targetElement] - Backing `<optgroup>` element (when available).
     */
    constructor(options, targetElement) {
        super(options, targetElement ?? null, null);
        /** Group label (mirrors `HTMLSelectOptGroupElement.label`). */
        this.label = "";
        /**
         * Child option models that belong to this group.
         *
         * Ownership: this group destroys its children in {@link destroy}.
         */
        this.items = [];
        /**
         * Whether this group is collapsed.
         *
         * Source-of-truth:
         * - Initialized from `targetElement.dataset.collapsed` (string → boolean).
         * - Toggled via {@link toggleCollapse}.
         */
        this.collapsed = false;
        /**
         * Subscribers invoked when collapsed state changes.
         * Callbacks are invoked through {@link iEvents.callEvent}.
         */
        this.privOnCollapsedChanged = [];
        this.label = this.targetElement.label;
        this.collapsed = Libs.string2Boolean(this.targetElement.dataset?.collapsed);
    }
    /**
     * Initializes group state from the backing `<optgroup>` (if present) and mounts the model.
     *
     * Behavior:
     * - Reads `label` from `targetElement.label`.
     * - Reads `collapsed` from `targetElement.dataset.collapsed` via {@link Libs.string2Boolean}.
     * - Calls `super.init()` then transitions to `MOUNTED` via `mount()`.
     *
     * Idempotency:
     * - Base {@link Model}/{@link Lifecycle} guards prevent duplicate `init()` transitions.
     *
     * @returns {void}
     * @override
     */
    init() {
        super.init();
        this.mount();
    }
    /**
     * Returns all option values within this group.
     *
     * @returns {string[]} Values of all child options (in current `items` order).
     */
    get value() {
        return this.items.map((item) => item.value);
    }
    /**
     * Returns the subset of child options that are currently selected.
     *
     * @returns {OptionModel[]} Selected child options.
     */
    get selectedItems() {
        return this.items.filter((item) => item.selected);
    }
    /**
     * Returns the subset of child options that are currently visible.
     *
     * Visibility is typically controlled by filtering/search (e.g., toggling `OptionModel.visible`).
     *
     * @returns {OptionModel[]} Visible child options.
     */
    get visibleItems() {
        return this.items.filter((item) => item.visible);
    }
    /**
     * Whether the group has at least one visible option.
     *
     * @returns {boolean} True if any child option is visible.
     */
    get hasVisibleItems() {
        return this.visibleItems.length > 0;
    }
    /**
     * Rebinds this model to a new `<optgroup>` element and synchronizes the label immediately.
     *
     * Notes:
     * - This method updates the label and pushes it to the view, then triggers a lifecycle update.
     * - The signature is intentionally stricter than the base model (`HTMLOptGroupElement` only).
     *
     * @param {HTMLOptGroupElement} targetElement - Updated backing `<optgroup>` element.
     * @returns {void}
     */
    updateTarget(targetElement) {
        this.label = targetElement.label;
        this.view?.updateLabel(this.label);
        this.update();
    }
    /**
     * Synchronizes the attached view (if any) with current model state and emits lifecycle update.
     *
     * View sync:
     * - Updates header label
     * - Applies collapsed state
     *
     * @returns {void}
     * @override
     */
    update() {
        if (this.view) {
            this.view.updateLabel(this.label);
            this.view.setCollapsed(this.collapsed);
        }
        super.update();
    }
    /**
     * Destroys the group model and releases owned resources.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Destroys all child {@link OptionModel} instances.
     * - Clears the `items` array.
     * - Completes lifecycle teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.items.forEach((item) => {
            item.destroy();
        });
        this.items = [];
        super.destroy();
    }
    /**
     * Subscribes to changes in the group's collapsed state.
     *
     * Callbacks are invoked from {@link toggleCollapse} via {@link iEvents.callEvent}.
     *
     * @param {(evtToken: IEventCallback, model: GroupModel, collapsed: boolean) => void} callback
     * Listener invoked with `(evtToken, model, collapsed)`.
     * @returns {void}
     */
    onCollapsedChanged(callback) {
        this.privOnCollapsedChanged.push(callback);
    }
    /**
     * Toggles collapsed state, updates the view, and notifies subscribers.
     *
     * Side effects:
     * - Mutates {@link collapsed}.
     * - Calls `view.setCollapsed(...)` if a view is attached.
     * - Dispatches callbacks registered via {@link onCollapsedChanged}.
     *
     * @returns {void}
     */
    toggleCollapse() {
        this.collapsed = !this.collapsed;
        this.view?.setCollapsed(this.collapsed);
        iEvents.callEvent([this, this.collapsed], ...this.privOnCollapsedChanged);
    }
    /**
     * Adds a child option to this group and sets the option's back-reference.
     *
     * @param {OptionModel} optionModel - Option to add.
     * @returns {void}
     */
    addItem(optionModel) {
        this.items.push(optionModel);
        optionModel.group = this;
    }
    /**
     * Removes a child option from this group and clears the option's back-reference.
     *
     * No-op if the option is not present in {@link items}.
     *
     * @param {OptionModel} optionModel - Option to remove.
     * @returns {void}
     */
    removeItem(optionModel) {
        const index = this.items.indexOf(optionModel);
        if (index > -1) {
            this.items.splice(index, 1);
            optionModel.group = null;
        }
    }
    /**
     * Requests the attached view (if any) to recompute/update its visibility.
     *
     * Typically called after child visibility changes (filter/search) so the group header can
     * reflect whether it contains visible items.
     *
     * No-op if no view is attached.
     *
     * @returns {void}
     */
    updateVisibility() {
        this.view?.updateVisibility();
    }
}

/**
 * Domain model for a native `<option>` element.
 *
 * This is the core selectable row model consumed by adapters/recyclers. It mirrors the backing
 * `<option>` node while also carrying UI-only state used by the headless+DOM-driven layer
 * (visibility, highlight, precomputed search key).
 *
 * ### Responsibility
 * - Mirror and synchronize state with the backing `<option>` element:
 *   - `value`, `selected`, `dataset`, and display label (with optional tag translation / HTML policy).
 * - Provide derived properties for rendering:
 *   - image resolution (`imageSrc` / `hasImage`),
 *   - rich/stripped label (`text` / `textContent`),
 *   - normalized search key (`textToFind`).
 * - Maintain UI-only flags:
 *   - `visible` for filtering/search,
 *   - `highlighted` for keyboard navigation/hover.
 * - Publish change notifications:
 *   - **External** selection (`selected`) vs **internal** selection sync (`selectedNonTrigger`),
 *   - visibility changes (`visible`).
 *
 * ### Lifecycle (Strict FSM)
 * - Base {@link Model} calls `init()` during construction (`NEW → INITIALIZED`), and this subclass
 *   overrides {@link init} to precompute {@link textToFind} before delegating to `super.init()`.
 * - {@link init} then transitions to `MOUNTED` via `mount()` for first render readiness.
 * - {@link update} recomputes derived text/search fields and pushes state into the {@link OptionView}
 *   if attached, then emits lifecycle update.
 * - {@link destroy} clears listeners/references and transitions to `DESTROYED` (idempotent).
 *
 * ### External vs internal selection semantics
 * - `selected` is the **external** user-facing signal:
 *   updates state (via {@link selectedNonTrigger}) and then notifies {@link onSelected} listeners.
 * - `selectedNonTrigger` is the **internal** sync signal:
 *   updates view/DOM/backing `<option>` and then notifies {@link onInternalSelected} listeners
 *   **without** implying user intent.
 *
 * ### DOM & a11y side effects (when a view is attached)
 * - Toggles CSS classes: `"hide"`, `"highlight"`, `"checked"`.
 * - Updates `aria-selected` on the option row root element.
 * - Updates label content (either `innerHTML` or `textContent` depending on `allowHtml`).
 * - Mirrors selection state to the backing `<option>` (property + attribute).
 *
 * @extends {Model<HTMLOptionElement, OptionViewTags, OptionView, SelectiveOptions>}
 * @see {@link GroupModel}
 * @see {@link OptionView}
 */
class OptionModel extends Model {
    /**
     * Creates an option model.
     *
     * @param {SelectiveOptions} options - Shared configuration for models/views.
     * @param {HTMLOptionElement} [targetElement=null] - Backing `<option>` element.
     * @param {OptionView} [view=null] - Optional view used to render this model.
     */
    constructor(options, targetElement, view) {
        super(options, targetElement, view);
        /**
         * External selection subscribers (emitted by the {@link selected} setter).
         * Use this for user-facing selection flows.
         */
        this.privOnSelected = [];
        /**
         * Internal selection subscribers (emitted by the {@link selectedNonTrigger} setter).
         * Use this for silent synchronization flows.
         */
        this.privOnInternalSelected = [];
        /**
         * Visibility subscribers (emitted by the {@link visible} setter).
         * Commonly used to recompute group visibility and update aggregated visibility stats.
         */
        this.privOnVisibilityChanged = [];
        /**
         * Visibility flag used for filtering/search.
         * When `false`, adapters/recyclers may treat this item as non-renderable.
         */
        this._visible = true;
        /** Highlight flag used for keyboard navigation / hover. */
        this._highlighted = false;
    }
    /**
     * Initializes the model and precomputes the search key.
     *
     * - Computes {@link textToFind} from {@link textContent} (lowercased + normalized).
     * - Delegates to `super.init()` and then transitions to `MOUNTED` via `mount()`.
     *
     * @returns {void}
     * @override
     */
    init() {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());
        super.init();
        this.mount();
    }
    /**
     * Image source resolved from dataset (`imgsrc` or `image`), or empty string if absent.
     *
     * @returns {string}
     */
    get imageSrc() {
        return this.dataset?.imgsrc || this.dataset?.image || "";
    }
    /**
     * Whether this option has an image associated with it.
     *
     * @returns {boolean}
     */
    get hasImage() {
        return !!this.imageSrc;
    }
    /**
     * Current value of the backing `<option>`.
     *
     * @returns {string}
     */
    get value() {
        return this.targetElement?.value ?? "";
    }
    /**
     * Whether the backing `<option>` is selected.
     *
     * @returns {boolean}
     */
    get selected() {
        return !!this.targetElement?.selected;
    }
    /**
     * Sets selected state and emits **external** selection listeners.
     *
     * Flow:
     * - Delegates to {@link selectedNonTrigger} to synchronize view/DOM/backing element.
     * - Notifies {@link onSelected} subscribers via {@link iEvents.callEvent}.
     *
     * @param {boolean} value - New selection state.
     * @returns {void}
     */
    set selected(value) {
        this.selectedNonTrigger = value;
        iEvents.callEvent([this, value], ...this.privOnSelected);
    }
    /**
     * Whether this option is visible (used for filtering/search).
     *
     * @returns {boolean}
     */
    get visible() {
        return this._visible;
    }
    /**
     * Sets visibility and synchronizes the view (if attached), then emits visibility listeners.
     *
     * Side effects (when view attached):
     * - Toggles `"hide"` CSS class on the view root element.
     *
     * Idempotent:
     * - No-op if the new value equals the current state.
     *
     * @param {boolean} value - New visibility state.
     * @returns {void}
     */
    set visible(value) {
        if (this._visible === value)
            return;
        this._visible = value;
        const viewEl = this.view?.getView?.();
        if (viewEl)
            viewEl.classList.toggle("hide", !value);
        iEvents.callEvent([this, value], ...this.privOnVisibilityChanged);
    }
    /**
     * Reads selected state without emitting external selection listeners.
     *
     * @returns {boolean}
     */
    get selectedNonTrigger() {
        return this.selected;
    }
    /**
     * Sets selected state **silently** (internal sync), updates view/a11y/backing DOM, then emits internal listeners.
     *
     * Side effects (when view/backing element exist):
     * - Updates the input checked state (`OptionInput`) if present.
     * - Toggles `"checked"` class on the root element.
     * - Sets `aria-selected`.
     * - Mirrors to backing `<option>`:
     *   - toggles `selected` attribute,
     *   - sets `targetElement.selected`.
     *
     * @param {boolean} value - New selection state.
     * @returns {void}
     */
    set selectedNonTrigger(value) {
        const input = this.view?.view?.tags?.OptionInput;
        const viewEl = this.view?.getView?.();
        if (input) {
            input.checked = value;
        }
        if (viewEl && this.targetElement) {
            viewEl.classList.toggle("checked", !!value);
            viewEl.setAttribute("aria-selected", value ? "true" : "false");
            this.targetElement.toggleAttribute("selected", !!value);
        }
        if (this.targetElement) {
            this.targetElement.selected = value;
        }
        iEvents.callEvent([this, value], ...this.privOnInternalSelected);
    }
    /**
     * Display label for rendering (with tag translation and HTML policy).
     *
     * Source precedence:
     * - `dataset.mask` if present, otherwise `targetElement.text`.
     *
     * Policy:
     * - When `options.allowHtml === true`, returns translated HTML.
     * - When `options.allowHtml === false`, returns plain text (HTML stripped).
     *
     * @returns {string}
     */
    get text() {
        const raw = this.dataset?.mask ?? this.targetElement?.text ?? "";
        const translated = Libs.tagTranslate(raw);
        return this.options.allowHtml ? translated : Libs.stripHtml(translated);
    }
    /**
     * Plain-text version of the display label, trimmed.
     *
     * - If `allowHtml` is enabled, strips HTML from {@link text}.
     * - Otherwise returns {@link text} directly (already plain).
     *
     * @returns {string}
     */
    get textContent() {
        return this.options.allowHtml
            ? Libs.stripHtml(this.text).trim()
            : this.text.trim();
    }
    /**
     * Dataset object of the backing `<option>` element.
     *
     * @returns {DOMStringMap}
     */
    get dataset() {
        return this.targetElement?.dataset ?? {};
    }
    /**
     * Whether this option is currently highlighted (navigation/hover).
     *
     * @returns {boolean}
     */
    get highlighted() {
        return this._highlighted;
    }
    /**
     * Sets highlight state and synchronizes the view (if attached).
     *
     * Side effects:
     * - Toggles `"highlight"` CSS class on the view root element.
     *
     * @param {boolean} value - New highlight state.
     * @returns {void}
     */
    set highlighted(value) {
        const val = !!value;
        const viewEl = this.view?.getView?.();
        if (this._highlighted !== val)
            this._highlighted = val;
        if (viewEl)
            viewEl.classList.toggle("highlight", val);
    }
    /**
     * Subscribes to **external** selection changes (emitted by {@link selected}).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    onSelected(callback) {
        this.privOnSelected.push(callback);
    }
    /**
     * Subscribes to **internal** selection changes (emitted by {@link selectedNonTrigger}).
     *
     * @param {(evtToken: IEventCallback, el: OptionModel, selected: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    onInternalSelected(callback) {
        this.privOnInternalSelected.push(callback);
    }
    /**
     * Subscribes to visibility changes (emitted by {@link visible}).
     *
     * @param {(evtToken: IEventCallback, model: OptionModel, visible: boolean) => void} callback - Listener callback.
     * @returns {void}
     */
    onVisibilityChanged(callback) {
        this.privOnVisibilityChanged.push(callback);
    }
    /**
     * Synchronizes derived fields and the attached view from the current backing element/options.
     *
     * Syncs:
     * - {@link textToFind} (normalized search key)
     * - Label content:
     *   - `innerHTML` when `allowHtml` is enabled,
     *   - otherwise `textContent`
     * - Image attributes (`src`/`alt`) when present
     * - Selected state from `targetElement.selected` via {@link selectedNonTrigger}
     *
     * No-op for view updates when no view is attached; still emits lifecycle update via `super.update()`.
     *
     * @returns {void}
     * @override
     */
    update() {
        this.textToFind = Libs.string2normalize(this.textContent.toLowerCase());
        if (!this.view) {
            super.update();
            return;
        }
        const labelContent = this.view.view.tags.LabelContent;
        if (labelContent) {
            if (this.options.allowHtml) {
                labelContent.innerHTML = this.text;
            }
            else {
                labelContent.textContent = this.textContent;
            }
        }
        const imageTag = this.view.view.tags.OptionImage;
        if (imageTag && this.hasImage) {
            if (imageTag.src != this.imageSrc) {
                imageTag.src = this.imageSrc;
            }
            if (imageTag.alt != this.text) {
                imageTag.alt = this.text;
            }
        }
        if (this.targetElement)
            this.selectedNonTrigger = this.targetElement.selected;
        super.update();
    }
    /**
     * Destroys the model and releases listener references.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Clears external/internal selection listeners and visibility listeners.
     * - Detaches from parent group and clears cached search key.
     * - Completes teardown via `super.destroy()` (base {@link Model} also destroys the view if present).
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.privOnSelected = [];
        this.privOnInternalSelected = [];
        this.privOnVisibilityChanged = [];
        this.group = null;
        this.textToFind = null;
        super.destroy();
    }
}

/**
 * Headless orchestrator for model creation/reconciliation and wiring of the view layer.
 *
 * ### Responsibilities
 * - Build and maintain an ordered list of models ({@link GroupModel} / {@link OptionModel})
 *   from raw `<optgroup>` / `<option>` elements.
 * - Own the {@link Adapter} and {@link RecyclerViewContract} instances and propagate updates/refreshes.
 * - Provide a small event pipeline surface by delegating to adapter pre-/post-change hooks.
 *
 * **Lifecycle (Strict FSM)**
 * - `NEW` → `INITIALIZED` (via constructor which calls `init()`).
 * - `MOUNTED` is entered automatically on the first `createModelResources()` when state is `INITIALIZED`.
 * - Subsequent calls to `refresh()`/`updateModel()` drive the `UPDATED` phase.
 * - `DESTROYED` releases resources; further calls become **no-ops** where specified.
 *
 * **Idempotency / No-ops**
 * - `createModelResources()` recreates the internal list deterministically for the given input.
 * - `notify()`/`refresh()` are **no-ops** if required handles are not initialized.
 * - `destroy()` is idempotent once the object is `DESTROYED`.
 *
 * **Relationships**
 * - Consumes raw DOM-derived inputs, produces {@link GroupModel}/{@link OptionModel}.
 * - Feeds the models into an {@link Adapter} which is set on a {@link RecyclerViewContract}.
 * - Does not touch DOM directly; DOM side-effects are handled by the recycler view/renderer.
 *
 * **Events / Hooks**
 * - Exposes `triggerChanging()` and `triggerChanged()` which delegate to adapter pipelines
 *   (`Adapter#changingProp`, `Adapter#changeProp`) for external observers.
 * - Uses `skipEvent()` to temporarily suppress adapter event propagation (internal batch updates).
 *
 * @template TModel extends ModelContract<any, any> - Concrete model type used by the adapter.
 * @template TAdapter extends Adapter<TModel, ViewContract<any>> - Concrete adapter that consumes the models.
 * @extends Lifecycle
 * @see {@link Adapter}
 * @see {@link RecyclerViewContract}
 * @see {@link GroupModel}
 * @see {@link OptionModel}
 * @see {@link Lifecycle}
 */
class ModelManager extends Lifecycle {
    /**
     * Constructs a ModelManager with configuration options used by created models and components.
     * Transitions lifecycle `NEW → INITIALIZED` via {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object passed to {@link GroupModel}/{@link OptionModel}
     * and to view infrastructure through adapter/recycler.
     */
    constructor(options) {
        super();
        this.privModelList = [];
        this.options = null;
        this.oldPosition = 0;
        this.options = options;
        this.init();
    }
    /**
     * Registers the adapter class to be used for rendering and managing models.
     * Must be called before {@link load}.
     *
     * @param {new (...args: any[]) => TAdapter} adapter - The adapter constructor (class) to instantiate.
     * @returns {void}
     */
    setupAdapter(adapter) {
        this.privAdapter = adapter;
    }
    /**
     * Registers the RecyclerView class responsible for hosting and updating item views.
     * Must be called before {@link load}.
     *
     * @param {new (...args: any[]) => RecyclerViewContract<TAdapter>} recyclerView - The recycler view constructor.
     * @returns {void}
     */
    setupRecyclerView(recyclerView) {
        this.privRecyclerView = recyclerView;
    }
    /**
     * Builds model instances ({@link GroupModel}/{@link OptionModel}) from raw `<optgroup>`/`<option>` elements.
     * Preserves grouping relationships and returns the structured list.
     *
     * **Behavior**
     * - When called while state is `INITIALIZED`, this method performs a one-time `mount()` (auto-mount).
     * - Uses a simple in-order traversal; the current group is the last seen `<optgroup>`.
     * - For options, the parent is inferred via `__parentGroup` identity when available.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - Parsed DOM elements from the source `<select>`.
     * @returns {Array<GroupModel | OptionModel>} The ordered list of group and option models.
     */
    createModelResources(modelData) {
        if (this.is(LifecycleState.INITIALIZED)) {
            this.mount();
        }
        this.privModelList = [];
        let currentGroup = null;
        modelData.forEach((data) => {
            if (data.tagName === "OPTGROUP") {
                currentGroup = new GroupModel(this.options, data);
                this.privModelList.push(currentGroup);
            }
            else if (data.tagName === "OPTION") {
                const optionModel = new OptionModel(this.options, data);
                const parentGroup = data["__parentGroup"];
                if (parentGroup &&
                    currentGroup &&
                    parentGroup === currentGroup.targetElement) {
                    currentGroup.addItem(optionModel);
                    optionModel.group = currentGroup;
                }
                else {
                    this.privModelList.push(optionModel);
                    currentGroup = null;
                }
            }
        });
        return this.privModelList;
    }
    /**
     * Replaces the current model list with new data and syncs it into the adapter,
     * then refreshes the view to reflect changes.
     *
     * **Notes**
     * - If the adapter is not yet initialized, syncing is skipped (safe no-op).
     * - After sync, calls {@link refresh} with `isUpdate = false`.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - New source elements to rebuild models from.
     * @returns {Promise<void>} Resolves when the adapter (if any) completes syncing.
     * @see Adapter#syncFromSource
     */
    async replace(modelData) {
        this.createModelResources(modelData);
        if (this.privAdapterHandle) {
            // Adapter expects TModel[], but this manager's list is GroupModel|OptionModel.
            await this.privAdapterHandle.syncFromSource(this.privModelList);
        }
        this.refresh(false);
    }
    /**
     * Requests a view refresh if an adapter has been initialized,
     * typically used after external updates to model data.
     * **No-op** if the adapter is absent.
     *
     * @returns {void}
     */
    notify() {
        if (!this.privAdapterHandle)
            return;
        this.refresh(false);
    }
    /**
     * Initializes adapter and recycler view instances, attaches them to a container element,
     * and applies optional configuration overrides for adapter and recyclerView (via `Object.assign`).
     *
     * **Requirements**
     * - Call {@link setupAdapter} and {@link setupRecyclerView} beforehand to provide constructors.
     * - The current `privModelList` becomes the initial dataset for the adapter.
     *
     * **Side effects**
     * - Sets the adapter on the recycler via `recycler.setAdapter(adapter)`.
     *
     * @template TExtra extends object
     * @param {HTMLElement} viewElement - Host element for the recycler view.
     * @param {Partial<TAdapter>} [adapterOpt={}] - Shallow overrides applied to the adapter instance.
     * @param {Partial<RecyclerViewContract<TAdapter>> & TExtra} [recyclerViewOpt={}] - Shallow overrides applied to the recycler instance.
     * @returns {void}
     * @see RecyclerViewContract#setAdapter
     */
    load(viewElement, adapterOpt = {}, recyclerViewOpt = {}) {
        this.privAdapterHandle = new this.privAdapter(this.privModelList);
        Object.assign(this.privAdapterHandle, adapterOpt);
        this.privRecyclerViewHandle = new this.privRecyclerView(viewElement);
        Object.assign(this.privRecyclerViewHandle, recyclerViewOpt);
        this.privRecyclerViewHandle.setAdapter(this.privAdapterHandle);
    }
    /**
     * Diffs existing models against new `<optgroup>`/`<option>` data to update in place:
     * reuses existing models when possible, updates positions and group membership,
     * removes stale views, and notifies adapter and listeners about updates.
     *
     * **Diffing strategy**
     * - Groups are keyed by `label`.
     * - Options are keyed by `${value}::${text}`.
     * - Removed groups/options are destroyed.
     * - Per-item `position` is recomputed sequentially.
     *
     * **Refresh semantics**
     * - Computes `isUpdate`: `false` on the first run and when removals occur; `true` otherwise.
     * - Calls `adapter.updateData()` and then {@link refresh} with the computed flag.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - Source elements to reconcile against.
     * @returns {void}
     * @see Adapter#updateData
     */
    updateModel(modelData) {
        const oldModels = this.privModelList;
        const newModels = [];
        const oldGroupMap = new Map();
        const oldOptionMap = new Map();
        oldModels.forEach((model) => {
            if (model instanceof GroupModel) {
                oldGroupMap.set(model.label, model);
            }
            else if (model instanceof OptionModel) {
                const key = `${model.value}::${model.textContent}`;
                oldOptionMap.set(key, model);
            }
        });
        let currentGroup = null;
        let position = 0;
        modelData.forEach((data) => {
            if (data.tagName === "OPTGROUP") {
                const dataVset = data;
                const existingGroup = oldGroupMap.get(dataVset.label);
                if (existingGroup) {
                    // Label is used as key; keep original behavior.
                    const hasLabelChange = existingGroup.label !== dataVset.label;
                    if (hasLabelChange) {
                        existingGroup.updateTarget(dataVset);
                    }
                    existingGroup.position = position;
                    existingGroup.items = [];
                    currentGroup = existingGroup;
                    newModels.push(existingGroup);
                    oldGroupMap.delete(dataVset.label);
                }
                else {
                    currentGroup = new GroupModel(this.options, dataVset);
                    currentGroup.position = position;
                    newModels.push(currentGroup);
                }
                position++;
            }
            else if (data.tagName === "OPTION") {
                const dataVset = data;
                const key = `${dataVset.value}::${dataVset.text}`;
                const existingOption = oldOptionMap.get(key);
                if (existingOption) {
                    existingOption.updateTarget(dataVset);
                    existingOption.position = position;
                    const parentGroup = dataVset["__parentGroup"];
                    if (parentGroup && currentGroup) {
                        currentGroup.addItem(existingOption);
                        existingOption.group = currentGroup;
                    }
                    else {
                        existingOption.group = null;
                        newModels.push(existingOption);
                    }
                    oldOptionMap.delete(key);
                }
                else {
                    const newOption = new OptionModel(this.options, dataVset);
                    newOption.position = position;
                    const parentGroup = dataVset["__parentGroup"];
                    if (parentGroup && currentGroup) {
                        currentGroup.addItem(newOption);
                        newOption.group = currentGroup;
                    }
                    else {
                        newModels.push(newOption);
                    }
                }
                position++;
            }
        });
        let isUpdate = true;
        if (this.oldPosition == 0) {
            isUpdate = false;
        }
        this.oldPosition = position;
        oldGroupMap.forEach((removedGroup) => {
            isUpdate = false;
            removedGroup.destroy();
        });
        oldOptionMap.forEach((removedOption) => {
            isUpdate = false;
            removedOption.destroy();
        });
        this.privModelList = newModels;
        if (this.privAdapterHandle) {
            this.privAdapterHandle.updateData(this.privModelList);
        }
        this.refresh(isUpdate);
    }
    /**
     * Instructs the adapter to temporarily skip event handling (e.g., during batch updates).
     *
     * @param {boolean} value - `true` to skip events; `false` to restore normal behavior.
     * @returns {void}
     */
    skipEvent(value) {
        if (this.privAdapterHandle)
            this.privAdapterHandle.isSkipEvent = value;
    }
    /**
     * Re-renders the recycler view if present and invokes the lifecycle update hook.
     * **No-op** if the recycler view is not initialized.
     *
     * @param {boolean} isUpdate - Indicates if this refresh follows an "update" operation (vs. full replace).
     * @returns {void}
     * @see Lifecycle#update
     */
    refresh(isUpdate) {
        if (!this.privRecyclerViewHandle)
            return;
        this.privRecyclerViewHandle.refresh(isUpdate);
        this.update();
    }
    /**
     * Releases adapter and recycler resources and clears all references.
     * Transitions to `DESTROYED`; subsequent calls are idempotent.
     *
     * **Important**
     * - Assumes handles were created via {@link load}; calling `destroy()` before `load()` may depend
     *   on the underlying implementations' null-tolerance.
     *
     * @returns {void}
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.privAdapterHandle.destroy();
        this.privRecyclerViewHandle.destroy();
        this.privModelList = [];
        this.privAdapter = null;
        this.privAdapterHandle = null;
        this.privRecyclerView = null;
        this.privRecyclerViewHandle = null;
        this.options = null;
        this.oldPosition = 0;
        super.destroy();
    }
    /**
     * Returns handles to the current resources, including the model list,
     * adapter instance, and recycler view instance.
     *
     * **Note**: The returned `adapter`/`recyclerView` may be `null` at runtime if {@link load} has not been called.
     *
     * @returns {{ modelList: Array<MixedItem>; adapter: TAdapter; recyclerView: RecyclerViewContract<TAdapter>; }}
     * The current resource references.
     */
    getResources() {
        return {
            modelList: this.privModelList,
            adapter: this.privAdapterHandle,
            recyclerView: this.privRecyclerViewHandle,
        };
    }
    /**
     * Triggers the adapter's pre-change pipeline for a named event,
     * enabling observers to react before a change is applied.
     *
     * **Delegates** to {@link Adapter.changingProp}.
     *
     * @param {string} event_name - Logical event name (consumer-defined).
     * @returns {Promise<void> | undefined} The adapter's promise, or `undefined` if the adapter is not initialized.
     * @fires changing
     */
    triggerChanging(event_name) {
        return this.privAdapterHandle?.changingProp(event_name);
    }
    /**
     * Triggers the adapter's post-change pipeline for a named event,
     * notifying observers after a change has been applied.
     *
     * **Delegates** to {@link Adapter.changeProp}.
     *
     * @param {string} event_name - Logical event name (consumer-defined).
     * @returns {Promise<void> | undefined} The adapter's promise, or `undefined` if the adapter is not initialized.
     * @fires changed
     */
    triggerChanged(event_name) {
        return this.privAdapterHandle?.changeProp(event_name);
    }
}

/**
 * RecyclerView renders models provided by an Adapter into a container element.
 *
 * Responsibilities:
 * - Maintain a root container (`viewElement`) where item views are rendered
 * - Attach an Adapter and wire item-change lifecycle:
 *   - `onPropChanging('items')` → clear container before items change
 *   - `onPropChanged('items')` → re-render after items change
 * - Expose rendering utilities: `render()`, `clear()`, `refresh()`
 * - Participate in the standard lifecycle (`init` → `mount` → `update` → `destroy`)
 *
 * @template TItem - The model type handled by the adapter.
 * @template TAdapter - The adapter type that manages items and updates the view.
 *
 * @implements {RecyclerViewContract<TAdapter>}
 */
class RecyclerView extends Lifecycle {
    /**
     * Constructs a RecyclerView with an optional container element that will host rendered item views.
     *
     * @param {HTMLDivElement|null} [viewElement=null] - The root element where the adapter will render items.
     */
    constructor(viewElement = null) {
        super();
        /** Root container that hosts rendered item views. */
        this.viewElement = null;
        /** The adapter that manages models and updates the RecyclerView on changes. */
        this.adapter = null;
        this.viewElement = viewElement;
        this.init();
    }
    /**
     * Attaches an adapter to the RecyclerView and wires item-change lifecycle:
     * - `onPropChanging('items')`: clears the container before items change
     * - `onPropChanged('items')`: re-renders after items change
     *
     * Then performs:
     * - `adapter.mount()` to initialize the adapter
     * - `this.mount()` to mark the RecyclerView as mounted
     * - An initial `render()` to sync the UI
     *
     * @param {TAdapter} adapter - The adapter managing models and their views.
     */
    setAdapter(adapter) {
        this.adapter = adapter;
        adapter.onPropChanging("items", () => {
            this.clear();
        });
        adapter.onPropChanged("items", () => {
            this.render();
        });
        adapter.mount();
        this.mount();
        this.render();
    }
    /**
     * Removes all child nodes from the rendering container, if present.
     * Typically used right before re-rendering or when items are about to change.
     */
    clear() {
        if (!this.viewElement)
            return;
        this.viewElement.replaceChildren();
    }
    /**
     * Renders the current adapter contents into the container.
     * No-ops if either the adapter or the container is not set.
     * Emits the `update` lifecycle after delegating rendering to the adapter.
     */
    render() {
        if (!this.adapter || !this.viewElement)
            return;
        this.adapter.updateRecyclerView(this.viewElement);
        this.update();
    }
    /**
     * Forces a re-render of the current adapter state into the container.
     * Useful when visual updates are required without changing the data.
     *
     * @param {boolean} isUpdate - Indicates if this refresh originates from an update operation.
     *                             (Reserved for future use; no impact on logic.)
     */
    refresh(isUpdate) {
        this.render();
    }
    /**
     * Destroys the RecyclerView, detaching from its adapter and container.
     *
     * - Delegates teardown to the adapter
     * - Clears strong references (adapter, viewElement)
     * - Ends the lifecycle
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.viewElement = null;
        this.adapter = null;
        super.destroy();
    }
}

/**
 * Accessory container that renders "selected chips" for multi-select mode.
 *
 * This component is a small DOM-driven helper that sits next to the Select UI mask and
 * visualizes current selections as removable chips. It does not own selection state by itself;
 * instead, it delegates deselection actions back to the {@link ModelManager} and underlying models.
 *
 * ### Responsibility
 * - Create a lightweight DOM container (single root node) for chips.
 * - Position the container relative to the Select UI mask (top or bottom insertion).
 * - Render the current selection set as removable chips.
 * - Dispatch deselect actions back into the selection pipeline:
 *   - pre-change hook via `modelManager.triggerChanging("select")`
 *   - then mutate the model (`OptionModel.selected = false`) to produce external selection events.
 * - Show/hide based on configuration (`accessoryVisible`, `multiple`) and chip count.
 *
 * ### Lifecycle (Strict FSM & idempotency)
 * - Construction optionally calls {@link initialize} and transitions `NEW → INITIALIZED` via {@link init}.
 * - {@link setRoot} binds DOM anchors, inserts the node into the mask container, then calls {@link mount}.
 * - {@link setModelData} re-renders chips and calls {@link update} (guarded: only after mounted).
 * - {@link destroy} removes the DOM node, clears references, and transitions to `DESTROYED`.
 *
 * No-ops / guards:
 * - `init()` is guarded to only run in `NEW`.
 * - `mount()` is guarded to only run in `INITIALIZED`.
 * - `update()` is guarded to only emit once mounted.
 *
 * ### Event / callback flow
 * - Chip remove click:
 *   1) prevents default
 *   2) awaits `modelManager.triggerChanging("select")` (pre-change pipeline)
 *   3) sets `modelData.selected = false` (external selection semantic)
 * - After rendering chips, triggers `window` `"resize"` via {@link iEvents.trigger} to allow
 *   popup/layout logic to recompute geometry.
 *
 * ### DOM & a11y side effects
 * - Creates a root `<div>` with classes `seui-accessorybox hide`.
 * - Stops `mouseup` propagation on the root to avoid "outside click" behaviors.
 * - Each chip has:
 *   - a `<span role="button">` with `aria-label`/`title` for screen readers and tooltips,
 *   - a content `<span>` rendered via `innerHTML` from {@link OptionModel.text}.
 * - Visibility is controlled via `"hide"` class.
 *
 * @extends Lifecycle
 * @see {@link ModelManager}
 * @see {@link OptionModel}
 */
class AccessoryBox extends Lifecycle {
    /**
     * Creates an AccessoryBox and optionally initializes it with configuration.
     *
     * @param {SelectiveOptions} [options=null] - Configuration controlling placement/visibility and texts.
     */
    constructor(options) {
        super();
        /**
         * Current selected option models rendered as chips.
         * This is a cached snapshot used for show/hide decisions and re-rendering.
         */
        this.modelDatas = [];
        if (options)
            this.initialize(options);
    }
    /**
     * Stores options and starts lifecycle initialization.
     *
     * Note: This does not attach the node into the DOM. DOM insertion occurs in {@link setRoot}
     * after the Select UI mask is available.
     *
     * @param {SelectiveOptions} options - Configuration object for the accessory box.
     * @returns {void}
     */
    initialize(options) {
        this.options = options;
        this.init(); // Trigger lifecycle initialization
    }
    /**
     * Initializes the accessory box DOM structure.
     *
     * Guarded: runs only when state is `NEW`.
     *
     * Side effects:
     * - Creates the root node with base classes (`seui-accessorybox`, `hide`).
     * - Stops `mouseup` propagation to avoid outside-click handlers reacting to chip interactions.
     *
     * @returns {void}
     * @override
     */
    init() {
        if (this.state !== LifecycleState.NEW)
            return;
        this.nodeMounted = Libs.mountNode({
            AccessoryBox: {
                tag: {
                    node: "div",
                    classList: ["seui-accessorybox", "hide"],
                    onmouseup: (evt) => {
                        // Prevent outside listeners from reacting to chip clicks
                        evt.stopPropagation();
                    },
                },
            },
        });
        this.node = this.nodeMounted.view;
        super.init(); // Mark as INITIALIZED
    }
    /**
     * Binds the component to the Select UI mask and inserts the accessory node into the DOM.
     *
     * - Captures the mask and its parent container.
     * - Calls {@link refreshLocation} to place the node either before or after the mask.
     * - Transitions to `MOUNTED` by calling {@link mount}.
     *
     * @param {HTMLDivElement} selectUIMask - The overlay/mask element of the main Select UI.
     * @returns {void}
     */
    setRoot(selectUIMask) {
        this.selectUIMask = selectUIMask;
        this.parentMask = selectUIMask.parentElement;
        this.refreshLocation();
        this.mount();
    }
    /**
     * Lifecycle mount (guarded).
     *
     * This component can only be mounted after {@link init} has completed (`INITIALIZED`).
     * No-op otherwise.
     *
     * @returns {void}
     * @override
     */
    mount() {
        if (!this.is(LifecycleState.INITIALIZED)) {
            return;
        }
        super.mount();
    }
    /**
     * Positions the accessory box relative to the Select UI mask.
     *
     * Placement:
     * - When `options.accessoryStyle === "top"`: insert before the mask.
     * - Otherwise: insert after the mask (before `mask.nextSibling`).
     *
     * No-op if the DOM anchors or {@link options} are not available.
     *
     * @returns {void}
     */
    refreshLocation() {
        if (!this.parentMask ||
            !this.node ||
            !this.selectUIMask ||
            !this.options)
            return;
        const ref = this.options.accessoryStyle === "top"
            ? this.selectUIMask
            : this.selectUIMask.nextSibling;
        this.parentMask.insertBefore(this.node, ref);
    }
    /**
     * Assigns the {@link ModelManager} used to run selection pipelines and mutate selection state.
     *
     * @param {ModelManager<MixedItem, MixedAdapter>} modelManager - Model manager controlling option state.
     * @returns {void}
     */
    setModelManager(modelManager) {
        this.modelManager = modelManager;
    }
    /**
     * Re-renders chips for the given selected options.
     *
     * Rendering behavior:
     * - Clears previous chips (`node.replaceChildren()`).
     * - When `options.multiple === true` and `modelDatas.length > 0`:
     *   - mounts a chip per option with:
     *     - a `<span role="button">` that deselects the option,
     *     - a content span rendered from `OptionModel.text` (HTML preserved).
     * - Otherwise, normalizes to an empty list.
     *
     * Deselect click flow:
     * 1) `preventDefault()`
     * 2) `await modelManager.triggerChanging("select")` (pre-change pipeline; no-op if manager is absent)
     * 3) `modelData.selected = false` (external selection semantics)
     *
     * Post-render side effects:
     * - Calls {@link refreshDisplay} to toggle visibility.
     * - Emits lifecycle {@link update} (guarded).
     * - Triggers a global `"resize"` event to allow layout/popup recalculation.
     *
     * @param {OptionModel[]} modelDatas - Selected options to render.
     * @returns {void}
     *
     * @remarks
     * The chip label uses `innerHTML` and therefore assumes `modelData.text` is trusted/sanitized upstream
     * when HTML rendering is enabled.
     */
    setModelData(modelDatas) {
        if (!this.node || !this.options)
            return;
        this.node.replaceChildren();
        if (modelDatas.length > 0 && this.options.multiple) {
            modelDatas.forEach((modelData) => {
                Libs.mountNode({
                    AccessoryItem: {
                        tag: { node: "div", classList: ["accessory-item"] },
                        child: {
                            Button: {
                                tag: {
                                    node: "span",
                                    classList: ["accessory-item-button"],
                                    role: "button",
                                    ariaLabel: `${this.options.textAccessoryDeselect}${modelData.textContent}`,
                                    title: `${this.options.textAccessoryDeselect}${modelData.textContent}`,
                                    onclick: async (evt) => {
                                        evt.preventDefault();
                                        await this.modelManager?.triggerChanging?.("select");
                                        modelData.selected = false;
                                    },
                                },
                            },
                            Content: {
                                tag: {
                                    node: "span",
                                    classList: ["accessory-item-content"],
                                    innerHTML: modelData.text,
                                },
                            },
                        },
                    },
                }, this.node);
            });
        }
        else {
            modelDatas = [];
        }
        this.modelDatas = modelDatas;
        this.refreshDisplay();
        this.update(); // lifecycle UPDATE
        iEvents.trigger(window, "resize");
    }
    /**
     * Lifecycle update (guarded).
     *
     * Only emits updates after the component is mounted. This keeps the FSM strict and prevents
     * update hooks from running before the node is attached to the DOM.
     *
     * @returns {void}
     * @override
     */
    update() {
        if (this.state !== LifecycleState.MOUNTED)
            return;
        super.update();
    }
    /**
     * Applies display rules based on configuration and current selection count.
     *
     * Visible when all are true:
     * - `options.accessoryVisible`
     * - `options.multiple`
     * - `modelDatas.length > 0`
     *
     * @returns {void}
     */
    refreshDisplay() {
        if (this.options?.accessoryVisible &&
            this.modelDatas.length > 0 &&
            this.options.multiple) {
            this.show();
        }
        else {
            this.hide();
        }
    }
    /**
     * Shows the accessory box by removing the `"hide"` CSS class.
     *
     * @returns {void}
     */
    show() {
        this.node?.classList.remove("hide");
    }
    /**
     * Hides the accessory box by applying the `"hide"` CSS class.
     *
     * @returns {void}
     */
    hide() {
        this.node?.classList.add("hide");
    }
    /**
     * Destroys the accessory box and releases owned resources.
     *
     * Behavior:
     * - Idempotent: returns early if already `DESTROYED`.
     * - Removes the root DOM node.
     * - Clears references (options, anchors, manager) and cached model data.
     * - Completes lifecycle teardown via `super.destroy()`.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.state === LifecycleState.DESTROYED)
            return;
        // Clean up DOM
        this.node?.remove();
        // Clear references
        this.nodeMounted = null;
        this.node = null;
        this.options = null;
        this.selectUIMask = null;
        this.parentMask = null;
        this.modelManager = null;
        this.modelDatas = [];
        super.destroy();
    }
}

/**
 * Search orchestration layer for Selective's Select UI.
 *
 * This controller bridges **user-driven search input** (keyword changes / infinite scroll)
 * to either:
 * - **Local filtering**: toggling model visibility flags in-memory, or
 * - **Remote search (AJAX)**: fetching, normalizing, and applying results back into the backing
 *   native `<select>` element.
 *
 * ### Responsibilities
 * - Choose search strategy (local vs AJAX) based on {@link AjaxConfig}.
 * - Normalize heterogeneous server response shapes into {@link NormalizedAjaxItem} via {@link parseResponse}.
 * - Track pagination state (page counters, `hasMore`, `isLoading`, current keyword).
 * - Apply remote results into the `<select>` (DOM mutation) and keep selection when requested.
 * - Coordinate transient UI states via {@link Popup} (loading indicator).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructed with references to the native `<select>`, a {@link ModelManager}, and {@link SelectBox}.
 * - Calls {@link Lifecycle.init} immediately during construction (via `initialize()`).
 * - Does **not** mount DOM by itself; it is invoked by higher-level components.
 * - {@link destroy} clears references; further calls should be treated as **no-ops** by consumers.
 *
 * ### Side effects
 * - Local search: mutates `OptionModel.visible` flags (model-layer side effects).
 * - AJAX apply: mutates `<select>` children (`innerHTML`, `appendChild`, dataset, selected state).
 * - UI: calls `popup.showLoading()` / `popup.hideLoading()` when a popup is attached.
 *
 * @extends Lifecycle
 * @see {@link ModelManager}
 * @see {@link AjaxConfig}
 * @see {@link Popup}
 */
class SearchController extends Lifecycle {
    /**
     * Creates a SearchController bound to a native `<select>` and an existing {@link ModelManager}.
     * Immediately transitions lifecycle `NEW → INITIALIZED` via {@link Lifecycle.init}.
     *
     * @param {HTMLSelectElement} selectElement - Native select element acting as the authoritative data source/target.
     * @param {ModelManager<MixedItem, any>} modelManager - Manager responsible for model resources and rendering refresh.
     * @param {SelectBox} selectBox - SelectBox handle used by configured AJAX data builders.
     */
    constructor(selectElement, modelManager, selectBox) {
        super();
        /**
         * SelectBox handle used by custom data builder functions that require Selective context.
         * NOTE: This is a reference; the controller does not own/destroy the SelectBox.
         */
        this.selectBox = null;
        /**
         * Remote pagination and loading state.
         * - `currentKeyword` is the last keyword used to compute pagination identity.
         * - `isPaginationEnabled` is inferred from server response shape.
         */
        this.paginationState = {
            currentPage: 0,
            totalPages: 1,
            hasMore: false,
            isLoading: false,
            currentKeyword: "",
            isPaginationEnabled: false,
        };
        this.initialize(selectElement, modelManager, selectBox);
    }
    /**
     * Captures dependencies and starts the controller lifecycle.
     * Intended to be called only from the constructor.
     *
     * @param {HTMLSelectElement} selectElement - Native select element.
     * @param {ModelManager<MixedItem, any>} modelManager - Model manager.
     * @param {SelectBox} selectBox - SelectBox handle.
     * @returns {void}
     */
    initialize(selectElement, modelManager, selectBox) {
        this.select = selectElement;
        this.modelManager = modelManager;
        this.selectBox = selectBox;
        this.init();
    }
    /**
     * Indicates whether remote (AJAX) search is configured.
     *
     * @returns {boolean} `true` when {@link AjaxConfig} is present; otherwise `false`.
     */
    isAjax() {
        return !!this.ajaxConfig;
    }
    /**
     * Loads specific option rows by their values from the server (AJAX-only).
     *
     * ### Behavior
     * - Uses `ajaxConfig.dataByValues(values[])` when provided; otherwise builds a default payload:
     *   `{ values: "...", load_by_values: "1", ...ajaxConfig.data }`.
     * - Supports GET/POST according to `ajaxConfig.method` (defaults to GET).
     * - Normalizes the response via {@link parseResponse}.
     * - Calls {@link Lifecycle.update} to mark an internal update.
     *
     * @param {string | string[]} values - One value or a list of values to fetch.
     * @returns {Promise<{ success: boolean; items: NormalizedAjaxItem[]; message?: string }>}
     * Resolves with normalized items on success.
     *
     * @remarks
     * - When AJAX is not configured, resolves with `{ success: false, ... }`.
     * - This method does not mutate the `<select>`; it only returns normalized items.
     */
    async loadByValues(values) {
        if (!this.ajaxConfig) {
            return {
                success: false,
                items: [],
                message: "Ajax not configured",
            };
        }
        const valuesArray = Array.isArray(values) ? values : [values];
        if (valuesArray.length === 0)
            return { success: true, items: [] };
        try {
            const cfg = this.ajaxConfig;
            let payload;
            if (typeof cfg.dataByValues === "function") {
                payload = cfg.dataByValues(valuesArray);
            }
            else {
                payload = {
                    values: valuesArray.join(","),
                    load_by_values: "1",
                    ...(typeof cfg.data === "function"
                        ? cfg.data.bind(this.selectBox.Selective.find(this.selectBox.container.targetElement))("", 0)
                        : (cfg.data ?? {})),
                };
            }
            let response;
            if ((cfg.method ?? "GET") === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach((key) => formData.append(key, String(payload[key])));
                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });
            }
            else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`);
            }
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const result = this.parseResponse(data);
            this.update();
            return { success: true, items: result.items };
        }
        catch (error) {
            console.error("Load by values error:", error);
            return { success: false, message: error?.message, items: [] };
        }
    }
    /**
     * Partitions the given values into those already present in the current `<select>` options
     * and those missing.
     *
     * @param {string[]} values - Values to check.
     * @returns {{ existing: string[]; missing: string[] }} Partitioned result.
     */
    checkMissingValues(values) {
        const allOptions = Array.from(this.select.options);
        const existingValues = allOptions.map((opt) => opt.value);
        const existing = values.filter((v) => existingValues.includes(v));
        const missing = values.filter((v) => !existingValues.includes(v));
        return { existing, missing };
    }
    /**
     * Configures AJAX settings used for remote searching and pagination.
     * Setting `null` disables AJAX mode and causes {@link search} to use local filtering.
     *
     * @param {AjaxConfig} config - AJAX configuration (endpoint, method, data builders, keepSelected, ...).
     * @returns {void}
     */
    setAjax(config) {
        this.ajaxConfig = config;
    }
    /**
     * Attaches a popup instance so the controller can reflect transient UI states
     * during remote operations (e.g., loading indicator).
     *
     * @param {Popup} popupInstance - Popup used to show results and loading state.
     * @returns {void}
     */
    setPopup(popupInstance) {
        this.popup = popupInstance;
    }
    /**
     * Returns a shallow snapshot of the current pagination state.
     *
     * @returns {PaginationState} State snapshot (defensive copy).
     */
    getPaginationState() {
        return { ...this.paginationState };
    }
    /**
     * Resets pagination counters while preserving whether pagination is enabled.
     * Clears page/totals/loading flags and the current keyword.
     *
     * @returns {void}
     */
    resetPagination() {
        this.paginationState = {
            currentPage: 0,
            totalPages: 1,
            hasMore: false,
            isLoading: false,
            currentKeyword: "",
            isPaginationEnabled: this.paginationState.isPaginationEnabled,
        };
    }
    /**
     * Clears the current keyword and restores visibility for all option models (local reset).
     *
     * ### Notes
     * - No network requests are made.
     * - This mutates `OptionModel.visible` for the current model set exposed by {@link ModelManager#getResources}.
     *
     * @returns {void}
     */
    clear() {
        this.paginationState.currentKeyword = "";
        const { modelList } = this.modelManager.getResources();
        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel)
                flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items))
                flatOptions.push(...m.items);
        }
        flatOptions.forEach((opt) => {
            opt.visible = true;
        });
    }
    /**
     * Performs a search using the configured strategy.
     * - If {@link AjaxConfig} is present, executes {@link ajaxSearch}.
     * - Otherwise performs local filtering via {@link localSearch}.
     *
     * @param {string} keyword - Search term.
     * @param {boolean} [append=false] - AJAX mode only: append results (next page) instead of replacing.
     * @returns {Promise<any>} Implementation-specific result object from the underlying strategy.
     */
    async search(keyword, append = false) {
        if (this.ajaxConfig)
            return this.ajaxSearch(keyword, append);
        return this.localSearch(keyword);
    }
    /**
     * Loads the next page in AJAX mode when pagination is enabled and available.
     *
     * ### Guards (no-ops with error result)
     * - AJAX must be configured.
     * - Must not already be loading.
     * - Pagination must be enabled and `hasMore` must be true.
     *
     * @returns {Promise<any>} Result of the paginated request, or an error object when not applicable.
     */
    async loadMore() {
        if (!this.ajaxConfig)
            return { success: false, message: "Ajax not enabled" };
        if (this.paginationState.isLoading)
            return { success: false, message: "Already loading" };
        if (!this.paginationState.isPaginationEnabled)
            return { success: false, message: "Pagination not enabled" };
        if (!this.paginationState.hasMore)
            return { success: false, message: "No more data" };
        this.paginationState.currentPage++;
        return this.ajaxSearch(this.paginationState.currentKeyword, true);
    }
    /**
     * Executes an in-memory search by normalizing the keyword and toggling each option's visibility.
     *
     * ### Matching
     * - Keyword is lowercased and de-accented via {@link Libs.string2normalize}.
     * - Each option uses `OptionModel.textToFind` for matching.
     *
     * ### Side effects
     * - Mutates `OptionModel.visible`.
     * - Calls {@link Lifecycle.update}.
     *
     * @param {string} keyword - Keyword to filter against local options.
     * @returns {Promise<{ success: boolean; hasResults: boolean; isEmpty: boolean }>}
     * Summary result for UI consumers.
     */
    async localSearch(keyword) {
        if (this.compareSearchTrigger(keyword))
            this.paginationState.currentKeyword = keyword;
        const lower = String(keyword ?? "").toLowerCase();
        const lowerNA = Libs.string2normalize(lower);
        const { modelList } = this.modelManager.getResources();
        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel)
                flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items))
                flatOptions.push(...m.items);
        }
        let hasVisibleItems = false;
        flatOptions.forEach((opt) => {
            const isVisible = lower === "" || opt.textToFind.includes(lowerNA);
            opt.visible = isVisible;
            if (isVisible)
                hasVisibleItems = true;
        });
        this.update();
        return {
            success: true,
            hasResults: hasVisibleItems,
            isEmpty: flatOptions.length === 0,
        };
    }
    /**
     * Determines whether the given keyword differs from the currently tracked keyword.
     * Used to decide whether a new search "session" should reset pagination.
     *
     * @param {string} keyword - Candidate keyword.
     * @returns {boolean} `true` if keyword differs from `paginationState.currentKeyword`.
     */
    compareSearchTrigger(keyword) {
        return keyword !== this.paginationState.currentKeyword;
    }
    /**
     * Executes an AJAX-based search with optional appending (pagination).
     *
     * ### Behavior
     * - If keyword changed (see {@link compareSearchTrigger}), pagination is reset and `append` is forced to `false`.
     * - Aborts any in-flight request and starts a new one via {@link AbortController}.
     * - Shows/hides loading UI on the attached {@link Popup} if present.
     * - Supports GET/POST based on {@link AjaxConfig.method}; payload is built from {@link AjaxConfig.data}.
     * - Normalizes server response via {@link parseResponse}.
     * - Applies items to the underlying `<select>` via {@link applyAjaxResult}.
     * - Updates pagination state when pagination info is present in the response.
     *
     * @param {string} keyword - Search keyword.
     * @param {boolean} [append=false] - Whether to append results (true = next page).
     * @returns {Promise<any>} Implementation-specific result object with pagination flags.
     */
    async ajaxSearch(keyword, append = false) {
        const cfg = this.ajaxConfig;
        if (this.compareSearchTrigger(keyword)) {
            this.resetPagination();
            this.paginationState.currentKeyword = keyword;
            append = false;
        }
        this.paginationState.isLoading = true;
        this.popup?.showLoading();
        this.abortController?.abort();
        this.abortController = new AbortController();
        const page = this.paginationState.currentPage;
        const selectedValues = Array.from(this.select.selectedOptions)
            .map((opt) => opt.value)
            .join(",");
        let payload;
        if (typeof cfg.data === "function") {
            const selectiveInstance = this.selectBox?.Selective?.find(this.selectBox?.container?.targetElement);
            payload = cfg.data.call(selectiveInstance, keyword, page);
            if (payload && typeof payload.selectedValue === "undefined")
                payload.selectedValue = selectedValues;
        }
        else {
            payload = {
                search: keyword,
                page,
                selectedValue: selectedValues,
                ...(cfg.data ?? {}),
            };
        }
        try {
            let response;
            if ((cfg.method ?? "GET") === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach((key) => formData.append(key, String(payload[key])));
                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    signal: this.abortController.signal,
                });
            }
            else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`, {
                    signal: this.abortController.signal,
                });
            }
            const data = await response.json();
            const result = this.parseResponse(data);
            if (result.hasPagination) {
                this.paginationState.isPaginationEnabled = true;
                this.paginationState.currentPage = result.page;
                this.paginationState.totalPages = result.totalPages;
                this.paginationState.hasMore = result.hasMore;
            }
            else {
                this.paginationState.isPaginationEnabled = false;
            }
            this.applyAjaxResult(result.items, !!cfg.keepSelected, append);
            this.paginationState.isLoading = false;
            this.popup?.hideLoading();
            this.update();
            return {
                success: true,
                hasResults: result.items.length > 0,
                isEmpty: result.items.length === 0,
                hasPagination: result.hasPagination,
                hasMore: result.hasMore,
                currentPage: result.page,
                totalPages: result.totalPages,
            };
        }
        catch (error) {
            this.paginationState.isLoading = false;
            this.popup?.hideLoading();
            if (error?.name === "AbortError")
                return { success: false, message: "Request aborted" };
            console.error("Ajax search error:", error);
            return { success: false, message: error?.message };
        }
    }
    /**
     * Normalizes various server response shapes into a consistent {@link ParseResponseResult}.
     *
     * ### Supported response shapes
     * - `{ object: [...], page?, totalPages?/total_page?, hasMore? }`
     * - `{ data: [...], page?, totalPages?/total_page?, hasMore? }`
     * - `{ items: [...], pagination: { page, totalPages?/total_page?, hasMore? } }`
     * - `[...]` (array of items)
     *
     * ### Item normalization rules
     * - Raw DOM nodes (`HTMLOptionElement` / `HTMLOptGroupElement`) are passed through as-is.
     * - Group-like objects are recognized by `type === "optgroup"` or heuristic fields (`isGroup`, `group`, `label`).
     * - Option-like objects are mapped to `{ type: "option", value, text, selected?, data? }`.
     *
     * @param {any} data - Server response (unknown shape).
     * @returns {ParseResponseResult} Normalized items with pagination metadata.
     */
    parseResponse(data) {
        let items = [];
        let hasPagination = false;
        let page = 0;
        let totalPages = 1;
        let hasMore = false;
        if (data.object && Array.isArray(data.object)) {
            items = data.object;
            if (typeof data.page !== "undefined") {
                hasPagination = true;
                page = parseInt(data.page ?? 0, 10);
                totalPages = parseInt(data.totalPages ?? data.total_page ?? 1, 10);
                hasMore = page < totalPages - 1;
            }
        }
        else if (data.data && Array.isArray(data.data)) {
            items = data.data;
            if (typeof data.page !== "undefined") {
                hasPagination = true;
                page = parseInt(data.page ?? 0, 10);
                totalPages = parseInt(data.totalPages ?? data.total_page ?? 1, 10);
                hasMore = data.hasMore ?? page < totalPages - 1;
            }
        }
        else if (Array.isArray(data)) {
            items = data;
        }
        else if (data.items && Array.isArray(data.items)) {
            items = data.items;
            if (data.pagination) {
                hasPagination = true;
                page = parseInt(data.pagination.page ?? 0, 10);
                totalPages = parseInt(data.pagination.totalPages ??
                    data.pagination.total_page ??
                    1, 10);
                hasMore = data.pagination.hasMore ?? page < totalPages - 1;
            }
        }
        const normalized = items.map((item) => {
            if (item instanceof HTMLOptionElement ||
                item instanceof HTMLOptGroupElement)
                return item;
            if (item.type === "optgroup" ||
                item.isGroup ||
                item.group ||
                item.label) {
                const label = item.label ?? item.name ?? item.title ?? "";
                const dataObj = item.data ?? {};
                const opts = (item.options ?? item.items ?? []).map((opt) => ({
                    value: opt.value ?? opt.id ?? opt.key ?? "",
                    text: opt.text ??
                        opt.label ??
                        opt.name ??
                        opt.title ??
                        "",
                    selected: opt.selected ?? false,
                    data: opt.data ??
                        (opt.imgsrc ? { imgsrc: opt.imgsrc } : {}),
                }));
                return {
                    type: "optgroup",
                    label,
                    data: dataObj,
                    options: opts,
                };
            }
            const dataObj = item.data ?? {};
            if (item?.imgsrc)
                dataObj.imgsrc = item.imgsrc;
            return {
                type: "option",
                value: item.value ?? item.id ?? item.key ?? "",
                text: item.text ?? item.label ?? item.name ?? item.title ?? "",
                selected: item.selected ?? false,
                data: dataObj,
            };
        });
        return { items: normalized, hasPagination, page, totalPages, hasMore };
    }
    /**
     * Applies normalized AJAX results to the backing `<select>` element.
     *
     * ### Behavior
     * - Optionally preserves existing selection values (`keepSelected`).
     * - Clears existing options when `append === false`.
     * - Accepts either normalized items or raw DOM nodes (`HTMLOptionElement` / `HTMLOptGroupElement`).
     * - Populates `dataset` for `data` payload fields on generated nodes.
     *
     * ### DOM side effects
     * - Mutates `<select>`: `innerHTML` (when replacing) and `appendChild` (when adding).
     * - Mutates selection state via `option.selected`.
     *
     * @param {NormalizedAjaxItem[]} items - Normalized items (or raw DOM nodes).
     * @param {boolean} keepSelected - Whether to preserve previously selected options by value.
     * @param {boolean} [append=false] - Append to existing options instead of replacing.
     * @returns {void}
     */
    applyAjaxResult(items, keepSelected, append = false) {
        const select = this.select;
        let oldSelected = [];
        if (keepSelected)
            oldSelected = Array.from(select.selectedOptions).map((o) => o.value);
        if (!append)
            select.innerHTML = "";
        items.forEach((item) => {
            // Skip empty item (defensive guard)
            if ((item["type"] === "option" || !item["type"]) &&
                item["value"] === "" &&
                item["text"] === "")
                return;
            if (item instanceof HTMLOptionElement ||
                item instanceof HTMLOptGroupElement) {
                select.appendChild(item);
                return;
            }
            if (item.type === "optgroup") {
                const optgroup = document.createElement("optgroup");
                optgroup.label = item.label;
                if (item.data) {
                    Object.keys(item.data).forEach((key) => {
                        optgroup.dataset[key] = String(item.data[key]);
                    });
                }
                if (Array.isArray(item.options)) {
                    item.options.forEach((opt) => {
                        const option = document.createElement("option");
                        option.value = opt.value;
                        option.text = opt.text;
                        if (opt.data) {
                            Object.keys(opt.data).forEach((key) => {
                                option.dataset[key] = String(opt.data[key]);
                            });
                        }
                        if (opt.selected ||
                            (keepSelected && oldSelected.includes(option.value))) {
                            option.selected = true;
                        }
                        optgroup.appendChild(option);
                    });
                }
                select.appendChild(optgroup);
            }
            else {
                const option = document.createElement("option");
                option.value = item.value;
                option.text = item.text;
                if (item.data) {
                    Object.keys(item.data).forEach((key) => {
                        option.dataset[key] = String(item.data[key]);
                    });
                }
                if (item.selected ||
                    (keepSelected && oldSelected.includes(option.value))) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
    }
    /**
     * Destroys the controller and clears references.
     * Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * ### Notes
     * - This controller does not own/destroy the linked {@link Popup}, {@link ModelManager}, or {@link SelectBox}.
     * - In-flight requests are not explicitly aborted here; consumers may abort earlier by triggering a new search,
     *   or handle cancellation externally.
     *
     * @returns {void}
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.select = null;
        this.modelManager = null;
        this.ajaxConfig = null;
        this.abortController = null;
        this.popup = null;
        this.selectBox = null;
        super.destroy();
    }
}

/**
 * SelectObserver
 *
 * Lightweight mutation tracker for native `<select>` elements.
 *
 * ### Responsibility
 * - Observes DOM changes (child list, attributes) on a bound `<select>` element.
 * - Debounces rapid mutations to prevent excessive handler invocations.
 * - Provides a lifecycle hook ({@link onChanged}) for consumers to react to detected changes.
 *
 * ### Observed mutations
 * - **Child list**: `<option>` / `<optgroup>` additions, removals, reordering.
 * - **Attributes**: `selected`, `value`, `disabled` changes (via `attributeFilter`).
 *
 * ### Debounce behavior
 * - Changes are batched using a `50ms` debounce timer ({@link _DEBOUNCE_DELAY}).
 * - Rapid successive mutations trigger only a single {@link onChanged} call after the delay.
 *
 * ### Lifecycle
 * - **Construction**: Initializes the `MutationObserver` but does **not** start observing.
 * - **{@link connect}**: Activates observation.
 * - **{@link disconnect}**: Stops observation, clears pending timers, releases resources.
 *
 * ### No-op / Idempotency
 * - {@link disconnect} is safe to call multiple times (clears timer only if present).
 * - {@link onChanged} is a no-op by default; consumers must override to implement behavior.
 *
 * ### DOM side effects
 * - None directly; mutation detection is read-only.
 * - Side effects occur only via consumer-implemented {@link onChanged} hook.
 *
 * @class
 */
class SelectObserver {
    /**
     * Creates a new SelectObserver for the given `<select>` element.
     *
     * Side effects:
     * - Initializes the `MutationObserver` with debounced change handling.
     * - Does **not** start observing; call {@link connect} to activate.
     *
     * @param {HTMLSelectElement} select - The `<select>` element to observe for mutations.
     */
    constructor(select) {
        /**
         * Debounce delay in milliseconds.
         *
         * - Fixed at `50ms` to balance responsiveness and batch efficiency.
         * - Applied to all mutation events.
         *
         * @private
         * @readonly
         */
        this._DEBOUNCE_DELAY = 50;
        this.select = select;
        this.observer = new MutationObserver(() => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.handleChange();
            }, this._DEBOUNCE_DELAY);
        });
    }
    /**
     * Internal handler invoked after debounce delay expires.
     *
     * Implementation:
     * - Forwards the current {@link select} element to the {@link onChanged} hook.
     *
     * @private
     * @returns {void}
     */
    handleChange() {
        this.onChanged(this.select);
    }
    /**
     * Activates mutation observation on the bound `<select>` element.
     *
     * Configuration:
     * - **childList**: Detects `<option>` / `<optgroup>` additions/removals.
     * - **subtree**: `false` (only direct children, no deep nesting).
     * - **attributes**: Tracks `selected`, `value`, `disabled` changes.
     *
     * Notes:
     * - Safe to call multiple times; `MutationObserver.observe()` replaces previous config.
     * - Mutations are debounced via {@link debounceTimer}.
     *
     * @public
     * @returns {void}
     */
    connect() {
        this.observer.observe(this.select, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ["selected", "value", "disabled"],
        });
    }
    /**
     * Hook invoked when debounced mutations are detected.
     *
     * Default behavior:
     * - No-op; consumers must override to implement custom change handling.
     *
     * Typical use cases:
     * - Sync internal state with the native `<select>` DOM.
     * - Trigger re-rendering of a virtual option list.
     * - Update accessibility attributes or external UI components.
     *
     * @public
     * @param {HTMLSelectElement} options - The current `<select>` element (same as {@link select}).
     * @returns {void}
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChanged(selectElement) {
        // override
    }
    /**
     * Stops mutation observation and releases resources.
     *
     * Behavior:
     * - Clears any pending {@link debounceTimer} to prevent stale {@link onChanged} invocations.
     * - Disconnects the `MutationObserver`.
     * - Idempotent: safe to call multiple times.
     *
     * Notes:
     * - After disconnection, no further mutations will be detected until {@link connect} is called again.
     *
     * @public
     * @returns {void}
     */
    disconnect() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}

/**
 * DatasetObserver
 *
 * Lightweight observer that watches `data-*` attribute mutations on a target element
 * and emits a debounced snapshot of `element.dataset`.
 *
 * ### Responsibility
 * - Detect changes to `data-*` attributes using a {@link MutationObserver}.
 * - Debounce rapid attribute mutations into a single callback invocation.
 * - Provide a secondary/manual notification path via a custom `"dataset:changed"` event.
 *
 * ### Event Model (External vs. Internal)
 * - **External changes**: DOM attribute mutations (e.g., `el.dataset.disabled = "1"`) are detected
 *   by {@link MutationObserver} and delivered after the debounce window.
 * - **Internal/manual signal**: dispatching `"dataset:changed"` on the element forces an immediate
 *   snapshot emission (not debounced here), useful when dataset-like state is updated through
 *   non-attribute paths or when consumers want an explicit refresh signal.
 *
 * ### Debounce Semantics
 * - Multiple attribute changes within ~50ms are coalesced into a single {@link onChanged} call.
 * - The callback receives a shallow copy of the current dataset (`{ ...element.dataset }`),
 *   ensuring callers do not hold a live reference.
 *
 * ### Usage
 * - Create instance with a target element.
 * - Call {@link connect} to start observing.
 * - Implement/assign {@link onChanged} to react to updates.
 * - Call {@link disconnect} during teardown to prevent leaks.
 */
class DatasetObserver {
    /**
     * Creates a {@link DatasetObserver} for the given element.
     *
     * Side effects:
     * - Instantiates a {@link MutationObserver} that filters for `attributes` mutations
     *   where `attributeName` starts with `"data-"`.
     * - Registers a `"dataset:changed"` event listener on the element to allow manual
     *   emission of dataset snapshots.
     *
     * Notes:
     * - Observation does not begin until {@link connect} is called.
     * - The `"dataset:changed"` listener is always active after construction.
     *
     * @param element - The element whose `data-*` attributes will be observed.
     */
    constructor(element) {
        this.element = element;
        this.observer = new MutationObserver((mutations) => {
            let datasetChanged = false;
            for (const mutation of mutations) {
                if (mutation.type === "attributes" &&
                    mutation.attributeName?.startsWith("data-")) {
                    datasetChanged = true;
                    break;
                }
            }
            if (!datasetChanged)
                return;
            if (this.debounceTimer)
                clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.onChanged({ ...this.element.dataset });
            }, 50);
        });
        element.addEventListener("dataset:changed", () => {
            this.onChanged({ ...this.element.dataset });
        });
    }
    /**
     * Starts observing the target element for attribute changes.
     *
     * - Observes all attribute mutations and relies on the mutation callback to filter
     *   down to `data-*` changes.
     * - `attributeOldValue` is enabled to allow future diagnostics; the current implementation
     *   does not consume old values directly.
     *
     * No-op behavior:
     * - Calling `connect()` multiple times will register multiple observations on the same
     *   element in standard DOM APIs. Consumers should treat this as "call once" unless the
     *   implementation is extended to guard idempotency.
     */
    connect() {
        this.observer.observe(this.element, {
            attributes: true,
            attributeOldValue: true,
        });
    }
    /**
     * Hook invoked when the element's dataset changes.
     *
     * Consumers typically override this method (or assign to it) to react to changes such as:
     * - disabled / readonly / visible flags
     * - feature toggles exposed via `data-*` attributes
     *
     * The `dataset` argument is a shallow copy of the *current* dataset at the time of emission.
     *
     * @param dataset - Snapshot of `element.dataset` (string values).
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChanged(dataset) {
        // override
    }
    /**
     * Stops observing and clears pending debounce work.
     *
     * Side effects:
     * - Cancels the pending debounce timer (if any).
     * - Disconnects the underlying {@link MutationObserver}.
     *
     * Idempotency:
     * - Safe to call multiple times; subsequent calls will be effectively no-ops after disconnect.
     */
    disconnect() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.observer.disconnect();
    }
}

/**
 * Base Adapter that bridges **Models** to **Views** and exposes a small, scheduler-backed
 * property change pipeline for coordination with higher-level infrastructure.
 *
 * ### Responsibility
 * - Own and manage an ordered collection of items (`items`).
 * - Provide a **view factory** ({@link viewHolder}) and a **bind step** ({@link onViewHolder})
 *   used by recyclers to mount/update item views.
 * - Provide a **two-phase property pipeline**:
 *   - `changingProp(...)` / {@link onPropChanging} (pre-change)
 *   - `changeProp(...)` / {@link onPropChanged} (post-change)
 *   backed by {@link Libs.callbackScheduler} and namespaced via {@link adapterKey}.
 * - Cooperate with a recycler (e.g., `RecyclerView` / `VirtualRecyclerView`) by exposing
 *   {@link updateRecyclerView} and an optional {@link recyclerView} reference for
 *   virtualization helpers (e.g., `ensureRendered`).
 *
 * ### Relationships (Model ↔ View ↔ Recycler)
 * - **Model**: Items are expected to be models with `destroy()` and lifecycle flags.
 * - **View**: Each item may carry a `view` reference (typically created once).
 * - **Recycler**: A RecyclerView calls `viewHolder()` to create a view and then calls
 *   `onViewHolder()` to mount/update the view; {@link updateRecyclerView} implements a
 *   simple non-virtualized binding loop for this purpose.
 *
 * ### Lifecycle (Strict FSM, idempotency)
 * - Constructor calls {@link Lifecycle.init} (`NEW → INITIALIZED`).
 * - Binding semantics are typically idempotent at the item level:
 *   - `item.isInit === false` → initial render (`viewer.mount()`)
 *   - `item.isInit === true`  → incremental update (`viewer.update()`)
 * - {@link setItems} emits change pipelines and then calls {@link Lifecycle.update}.
 *
 * ### Event / Hook flow
 * The adapter does not emit DOM events directly; instead it provides a generic property
 * pipeline for observers (e.g., "items", "select", "visibility"):
 * 1) `changingProp(propName, ...)` schedules/executes pre-change callbacks
 * 2) caller mutates adapter/model state
 * 3) `changeProp(propName, ...)` schedules/executes post-change callbacks
 *
 * Keys are namespaced per instance:
 * - `${propName}ing_${adapterKey}` (pre-change)
 * - `${propName}_${adapterKey}` (post-change)
 *
 * ### Notes / invariants
 * - Items are expected to embed a `view` reference and an `isInit` flag to avoid double
 *   listener wiring in concrete view implementations.
 * - {@link viewHolder} should be overridden by subclasses to return a concrete viewer.
 *
 * @template TItem - Model type the adapter operates on.
 * Must implement {@link ModelContract} and carry `{ view: TViewer | null; isInit: boolean }`.
 * @template TViewer - View type associated with each item (implements {@link ViewContract}).
 *
 * @implements {AdapterContract<TItem>}
 * @extends Lifecycle
 * @see {@link Libs.callbackScheduler}
 * @see {@link ViewContract}
 * @see {@link ModelContract}
 */
class Adapter extends Lifecycle {
    /**
     * Creates an adapter with an optional initial item list and initializes its lifecycle.
     *
     * @param {TItem[]} [items=[]] - Initial items to be managed by the adapter.
     */
    constructor(items = []) {
        super();
        /**
         * Current list of items managed by the adapter.
         *
         * Ordering is significant and is used as the index space passed to recyclers and bind calls.
         */
        this.items = [];
        /**
         * Unique key for this adapter instance.
         * Used to namespace scheduler pipelines to avoid cross-instance collisions.
         */
        this.adapterKey = Libs.randomString(12);
        /**
         * When true, consumers (typically view event handlers) may suppress certain actions.
         * This flag is intentionally generic and is coordinated by higher-level components.
         */
        this.isSkipEvent = false;
        this.items = items;
        this.init();
    }
    /**
     * Binds an item model to its viewer at a given position.
     *
     * Default behavior:
     * - If `item.isInit === true`, calls `viewer.update()` (incremental update)
     * - Otherwise calls `viewer.mount()` (first mount)
     *
     * This method is invoked by recyclers as part of their binding loop and may be overridden
     * by subclasses to implement custom diffing, animations, or richer binding behavior.
     *
     * @param {TItem} item - The model instance to bind.
     * @param {TViewer | null} viewer - The view responsible for rendering the model (may be null).
     * @param {number} position - Index of the item within the adapter item list.
     * @returns {void}
     */
    onViewHolder(item, viewer, position) {
        const v = viewer;
        if (item.isInit) {
            v?.update?.();
        }
        else {
            v?.mount?.();
        }
    }
    /**
     * Registers a **pre-change** callback for a property pipeline.
     *
     * Execution semantics:
     * - Registered under `${propName}ing_${adapterKey}`.
     * - Scheduled via {@link Libs.callbackScheduler} with `{ debounce: 0 }`.
     * - Intended to run **before** a state mutation (e.g., before replacing `items`).
     *
     * @param {string} propName - Logical property name (e.g., `"items"`, `"select"`).
     * @param {(...args: unknown[]) => void} callback - Callback executed during the pre-change phase.
     * @returns {void}
     * @see {@link changingProp}
     */
    onPropChanging(propName, callback) {
        Libs.callbackScheduler.on(`${propName}ing_${this.adapterKey}`, callback, { debounce: 0 });
    }
    /**
     * Registers a **post-change** callback for a property pipeline.
     *
     * Execution semantics:
     * - Registered under `${propName}_${adapterKey}`.
     * - Scheduled via {@link Libs.callbackScheduler} with `{ debounce: 0 }`.
     * - Intended to run **after** a state mutation (e.g., after replacing `items`).
     *
     * @param {string} propName - Logical property name (e.g., `"items"`, `"selected"`).
     * @param {(...args: unknown[]) => void} callback - Callback executed during the post-change phase.
     * @returns {void}
     * @see {@link changeProp}
     */
    onPropChanged(propName, callback) {
        Libs.callbackScheduler.on(`${propName}_${this.adapterKey}`, callback, {
            debounce: 0,
        });
    }
    /**
     * Triggers the **post-change** pipeline for a given property.
     *
     * Intended usage:
     * - Call **after** mutating adapter/model state to notify observers.
     *
     * @param {string} propName - Logical property name to emit.
     * @param {...unknown} params - Parameters forwarded to subscribers.
     * @returns {Promise<void>} Resolves when scheduled callbacks complete.
     */
    changeProp(propName, ...params) {
        return Libs.callbackScheduler.run(`${propName}_${this.adapterKey}`, ...params);
    }
    /**
     * Triggers the **pre-change** pipeline for a given property.
     *
     * Intended usage:
     * - Call **before** mutating adapter/model state to allow observers to prepare.
     *
     * @param {string} propName - Logical property name to emit.
     * @param {...unknown} params - Parameters forwarded to subscribers.
     * @returns {Promise<void>} Resolves when scheduled callbacks complete.
     */
    changingProp(propName, ...params) {
        return Libs.callbackScheduler.run(`${propName}ing_${this.adapterKey}`, ...params);
    }
    /**
     * Factory method that creates a viewer instance for a given item in a parent container.
     *
     * Subclasses **must** override this to return a concrete viewer implementation.
     *
     * @param {HTMLElement} parent - Container element that will host the viewer.
     * @param {TItem} item - The model for which the viewer is created.
     * @returns {TViewer} The created viewer instance; `null` by default.
     */
    viewHolder(parent, item) {
        return null;
    }
    /**
     * Returns the number of items currently managed by the adapter.
     *
     * @returns {number} Current item count.
     */
    itemCount() {
        return this.items.length;
    }
    /**
     * Replaces the adapter's items with a new collection and emits change pipelines.
     *
     * Flow:
     * 1) `changingProp("items", items)` (pre-change)
     * 2) assign `this.items = items`
     * 3) `changeProp("items", items)` (post-change)
     * 4) {@link Lifecycle.update} to signal an update cycle
     *
     * Note:
     * - This method does not render to the DOM by itself. Rendering is performed by the recycler
     *   via {@link updateRecyclerView} or a virtualized mount loop.
     *
     * @param {TItem[]} items - The new list of items.
     * @returns {Promise<void>}
     */
    async setItems(items) {
        await this.changingProp("items", items);
        this.items = items;
        await this.changeProp("items", items);
        this.update();
    }
    /**
     * Synchronizes adapter items from an external source by delegating to {@link setItems}.
     *
     * @param {TItem[]} items - The source list of items to synchronize.
     * @returns {Promise<void>}
     */
    async syncFromSource(items) {
        await this.setItems(items);
    }
    /**
     * Ensures each item has a viewer and binds it via {@link onViewHolder}.
     *
     * This is a simple, non-virtualized binding loop that:
     * - iterates items in order,
     * - creates a viewer for first-time items (`item.isInit === false`),
     * - calls {@link onViewHolder} to mount/update,
     * - marks `item.isInit = true`.
     *
     * Typical usage:
     * - Called by a RecyclerView implementation to (re)bind all items into a container.
     *
     * @param {HTMLElement} parent - Container in which item viewers are rendered.
     * @returns {void}
     */
    updateRecyclerView(parent) {
        for (let index = 0; index < this.itemCount(); index++) {
            const item = this.items[index];
            let viewer = item.view;
            if (!item.isInit) {
                viewer = this.viewHolder(parent, item);
                item.view = viewer;
            }
            this.onViewHolder(item, viewer, index);
            item.isInit = true;
        }
    }
    /**
     * Hook for applying incoming data without using the default change pipeline.
     *
     * This is intentionally a no-op in the base adapter. Subclasses can override to:
     * - update internal derived structures,
     * - refresh caches,
     * - perform silent updates that should not notify observers.
     *
     * @param {TItem[]} items - Incoming data to apply.
     * @returns {void}
     */
    updateData(items) {
    }
    /**
     * Destroys the adapter and releases references.
     *
     * Behavior:
     * - Returns early if already in {@link LifecycleState.DESTROYED}.
     * - Clears {@link recyclerView} reference.
     * - Calls `destroy()` on each item if available.
     * - Clears the `items` array.
     *
     * @remarks
     * This implementation does not explicitly clear scheduler pipelines registered via
     * {@link onPropChanging}/{@link onPropChanged}. If the scheduler retains them by key,
     * the adapter's {@link adapterKey} namespacing helps avoid collisions, but teardown
     * responsibility may belong to the scheduler implementation.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.recyclerView = null;
        this.items.forEach((item) => {
            item?.destroy?.();
        });
        this.items = [];
    }
}

/**
 * Base View primitive that anchors a mounted DOM structure into a parent container.
 *
 * This class is the **View** part of the library's Model/View separation:
 * - A View is responsible for owning/manipulating DOM nodes and exposing typed handles (`tags`)
 *   for efficient updates.
 * - A View is typically created/managed by an Adapter/RecyclerView layer and assigned back to a Model.
 *
 * ### Responsibility
 * - Hold a reference to the host container (`parent`) where the view's root element is attached.
 * - Store the mounted structure (`view`) produced by a mount utility (root element + typed tag map).
 * - Provide a safe root accessor ({@link getView}) for downstream code (e.g., scrolling, a11y, styling).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor calls {@link Lifecycle.init} immediately (`NEW → INITIALIZED`).
 * - Mounting is performed by subclasses / infrastructure:
 *   - populate {@link view} (usually during a subclass mount hook),
 *   - append `view.view` to {@link parent},
 *   - then transition to `MOUNTED` via {@link Lifecycle.mount} (typically done by the base/framework).
 * - {@link destroy} transitions to `DESTROYED` and removes the root element from the DOM.
 *
 * ### Idempotency / No-ops
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 * - {@link getView} throws if the view is not yet mounted (i.e., {@link view} is unset).
 *
 * ### DOM side effects / Ownership
 * - Owns the root element produced by the mount helper and removes it on {@link destroy}.
 * - Does not automatically append the root node; external orchestrators (Adapter/RecyclerView) control attachment.
 *
 * @template TTags - Map of tag names to their corresponding HTMLElement instances.
 * @implements {ViewContract<TTags>}
 * @extends Lifecycle
 * @see {@link MountViewResult}
 * @see {@link ViewContract}
 * @see {@link LifecycleState}
 */
class View extends Lifecycle {
    /**
     * Creates a View bound to the specified parent container and initializes lifecycle state.
     *
     * Notes:
     * - This base constructor **does not** perform DOM mounting or attachment.
     * - Subclasses typically assign {@link view} during their mount step, then append `view.view` to {@link parent}.
     *
     * @param {HTMLElement} parent - Host element into which this view will render.
     */
    constructor(parent) {
        super();
        this.parent = parent;
        this.init();
    }
    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * @returns {HTMLElement} The root element produced by the mounting helper.
     * @throws {Error} If {@link view} is not set or the view has not been mounted yet.
     */
    getView() {
        if (!this.view?.view) {
            throw new Error("View is not mounted. Did you forget to set this.view?");
        }
        return this.view.view;
    }
    /**
     * Destroys the view and releases DOM references.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Removes the root element from the DOM (if present).
     * - Clears references to {@link parent} and {@link view}.
     * - Completes teardown by calling {@link Lifecycle.destroy}.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.getView()?.remove?.();
        this.parent = null;
        this.view = null;
        super.destroy();
    }
}

/**
 * GroupView
 *
 * View implementation for rendering grouped collections of selectable items.
 *
 * ### Responsibility
 * - Renders a semantic group structure: header (label) + items container.
 * - Manages group-level visibility based on child item state.
 * - Supports collapse/expand interactions with accessibility annotations.
 * - Provides typed access to DOM structure via {@link view}.
 *
 * ### Structure
 * ```
 * GroupView (root)
 *   ├─ GroupHeader (label, role="presentation")
 *   └─ GroupItems (container, role="group")
 * ```
 *
 * ### Lifecycle (View-based FSM)
 * - **Construction**: Accepts parent container, transitions `NEW → INITIALIZED`.
 * - **{@link mount}**: Creates DOM structure, appends to parent, transitions `INITIALIZED → MOUNTED`.
 * - **{@link update}**: Refreshes group header label, transitions `MOUNTED → UPDATED → MOUNTED`.
 * - **{@link destroy}**: Removes DOM nodes, transitions to `DESTROYED`.
 *
 * ### Visibility semantics
 * - {@link updateVisibility} hides the entire group when all child items are hidden.
 * - Checks for `"hide"` class on children (does not inspect `display` or `visibility` styles).
 *
 * ### Accessibility
 * - Root container: `role="group"`, `aria-labelledby` points to header.
 * - Header: `role="presentation"`, unique ID for labeling.
 * - Items container: `role="group"` (nested group).
 * - Collapse state: `aria-expanded` attribute on header (managed by {@link setCollapsed}).
 *
 * ### DOM side effects
 * - {@link mount} creates and appends DOM structure.
 * - {@link updateLabel} mutates header `textContent`.
 * - {@link setCollapsed} toggles CSS classes and ARIA attributes.
 * - {@link updateVisibility} toggles `"hide"` class on root.
 *
 * ### No-op / Idempotency
 * - {@link updateLabel}, {@link updateVisibility}, {@link setCollapsed} are no-ops if not mounted (early return guards).
 * - Safe to call multiple times without side effects beyond DOM state updates.
 *
 * @extends View<GroupViewTags>
 * @template GroupViewTags - Type descriptor for the group's DOM structure.
 * @see {@link GroupViewResult}
 * @see {@link View}
 */
class GroupView extends View {
    /**
     * Creates a new GroupView bound to the given parent element.
     *
     * Initialization flow:
     * 1. Calls `super(parent)` (View base constructor).
     *
     * @public
     * @param {HTMLElement} parent - Container element that will host this group view.
     * @param {SelectiveOptions} options - Optional configuration for this group view.
     */
    constructor(parent, options) {
        super(parent);
        this.options = options;
    }
    /**
     * Mounts the group view into the DOM.
     *
     * Creation flow:
     * 1. Generates unique group ID (7-character random string).
     * 2. Creates DOM structure via {@link Libs.mountNode}:
     *    - Root: `<div role="group" aria-labelledby="seui-{this.options?.SEID || default}-{id}-header">`
     *    - Header: `<div role="presentation" id="seui-{this.options?.SEID || default}-{id}-header">`
     *    - Items: `<div role="group">` (nested group for child items)
     * 3. Appends root to {@link parent} container.
     * 4. Transitions `INITIALIZED → MOUNTED` via `super.mount()`.
     *
     * Accessibility setup:
     * - Root `aria-labelledby` associates group with header text.
     * - Header `role="presentation"` hides it from navigation (purely visual label).
     * - Items container `role="group"` creates semantic boundary for children.
     *
     * Postcondition:
     * - {@link view} is populated with typed DOM references.
     *
     * @public
     * @returns {void}
     * @override
     * @throws {Error} If {@link parent} is null (should never occur due to base `View` constructor).
     */
    mount() {
        const group_id = Libs.randomString(7);
        this.view = Libs.mountNode({
            GroupView: {
                tag: {
                    node: "div",
                    classList: ["seui-group"],
                    role: "group",
                    ariaLabelledby: `seui-${this.options?.SEID || "default"}-${group_id}-header`,
                    id: `seui-${this.options?.SEID || "default"}-${group_id}-group`,
                },
                child: {
                    GroupHeader: {
                        tag: {
                            node: "div",
                            classList: ["seui-group-header"],
                            role: "presentation",
                            id: `seui-${this.options?.SEID || "default"}-${group_id}-header`,
                        },
                    },
                    GroupItems: {
                        tag: {
                            node: "div",
                            classList: ["seui-group-items"],
                            role: "group",
                        },
                    },
                },
            },
        });
        // Parent is guaranteed to exist by the base View constructor.
        this.parent.appendChild(this.view.view);
        super.mount();
    }
    /**
     * Updates the group view in response to state changes.
     *
     * Behavior:
     * - Refreshes the group header label via {@link updateLabel}.
     * - Transitions `MOUNTED → UPDATED → MOUNTED` via `super.update()`.
     *
     * Notes:
     * - Currently performs only label refresh; extend for additional update logic.
     * - Does **not** update visibility or collapse state automatically.
     *
     * @public
     * @returns {void}
     * @override
     */
    update() {
        this.updateLabel();
        super.update();
    }
    /**
     * Updates the text content of the group header.
     *
     * Behavior:
     * - No-op if not mounted ({@link view} is `null`).
     * - If `label` is `null`, preserves existing header text.
     * - Otherwise, replaces header `textContent` with new label.
     *
     * Notes:
     * - Does **not** escape HTML (uses `textContent`, not `innerHTML`).
     * - Safe to call multiple times with same value (idempotent).
     *
     * @public
     * @param {string} [label=null] - New label to display; `null` preserves current label.
     * @returns {void}
     */
    updateLabel(label) {
        if (!this.view)
            return;
        const headerEl = this.view.tags.GroupHeader;
        if (label !== null) {
            headerEl.textContent = label;
        }
    }
    /**
     * Returns the container element for child item views.
     *
     * Usage:
     * - Caller appends `OptionView` or other child views to this container.
     * - Container provides semantic grouping (`role="group"`).
     *
     * @public
     * @returns {HTMLDivElement} The items container element.
     * @throws {Error} If the view has not been mounted yet ({@link view} is `null`).
     */
    getItemsContainer() {
        if (!this.view) {
            throw new Error("GroupView has not been rendered.");
        }
        return this.view.tags.GroupItems;
    }
    /**
     * Updates the group's visibility based on child item state.
     *
     * Visibility rules:
     * - Iterates through direct children of the items container.
     * - Counts children **without** the `"hide"` CSS class.
     * - Toggles `"hide"` class on root container:
     *   - **Added** if all children are hidden (zero visible).
     *   - **Removed** if any child is visible.
     *
     * Notes:
     * - No-op if not mounted ({@link view} is `null`).
     * - Only checks for `"hide"` class; does **not** inspect `display` or `visibility` styles.
     * - Safe to call repeatedly (idempotent based on current child state).
     *
     * @public
     * @returns {void}
     */
    updateVisibility() {
        if (!this.view)
            return;
        const items = this.view.tags.GroupItems;
        const visibleItems = Array.from(items.children).filter((child) => !child.classList.contains("hide"));
        this.view.view.classList.toggle("hide", visibleItems.length === 0);
    }
    /**
     * Sets the collapsed/expanded state of the group.
     *
     * State updates:
     * - **CSS**: Toggles `"collapsed"` class on root container.
     * - **ARIA**: Sets `aria-expanded` attribute on header (`"true"` or `"false"`).
     *
     * Visual effects:
     * - CSS class typically controls item container visibility (via stylesheet).
     * - ARIA attribute communicates state to assistive technologies.
     *
     * Notes:
     * - No-op if not mounted ({@link view} is `null`).
     * - Does **not** animate or transition; relies on CSS for presentation.
     * - Safe to call with same value repeatedly (idempotent).
     *
     * @public
     * @param {boolean} collapsed - `true` to collapse the group; `false` to expand.
     * @returns {void}
     */
    setCollapsed(collapsed) {
        if (!this.view)
            return;
        this.view.view.classList.toggle("collapsed", collapsed);
        this.view.tags.GroupHeader.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
}

/**
 * OptionView
 *
 * View implementation for a single selectable option with reactive configuration.
 *
 * ### Responsibility
 * - Renders an option with input (radio/checkbox) + optional image + label.
 * - Supports **reactive configuration** via Proxy-based change tracking.
 * - Applies **incremental DOM updates** for configuration changes (no full re-render).
 * - Manages input type switching (radio ↔ checkbox) based on selection mode.
 * - Dynamically creates/removes image elements when {@link hasImage} changes.
 *
 * ### Structure
 * ```
 * OptionView (root, role="option")
 *   ├─ OptionInput (<input type="radio|checkbox">)
 *   ├─ OptionImage (<img>, conditional)
 *   └─ OptionLabel (<label>)
 *       └─ LabelContent (<div>)
 * ```
 *
 * ### Lifecycle (View-based FSM)
 * - **Construction**: Calls {@link initialize}, sets up config Proxy, transitions `NEW → INITIALIZED`.
 * - **{@link mount}**: Creates DOM structure based on current config, transitions `INITIALIZED → MOUNTED`.
 * - **Reactive updates**: After mount, config changes trigger {@link applyPartialChange} (targeted DOM updates).
 * - **{@link destroy}**: Removes DOM nodes, transitions to `DESTROYED`.
 *
 * ### Reactive configuration strategy
 * - **{@link config}**: Internal target object (should not be mutated directly).
 * - **{@link configProxy}**: Proxy wrapper; assignments trigger {@link applyPartialChange}.
 * - **{@link isRendered}**: Gates partial updates (no DOM changes before initial {@link mount}).
 * - **Batch updates**: {@link optionConfig} setter applies multiple changes efficiently (only diffed properties).
 *
 * ### Partial update semantics
 * - **`isMultiple`**: Toggles `"multiple"` class, switches input `type` (radio ↔ checkbox).
 * - **`hasImage`**: Toggles `"has-image"` class, creates/removes `<img>` element.
 * - **`imagePosition`**: Replaces `image-{position}` class (top/right/bottom/left).
 * - **`imageWidth/Height/BorderRadius`**: Mutates `<img>` inline styles.
 * - **`labelValign/Halign`**: Replaces label alignment classes.
 *
 * ### Image lifecycle
 * - Created on-demand via {@link createImage} when `hasImage = true`.
 * - Removed via `remove()` when `hasImage = false`.
 * - Reference stored in `view.tags.OptionImage` (nulled after removal).
 *
 * ### Accessibility
 * - Root: `role="option"`, `aria-selected="false"` (managed externally), `tabindex="-1"`.
 * - Input: Associated with label via unique `id` / `htmlFor`.
 * - Label: Clickable, triggers input selection.
 *
 * ### DOM side effects
 * - {@link mount} creates and appends full structure.
 * - {@link applyPartialChange} mutates classes, attributes, styles, or child nodes.
 * - {@link createImage} inserts `<img>` element.
 * - Setters ({@link isMultiple}, {@link hasImage}) trigger Proxy → DOM updates.
 *
 * ### No-op / Idempotency
 * - {@link applyPartialChange} is no-op if view not mounted (early return guard).
 * - {@link createImage} is no-op if image already exists.
 * - {@link optionConfig} setter only assigns diffed properties (avoids redundant Proxy triggers).
 * - Safe to call setters multiple times with same value (Proxy guards against no-op updates).
 *
 * @extends View<OptionViewTags>
 * @template OptionViewTags - Type descriptor for the option's DOM structure.
 * @see {@link OptionViewResult}
 * @see {@link OptionConfig}
 * @see {@link View}
 */
class OptionView extends View {
    /**
     * Creates a new OptionView bound to the given parent element.
     *
     * Initialization flow:
     * 1. Calls `super(parent)` (View base constructor).
     * 2. Calls {@link initialize} to set up config and Proxy.
     * 3. Transitions `NEW → INITIALIZED` via `this.init()` inside {@link initialize}.
     *
     * @public
     * @param {HTMLElement} parent - Container element that will host this option view.
     * @param {SelectiveOptions} options - Optional configuration for this option view.
     */
    constructor(parent, options) {
        super(parent);
        /**
         * Flag indicating whether the initial render has completed.
         *
         * Lifecycle:
         * - `false` until {@link mount} finishes.
         * - `true` afterward (enables partial updates).
         *
         * Purpose:
         * - Gates {@link applyPartialChange} to prevent DOM mutations before structure exists.
         *
         * @private
         */
        this.isRendered = false;
        this.options = options;
        this.initialize();
    }
    /**
     * Initializes the default configuration and sets up reactive Proxy.
     *
     * Configuration defaults:
     * - `isMultiple`: `false` (radio mode)
     * - `hasImage`: `false` (no image)
     * - `imagePosition`: `"right"`
     * - `imageWidth/Height`: `"60px"`
     * - `imageBorderRadius`: `"4px"`
     * - `labelValign/Halign`: `"center"` / `"left"`
     *
     * Proxy behavior:
     * - **`set` trap**: Compares old vs new value; if different:
     *   1. Updates {@link config} target.
     *   2. Calls {@link applyPartialChange} if {@link isRendered} is `true`.
     * - Returns `true` to indicate success.
     *
     * Postcondition:
     * - {@link config} and {@link configProxy} are initialized.
     * - Transitions `NEW → INITIALIZED` via `this.init()`.
     *
     * Notes:
     * - No DOM mutations occur until {@link mount} is called.
     *
     * @public
     * @returns {void}
     */
    initialize() {
        const self = this;
        this.config = {
            isMultiple: false,
            hasImage: false,
            imagePosition: "right",
            imageWidth: "60px",
            imageHeight: "60px",
            imageBorderRadius: "4px",
            labelValign: "center",
            labelHalign: "left",
        };
        this.configProxy = new Proxy(this.config, {
            set(target, prop, value) {
                if (typeof prop !== "string")
                    return true;
                const key = prop;
                const oldValue = target[key];
                if (oldValue !== value) {
                    target[key] = value;
                    if (self.isRendered) {
                        self.applyPartialChange(key, value, oldValue);
                    }
                }
                return true;
            },
        });
        this.init();
    }
    /**
     * Indicates whether the option supports multiple selection.
     *
     * Semantics:
     * - `false`: Single selection mode (radio input).
     * - `true`: Multiple selection mode (checkbox input).
     *
     * @public
     * @returns {boolean} Current selection mode.
     */
    get isMultiple() {
        return this.config.isMultiple;
    }
    /**
     * Enables or disables multiple selection mode.
     *
     * Side effects (when rendered):
     * - Toggles `"multiple"` CSS class on root element.
     * - Switches input `type` attribute (`"radio"` ↔ `"checkbox"`).
     *
     * Notes:
     * - Assignments trigger Proxy → {@link applyPartialChange}.
     * - No-op if value hasn't changed (Proxy guards).
     *
     * @public
     * @param {boolean} value - `true` for multiple selection; `false` for single.
     */
    set isMultiple(value) {
        this.configProxy.isMultiple = !!value;
    }
    /**
     * Indicates whether the option displays an image.
     *
     * @public
     * @returns {boolean} `true` if image is visible; `false` otherwise.
     */
    get hasImage() {
        return this.config.hasImage;
    }
    /**
     * Shows or hides the option's image element.
     *
     * Side effects (when rendered):
     * - **`true`**: Toggles `"has-image"` class, adds `image-{position}` class, calls {@link createImage}.
     * - **`false`**: Removes `"has-image"` and `image-*` classes, removes `<img>` element, nulls reference.
     *
     * Notes:
     * - Assignments trigger Proxy → {@link applyPartialChange}.
     * - Image is created on-demand (not pre-rendered).
     *
     * @public
     * @param {boolean} value - `true` to show image; `false` to hide.
     */
    set hasImage(value) {
        this.configProxy.hasImage = !!value;
    }
    /**
     * Provides reactive access to the full option configuration.
     *
     * Usage:
     * - **Getter**: Returns {@link configProxy} for direct property access.
     * - **Setter**: Applies batch configuration changes (see setter docs).
     *
     * Notes:
     * - Mutating properties on the returned object triggers incremental DOM updates.
     * - Safe to read/write after {@link initialize} completes.
     *
     * @public
     * @returns {OptionConfig} Reactive configuration Proxy.
     */
    get optionConfig() {
        return this.configProxy;
    }
    /**
     * Applies a batch of configuration changes efficiently.
     *
     * Optimization strategy:
     * 1. Compares each incoming property against current {@link config} value.
     * 2. Builds a `changes` object containing **only diffed properties**.
     * 3. Assigns `changes` to {@link configProxy} via `Object.assign` (triggers Proxy traps).
     *
     * Diffed properties:
     * - `imageWidth`, `imageHeight`, `imageBorderRadius`
     * - `imagePosition`
     * - `labelValign`, `labelHalign`
     *
     * Notes:
     * - No-op if `config` is `null`, or no properties differ.
     * - Prevents redundant Proxy triggers for unchanged values.
     * - Each changed property triggers {@link applyPartialChange} individually.
     *
     * @public
     * @param {OptionConfigPatch} config - Partial configuration patch; `null` is no-op.
     * @returns {void}
     */
    set optionConfig(config) {
        if (!config || !this.configProxy || !this.config)
            return;
        const changes = {};
        if (config.imageWidth !== undefined &&
            config.imageWidth !== this.config.imageWidth)
            changes.imageWidth = config.imageWidth;
        if (config.imageHeight !== undefined &&
            config.imageHeight !== this.config.imageHeight)
            changes.imageHeight = config.imageHeight;
        if (config.imageBorderRadius !== undefined &&
            config.imageBorderRadius !== this.config.imageBorderRadius)
            changes.imageBorderRadius = config.imageBorderRadius;
        if (config.imagePosition !== undefined &&
            config.imagePosition !== this.config.imagePosition)
            changes.imagePosition = config.imagePosition;
        if (config.labelValign !== undefined &&
            config.labelValign !== this.config.labelValign)
            changes.labelValign = config.labelValign;
        if (config.labelHalign !== undefined &&
            config.labelHalign !== this.config.labelHalign)
            changes.labelHalign = config.labelHalign;
        if (Object.keys(changes).length > 0) {
            Object.assign(this.configProxy, changes);
        }
    }
    /**
     * Performs the initial render of the option view.
     *
     * Rendering flow:
     * 1. Generates unique option ID (7-character random string).
     * 2. Builds CSS classes based on current {@link config} (`multiple`, `has-image`, `image-{position}`).
     * 3. Constructs child structure:
     *    - **OptionInput**: `<input type="radio|checkbox">` with unique ID.
     *    - **OptionImage** (conditional): `<img>` with inline styles (width/height/borderRadius).
     *    - **OptionLabel**: `<label htmlFor="{inputID}">` with alignment classes.
     *      - **LabelContent**: `<div>` (content placeholder).
     * 4. Creates DOM via {@link Libs.mountNode}.
     * 5. Appends root to {@link parent}.
     * 6. Sets {@link isRendered} to `true` (enables reactive updates).
     * 7. Transitions `INITIALIZED → MOUNTED` via `super.mount()`.
     *
     * Accessibility setup:
     * - Root: `role="option"`, `aria-selected="false"`, `tabindex="-1"`.
     * - Input/Label association via `id` / `htmlFor`.
     *
     * Postcondition:
     * - {@link view} is populated with typed DOM references.
     * - Reactive updates are now enabled.
     *
     * @public
     * @returns {void}
     * @override
     */
    mount() {
        const viewClass = ["seui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${this.options?.SEID ?? "default"}_${opt_id}`;
        if (this.config.isMultiple)
            viewClass.push("multiple");
        if (this.config.hasImage) {
            viewClass.push("has-image", `image-${this.config.imagePosition}`);
        }
        const childStructure = {
            OptionInput: {
                tag: {
                    node: "input",
                    type: this.config.isMultiple ? "checkbox" : "radio",
                    classList: "allow-choice",
                    id: inputID,
                },
            },
            ...(this.config.hasImage && {
                OptionImage: {
                    tag: {
                        node: "img",
                        classList: "option-image",
                        style: {
                            width: this.config.imageWidth,
                            height: this.config.imageHeight,
                            borderRadius: this.config.imageBorderRadius,
                        },
                    },
                },
            }),
            OptionLabel: {
                tag: {
                    node: "label",
                    htmlFor: inputID,
                    classList: [
                        `align-vertical-${this.config.labelValign}`,
                        `align-horizontal-${this.config.labelHalign}`,
                    ],
                },
                child: {
                    LabelContent: { tag: { node: "div" } },
                },
            },
        };
        this.view = Libs.mountNode({
            OptionView: {
                tag: {
                    node: "div",
                    id: `seui-${this.options?.SEID ?? "default"}-${opt_id}-option`,
                    classList: viewClass,
                    role: "option",
                    ariaSelected: "false",
                    tabIndex: "-1",
                },
                child: childStructure,
            },
        });
        this.parent.appendChild(this.view.view);
        this.isRendered = true;
        super.mount();
    }
    /**
     * Applies a targeted DOM update for a single configuration change.
     *
     * Implementation strategy:
     * - Retrieves DOM references from {@link view}.
     * - Switches on `prop` to determine update type.
     * - Mutates **only** the affected DOM nodes (classes, attributes, styles, or child structure).
     *
     * Update rules:
     * - **`isMultiple`**: Toggle `"multiple"` class, switch input `type` (radio ↔ checkbox).
     * - **`hasImage`**: Toggle `"has-image"` class, create/remove `<img>` element, manage `image-*` classes.
     * - **`imagePosition`**: Replace `image-{position}` class (top/right/bottom/left).
     * - **`imageWidth/Height/BorderRadius`**: Mutate `<img>` inline styles.
     * - **`labelValign/Halign`**: Replace label alignment classes.
     *
     * No-op conditions:
     * - If {@link view} is `null` (not mounted yet).
     * - If affected element doesn't exist (e.g., image removed).
     *
     * Notes:
     * - Called by Proxy `set` trap when {@link isRendered} is `true`.
     * - Avoids full re-render; updates are incremental and efficient.
     * - `oldValue` parameter is unused (reserved for future diffing logic).
     *
     * @private
     * @template K - Key of {@link OptionConfig}.
     * @param {K} prop - Property name that changed.
     * @param {OptionConfig[K]} newValue - New value for the property.
     * @param {OptionConfig[K]} oldValue - Previous value (currently unused).
     * @returns {void}
     */
    applyPartialChange(prop, newValue, oldValue) {
        const v = this.view;
        if (!v || !v.view)
            return;
        const root = v.view;
        const input = v.tags?.OptionInput;
        const label = v.tags?.OptionLabel;
        switch (prop) {
            case "isMultiple": {
                const val = !!newValue;
                root.classList.toggle("multiple", val);
                if (input && input.type !== (val ? "checkbox" : "radio")) {
                    input.type = val ? "checkbox" : "radio";
                }
                break;
            }
            case "hasImage": {
                const val = !!newValue;
                root.classList.toggle("has-image", val);
                if (val) {
                    root.classList.add(`image-${this.config.imagePosition}`);
                    this.createImage();
                }
                else {
                    root.className = root.className
                        .replace(/image-(top|right|bottom|left)/g, "")
                        .trim();
                    const img = v.tags?.OptionImage;
                    img?.remove();
                    v.tags.OptionImage = null;
                }
                break;
            }
            case "imagePosition": {
                if (this.config.hasImage) {
                    root.className = root.className
                        .replace(/image-(top|right|bottom|left)/g, "")
                        .trim();
                    root.classList.add(`image-${String(newValue)}`);
                }
                break;
            }
            case "imageWidth":
            case "imageHeight":
            case "imageBorderRadius": {
                const img = v.tags?.OptionImage;
                if (img) {
                    const styleProp = prop === "imageWidth"
                        ? "width"
                        : prop === "imageHeight"
                            ? "height"
                            : "borderRadius";
                    img.style[styleProp] = String(newValue);
                }
                break;
            }
            case "labelValign":
            case "labelHalign": {
                if (label) {
                    label.className =
                        `align-vertical-${this.config.labelValign} ` +
                            `align-horizontal-${this.config.labelHalign}`;
                }
                break;
            }
        }
    }
    /**
     * Creates and inserts the `<img>` element for the option on demand.
     *
     * Creation flow:
     * 1. Checks if image already exists (early return if present).
     * 2. Creates `<img>` element with:
     *    - Class: `"option-image"`
     *    - Inline styles: `width`, `height`, `borderRadius` from {@link config}.
     * 3. Inserts image before {@link OptionLabel} (if label exists), otherwise appends to root.
     * 4. Stores reference in `view.tags.OptionImage`.
     *
     * No-op conditions:
     * - If {@link view} is `null` (not mounted yet).
     * - If image already exists in `view.tags.OptionImage`.
     *
     * Notes:
     * - Called by {@link applyPartialChange} when `hasImage` transitions to `true`.
     * - Insertion order ensures proper layout (image before label).
     *
     * @private
     * @returns {void}
     */
    createImage() {
        const v = this.view;
        if (!v || !v.view)
            return;
        if (v.tags?.OptionImage)
            return;
        const root = v.view;
        const label = v.tags?.OptionLabel;
        const image = document.createElement("img");
        image.className = "option-image";
        image.style.width = this.config.imageWidth;
        image.style.height = this.config.imageHeight;
        image.style.borderRadius = this.config.imageBorderRadius;
        if (label?.parentElement) {
            root.insertBefore(image, label);
        }
        else {
            root.appendChild(image);
        }
        v.tags.OptionImage = image;
    }
}

/**
 * Mixed (heterogeneous) adapter for rendering and interacting with a list that contains
 * both {@link GroupModel} and {@link OptionModel} items.
 *
 * ### Responsibility
 * - Flatten hierarchical data (groups → options) into `flatOptions` for:
 *   - keyboard navigation (highlight + next/prev visible),
 *   - visibility aggregation (visibleCount/totalCount),
 *   - selection helpers (getSelectedItem(s), checkAll).
 * - Create the correct view implementation per item:
 *   - {@link GroupView} for groups,
 *   - {@link OptionView} for options (including options inside a group container).
 * - Bind DOM events and model hooks to keep View ↔ Model synchronized:
 *   - click → selection changes,
 *   - mouseenter → highlight changes,
 *   - model visibility change → group visibility recalculation + debounced stats event.
 *
 * ### Lifecycle (Strict FSM, idempotency)
 * - `init()` registers a debounced visibility aggregation job and then calls `mount()`.
 * - View binding in `handleGroupView` / `handleOptionView` is guarded by `model.isInit`
 *   to avoid double-wiring listeners (idempotent binding).
 * - `destroy()` clears scheduler jobs and destroys groups (cascades into their options/views),
 *   then transitions to `DESTROYED`. Subsequent destroy calls are **no-ops**.
 *
 * ### Event / Hook flow (external vs internal)
 * - **External selection**: user click triggers `changingProp("select")` then changes `OptionModel.selected`,
 *   and eventually emits adapter-level `changeProp("selected")` via `optionModel.onSelected`.
 * - **Internal selection**: `OptionModel.selectedNonTrigger` / `onInternalSelected` updates internal state
 *   (e.g., cache `selectedItemSingle`) and emits adapter-level `changeProp("selected_internal")`
 *   without implying user intent.
 *
 * ### Visibility / Highlight / Navigation
 * - Visibility is tracked per option model (`OptionModel.visible`), and groups can update their own
 *   derived visibility via `GroupModel.updateVisibility()`.
 * - Highlight is tracked by flat index (`currentHighlightIndex`) and by model flag
 *   (`OptionModel.highlighted`), enabling view-level styling / a11y hooks.
 *
 * ### DOM side effects / a11y notes
 * - Adds DOM listeners (`click`, `mouseenter`) on first bind only.
 * - Uses `Element.scrollIntoView()` when highlighting with scrolling enabled.
 * - When options are virtualized, falls back to `recyclerView.ensureRendered(i, { scrollIntoView: true })`
 *   before attempting to scroll.
 *
 * @extends {Adapter<MixedItem, GroupView | OptionView>}
 * @see {@link GroupModel}
 * @see {@link OptionModel}
 * @see {@link GroupView}
 * @see {@link OptionView}
 */
class MixedAdapter extends Adapter {
    /**
     * Creates a MixedAdapter with an optional initial list of items.
     * Immediately computes `groups` and `flatOptions` for navigation/stats.
     *
     * @param {MixedItem[]} [items=[]] - Initial items (groups and/or options).
     */
    constructor(items = []) {
        super(items);
        /** Whether the adapter operates in multi-selection mode. */
        this.isMultiple = false;
        /**
         * Subscribers for aggregated visibility statistics.
         * Fired via a debounced scheduler to avoid repeated recomputation during batch updates.
         */
        this.visibilityChangedCallbacks = [];
        /**
         * Flat index of the currently highlighted option.
         * `-1` indicates "no highlight".
         */
        this.currentHighlightIndex = -1;
        /** Top-level group models (if any). */
        this.groups = [];
        /**
         * Flattened list of all option models, including options inside groups.
         * This is the primary index space for navigation/highlight.
         */
        this.flatOptions = [];
        this.buildFlatStructure();
    }
    /**
     * Initializes debounced visibility aggregation and transitions lifecycle forward.
     *
     * - Registers `sche_vis_${adapterKey}`:
     *   - computes `{ visibleCount, totalCount, hasVisible, isEmpty }` from `flatOptions`,
     *   - notifies {@link onVisibilityChanged} subscribers,
     *   - triggers a proxy scheduler `sche_vis_proxy_${adapterKey}` for downstream chaining.
     * - Calls base `init()` and mounts immediately.
     *
     * Idempotency:
     * - Scheduler key is deterministic per adapter instance (`adapterKey`).
     *
     * @returns {void}
     * @override
     */
    init() {
        Libs.callbackScheduler.on(`sche_vis_${this.adapterKey}`, () => {
            const visibleCount = this.flatOptions.filter((item) => item.visible).length;
            const totalCount = this.flatOptions.length;
            this.visibilityChangedCallbacks.forEach((callback) => {
                callback({
                    visibleCount,
                    totalCount,
                    hasVisible: visibleCount > 0,
                    isEmpty: totalCount === 0,
                });
            });
            // Proxy hook; allows other listeners to chain after visibility aggregation.
            Libs.callbackScheduler.run(`sche_vis_proxy_${this.adapterKey}`);
        }, { debounce: 10 });
        super.init();
        this.mount();
    }
    /**
     * Rebuilds the derived structures:
     * - `groups`: top-level {@link GroupModel} list
     * - `flatOptions`: all {@link OptionModel} instances in traversal order
     *
     * The flat list is used for:
     * - navigation across visible options,
     * - computing visibility statistics,
     * - highlight index mapping.
     *
     * @returns {void}
     */
    buildFlatStructure() {
        this.flatOptions = [];
        this.groups = [];
        this.items.forEach((item) => {
            if (item instanceof GroupModel) {
                this.groups.push(item);
                this.flatOptions.push(...item.items);
            }
            else if (item instanceof OptionModel) {
                this.flatOptions.push(item);
            }
        });
    }
    /**
     * Creates the appropriate view instance for a given item.
     *
     * @param {HTMLElement} parent - Container element where the view will be mounted.
     * @param {MixedItem} item - The item to render (group or option).
     * @returns {GroupView | OptionView} A view instance matching the item type.
     * @override
     */
    viewHolder(parent, item) {
        if (item instanceof GroupModel)
            return new GroupView(parent, this.options);
        return new OptionView(parent, this.options);
    }
    /**
     * Binds a model (group or option) to its view and delegates to specialized handlers.
     *
     * Notes:
     * - Assigns `item.position` in the top-level `items` list (not the `flatOptions` index).
     * - Performs one-time listener binding guarded by `item.isInit`.
     *
     * @param {MixedItem} item - {@link GroupModel} or {@link OptionModel}.
     * @param {GroupView | OptionView} viewer - The view instance that will render the model.
     * @param {number} position - Position in the top-level mixed list.
     * @returns {void}
     * @override
     */
    onViewHolder(item, viewer, position) {
        item.position = position;
        if (item instanceof GroupModel) {
            this.handleGroupView(item, viewer, position);
        }
        else if (item instanceof OptionModel) {
            this.handleOptionView(item, viewer, position);
        }
        item.isInit = true;
    }
    /**
     * Binds / renders a group header and its option children.
     *
     * Responsibilities:
     * - Set header label and click-to-toggle behavior (one-time).
     * - Observe collapsed state:
     *   - toggles child option DOM display,
     *   - invokes {@link onCollapsedChange} hook.
     * - Ensure each child option has a view and is bound via {@link handleOptionView}.
     * - Sync collapsed UI and derived visibility for the group view.
     *
     * DOM side effects:
     * - Adds a click listener to the group header (only once).
     * - Updates child option view element `style.display` on collapse changes.
     *
     * @param {GroupModel} groupModel - Group data model.
     * @param {GroupView} groupView - Group view instance.
     * @param {number} position - Group index in the top-level list.
     * @returns {void}
     */
    handleGroupView(groupModel, groupView, position) {
        super.onViewHolder(groupModel, groupView, position);
        groupModel.view = groupView;
        const header = groupView.view.tags.GroupHeader;
        header.textContent = groupModel.label;
        if (!groupModel.isInit) {
            header.style.cursor = "pointer";
            header.addEventListener("click", () => {
                groupModel.toggleCollapse();
            });
            groupModel.onCollapsedChanged((evtToken, model, collapsed) => {
                model.items.forEach((optItem) => {
                    const optView = optItem.view?.getView?.();
                    if (optView)
                        optView.style.display = collapsed ? "none" : "";
                });
                this.onCollapsedChange(model, collapsed);
            });
        }
        const itemsContainer = groupView.getItemsContainer();
        groupModel.items.forEach((optionModel, idx) => {
            let optionViewer = optionModel.view;
            if (!optionModel.isInit || !optionViewer) {
                optionViewer = new OptionView(itemsContainer, this.options);
            }
            this.handleOptionView(optionModel, optionViewer, idx);
            optionModel.isInit = true;
        });
        groupView.setCollapsed(groupModel.collapsed);
        groupView.updateVisibility();
    }
    /**
     * Binds / renders an option row and wires selection/highlight/visibility behavior.
     *
     * Responsibilities:
     * - Apply visual configuration from the model options (image sizing/position, label alignment).
     * - Render image (src/alt) and label HTML.
     * - Wire DOM events (one-time):
     *   - click → selection (single/multiple),
     *   - mouseenter → highlight.
     * - Wire model hooks (one-time):
     *   - `onSelected` → `changeProp("selected")` (external semantics),
     *   - `onInternalSelected` → cache single selected + `changeProp("selected_internal")` (internal semantics),
     *   - `onVisibilityChanged` → group visibility recompute + debounced visibility stats.
     *
     * Selection semantics:
     * - Multi-select: toggles `selected` for the clicked option.
     * - Single-select: clears previous selected option (if cached) and selects the clicked one.
     * - Both paths run `changingProp("select")` before mutating selection when not skipping events.
     *
     * DOM side effects:
     * - Adds listeners to `OptionView` element only on first bind.
     * - Updates image and label DOM each bind.
     *
     * @param {OptionModel} optionModel - Option data model.
     * @param {OptionView} optionViewer - Option view instance.
     * @param {number} position - Option index within its group list (or rendering context).
     * @returns {void}
     */
    handleOptionView(optionModel, optionViewer, position) {
        optionViewer.isMultiple = this.isMultiple;
        optionViewer.hasImage = optionModel.hasImage;
        optionViewer.optionConfig = {
            imageWidth: optionModel.options.imageWidth,
            imageHeight: optionModel.options.imageHeight,
            imageBorderRadius: optionModel.options.imageBorderRadius,
            imagePosition: optionModel.options.imagePosition,
            labelValign: optionModel.options.labelValign,
            labelHalign: optionModel.options.labelHalign,
        };
        if (!optionModel.isInit) {
            super.onViewHolder(optionModel, optionViewer, position);
        }
        optionModel.view = optionViewer;
        if (optionModel.hasImage) {
            const imageTag = optionViewer.view.tags.OptionImage;
            if (imageTag) {
                if (imageTag.src !== optionModel.imageSrc)
                    imageTag.src = optionModel.imageSrc;
                if (imageTag.alt !== optionModel.text)
                    imageTag.alt = optionModel.text;
            }
        }
        // Label uses HTML to support rich content; consumers must ensure the model text is safe.
        optionViewer.view.tags.LabelContent.innerHTML = optionModel.text;
        if (!optionModel.isInit) {
            optionViewer.view.tags.OptionView.addEventListener("click", async (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                if (this.isSkipEvent)
                    return;
                if (this.isMultiple) {
                    await this.changingProp("select");
                    optionModel.selected = !optionModel.selected;
                }
                else if (optionModel.selected !== true) {
                    await this.changingProp("select");
                    if (this.selectedItemSingle)
                        this.selectedItemSingle.selected = false;
                    optionModel.selected = true;
                }
            });
            optionViewer.view.tags.OptionView.title = optionModel.textContent;
            optionViewer.view.tags.OptionView.addEventListener("mouseenter", () => {
                if (this.isSkipEvent)
                    return;
                this.setHighlight(this.flatOptions.indexOf(optionModel), false);
            });
            // External selection notification (user-facing semantics).
            optionModel.onSelected((_evtToken, _el, _selected) => {
                this.changeProp("selected");
            });
            // Internal selection notification (non-trigger semantics).
            optionModel.onInternalSelected((_evtToken, _el, selected) => {
                if (selected)
                    this.selectedItemSingle = optionModel;
                this.changeProp("selected_internal");
            });
            // Visibility changes affect group visibility and aggregated visibility stats.
            optionModel.onVisibilityChanged((_evtToken, model, _visible) => {
                model.group?.updateVisibility();
                this.notifyVisibilityChanged();
            });
        }
        // Ensure single-select cache and suppress re-trigger when model is already selected.
        if (optionModel.selected) {
            this.selectedItemSingle = optionModel;
            optionModel.selectedNonTrigger = true;
        }
    }
    /**
     * Replaces items and rebuilds derived structures with full change notifications.
     *
     * Flow:
     * - `changingProp("items", items)` (pre-change pipeline)
     * - assign `this.items`, rebuild `groups`/`flatOptions`
     * - `changeProp("items", items)` (post-change pipeline)
     * - {@link Lifecycle.update}
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {Promise<void>}
     * @override
     */
    async setItems(items) {
        await this.changingProp("items", items);
        this.items = items;
        this.buildFlatStructure();
        await this.changeProp("items", items);
        this.update();
    }
    /**
     * Synchronizes items from an external source by delegating to {@link setItems}.
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {Promise<void>}
     * @override
     */
    async syncFromSource(items) {
        await this.setItems(items);
    }
    /**
     * Updates items and rebuilds derived structures **without** emitting change notifications.
     * Useful for internal reconciliation where observers should not be notified.
     *
     * @param {MixedItem[]} items - New mixed item collection (groups/options).
     * @returns {void}
     * @override
     */
    updateData(items) {
        this.items = items;
        this.buildFlatStructure();
        this.update();
    }
    /**
     * Releases adapter resources and clears derived state.
     *
     * Behavior:
     * - Clears visibility scheduler task (`sche_vis_${adapterKey}`).
     * - Destroys all group models (which may cascade to child models/views).
     * - Resets cached selection/highlight and subscriber lists.
     *
     * Idempotent:
     * - Returns early if already in {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        Libs.callbackScheduler.clear(`sche_vis_${this.adapterKey}`);
        this.groups.forEach((group) => {
            group.destroy();
        });
        this.visibilityChangedCallbacks = [];
        this.currentHighlightIndex = -1;
        this.selectedItemSingle = null;
        this.groups = [];
        this.flatOptions = [];
        super.destroy();
    }
    /**
     * Returns all currently selected options from the flat list.
     *
     * @returns {OptionModel[]} Selected options.
     */
    getSelectedItems() {
        return this.flatOptions.filter((item) => item.selected);
    }
    /**
     * Returns the first selected option from the flat list (if any).
     * Primarily useful for single-select mode.
     *
     * @returns {OptionModel | undefined} The first selected option, or `undefined` if none.
     */
    getSelectedItem() {
        return this.flatOptions.find((item) => item.selected);
    }
    /**
     * Selects or deselects all options when in multiple selection mode.
     * No-op if `isMultiple` is false.
     *
     * @param {boolean} isChecked - `true` to select all; `false` to deselect all.
     * @returns {void}
     */
    checkAll(isChecked) {
        if (!this.isMultiple)
            return;
        this.flatOptions.forEach((item) => {
            item.selected = isChecked;
        });
    }
    /**
     * Subscribes to aggregated visibility changes across all options.
     * The callback is invoked from a debounced scheduler.
     *
     * @param {(stats: VisibilityStats) => void} callback - Invoked with `{ visibleCount, totalCount, hasVisible, isEmpty }`.
     * @returns {void}
     */
    onVisibilityChanged(callback) {
        this.visibilityChangedCallbacks.push(callback);
    }
    /**
     * Schedules a debounced visibility statistics recomputation and subscriber notification.
     *
     * @returns {void}
     */
    notifyVisibilityChanged() {
        Libs.callbackScheduler.run(`sche_vis_${this.adapterKey}`);
    }
    /**
     * Computes and returns current visibility statistics for options.
     *
     * @returns {VisibilityStats} Aggregated stats: `{ visibleCount, totalCount, hasVisible, isEmpty }`.
     */
    getVisibilityStats() {
        const visibleCount = this.flatOptions.filter((item) => item.visible).length;
        const totalCount = this.flatOptions.length;
        return {
            visibleCount,
            totalCount,
            hasVisible: visibleCount > 0,
            isEmpty: totalCount === 0,
        };
    }
    /**
     * Resets highlight navigation to the first visible option (starting from index 0).
     *
     * @returns {void}
     */
    resetHighlight() {
        this.setHighlight(0);
    }
    /**
     * Moves highlight among **visible** options and optionally scrolls the new target into view.
     *
     * - Wraps around at both ends (circular navigation).
     * - Uses the current highlight (flat index) as the starting point.
     *
     * @param {number} direction - `+1` to move forward; `-1` to move backward.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     * @returns {void}
     */
    navigate(direction, isScrollToView = true) {
        const visibleOptions = this.flatOptions.filter((opt) => opt.visible);
        if (visibleOptions.length === 0)
            return;
        let currentVisibleIndex = visibleOptions.findIndex((opt) => opt === this.flatOptions[this.currentHighlightIndex]);
        if (currentVisibleIndex === -1)
            currentVisibleIndex = -1;
        let nextVisibleIndex = currentVisibleIndex + direction;
        if (nextVisibleIndex >= visibleOptions.length)
            nextVisibleIndex = 0;
        if (nextVisibleIndex < 0)
            nextVisibleIndex = visibleOptions.length - 1;
        const nextOption = visibleOptions[nextVisibleIndex];
        const flatIndex = this.flatOptions.indexOf(nextOption);
        this.setHighlight(flatIndex, isScrollToView);
    }
    /**
     * Programmatically selects (clicks) the currently highlighted option if it is visible.
     *
     * DOM side effects:
     * - Calls `HTMLElement.click()` on the rendered option view element.
     *
     * No-op if:
     * - No highlight is set,
     * - Highlighted item does not exist,
     * - Highlighted item is not visible,
     * - View element is not available (e.g., not rendered).
     *
     * @returns {void}
     */
    selectHighlighted() {
        if (this.currentHighlightIndex > -1 &&
            this.flatOptions[this.currentHighlightIndex]) {
            const item = this.flatOptions[this.currentHighlightIndex];
            if (item.visible) {
                const viewEl = item.view?.getView?.();
                if (viewEl)
                    viewEl.click();
            }
        }
    }
    /**
     * Highlights a target option (by flat index or model reference), skipping invisible items.
     * Optionally scrolls the highlighted item into view.
     *
     * Behavior:
     * - Clears previous highlight (if any) by toggling `OptionModel.highlighted = false`.
     * - Starting from the resolved index, finds the first visible option and highlights it.
     * - If scrolling is enabled:
     *   - scrolls the DOM element when available, otherwise
     *   - asks the recycler to render the item and scroll into view (virtualized lists).
     * - Invokes {@link onHighlightChange} hook after applying highlight.
     *
     * @param {number | OptionModel} target - Flat index or option model to highlight.
     * @param {boolean} [isScrollToView=true] - Whether to scroll the highlighted item into view.
     * @returns {void}
     */
    setHighlight(target, isScrollToView = true) {
        let index = 0;
        if (typeof target === "number") {
            index = target;
        }
        else if (target instanceof OptionModel) {
            const fi = this.flatOptions.indexOf(target);
            index = fi > -1 ? fi : 0;
        }
        else {
            index = 0;
        }
        if (this.currentHighlightIndex > -1 &&
            this.flatOptions[this.currentHighlightIndex]) {
            this.flatOptions[this.currentHighlightIndex].highlighted = false;
        }
        for (let i = index; i < this.flatOptions.length; i++) {
            const item = this.flatOptions[i];
            if (!item?.visible)
                continue;
            item.highlighted = true;
            this.currentHighlightIndex = i;
            if (isScrollToView) {
                const el = item.view?.getView?.();
                if (el) {
                    el.scrollIntoView({ block: "center", behavior: "smooth" });
                }
                else {
                    // If virtualized, ensure the item is rendered before trying to scroll.
                    this.recyclerView?.ensureRendered?.(i, {
                        scrollIntoView: true,
                    });
                }
            }
            this.onHighlightChange(i, item.view?.getView?.()?.id);
            return;
        }
    }
    /**
     * Hook called whenever highlight changes.
     *
     * Intended for UI side effects that do not belong in core adapter logic, e.g.:
     * - roving tabindex / focus synchronization,
     * - ARIA live region announcements,
     * - analytics/navigation instrumentation.
     *
     * @param {number} index - Flat index of the newly highlighted option.
     * @param {string} [id] - Optional DOM id of the highlighted view element (when available).
     * @returns {void}
     */
    onHighlightChange(index, id) { }
    /**
     * Hook called whenever a group's collapsed state changes.
     *
     * Intended for integration side effects, e.g.:
     * - layout recalculation,
     * - popup resize,
     * - analytics.
     *
     * @param {GroupModel} model - The group whose collapsed state changed.
     * @param {boolean} collapsed - New collapsed state.
     * @returns {void}
     */
    onCollapsedChange(model, collapsed) { }
}

/**
 * Fenwick Tree (Binary Indexed Tree) used for fast prefix sums over item heights.
 *
 * ### Responsibility
 * - Maintain cumulative sums for a numeric array (here: per-item heights) with:
 *   - point updates in **O(log n)**
 *   - prefix/range queries in **O(log n)**
 * - Enable virtualization math (offset-by-index, index-by-offset) without scanning.
 *
 * ### Indexing contract
 * - Internally uses **1-based indexing**:
 *   - valid indices: `1..stackNum`
 *   - `bit[0]` is unused
 * - External callers must convert from 0-based item indices where needed
 *   (e.g., update at 0-based `i` → `add(i + 1, delta)`).
 *
 * ### Lifecycle
 * - Calls {@link Lifecycle.init} in {@link initialize}.
 * - Does not participate in mount/update DOM phases; acts as a pure in-memory helper.
 *
 * @extends Lifecycle
 * @internal Utility for {@link VirtualRecyclerView} height math.
 */
class Fenwick extends Lifecycle {
    /**
     * Creates a Fenwick tree and initializes it with the provided size (optional).
     *
     * @param {number} [stackNum=0] - Initial number of elements (all values start at 0).
     */
    constructor(stackNum = 0) {
        super();
        /** Internal BIT array. Index 0 is unused; valid range: [1..stackNum]. */
        this.bit = [];
        /** Number of elements managed by the tree (logical size). */
        this.stackNum = 0;
        this.initialize(stackNum);
    }
    /**
     * Initializes lifecycle and resets the tree to the given size.
     *
     * Idempotency:
     * - {@link Lifecycle.init} is guarded by the base FSM (no-op after first init).
     *
     * @param {number} stackNum - Number of elements to allocate (values cleared to 0).
     * @returns {void}
     */
    initialize(stackNum) {
        this.init();
        this.reset(stackNum);
    }
    /**
     * Resets the tree to a new size and clears all values to 0.
     *
     * @param {number} stackNum - New number of elements (valid 1-based indices: 1..stackNum).
     * @returns {void}
     */
    reset(stackNum) {
        this.stackNum = stackNum;
        this.bit = new Array(stackNum + 1).fill(0);
    }
    /**
     * Adds `delta` to the element at **1-based** index `i`.
     *
     * Complexity: **O(log n)**
     *
     * @param {number} i - 1-based index of the element to update (1..stackNum).
     * @param {number} delta - Value to add (can be negative).
     * @returns {void}
     */
    add(i, delta) {
        for (let x = i; x <= this.stackNum; x += x & -x)
            this.bit[x] += delta;
    }
    /**
     * Returns the prefix sum for the range **[1..i]** (inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param {number} i - 1-based index up to which the sum is calculated.
     * @returns {number} The cumulative sum from 1 to i.
     */
    sum(i) {
        let s = 0;
        for (let x = i; x > 0; x -= x & -x)
            s += this.bit[x];
        return s;
    }
    /**
     * Returns the sum in the range **[l..r]** (1-based, inclusive).
     *
     * Complexity: **O(log n)**
     *
     * @param {number} l - Left index (inclusive).
     * @param {number} r - Right index (inclusive).
     * @returns {number} The sum in [l..r], or 0 if r < l.
     */
    rangeSum(l, r) {
        return r < l ? 0 : this.sum(r) - this.sum(l - 1);
    }
    /**
     * Builds the tree from a **0-based** array in **O(n log n)**.
     *
     * Each element `arr[i]` is added to index `i + 1` (1-based BIT index).
     *
     * @param {number[]} arr - Source values (0-based).
     * @returns {void}
     */
    buildFrom(arr) {
        this.reset(arr.length);
        arr.forEach((val, i) => this.add(i + 1, val));
    }
    /**
     * Finds the largest index `idx` such that `prefixSum(idx) <= target`.
     *
     * This is a classic Fenwick lower-bound over prefix sums.
     * In virtualization terms, it answers: "How many items fit in `target` pixels?"
     *
     * Complexity: **O(log n)**
     *
     * @param {number} target - Target prefix sum.
     * @returns {number} The largest 1-based index satisfying the condition (range 0..stackNum).
     * Returns 0 if the first element already exceeds `target`.
     */
    lowerBoundPrefix(target) {
        let idx = 0, bitMask = 1;
        while (bitMask << 1 <= this.stackNum)
            bitMask <<= 1;
        let cur = 0;
        for (let step = bitMask; step !== 0; step >>= 1) {
            const next = idx + step;
            if (next <= this.stackNum && cur + this.bit[next] <= target) {
                idx = next;
                cur += this.bit[next];
            }
        }
        return idx;
    }
}

/**
 * Virtualized RecyclerView with windowing and dynamic-height support.
 *
 * This recycler only keeps the **visible window** mounted in the DOM, plus an overscan buffer,
 * while simulating the full scroll height using top/bottom padding elements.
 *
 * ### Responsibility
 * - Maintain a viewport window `[start..end]` over adapter items and mount/unmount DOM accordingly.
 * - Support **variable row heights** using measured outer heights (including vertical margins).
 * - Provide stable scrolling under height changes via an **anchor correction** strategy.
 * - Integrate with item visibility (filtering): invisible items are treated as height `0` and are not mounted.
 *
 * ### Virtualization strategy
 * - **Prefix sums** over heights are maintained in a {@link Fenwick} tree:
 *   - `offsetTopOf(i)` → prefix sum for heights before item `i`
 *   - `findFirstVisibleIndex(scrollTop)` → lower-bound over prefix sums (then forward-scan to visible)
 * - **Overscan** is expressed in item multiples and converted to pixels using the current estimate:
 *   `overscanPx = overscan * estimate`.
 * - **Adaptive estimate** can be enabled to use the running average of measured items as the estimate.
 *
 * ### Dynamic heights (measurement)
 * - When enabled, visible items are measured using `getBoundingClientRect()` + computed margins.
 * - A {@link ResizeObserver} observes the host container and schedules re-measurement on the next animation frame.
 * - Height updates are applied incrementally to the Fenwick tree in **O(log n)** per item.
 *
 * ### Anchor correction (scroll stability)
 * - An "anchor index" (first visible item) is derived from the current scroll position.
 * - After re-render and potential height changes, scrollTop is adjusted so the anchor remains visually stable,
 *   preventing "jumping" during measurement-driven reflows.
 *
 * ### Lifecycle / idempotency
 * - Mounted scaffold elements are created when an adapter is set via {@link setAdapter}.
 * - `refresh()` is safe to call repeatedly; it rebuilds internal structures and schedules a window update.
 * - `destroy()` is idempotent once in {@link LifecycleState.DESTROYED} and removes scaffold DOM nodes.
 *
 * ### DOM side effects
 * - Mutates DOM under `viewElement` by creating three nodes:
 *   - `PadTop`, `ItemsHost`, `PadBottom`
 * - Mounts/unmounts item nodes inside `ItemsHost`
 * - Attaches/removes a scroll listener on the resolved scroll container
 * - Uses `scrollIntoView`/scrollTop assignments when asked to bring an item into view
 *
 * @template TItem - Model type for list items.
 * @template TAdapter - Adapter providing view holders and binding logic.
 *
 * @extends {RecyclerView<TItem, TAdapter>}
 * @see {@link VirtualOptions}
 * @see {@link RecyclerView}
 */
class VirtualRecyclerView extends RecyclerView {
    /**
     * Creates a virtual recycler view.
     *
     * Note: The virtualization scaffold is built when an adapter is set via {@link setAdapter}.
     *
     * @param {HTMLDivElement} [viewElement=null] - Optional root container for the recycler view.
     */
    constructor(viewElement) {
        super(viewElement);
        /**
         * Virtualization settings (materialized to `Required<VirtualOptions>`).
         *
         * - `scrollEl`           : External scroll container (if omitted, inferred from DOM)
         * - `estimateItemHeight` : Initial/fallback item height in pixels
         * - `overscan`           : Extra viewport height (in item multiples) rendered above/below
         * - `dynamicHeights`     : Enable measuring items with ResizeObserver
         * - `adaptiveEstimate`   : Use average of measured items as the running estimate
         */
        this.opts = {
            scrollEl: undefined,
            estimateItemHeight: 36,
            overscan: 8,
            dynamicHeights: true,
            adaptiveEstimate: true,
        };
        /** Cache of measured heights per item index (undefined when not measured). */
        this.heightCache = [];
        /**
         * Fenwick tree storing current height values (in pixels).
         * Invisible items are encoded as height 0.
         */
        this.fenwick = new Fenwick(0);
        /**
         * Map of currently mounted DOM elements keyed by item index.
         * Used to avoid re-creating nodes and to manage ordering within the host.
         */
        this.created = new Map();
        /** Whether an initial height probe has been performed. */
        this.firstMeasured = false;
        /** Current window bounds (inclusive) in item index space. */
        this.start = 0;
        /** Current window end (inclusive). -1 means not initialized. */
        this.end = -1;
        /** Re-entrancy/suspension flags used to prevent feedback loops. */
        this.updating = false;
        this.suppressResize = false;
        this.lastRenderCount = 0;
        this.suspended = false;
        this.resumeResizeAfter = false;
        /** Small cache for sticky header height (≈16ms TTL) to limit layout reads. */
        this.stickyCacheTick = 0;
        this.stickyCacheVal = 0;
        /** Stats for adaptive estimator (sum of measured heights / count of measured items). */
        this.measuredSum = 0;
        this.measuredCount = 0;
    }
    /**
     * Updates virtualization settings (overscan, estimates, dynamic heights, etc.).
     *
     * This only updates internal configuration; consumers should call {@link refresh}
     * to apply changes immediately if needed.
     *
     * @param {Partial<VirtualOptions>} opts - Partial configuration merged into current options.
     * @returns {void}
     */
    configure(opts) {
        this.opts = { ...this.opts, ...opts };
    }
    /**
     * Binds an adapter and initializes the virtualization scaffold.
     *
     * ### Flow
     * 1) Dispose previous listeners/observers if an adapter was already attached
     * 2) Call `super.setAdapter(adapter)` to wire base recycler state
     * 3) Build the scaffold elements (PadTop, ItemsHost, PadBottom)
     * 4) Resolve `scrollEl` (configured `opts.scrollEl` → nearest popup → parentElement)
     * 5) Attach scroll listener, perform initial refresh, attach resize observer
     * 6) Subscribe to adapter visibility updates (if supported) to hard-refresh windowing state
     *
     * DOM side effects:
     * - Clears `viewElement` children and replaces with scaffold nodes.
     * - Attaches a `scroll` listener to `scrollEl` (`passive: true`).
     *
     * @param {TAdapter} adapter - Adapter that provides items and view binding.
     * @returns {void}
     * @throws {Error} If no scroll container can be resolved.
     * @override
     */
    setAdapter(adapter) {
        if (this.adapter)
            this.dispose();
        super.setAdapter(adapter);
        adapter.recyclerView = this;
        if (!this.viewElement)
            return;
        this.viewElement.replaceChildren();
        const nodeMounted = Libs.mountNode({
            PadTop: {
                tag: { node: "div", classList: "seui-virtual-pad-top" },
            },
            ItemsHost: {
                tag: { node: "div", classList: "seui-virtual-items" },
            },
            PadBottom: {
                tag: { node: "div", classList: "seui-virtual-pad-bottom" },
            },
        }, this.viewElement);
        this.PadTop = nodeMounted.PadTop;
        this.ItemsHost = nodeMounted.ItemsHost;
        this.PadBottom = nodeMounted.PadBottom;
        this.scrollEl =
            this.opts.scrollEl ??
                this.viewElement.closest(".seui-popup") ??
                this.viewElement.parentElement;
        if (!this.scrollEl)
            throw new Error("VirtualRecyclerView: scrollEl not found");
        this.boundOnScroll = this.onScroll.bind(this);
        this.scrollEl.addEventListener("scroll", this.boundOnScroll, {
            passive: true,
        });
        this.refresh(false);
        this.attachResizeObserverOnce();
        adapter?.onVisibilityChanged?.(() => this.refreshItem());
    }
    /**
     * Suspends scroll/resize processing to prevent window updates during batch operations.
     *
     * Behavior:
     * - Cancels any scheduled animation frames.
     * - Detaches the scroll listener (if attached).
     * - Disconnects ResizeObserver and remembers to restore it on {@link resume}.
     *
     * @returns {void}
     */
    suspend() {
        this.suspended = true;
        this.cancelFrames();
        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this.boundOnScroll);
        }
        if (this.resizeObs) {
            this.resizeObs.disconnect();
            this.resumeResizeAfter = true;
        }
    }
    /**
     * Resumes processing after {@link suspend}.
     *
     * Behavior:
     * - Re-attaches the scroll listener (if available).
     * - Restores ResizeObserver when it was previously disconnected.
     * - Schedules a window recalculation on the next animation frame.
     *
     * @returns {void}
     */
    resume() {
        this.suspended = false;
        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.addEventListener("scroll", this.boundOnScroll, {
                passive: true,
            });
        }
        if (this.resumeResizeAfter) {
            this.attachResizeObserverOnce();
            this.resumeResizeAfter = false;
        }
        this.scheduleUpdateWindow();
    }
    /**
     * Rebuilds internal virtualization state and schedules a render update.
     *
     * Behavior:
     * - When `isUpdate === false`, triggers a hard refresh via {@link refreshItem} (reset + rebuild).
     * - Updates caches to match the adapter item count.
     * - Probes initial item height on first run to seed a better estimate.
     * - Rebuilds Fenwick prefix sums and schedules window computation.
     *
     * No-op if adapter or `viewElement` is missing.
     *
     * @param {boolean} isUpdate - `true` when called due to incremental data update; `false` for initial setup/full replace.
     * @returns {void}
     * @override
     */
    refresh(isUpdate) {
        if (!this.adapter || !this.viewElement)
            return;
        if (!isUpdate)
            this.refreshItem();
        const count = this.adapter.itemCount();
        this.lastRenderCount = count;
        if (count === 0) {
            this.resetState();
            this.update();
            return;
        }
        this.heightCache.length = count;
        if (!this.firstMeasured) {
            this.probeInitialHeight();
            this.firstMeasured = true;
        }
        this.rebuildFenwick(count);
        this.scheduleUpdateWindow();
        this.update();
    }
    /**
     * Ensures the item at `index` is mounted, and optionally scrolls it into view.
     *
     * This is primarily used by navigation/highlight flows where the target may not be rendered
     * due to virtualization.
     *
     * @param {number} index - Item index to ensure visible/mounted.
     * @param {{ scrollIntoView?: boolean }} [opt] - Optional behavior controls.
     * @returns {void}
     */
    ensureRendered(index, opt) {
        this.mountRange(index, index);
        if (opt?.scrollIntoView)
            this.scrollToIndex(index);
    }
    /**
     * Scrolls the scroll container to align the item at `index` into view.
     *
     * Calculation notes:
     * - Computes target top using prefix sums (`offsetTopOf`) and container offset relative to scrollEl.
     * - Clamps scrollTop to the scrollable range to avoid overshoot.
     *
     * No-op when itemCount is 0.
     *
     * @param {number} index - Item index to bring into view.
     * @returns {void}
     */
    scrollToIndex(index) {
        const count = this.adapter?.itemCount?.() ?? 0;
        if (count <= 0)
            return;
        const topInContainer = this.offsetTopOf(index);
        const containerTop = this.containerTopInScroll();
        const target = containerTop + topInContainer;
        const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
        this.scrollEl.scrollTop = Math.min(Math.max(0, target), maxScroll);
    }
    /**
     * Disposes runtime resources without destroying the instance.
     *
     * Intended for adapter swaps or teardown sequencing:
     * - cancels pending frames,
     * - removes scroll listeners,
     * - disconnects ResizeObserver,
     * - removes mounted item elements and clears internal maps.
     *
     * @returns {void}
     */
    dispose() {
        this.cancelFrames();
        if (this.scrollEl && this.boundOnScroll) {
            this.scrollEl.removeEventListener("scroll", this.boundOnScroll);
        }
        this.resizeObs?.disconnect();
        this.created.forEach((el) => el.remove());
        this.created.clear();
    }
    /**
     * Destroys the virtual recycler view and releases all resources.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Resets internal caches and disposes listeners/observers.
     * - Removes scaffold DOM nodes (PadTop, ItemsHost, PadBottom).
     * - Completes lifecycle teardown via {@link Lifecycle.destroy}.
     *
     * @returns {void}
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        this.resetState();
        this.dispose();
        this.PadTop.remove();
        this.ItemsHost.remove();
        this.PadBottom.remove();
        this.PadTop = null;
        this.ItemsHost = null;
        this.PadBottom = null;
        super.destroy();
    }
    /**
     * Hard reset used after large visibility changes (e.g., search/filter cleared).
     *
     * This recalculates padding and height structures by:
     * - suspending processing,
     * - resetting state and removing invisible elements,
     * - recomputing estimator stats from cache,
     * - rebuilding Fenwick prefix sums,
     * - resetting window bounds and resuming updates.
     *
     * @returns {void}
     */
    refreshItem() {
        if (!this.adapter)
            return;
        const count = this.adapter.itemCount();
        if (count <= 0)
            return;
        this.suspend();
        this.resetState();
        this.cleanupInvisibleItems();
        this.recomputeMeasuredStats(count);
        this.rebuildFenwick(count);
        this.start = 0;
        this.end = -1;
        this.resume();
    }
    /** Cancels any pending animation frames for window calculation and measurement. */
    cancelFrames() {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.measureRaf != null) {
            cancelAnimationFrame(this.measureRaf);
            this.measureRaf = null;
        }
    }
    /**
     * Resets internal state: mounted elements, caches, Fenwick sums, padding, and estimator stats.
     *
     * DOM side effects:
     * - Removes all currently mounted item elements tracked in {@link created}.
     * - Resets pad heights to `0px`.
     *
     * @returns {void}
     */
    resetState() {
        this.created.forEach((el) => el.remove());
        this.created.clear();
        this.heightCache = [];
        this.fenwick.reset(0);
        this.PadTop.style.height = "0px";
        this.PadBottom.style.height = "0px";
        this.firstMeasured = false;
        this.measuredSum = 0;
        this.measuredCount = 0;
    }
    /**
     * Measures the first item to seed a better initial height estimate.
     *
     * Strategy:
     * - Temporarily mounts index 0, measures its outer height, and updates `estimateItemHeight`.
     * - If `dynamicHeights` is disabled, the probe element is removed and the model/view init flags
     *   are reverted for that item to avoid treating the probe as a real render.
     *
     * @returns {void}
     */
    probeInitialHeight() {
        const probe = 0;
        this.mountIndexOnce(probe);
        const el = this.created.get(probe);
        if (!el)
            return;
        const h = this.measureOuterHeight(el);
        if (!isNaN(h))
            this.opts.estimateItemHeight = h;
        if (!this.opts.dynamicHeights) {
            el.remove();
            this.created.delete(probe);
            const item = this.adapter.items[probe];
            if (item) {
                item.isInit = false;
                item.view = null;
            }
        }
    }
    /**
     * Whether the item at `index` is visible (i.e., not filtered/hidden).
     *
     * Visibility convention:
     * - If `item.visible` is undefined, the item is treated as visible.
     *
     * @param {number} index - 0-based item index.
     * @returns {boolean} True if visible; otherwise false.
     */
    isIndexVisible(index) {
        const item = this.adapter?.items?.[index];
        return item?.visible ?? true;
    }
    /**
     * Finds the next visible item index starting from `index`.
     *
     * @param {number} index - Start index (0-based).
     * @param {number} count - Total item count.
     * @returns {number} Next visible index, or -1 if none exist.
     */
    nextVisibleFrom(index, count) {
        for (let i = Math.max(0, index); i < count; i++) {
            if (this.isIndexVisible(i))
                return i;
        }
        return -1;
    }
    /**
     * Recomputes running estimator stats from the current height cache.
     *
     * Only counts **visible** items; invisible items do not contribute to adaptive estimation.
     *
     * @param {number} count - Total item count.
     * @returns {void}
     */
    recomputeMeasuredStats(count) {
        this.measuredSum = 0;
        this.measuredCount = 0;
        for (let i = 0; i < count; i++) {
            if (!this.isIndexVisible(i))
                continue;
            const h = this.heightCache[i];
            if (h != null) {
                this.measuredSum += h;
                this.measuredCount++;
            }
        }
    }
    /**
     * Returns the view container's top offset relative to the scroll container.
     *
     * This is used to convert absolute scrollTop to a scrollTop relative to the recycler's own container.
     *
     * @returns {number} Top offset in pixels (non-negative).
     */
    containerTopInScroll() {
        const a = this.viewElement.getBoundingClientRect();
        const b = this.scrollEl.getBoundingClientRect();
        return Math.max(0, a.top - b.top + this.scrollEl.scrollTop);
    }
    /**
     * Returns sticky header height with a short cache window (~16ms) to avoid layout thrashing.
     *
     * Used to adjust effective viewport height (so windowing math accounts for a visible sticky header).
     *
     * @returns {number} Sticky header height in pixels.
     */
    stickyTopHeight() {
        const now = performance.now();
        if (now - this.stickyCacheTick < 16)
            return this.stickyCacheVal;
        const sticky = this.scrollEl.querySelector(".seui-option-handle:not(.hide)");
        this.stickyCacheVal = sticky?.offsetHeight ?? 0;
        this.stickyCacheTick = now;
        return this.stickyCacheVal;
    }
    /**
     * Schedules a window update on the next animation frame.
     *
     * No-op if:
     * - a frame is already scheduled, or
     * - the recycler is currently suspended.
     *
     * @returns {void}
     */
    scheduleUpdateWindow() {
        if (this.rafId != null || this.suspended)
            return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateWindowInternal();
        });
    }
    /**
     * Measures an element's "outer height" including vertical margins.
     *
     * @param {HTMLElement} el - Element to measure.
     * @returns {number} Total outer height in pixels (minimum 1).
     */
    measureOuterHeight(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const mt = parseFloat(style.marginTop) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        return Math.max(1, rect.height + mt + mb);
    }
    /**
     * Returns the current height estimate for unmeasured items.
     *
     * - When adaptive estimation is enabled and at least one item was measured,
     *   returns the running average.
     * - Otherwise returns the configured fixed estimate.
     *
     * @returns {number} Estimated item height in pixels (minimum 1).
     */
    getEstimate() {
        if (this.opts.adaptiveEstimate && this.measuredCount > 0) {
            return Math.max(1, this.measuredSum / this.measuredCount);
        }
        return this.opts.estimateItemHeight;
    }
    /**
     * Rebuilds Fenwick prefix sums from current cache/estimate and visibility.
     *
     * Encoding:
     * - Invisible items contribute `0` height.
     * - Visible items contribute either cached measured height, or the current estimate.
     *
     * @param {number} count - Total number of items.
     * @returns {void}
     */
    rebuildFenwick(count) {
        const est = this.getEstimate();
        const arr = Array.from({ length: count }, (_, i) => this.isIndexVisible(i) ? (this.heightCache[i] ?? est) : 0);
        this.fenwick.buildFrom(arr);
    }
    /**
     * Updates cached height at `index` and applies delta to the Fenwick tree.
     *
     * Behavior:
     * - Ignores invisible items (no-op).
     * - Applies an epsilon threshold to avoid jitter from sub-pixel / minor changes.
     * - Updates adaptive estimator stats and Fenwick sums in **O(log n)**.
     *
     * @param {number} index - 0-based item index to update.
     * @param {number} newH - Newly measured outer height (px).
     * @returns {boolean} True if the height changed beyond the epsilon threshold.
     */
    updateHeightAt(index, newH) {
        if (!this.isIndexVisible(index))
            return false;
        const est = this.getEstimate();
        const oldH = this.heightCache[index] ?? est;
        if (Math.abs(newH - oldH) <= VirtualRecyclerView.EPS)
            return false;
        const prevMeasured = this.heightCache[index];
        if (prevMeasured == null) {
            this.measuredSum += newH;
            this.measuredCount++;
        }
        else {
            this.measuredSum += newH - prevMeasured;
        }
        this.heightCache[index] = newH;
        this.fenwick.add(index + 1, newH - oldH);
        return true;
    }
    /**
     * Finds the first visible item at or after a scroll-relative offset.
     *
     * Strategy:
     * - Use Fenwick lower-bound to approximate a candidate index by cumulative height,
     * - Then advance to the next visible item.
     *
     * @param {number} stRel - ScrollTop relative to the view container (px).
     * @param {number} count - Total item count.
     * @returns {number} A visible index (best-effort); falls back to clamped candidate when needed.
     */
    findFirstVisibleIndex(stRel, count) {
        const k = this.fenwick.lowerBoundPrefix(Math.max(0, stRel));
        const raw = Math.min(count - 1, k);
        const v = this.nextVisibleFrom(raw, count);
        return v === -1 ? Math.max(0, raw) : v;
    }
    /**
     * Inserts an element into {@link ItemsHost} maintaining increasing index order.
     *
     * Heuristics:
     * - Prefer inserting after the previous index element if present.
     * - Else insert before the next index element if present.
     * - Else scan children to find the first element with a larger `data-vindex`.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to insert.
     * @returns {void}
     */
    insertIntoHostByIndex(index, el) {
        el.setAttribute(VirtualRecyclerView.ATTR_INDEX, String(index));
        const prev = this.created.get(index - 1);
        if (prev?.parentElement === this.ItemsHost) {
            prev.after(el);
            return;
        }
        const next = this.created.get(index + 1);
        if (next?.parentElement === this.ItemsHost) {
            this.ItemsHost.insertBefore(el, next);
            return;
        }
        const children = Array.from(this.ItemsHost.children);
        for (const child of children) {
            const v = child.getAttribute(VirtualRecyclerView.ATTR_INDEX);
            if (v && Number(v) > index) {
                this.ItemsHost.insertBefore(el, child);
                return;
            }
        }
        this.ItemsHost.appendChild(el);
    }
    /**
     * Ensures the element is in the correct DOM position for its index.
     *
     * Reinserts the element when adjacent siblings indicate an out-of-order position.
     *
     * @param {number} index - Item index.
     * @param {HTMLElement} el - Element to validate/reinsert.
     * @returns {void}
     */
    ensureDomOrder(index, el) {
        if (el.parentElement !== this.ItemsHost) {
            this.insertIntoHostByIndex(index, el);
            return;
        }
        el.setAttribute(VirtualRecyclerView.ATTR_INDEX, String(index));
        const prev = el.previousElementSibling;
        const next = el.nextElementSibling;
        const needsReorder = (prev &&
            Number(prev.getAttribute(VirtualRecyclerView.ATTR_INDEX)) >
                index) ||
            (next &&
                Number(next.getAttribute(VirtualRecyclerView.ATTR_INDEX)) <
                    index);
        if (needsReorder) {
            el.remove();
            this.insertIntoHostByIndex(index, el);
        }
    }
    /**
     * Attaches a {@link ResizeObserver} used for dynamic-height measurement.
     *
     * Singleton behavior:
     * - Only creates/attaches the observer once per instance.
     *
     * Scheduling:
     * - Observer callback schedules measurement on the next animation frame to batch DOM reads.
     * - No-op when suppressed or suspended.
     *
     * @returns {void}
     */
    attachResizeObserverOnce() {
        if (this.resizeObs)
            return;
        this.resizeObs = new ResizeObserver(() => {
            if (this.suppressResize ||
                this.suspended ||
                !this.adapter ||
                this.measureRaf != null)
                return;
            this.measureRaf = requestAnimationFrame(() => {
                this.measureRaf = null;
                this.measureVisibleAndUpdate();
            });
        });
        this.resizeObs.observe(this.ItemsHost);
    }
    /**
     * Measures all currently rendered items and updates the height cache.
     *
     * If any height changed:
     * - Rebuilds Fenwick sums when adaptive estimation is enabled.
     * - Schedules a window recalculation.
     *
     * @returns {void}
     */
    measureVisibleAndUpdate() {
        if (!this.adapter)
            return;
        const count = this.adapter.itemCount();
        if (count <= 0)
            return;
        let changed = false;
        for (let i = this.start; i <= this.end; i++) {
            if (!this.isIndexVisible(i))
                continue;
            const item = this.adapter.items[i];
            const el = item?.view?.getView?.();
            if (!el)
                continue;
            const newH = this.measureOuterHeight(el);
            if (this.updateHeightAt(i, newH))
                changed = true;
        }
        if (changed) {
            if (this.opts.adaptiveEstimate)
                this.rebuildFenwick(count);
            this.scheduleUpdateWindow();
        }
    }
    /**
     * Scroll event handler. Schedules a window update on the next frame.
     *
     * @returns {void}
     */
    onScroll() {
        this.scheduleUpdateWindow();
    }
    /**
     * Core window update routine: computes the visible range and reconciles mounted DOM.
     *
     * High-level steps:
     * 1) Compute scroll-relative viewport bounds (accounting for sticky header height).
     * 2) Capture an anchor item and its visual delta relative to scrollTop.
     * 3) Compute new start/end with overscan.
     * 4) Mount missing items and unmount items outside the window.
     * 5) Measure visible items (optional) and update pad heights.
     * 6) Apply anchor correction to keep scroll position stable after height changes.
     *
     * Guarding:
     * - Prevents re-entrancy via `updating`.
     * - No-op while `suspended`.
     *
     * @returns {void}
     */
    updateWindowInternal() {
        if (this.updating || this.suspended)
            return;
        this.updating = true;
        try {
            if (!this.adapter)
                return;
            const count = this.adapter.itemCount();
            if (count <= 0)
                return;
            // Handle item count changes (e.g., add/remove)
            if (this.lastRenderCount !== count) {
                this.lastRenderCount = count;
                this.heightCache.length = count;
                this.rebuildFenwick(count);
            }
            const containerTop = this.containerTopInScroll();
            const stRel = Math.max(0, this.scrollEl.scrollTop - containerTop);
            const stickyH = this.stickyTopHeight();
            const vhEff = Math.max(0, this.scrollEl.clientHeight - stickyH);
            const anchorIndex = this.findFirstVisibleIndex(stRel, count);
            const anchorTop = this.offsetTopOf(anchorIndex);
            const anchorDelta = containerTop + anchorTop - this.scrollEl.scrollTop;
            const firstVis = this.findFirstVisibleIndex(stRel, count);
            if (firstVis === -1) {
                this.resetState();
                return;
            }
            const est = this.getEstimate();
            const overscanPx = this.opts.overscan * est;
            let startIndex = this.nextVisibleFrom(Math.min(count - 1, this.fenwick.lowerBoundPrefix(Math.max(0, stRel - overscanPx))), count) ?? firstVis;
            let endIndex = Math.min(count - 1, this.fenwick.lowerBoundPrefix(stRel + vhEff + overscanPx));
            if (startIndex === this.start && endIndex === this.end)
                return;
            this.start = startIndex;
            this.end = endIndex;
            this.suppressResize = true;
            try {
                this.mountRange(this.start, this.end);
                this.unmountOutside(this.start, this.end);
                if (this.opts.dynamicHeights)
                    this.measureVisibleAndUpdate();
                const topPx = this.offsetTopOf(this.start);
                const windowPx = this.windowHeight(this.start, this.end);
                const total = this.totalHeight(count);
                const bottomPx = Math.max(0, total - topPx - windowPx);
                this.PadTop.style.height = `${topPx}px`;
                this.PadBottom.style.height = `${bottomPx}px`;
            }
            finally {
                this.suppressResize = false;
            }
            // Keep anchor item stable to prevent scroll jump
            const anchorTopNew = this.offsetTopOf(anchorIndex);
            const targetScroll = this.containerTopInScroll() + anchorTopNew - anchorDelta;
            const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
            const clamped = Math.min(Math.max(0, targetScroll), maxScroll);
            const heightChanged = Math.abs(anchorTopNew - anchorTop) > 1;
            const scrollDiff = Math.abs(this.scrollEl.scrollTop - clamped);
            if (heightChanged && scrollDiff > 0.5 && scrollDiff < 100) {
                this.scrollEl.scrollTop = clamped;
            }
        }
        finally {
            this.updating = false;
        }
    }
    /** Mounts all items in the inclusive range `[start..end]`. */
    mountRange(start, end) {
        for (let i = start; i <= end; i++)
            this.mountIndexOnce(i);
    }
    /**
     * Mounts/rebinds a single item at `index`.
     *
     * Behavior:
     * - If the item is invisible, ensures it is removed/untracked (no-op otherwise).
     * - Reuses an existing DOM element when present and the model already has a view.
     * - Creates a new view holder on first mount (`item.isInit === false`) and binds via `adapter.onViewHolder`.
     * - Ensures DOM order within {@link ItemsHost} and updates the {@link created} map.
     *
     * @param {number} index - Item index to mount/rebind.
     * @returns {void}
     */
    mountIndexOnce(index) {
        if (!this.isIndexVisible(index)) {
            const existing = this.created.get(index);
            if (existing?.parentElement === this.ItemsHost)
                existing.remove();
            this.created.delete(index);
            return;
        }
        const item = this.adapter.items[index];
        if (!item)
            return;
        const existing = this.created.get(index);
        if (existing) {
            if (!item?.view) {
                existing.remove();
                this.created.delete(index);
            }
            else {
                this.ensureDomOrder(index, existing);
                this.adapter.onViewHolder(item, item.view, index);
            }
            return;
        }
        if (!item.isInit) {
            const viewer = this.adapter.viewHolder(this.ItemsHost, item);
            item.view = viewer;
            this.adapter.onViewHolder(item, viewer, index);
            item.isInit = true;
        }
        else if (item.view) {
            this.adapter.onViewHolder(item, item.view, index);
        }
        const el = item.view?.getView?.();
        if (el) {
            this.ensureDomOrder(index, el);
            this.created.set(index, el);
        }
    }
    /**
     * Unmounts all mounted items outside the inclusive range `[start..end]`.
     *
     * @param {number} start - Window start (inclusive).
     * @param {number} end - Window end (inclusive).
     * @returns {void}
     */
    unmountOutside(start, end) {
        this.created.forEach((el, idx) => {
            if (idx < start || idx > end) {
                if (el.parentElement === this.ItemsHost)
                    el.remove();
                this.created.delete(idx);
            }
        });
    }
    /**
     * Removes all currently mounted items that are now marked invisible.
     *
     * @returns {void}
     */
    cleanupInvisibleItems() {
        this.created.forEach((el, idx) => {
            if (!this.isIndexVisible(idx)) {
                if (el.parentElement === this.ItemsHost)
                    el.remove();
                this.created.delete(idx);
            }
        });
    }
    /**
     * Returns cumulative height from the start of the list to the **top** of item at `index`.
     *
     * Indexing note:
     * - Uses Fenwick prefix sum with a 1-based contract.
     * - Passing a 0-based `index` to `sum(index)` yields the sum of heights for items `[0..index-1]`,
     *   which corresponds to the CSS `offsetTop` for item `index` in a stacked list.
     *
     * @param {number} index - Item index (0-based).
     * @returns {number} Offset from the top of the list to the top of the item (px).
     */
    offsetTopOf(index) {
        return this.fenwick.sum(index);
    }
    /**
     * Returns the total height of items in the inclusive range `[start..end]`.
     *
     * @param {number} start - Start index (0-based).
     * @param {number} end - End index (0-based).
     * @returns {number} Total height in pixels.
     */
    windowHeight(start, end) {
        return this.fenwick.rangeSum(start + 1, end + 1);
    }
    /**
     * Returns total scrollable height for all items.
     *
     * @param {number} count - Total item count.
     * @returns {number} Total height in pixels.
     */
    totalHeight(count) {
        return this.fenwick.sum(count);
    }
}
/** Epsilon threshold for height-change significance (px). */
VirtualRecyclerView.EPS = 0.5;
/** Attribute stored on each mounted element indicating its item index. */
VirtualRecyclerView.ATTR_INDEX = "data-vindex";

/**
 * SelectBox
 *
 * Root coordinator component that enhances a native `<select>` element into the library's
 * DOM-driven Select UI. `SelectBox` composes and wires together the major runtime pieces:
 *
 * - **View layer**: {@link PlaceHolder}, {@link Directive}, {@link SearchBox}, {@link Popup}, {@link AccessoryBox}
 * - **Model layer**: {@link ModelManager} with {@link MixedAdapter} resources (groups/options/navigation/visibility)
 * - **Rendering layer**: {@link RecyclerView} or {@link VirtualRecyclerView} (virtual scroll)
 * - **Controllers / services**: {@link SearchController}, {@link Effector}, {@link Refresher}
 * - **Observers**: {@link SelectObserver} and {@link DatasetObserver} for keeping DOM/source-of-truth in sync
 *
 * ### Architecture / Relationships
 * - The native `<select>` remains the canonical form element and is moved into the SelectBox DOM wrapper.
 * - `ModelManager` owns adapter + recyclerview instances and exposes a resource model list.
 * - `Popup` hosts the list UI (adapter ↔ recycler/view) and emits adapter property changes.
 * - `SearchBox` emits external events (search/navigation/enter/esc), which drive adapter navigation and search.
 *
 * ### Lifecycle (Strict FSM)
 * This class uses explicit state guards (`this.state !== ...`) to enforce a strict sequence:
 * - `NEW` → {@link init} (creates subcomponents and runtime wiring) → `INITIALIZED`
 * - {@link mount} (inserts wrapper and relocates `<select>` in DOM) → `MOUNTED`
 * - {@link update} (resize / reactive refresh) → `UPDATED`
 * - {@link destroy} (disconnect observers, destroy children, remove DOM) → `DESTROYED`
 *
 * Each lifecycle entry point is designed to be **idempotent/no-op** when called from an
 * unexpected state.
 *
 * ### External vs Internal Events (Selection)
 * Selection changes can be routed through two different adapter property channels:
 * - `"selected"`: treated as **external** selection (user-triggered) → calls `change(..., true)`
 * - `"selected_internal"`: treated as **internal** selection (non-trigger) → calls `change(..., false)`
 *
 * This separation allows the framework to distinguish “notify observers / emit events”
 * from “silent state sync” (e.g., restoring selection, programmatic updates).
 *
 * ### DOM / a11y Side Effects
 * - Creates a focusable `ViewPanel` and applies listbox-related ARIA attributes on open/close
 *   (`aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-labelledby`, `aria-multiselectable`).
 * - Stops `mousedown` propagation on the view panel to avoid outer click handlers capturing interaction.
 *
 * @extends Lifecycle
 */
class SelectBox extends Lifecycle {
    /**
     * Creates a {@link SelectBox} bound to a native `<select>` element.
     *
     * When both `select` and `Selective` are provided, the instance initializes immediately
     * (bind options from dataset/binder map and enters the lifecycle via {@link init}).
     *
     * @param select - The native select element to enhance.
     * @param Selective - The Selective framework context used for registry/services.
     */
    constructor(select, Selective) {
        super();
        /**
         * Runtime container holding:
         * - `view/tags` from {@link Libs.mountNode}
         * - composed child components (placeholder, searchbox, popup, etc.)
         * - runtime services/controllers and observers
         *
         * Declared as a `Partial` because it is progressively populated during {@link init}.
         */
        this.container = {};
        /**
         * Snapshot of the previous selection value used for rollback in `beforeChange` cancellation
         * and max-selection enforcement.
         *
         * @internal
         */
        this.oldValue = null;
        /**
         * Whether the popup/list UI is currently open.
         *
         * This is authoritative for the action API (`getAction().isOpen`) and open/close guards.
         *
         * @internal
         */
        this.isOpen = false;
        /**
         * Tracks whether an initial AJAX load has been performed at least once.
         * Used to avoid redundant initial fetches on open.
         *
         * @internal
         */
        this.hasLoadedOnce = false;
        /**
         * Tracks whether the instance is in "pre-search" mode (a search is about to happen).
         * Used as a hint to perform AJAX refresh on open.
         *
         * @internal
         */
        this.isBeforeSearch = false;
        /**
         * Tracks whether {@link deInit} has already run.
         *
         * This guards teardown work (including plugin lifecycle hooks) from running more than once
         * when {@link deInit} is called separately before {@link destroy}.
         *
         * @internal
         */
        this.hasDeInitialized = false;
        /**
         * Registered plugins for this SelectBox instance.
         */
        this.plugins = [];
        if (select && Selective)
            this.initialize(select, Selective);
    }
    /**
     * Disabled state mirror for both runtime behavior and DOM/a11y representation.
     *
     * Side effects when set:
     * - Updates `options.disabled`
     * - Toggles `.disabled` on the root wrapper
     * - Sets `aria-disabled` on wrapper and view panel
     */
    get isDisabled() {
        return !!this.options?.disabled;
    }
    set isDisabled(value) {
        if (!this.options || !this.node)
            return;
        this.options.disabled = value;
        this.node.classList.toggle("disabled", value);
        this.node.setAttribute("aria-disabled", String(value));
        this.container.tags?.ViewPanel?.setAttribute("aria-disabled", String(value));
    }
    /**
     * Read-only state mirror.
     *
     * Side effects when set:
     * - Updates `options.readonly`
     * - Toggles `.readonly` on the root wrapper to prevent user interaction in UI layer
     */
    get isReadOnly() {
        return !!this.options?.readonly;
    }
    set isReadOnly(value) {
        if (!this.options || !this.node)
            return;
        this.options.readonly = value;
        this.node.classList.toggle("readonly", value);
    }
    /**
     * Visibility state mirror.
     *
     * Side effects when set:
     * - Updates `options.visible`
     * - Toggles `.invisible` class on the root wrapper
     */
    get isVisible() {
        return !!this.options?.visible;
    }
    set isVisible(value) {
        if (!this.options || !this.node)
            return;
        this.options.visible = value;
        this.node.classList.toggle("invisible", !value);
    }
    /**
     * Binds configuration and Selective context, then enters lifecycle initialization.
     *
     * Sources configuration from the select element binder map:
     * - {@link Libs.getBinderMap} → {@link BinderMap.options} → {@link SelectiveOptions}
     *
     * @param select - Native select element being enhanced.
     * @param Selective - Selective runtime context.
     * @internal
     */
    initialize(select, Selective) {
        const bindedMap = Libs.getBinderMap(select);
        this.options = bindedMap.options;
        this.Selective = Selective;
        this.init(select);
    }
    /**
     * Lifecycle: `init` (composition / wiring stage).
     *
     * Strict FSM:
     * - No-ops unless `state === NEW`.
     *
     * Responsibilities:
     * - Instantiate view subcomponents (placeholder/directive/searchbox/accessory/popup).
     * - Create and mount the container DOM structure (but does not insert into document yet).
     * - Configure {@link ModelManager} with {@link MixedAdapter} and a RecyclerView implementation
     *   ({@link VirtualRecyclerView} when `options.virtualScroll`).
     * - Create initial model resources by parsing the source `<select>`.
     * - Wire controller/service flows:
     *   - search events → {@link SearchController} → adapter updates → popup resize/highlight resets
     *   - adapter selection changes → action API {@link SelectBoxAction.change} with trigger rules
     * - Connect observers for two-way synchronization:
     *   - {@link SelectObserver} for option changes in `<select>`
     *   - {@link DatasetObserver} for runtime flags (disabled/readonly/visible) from dataset
     *
     * DOM/a11y:
     * - Ensures placeholder node has an id for `aria-labelledby` usage.
     * - Adds a keydown handler on `ViewPanel` to open on Enter/Space/ArrowDown.
     *
     * @param select - Native select element used as source of truth for options/value.
     */
    init(select) {
        if (this.state !== LifecycleState.NEW)
            return;
        if (!select || !this.options)
            return;
        const options = this.options;
        // Create all components
        const placeholder = new PlaceHolder(options);
        const directive = new Directive();
        const searchbox = new SearchBox(options);
        const effector = Effector();
        const optionModelManager = new ModelManager(options);
        const accessoryBox = new AccessoryBox(options);
        const searchController = new SearchController(select, optionModelManager, this);
        const selectObserver = new SelectObserver(select);
        const datasetObserver = new DatasetObserver(select);
        // ensure placeholder has id for aria-labelledby usage
        if (placeholder.node)
            placeholder.node.id = String(options.SEID_HOLDER ?? "");
        const container = Libs.mountNode({
            Container: {
                tag: { node: "div", classList: "seui-MAIN" },
                child: {
                    ViewPanel: {
                        tag: {
                            node: "div",
                            classList: "seui-view",
                            tabIndex: 0,
                            onkeydown: (e) => {
                                if (e.key === "Enter" ||
                                    e.key === " " ||
                                    e.key === "ArrowDown") {
                                    e.preventDefault();
                                    this.getAction()?.open();
                                }
                            },
                        },
                        child: {
                            PlaceHolder: { tag: placeholder.node },
                            Directive: { tag: directive.node },
                            SearchBox: { tag: searchbox.node },
                        },
                    },
                },
            },
        }, null);
        this.container = container;
        this.node = container.view;
        // Store references on container
        container.searchController = searchController;
        container.placeholder = placeholder;
        container.directive = directive;
        container.searchbox = searchbox;
        container.effector = effector;
        container.targetElement = select;
        container.accessorybox = accessoryBox;
        container.selectObserver = selectObserver;
        container.datasetObserver = datasetObserver;
        // ModelManager setup
        optionModelManager.setupAdapter(MixedAdapter);
        if (options.virtualScroll) {
            optionModelManager.setupRecyclerView(VirtualRecyclerView);
        }
        else {
            optionModelManager.setupRecyclerView(RecyclerView);
        }
        optionModelManager.createModelResources(Libs.parseSelectToArray(select));
        optionModelManager.on("onUpdate", () => {
            container.popup?.triggerResize?.();
        });
        this.optionModelManager = optionModelManager;
        // Popup
        const popup = new Popup(select, options, optionModelManager);
        container.popup = popup;
        popup.setupEffector(effector);
        popup.setupInfiniteScroll(searchController, options);
        popup.onAdapterPropChanged("selected", () => {
            this.getAction()?.change(null, true);
        });
        popup.onAdapterPropChanged("selected_internal", () => {
            this.getAction()?.change(null, false);
        });
        popup.onAdapterPropChanging("select", () => {
            this.oldValue = this.getAction()?.value ?? "";
        });
        accessoryBox.setRoot(container.tags.ViewPanel);
        accessoryBox.setModelManager(optionModelManager);
        this.setupEventHandlers(select, container, options, searchController, searchbox);
        this.setupObservers(selectObserver, datasetObserver, select, optionModelManager);
        this.plugins = this.Selective?.getPlugins?.() ?? [];
        if (this.plugins.length) {
            const resources = optionModelManager.getResources();
            const pluginContext = {
                selectBox: this,
                options,
                adapter: resources.adapter,
                recycler: resources.recyclerView,
                viewTags: container.tags,
                actions: this.getAction(),
            };
            this.pluginContext = pluginContext;
            this.runPluginHook("init", (plugin) => plugin.init?.(pluginContext));
        }
        // Initial states
        this.isDisabled = Libs.string2Boolean(options.disabled);
        this.isReadOnly = Libs.string2Boolean(options.readonly);
        // Call parent lifecycle init
        super.init();
    }
    /**
     * Lifecycle: `mount` (DOM insertion stage).
     *
     * Strict FSM:
     * - No-ops unless `state === INITIALIZED`.
     *
     * DOM operations:
     * - Inserts the SelectBox wrapper before the original `<select>`.
     * - Moves the `<select>` inside the wrapper (before `ViewPanel`) to preserve form behavior.
     * - Adds a `mousedown` handler to `ViewPanel` to contain interactions and prevent outer handlers.
     * - Applies initial sizing (`Refresher.resizeBox`) and marks the select as initialized (`.init`).
     * - Applies an initial "mask" refresh via `change(null, false)` without emitting external triggers.
     */
    mount() {
        if (this.state !== LifecycleState.INITIALIZED)
            return;
        if (!this.node || !this.container.targetElement)
            return;
        const select = this.container.targetElement;
        const container = this.container;
        // Mount into DOM: wrapper before select, then move select inside
        select.parentNode?.insertBefore(this.node, select);
        this.node.insertBefore(select, container.tags.ViewPanel);
        container.tags.ViewPanel.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        Refresher.resizeBox(select, container.tags.ViewPanel);
        select.classList.add("init");
        // initial mask
        const action = this.getAction();
        action?.change?.(null, false);
        if (this.options.preload) {
            action?.load?.();
        }
        // Call parent lifecycle mount
        super.mount();
    }
    /**
     * Lifecycle: `update` (reactive refresh stage).
     *
     * Strict FSM:
     * - No-ops unless `state === MOUNTED`.
     *
     * Behavior:
     * - Triggers popup resize recalculation to keep layout consistent with content changes
     *   (e.g. filtering results, collapses/expands, accessory changes).
     *
     * Note:
     * - Actual data mutations are driven by adapter/model updates and action API methods,
     *   not by this method directly.
     */
    update() {
        if (this.state !== LifecycleState.MOUNTED)
            return;
        // Trigger any update logic here
        this.container.popup?.triggerResize?.();
        super.update();
    }
    /**
     * Wires event handlers between UI components, controller, and adapter.
     *
     * Key flows:
     * - SearchBox input → SearchController.search/clear → Popup resize + adapter highlight reset
     * - SearchBox navigation/enter/esc → MixedAdapter.navigate/selectHighlighted + close + focus restore
     * - Adapter highlight changes → SearchBox `aria-activedescendant`
     * - Adapter collapsed changes → Popup resize
     *
     * Trigger semantics:
     * - The `isTrigger` boolean from SearchBox is used to distinguish user-driven vs programmatic clears.
     * - AJAX searches optionally show/hide loading UI and respect `delaysearchtime`.
     *
     * @param select - The enhanced native select element.
     * @param container - The assembled runtime container.
     * @param options - Bound configuration flags and callbacks.
     * @param searchController - Controller responsible for local/AJAX searches and pagination.
     * @param searchbox - Search input component emitting search/navigation intents.
     * @internal
     */
    setupEventHandlers(select, container, options, searchController, searchbox) {
        const optionAdapter = container.popup.optionAdapter;
        let hightlightTimer = null;
        const searchHandle = (keyword, isTrigger) => {
            if (!isTrigger && keyword === "") {
                searchController.clear();
            }
            else {
                if (keyword !== "")
                    this.isBeforeSearch = true;
                searchController
                    .search(keyword)
                    .then((result) => {
                    clearTimeout(hightlightTimer);
                    Libs.callbackScheduler.clear(`sche_vis_proxy_${optionAdapter.adapterKey}`);
                    Libs.callbackScheduler.on(`sche_vis_proxy_${optionAdapter.adapterKey}`, () => {
                        container.popup?.triggerResize?.();
                        if (result?.hasResults) {
                            hightlightTimer = setTimeout(() => {
                                optionAdapter.resetHighlight();
                                container.popup?.triggerResize?.();
                            }, options.animationtime ?? 0);
                        }
                    }, { debounce: 10 });
                })
                    .catch((error) => {
                    console.error("Search error:", error);
                });
            }
        };
        let searchHandleTimer = null;
        searchbox.onSearch = (keyword, isTrigger) => {
            if (!searchController.compareSearchTrigger(keyword))
                return;
            if (searchHandleTimer)
                clearTimeout(searchHandleTimer);
            if (searchController.isAjax()) {
                container.popup?.showLoading?.();
                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, options.delaysearchtime ?? 0);
            }
            else {
                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, 10);
            }
        };
        searchController.setPopup(container.popup);
        searchbox.onNavigate = (direction) => {
            optionAdapter.navigate(direction);
        };
        searchbox.onEnter = () => {
            optionAdapter.selectHighlighted();
        };
        searchbox.onEsc = () => {
            this.getAction()?.close();
            container.tags.ViewPanel.focus();
        };
        optionAdapter.onHighlightChange = (_index, id) => {
            if (id)
                searchbox.setActiveDescendant(id);
        };
        optionAdapter.onCollapsedChange = () => {
            container.popup?.triggerResize?.();
        };
        // AJAX setup (if provided)
        if (options.ajax) {
            if (options.ajax?.keepSelected == undefined) {
                options.ajax.keepSelected = options.keepSelected;
            }
            searchController.setAjax(options.ajax);
        }
    }
    /**
     * Connects and wires observers that synchronize the enhanced UI with the source `<select>`
     * element and its dataset-based runtime flags.
     *
     * - {@link SelectObserver}:
     *   - On change, re-parses the select into resources and refreshes the selection mask.
     * - {@link DatasetObserver}:
     *   - On change, mirrors dataset flags into runtime properties:
     *     `disabled` / `readonly` / `visible`
     *
     * @param selectObserver - Observer tracking select option/value mutations.
     * @param datasetObserver - Observer tracking dataset attribute changes.
     * @param select - The enhanced native select element.
     * @param optionModelManager - Model manager to update from parsed select.
     * @internal
     */
    setupObservers(selectObserver, datasetObserver, select, optionModelManager) {
        selectObserver.connect();
        selectObserver.onChanged = (sel) => {
            optionModelManager.updateModel(Libs.parseSelectToArray(sel));
            this.getAction()?.refreshMask();
        };
        datasetObserver.connect();
        datasetObserver.onChanged = (dataset) => {
            if (Libs.string2Boolean(dataset.disabled) !== this.isDisabled) {
                this.isDisabled = Libs.string2Boolean(dataset.disabled);
            }
            if (Libs.string2Boolean(dataset.readonly) !== this.isReadOnly) {
                this.isReadOnly = Libs.string2Boolean(dataset.readonly);
            }
            if (Libs.string2Boolean(dataset.visible) !== this.isVisible) {
                this.isVisible = Libs.string2Boolean(dataset.visible ?? "1");
            }
        };
    }
    /**
     * Disconnects observers associated with this instance.
     *
     * This is used during {@link destroy} to ensure external DOM observers are stopped,
     * preventing memory leaks and unintended background updates.
     */
    deInit() {
        if (this.hasDeInitialized) {
            return;
        }
        const c = this.container ?? {};
        const { selectObserver, datasetObserver } = c;
        if (this.plugins.length) {
            this.runPluginHook("destroy", (plugin) => plugin.destroy?.());
        }
        this.plugins = [];
        this.pluginContext = null;
        if (selectObserver?.disconnect)
            selectObserver.disconnect();
        if (datasetObserver?.disconnect)
            datasetObserver.disconnect();
        this.hasDeInitialized = true;
    }
    /**
     * Lifecycle: `destroy` (teardown stage).
     *
     * Strict FSM / idempotency:
     * - No-ops when already in {@link LifecycleState.DESTROYED}.
     *
     * Responsibilities:
     * - Disconnect observers.
     * - Destroy composed child components/controllers.
     * - Remove wrapper DOM from the document.
     * - Clear references to enable garbage collection.
     *
     * @override
     */
    destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        // Disconnect observers
        this.deInit();
        // Destroy child components
        const container = this.container;
        container.searchController.destroy();
        container.directive.destroy();
        container.popup.destroy();
        container.accessorybox.destroy();
        container.placeholder.destroy();
        container.searchbox.destroy();
        this.optionModelManager.destroy();
        // Remove from DOM
        this.node?.remove();
        // Clear all references
        this.container = {};
        this.node = null;
        this.options = null;
        this.optionModelManager = null;
        this.Selective = null;
        this.oldValue = null;
        this.isOpen = false;
        this.hasLoadedOnce = false;
        this.isBeforeSearch = false;
        // Call parent lifecycle destroy
        super.destroy();
    }
    /**
     * Builds and returns an imperative action API for controlling this SelectBox instance.
     *
     * The returned object is a "facade" used by external consumers (and internal wiring) to:
     * - read/write selection values (`value`, `valueArray`, `setValue`, `selectAll`, `deSelectAll`)
     * - control popup visibility (`open`, `close`, `toggle`)
     * - refresh mask/placeholder (`refreshMask`)
     * - attach event callbacks (`on`)
     * - configure AJAX (`ajax`, `loadAjax`)
     *
     * ### Triggering contract (external vs internal)
     * Many methods accept a `trigger`/`canTrigger` boolean which controls whether:
     * - `beforeChange` / `change` callbacks are invoked via {@link iEvents.callEvent}
     * - native DOM `"change"` is fired on the underlying select
     *
     * This mirrors the library convention of distinguishing user-visible change events from
     * internal/non-trigger state synchronization.
     *
     * ### Side effects
     * - Mutates `OptionModel.selectedNonTrigger` flags to update selection.
     * - Writes to the native select value for single-select mode.
     * - Updates UI mask and accessory box, and requests popup resizing where needed.
     * - Applies a11y attributes to `ViewPanel` on open/close.
     *
     * No-ops:
     * - Returns `null` when the binder map is missing for the current target element.
     *
     * @returns An action facade for controlling this instance, or `null` if not bound.
     */
    getAction() {
        const container = this.container;
        const superThis = this;
        const getInstance = () => {
            return this.Selective.find(container.targetElement);
        };
        const bindedMap = Libs.getBinderMap(container.targetElement);
        if (!bindedMap)
            return null;
        const bindedOptions = bindedMap.options;
        const resp = {
            get targetElement() {
                return container.targetElement;
            },
            get placeholder() {
                return container.placeholder.get();
            },
            set placeholder(value) {
                container.placeholder?.set(value);
                container.searchbox?.setPlaceHolder(value);
            },
            get oldValue() {
                return superThis.oldValue;
            },
            set value(value) {
                this.setValue(null, value, true);
            },
            get value() {
                const item_list = this.valueArray;
                const valLength = item_list.length;
                return valLength > 1
                    ? item_list
                    : valLength === 0
                        ? ""
                        : item_list[0];
            },
            get valueArray() {
                const item_list = [];
                superThis.getModelOption().forEach((m) => {
                    if (m.selected)
                        item_list.push(m.value);
                });
                return item_list;
            },
            get valueString() {
                const customDelimiter = bindedOptions.customDelimiter;
                const item_list = this.valueArray;
                return item_list.join(customDelimiter);
            },
            get valueOptions() {
                const item_list = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m);
                });
                return item_list;
            },
            get mask() {
                const item_list = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m.text);
                });
                return item_list;
            },
            get valueText() {
                const item_list = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m.text);
                });
                const valLength = item_list.length;
                return valLength > 1
                    ? item_list
                    : valLength === 0
                        ? ""
                        : item_list[0];
            },
            get isOpen() {
                return superThis.isOpen;
            },
            getParent(_evtToken) {
                return container.view.parentElement;
            },
            valueDataset(_evtToken, strDataset = null, isArray = false) {
                var item_list = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(strDataset ? m.dataset[strDataset] : m.dataset);
                });
                if (!isArray) {
                    if (item_list.length == 0) {
                        return "";
                    }
                    else if (item_list.length == 1) {
                        return item_list[0];
                    }
                }
                return item_list;
            },
            selectAll(_evtToken, trigger = true) {
                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (superThis.getModelOption().length >
                        bindedOptions.maxSelected)
                        return;
                }
                if (this.disabled || this.readonly || !bindedOptions.multiple)
                    return;
                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel)
                        return;
                    superThis.oldValue = this.value;
                }
                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = true;
                });
                this.change(false, trigger);
            },
            deSelectAll(_evtToken, trigger = true) {
                if (this.disabled || this.readonly || !bindedOptions.multiple)
                    return;
                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel)
                        return;
                    superThis.oldValue = this.value;
                }
                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = false;
                });
                this.change(false, trigger);
            },
            deSelectByDataset(_evtToken, dataset, trigger = true) {
                if (dataset) {
                    superThis.getModelOption().forEach((optionModel) => {
                        if (optionModel.dataset) {
                            for (let searchKey in dataset) {
                                let value = dataset[searchKey];
                                !Array.isArray(value) && (value = [value]);
                                if (value.includes(optionModel.dataset[searchKey])) {
                                    optionModel.selectedNonTrigger = false;
                                }
                            }
                        }
                    });
                    this.change(false, trigger);
                }
            },
            setValue(_evtToken, value, trigger = true, force = false) {
                if (!Array.isArray(value))
                    value = [value];
                value = value.filter((v) => v !== "" && v != null);
                if (value.length === 0) {
                    superThis
                        .getModelOption()
                        .forEach((m) => (m.selectedNonTrigger = false));
                    this.change(false, trigger);
                    return;
                }
                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (value.length > bindedOptions.maxSelected) {
                        console.warn(`Cannot select more than ${bindedOptions.maxSelected} items`);
                        return;
                    }
                }
                if (!force && (this.disabled || this.readonly))
                    return;
                // AJAX: load missing values
                if (container.searchController?.isAjax?.()) {
                    const { missing } = container.searchController.checkMissingValues(value);
                    if (missing.length > 0) {
                        (async () => {
                            if (bindedOptions.loadingfield)
                                container.popup?.showLoading?.();
                            try {
                                container.searchController.resetPagination();
                                const result = await container.searchController.loadByValues(missing);
                                if (result.success && result.items.length > 0) {
                                    result.items.forEach((it) => {
                                        if (missing.includes(it.value) ||
                                            missing.includes(it.text))
                                            it.selected = true;
                                    });
                                    container.searchController.applyAjaxResult?.(result.items, false, false);
                                    setTimeout(() => {
                                        container.searchController.resetPagination();
                                        this.change(false, trigger);
                                    }, 200);
                                }
                                else if (missing.length > 0) {
                                    console.warn(`Could not load ${missing.length} values:`, missing);
                                }
                            }
                            catch (error) {
                                console.error("Error loading missing values:", error);
                            }
                            finally {
                                if (bindedOptions.loadingfield)
                                    container.popup?.hideLoading?.();
                            }
                        })();
                        return;
                    }
                }
                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel)
                        return;
                    superThis.oldValue = this.value;
                }
                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = value.some((v) => v == m.value);
                });
                if (!bindedOptions.multiple && value.length > 0) {
                    container.targetElement.value = value[0];
                }
                this.change(false, trigger);
            },
            load() {
                if ((!superThis.hasLoadedOnce || superThis.isBeforeSearch) &&
                    bindedOptions?.ajax) {
                    container.searchController.resetPagination();
                    container.popup.showLoading();
                    superThis.hasLoadedOnce = true;
                    superThis.isBeforeSearch = false;
                    setTimeout(() => {
                        if (!container.popup || !container.searchController)
                            return;
                        container.searchController
                            .search("")
                            .then(() => container.popup?.triggerResize?.())
                            .catch((err) => console.error("Initial ajax load error:", err));
                    }, bindedOptions.animationtime);
                    container.popup.load();
                }
                else {
                    container.popup.load();
                }
            },
            open() {
                if (superThis.isOpen)
                    return;
                const findAnother = superThis.Selective?.find?.();
                if (findAnother && !findAnother.isEmpty) {
                    const closeToken = findAnother.close();
                    if (closeToken.isCancel)
                        return;
                }
                if (this.disabled) {
                    return;
                }
                const beforeShowToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeShow);
                if (beforeShowToken.isCancel) {
                    return;
                }
                superThis.isOpen = true;
                container.directive.setDropdown(true);
                const adapter = container.popup.optionAdapter;
                const selectedOption = adapter.getSelectedItem();
                if (selectedOption) {
                    adapter.setHighlight(selectedOption, false);
                }
                else {
                    adapter.resetHighlight();
                }
                this.load();
                container.popup.open(null, !container.popup.loadingState.isVisible);
                container.searchbox.show();
                const ViewPanel = container.tags.ViewPanel;
                ViewPanel.setAttribute("aria-expanded", "true");
                ViewPanel.setAttribute("aria-controls", bindedOptions.SEID_LIST);
                ViewPanel.setAttribute("aria-haspopup", "listbox");
                ViewPanel.setAttribute("aria-labelledby", bindedOptions.SEID_HOLDER);
                if (bindedOptions.multiple) {
                    ViewPanel.setAttribute("aria-multiselectable", "true");
                }
                iEvents.callEvent([getInstance()], ...bindedOptions.on.show);
                if (superThis.pluginContext) {
                    superThis.runPluginHook("onOpen", (plugin) => plugin.onOpen?.(superThis.pluginContext));
                }
                return;
            },
            close() {
                if (!superThis.isOpen)
                    return;
                const beforeCloseToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeClose);
                if (beforeCloseToken.isCancel)
                    return;
                superThis.isOpen = false;
                container.directive.setDropdown(false);
                container.popup.close(() => {
                    container.searchbox.clear(false);
                });
                container.searchbox.hide();
                container.tags.ViewPanel.setAttribute("aria-expanded", "false");
                iEvents.callEvent([getInstance()], ...bindedOptions.on.close);
                if (superThis.pluginContext) {
                    superThis.runPluginHook("onClose", (plugin) => plugin.onClose?.(superThis.pluginContext));
                }
                return;
            },
            toggle() {
                if (superThis.isOpen)
                    this.close();
                else
                    this.open();
            },
            change(_evtToken, canTrigger = true) {
                if (canTrigger) {
                    if (bindedOptions.multiple &&
                        bindedOptions.maxSelected > 0) {
                        if (this.valueArray.length > bindedOptions.maxSelected) {
                            this.setValue(null, this.oldValue, false, true);
                        }
                    }
                    if (this.disabled || this.readonly) {
                        this.setValue(null, this.oldValue, false, true);
                        return;
                    }
                    const beforeChangeToken = iEvents.callEvent([getInstance(), this.value], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) {
                        this.setValue(null, this.oldValue, false);
                        return;
                    }
                }
                this.refreshMask();
                container.accessorybox.setModelData(this.valueOptions);
                if (canTrigger) {
                    if (container.targetElement)
                        iEvents.trigger(container.targetElement, "change");
                    iEvents.callEvent([getInstance(), this.value], ...bindedOptions.on.change);
                    if (superThis.options?.autoclose)
                        this.close();
                }
                // Trigger update lifecycle
                if (superThis.is(LifecycleState.MOUNTED)) {
                    superThis.update();
                }
                if (superThis.pluginContext && superThis.optionModelManager) {
                    const resources = superThis.optionModelManager.getResources();
                    superThis.runPluginHook("onChange", (plugin) => plugin.onChange?.(this.value, resources.modelList, resources.adapter, superThis.pluginContext));
                }
            },
            refreshMask() {
                let mask = bindedOptions.placeholder;
                if (!bindedOptions.multiple &&
                    superThis.getModelOption().length > 0) {
                    mask = this.mask[0];
                }
                mask ?? (mask = bindedOptions.placeholder);
                container.placeholder.set(mask, false);
                container.searchbox.setPlaceHolder(mask);
            },
            on(_evtToken, evtName, handle) {
                if (!bindedOptions.on[evtName])
                    bindedOptions.on[evtName] = [];
                bindedOptions.on[evtName].push(handle);
            },
            ajax(_evtToken, obj) {
                if (obj.keepSelected == undefined) {
                    obj.keepSelected = superThis.options.keepSelected;
                }
                container.searchController.setAjax(obj);
            },
            loadAjax(_evtToken) {
                return new Promise((resove, reject) => {
                    container.popup.showLoading();
                    container.searchController.resetPagination();
                    superThis.hasLoadedOnce = true;
                    superThis.isBeforeSearch = false;
                    if (!container.popup || !container.searchController) {
                        resove(getInstance());
                    }
                    else {
                        container.searchController
                            .search("")
                            .then(() => {
                            container.popup?.triggerResize?.();
                            resove(getInstance());
                        })
                            .catch((err) => {
                            console.error("Initial ajax load error:", err);
                            reject(err);
                        });
                    }
                });
            },
        };
        // mirror properties: disabled / readonly / visible
        this.createSymProp(resp, "disabled", "isDisabled");
        this.createSymProp(resp, "readonly", "isReadOnly");
        this.createSymProp(resp, "visible", "isVisible");
        return resp;
    }
    /**
     * Defines a mirrored facade property on an arbitrary object.
     *
     * This helper is used when building the {@link SelectBoxAction} facade to expose
     * `disabled` / `readonly` / `visible` as ergonomic properties while keeping them
     * synchronized with the underlying {@link SelectBox} runtime state.
     *
     * ### Behavior
     * - Getter proxies the current runtime value from `this[privateProp]`.
     * - Setter coerces the incoming value to boolean and writes it to `this[privateProp]`.
     * - Additionally reflects the value onto `targetElement.dataset[prop]` when available,
     *   allowing external dataset observers (and DOM tooling) to observe state changes.
     *
     * ### Side effects
     * - Mutates the action facade object via `Object.defineProperty`.
     * - Mutates DOM dataset on the underlying `<select>` element (if present).
     *
     * No-ops:
     * - Dataset reflection is skipped when `container.targetElement.dataset` is unavailable.
     *
     * @param obj - The facade object to define the property on.
     * @param prop - The public facade property name (`disabled` | `readonly` | `visible`).
     * @param privateProp - The backing SelectBox property name (`isDisabled` | `isReadOnly` | `isVisible`).
     * @internal
     */
    createSymProp(obj, prop, privateProp) {
        const superThis = this;
        Object.defineProperty(obj, prop, {
            get() {
                return superThis[privateProp];
            },
            set(value) {
                superThis[privateProp] = !!value;
                if (superThis.container?.targetElement?.dataset) {
                    superThis.container.targetElement.dataset[prop] =
                        String(!!value);
                }
            },
            enumerable: true,
            configurable: true,
        });
    }
    /**
     * Returns a flat list of {@link OptionModel} items from current model resources.
     *
     * The underlying resource list may contain a mix of:
     * - {@link OptionModel} (standalone options)
     * - {@link GroupModel} (group headers with nested `items`)
     *
     * This method flattens the structure into a single array of options, optionally
     * filtered by the *current* selection state.
     *
     * ### Filtering
     * - When `isSelected` is `true` or `false`, filters by `OptionModel.selected`.
     * - When `isSelected` is `null`, returns all available options.
     *
     * No-ops:
     * - Returns an empty array if the {@link optionModelManager} is not available.
     *
     * @param isSelected - Optional selection filter (`true` | `false` | `null`). Defaults to `null`.
     * @returns A flat array of option models (possibly filtered).
     * @internal
     */
    getModelOption(isSelected) {
        if (!this.optionModelManager)
            return [];
        const { modelList } = this.optionModelManager.getResources();
        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel) {
                flatOptions.push(m);
            }
            else if (m instanceof GroupModel) {
                if (Array.isArray(m.items) && m.items.length)
                    flatOptions.push(...m.items);
            }
        }
        if (typeof isSelected === "boolean") {
            return flatOptions.filter((o) => o.selected === isSelected);
        }
        return flatOptions;
    }
    /**
     * Safely runs a hook across all registered plugins.
     *
     * Any plugin failure is isolated to prevent breaking the current flow.
     *
     * @param hook - Hook name for logging context.
     * @param runner - Hook invocation handler.
     * @internal
     */
    runPluginHook(hook, runner) {
        if (!this.plugins.length)
            return;
        this.plugins.forEach((plugin) => {
            try {
                runner(plugin);
            }
            catch (error) {
                console.error(`Plugin "${plugin.id}" ${hook} error:`, error);
            }
        });
    }
}

/**
 * ElementAdditionObserver
 *
 * Generic DOM utility that detects when elements of a given tag name are added to the document
 * and notifies registered listeners.
 *
 * ### Responsibility
 * - Observes `document.body` for subtree mutations (`childList + subtree`).
 * - Detects newly added elements that match a watched tag name:
 *   - Direct additions (the added node itself)
 *   - Nested additions (descendants inside the added subtree via `querySelectorAll`)
 * - Dispatches detected elements to registered callbacks (external hooks).
 *
 * ### Lifecycle / Idempotency
 * - {@link connect} starts observation. Subsequent calls while active are **no-ops**.
 * - {@link disconnect} stops observation. Subsequent calls while inactive are **no-ops**.
 * - Callbacks can be managed independently via {@link onDetect} and {@link clearDetect}.
 *
 * ### Event / Hook Flow
 * DOM mutation → match extraction → {@link handle} → invoke each callback from {@link actions}.
 *
 * ### DOM / Performance Notes
 * - This observer runs on every mutation affecting `document.body` subtree.
 * - For each added element node, it may call `querySelectorAll(tag)`, which can be expensive
 *   for large inserted subtrees or frequent DOM churn.
 *
 * @template T - Element subtype emitted to callbacks (defaults to {@link Element}).
 */
class ElementAdditionObserver {
    constructor() {
        /**
         * Tracks whether the observer is currently attached to the document.
         *
         * Used to enforce a "connect once" contract and make {@link connect}/{@link disconnect} idempotent.
         *
         * @internal
         */
        this.isActive = false;
        /**
         * Registered detection callbacks.
         *
         * Each callback is invoked with the detected element instance.
         *
         * @internal
         */
        this.actions = new Set();
    }
    /**
     * Registers a callback invoked whenever a matching element is detected as added to the DOM.
     *
     * Notes:
     * - Callbacks are invoked in registration order.
     * - This is an "external hook": this class does not store detected elements; it only emits them.
     *
     * @param action - Function executed with the newly detected element.
     */
    onDetect(action) {
        this.actions.add(action);
    }
    /**
     * Clears all registered detection callbacks.
     *
     * This does not affect the active observation state. If connected, the observer continues
     * to scan mutations but will not invoke any listeners until new callbacks are registered.
     */
    clearDetect() {
        this.actions.clear();
    }
    /**
     * Starts observing the document for additions of elements matching the given tag name.
     *
     * Detection includes:
     * - The added node itself (when it is an element and matches `tag`)
     * - Descendants of the added node that match `tag` (via `querySelectorAll`)
     *
     * Idempotency:
     * - No-ops if already active.
     *
     * Side effects:
     * - Attaches a {@link MutationObserver} to `document.body` with `{ childList: true, subtree: true }`.
     *
     * @param tag - Tag name to watch for (e.g., `"select"`, `"div"`). Case-insensitive.
     */
    connect(tag) {
        if (this.isActive)
            return;
        this.isActive = true;
        const upperTag = tag.toUpperCase();
        const lowerTag = tag.toLowerCase();
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    // Only element nodes can have tagName/querySelectorAll.
                    if (node.nodeType !== 1)
                        return;
                    const subnode = node;
                    // Direct match: the added node itself.
                    if (subnode.tagName === upperTag) {
                        this.handle(subnode);
                    }
                    // Nested matches: descendants inside the added subtree.
                    const matches = subnode.querySelectorAll(lowerTag);
                    matches.forEach((el) => this.handle(el));
                });
            }
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
    /**
     * Stops observing for element additions and releases internal resources.
     *
     * Idempotency:
     * - No-ops if not active.
     *
     * Side effects:
     * - Disconnects the underlying {@link MutationObserver}.
     * - Clears the observer reference (does not clear registered callbacks).
     */
    disconnect() {
        if (!this.isActive)
            return;
        this.isActive = false;
        this.observer?.disconnect();
        this.observer = null;
    }
    /**
     * Dispatches a detected element to all registered callbacks.
     *
     * Notes:
     * - Invocation is synchronous and in-order.
     * - Exceptions thrown by a callback will propagate and may prevent later callbacks
     *   from executing (no internal try/catch is applied).
     *
     * @param element - The element detected as added to the DOM.
     * @internal
     */
    handle(element) {
        for (const action of this.actions) {
            action(element);
        }
    }
}

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
class Selective extends Lifecycle {
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
        /**
         * Registry mapping CSS selectors to their {@link SelectiveOptions} configurations.
         *
         * - Populated during {@link bind}.
         * - Used by {@link Observer} to auto-bind new elements.
         * - Cleared during {@link destroyAll}, individual entries removed via {@link destroyByQuery}.
         *
         * @private
         */
        this.bindedQueries = new Map();
        /**
         * Registry of Selective plugins keyed by plugin ID.
         *
         * - Managed via {@link registerPlugin}, {@link unregisterPlugin}, and {@link getPlugin}.
         * - Cleared during {@link destroyAll} after invoking plugin teardown hooks.
         *
         * @private
         */
        this.plugins = new Map();
        this.init();
    }
    /**
     * Initializes the Selective system.
     *
     * Behavior:
     * - No-op if not in {@link LifecycleState.NEW} (idempotent guard).
     * - Initializes {@link bindedQueries} as empty `Map`.
     * - Initializes {@link plugins} as empty `Map`.
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
    init() {
        if (!this.is(LifecycleState.NEW))
            return;
        // Initialize core properties
        this.bindedQueries = new Map();
        this.plugins = new Map();
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
    bind(query, options) {
        // Auto-init if not initialized
        if (this.is(LifecycleState.NEW)) {
            this.init();
        }
        const merged = Libs.mergeConfig(Libs.getDefaultConfig(), options);
        // Ensure hooks exist
        merged.on = merged.on ?? {};
        merged.on.load = (merged.on.load ?? []);
        this.bindedQueries.set(query, merged);
        const doneToken = Libs.randomString();
        Libs.callbackScheduler.on(doneToken, () => {
            iEvents.callEvent([this.find(query)], ...merged.on.load);
            Libs.callbackScheduler.clear(doneToken);
            merged.on.load = [];
        });
        const selectElements = Libs.getElements(query);
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
    mount() {
        if (this.state !== LifecycleState.INITIALIZED)
            return;
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
    update() {
        if (this.state !== LifecycleState.MOUNTED)
            return;
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
    find(query = "*") {
        const empty = { isEmpty: true };
        if (query === "*") {
            query = Libs.getBindedCommand().join(", ");
            if (query === "")
                return empty;
        }
        const sels = Libs.getElements(query);
        if (sels.length === 0)
            return empty;
        const binded = Libs.getBinderMap(sels[0]);
        if (!binded || !binded.action)
            return empty;
        const actions = {};
        for (const actionName in binded.action) {
            actions[actionName] = this.getProperties(actionName, binded.action);
        }
        const response = { isEmpty: false };
        for (const actionKey in actions) {
            const action = actions[actionKey];
            switch (action.type) {
                case "get-set":
                    this.buildGetSetAction(response, action.name, sels);
                    break;
                case "func":
                    this.buildFuntionAction(response, action.name, sels);
                    break;
            }
        }
        return response;
    }
    /**
     * Returns all registered Selective plugins.
     *
     * @returns The list of plugins in registration order.
     */
    getPlugins() {
        return Array.from(this.plugins.values());
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
    Observer() {
        if (!this.EAObserver) {
            this.EAObserver = new ElementAdditionObserver();
            this.EAObserver.onDetect((selectElement) => {
                this.bindedQueries.forEach((options, query) => {
                    try {
                        if (selectElement.matches(query)) {
                            this.applySelectBox(selectElement, options);
                            // Trigger update when new element is bound
                            if (this.is(LifecycleState.MOUNTED)) {
                                this.update();
                            }
                        }
                    }
                    catch (error) {
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
    destroy(target = null) {
        if (target === null) {
            this.destroyAll();
        }
        else if (typeof target === "string") {
            this.destroyByQuery(target);
        }
        else if (target instanceof HTMLSelectElement) {
            this.destroyElement(target);
        }
        // Trigger update after partial destroy
        if (target !== null && this.is(LifecycleState.MOUNTED)) {
            this.update();
        }
    }
    /**
     * Registers a plugin for Selective lifecycle integration.
     *
     * @public
     * @param {SelectivePlugin} plugin - Plugin instance to register.
     * @returns {void}
     */
    registerPlugin(plugin) {
        if (!plugin?.id)
            return;
        this.plugins.set(plugin.id, plugin);
    }
    /**
     * Unregisters a plugin by ID.
     *
     * @public
     * @param {string} id - Plugin ID to remove.
     * @returns {void}
     */
    unregisterPlugin(id) {
        if (!id)
            return;
        this.plugins.delete(id);
    }
    /**
     * Retrieves a plugin by ID.
     *
     * @public
     * @param {string} id - Plugin ID to retrieve.
     * @returns {SelectivePlugin | undefined} Plugin instance if found.
     */
    getPlugin(id) {
        if (!id)
            return undefined;
        return this.plugins.get(id);
    }
    /**
     * Destroys all bound Selective instances and releases global resources.
     *
     * Teardown flow:
     * 1. Iterates all registered queries and calls {@link destroyByQuery}.
     * 2. Clears {@link bindedQueries} and {@link Libs.getBindedCommand}.
     * 3. Invokes plugin teardown hooks and clears {@link plugins}.
     * 4. Disconnects {@link EAObserver} (stops auto-binding).
     * 5. Transitions to {@link LifecycleState.DESTROYED} via `super.destroy()`.
     *
     * Idempotency:
     * - No-op if already {@link LifecycleState.DESTROYED}.
     *
     * @private
     * @returns {void}
     */
    destroyAll() {
        if (this.state === LifecycleState.DESTROYED)
            return;
        const bindedCommands = Libs.getBindedCommand();
        bindedCommands.forEach((query) => this.destroyByQuery(query));
        this.bindedQueries.clear();
        Libs.getBindedCommand().length = 0;
        this.plugins.forEach((plugin) => {
            plugin.destroy?.();
            plugin.onDestroy?.();
        });
        this.plugins.clear();
        this.EAObserver?.disconnect();
        this.plugins.clear();
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
    destroyByQuery(query) {
        const selectElements = Libs.getElements(query);
        selectElements.forEach((element) => {
            if (element.tagName === "SELECT")
                this.destroyElement(element);
        });
        this.bindedQueries.delete(query);
        const commands = Libs.getBindedCommand();
        const index = commands.indexOf(query);
        if (index > -1)
            commands.splice(index, 1);
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
    destroyElement(selectElement) {
        const bindMap = Libs.getBinderMap(selectElement);
        if (!bindMap)
            return;
        const selfBox = bindMap.self;
        Libs.setUnbinderMap(selectElement, bindMap);
        const wasObserving = !!this.EAObserver;
        if (wasObserving)
            this.EAObserver?.disconnect();
        bindMap.self?.deInit?.();
        const wrapper = bindMap.container?.element ?? selectElement.parentElement;
        selectElement.style.display = "";
        selectElement.style.visibility = "";
        selectElement.disabled = false;
        delete selectElement.dataset.selectiveId;
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.replaceChild(selectElement, wrapper);
        }
        else {
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
    rebind(query, options) {
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
    applySelectBox(selectElement, options) {
        if (Libs.getBinderMap(selectElement) ||
            Libs.getUnbinderMap(selectElement)) {
            return false;
        }
        const SEID = Libs.randomString(8);
        const options_cfg = Libs.buildConfig(selectElement, options);
        options_cfg.SEID = SEID;
        options_cfg.SEID_LIST = `seui-${SEID}-optionlist`;
        options_cfg.SEID_HOLDER = `seui-${SEID}-placeholder`;
        const bindMap = { options: options_cfg };
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
    getProperties(actionName, action) {
        const descriptor = Object.getOwnPropertyDescriptor(action, actionName);
        let type = "variable";
        if (descriptor?.get ||
            (descriptor?.set && typeof action[actionName] !== "function")) {
            type = "get-set";
        }
        else if (typeof action[actionName] === "function") {
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
    buildGetSetAction(object, name, els) {
        Object.defineProperty(object, name, {
            get() {
                const binded = Libs.getBinderMap(els[0]);
                return binded.action?.[name];
            },
            set(value) {
                els.forEach((el) => {
                    const binded = Libs.getBinderMap(el);
                    if (binded?.action)
                        binded.action[name] = value;
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
    buildFuntionAction(object, name, els) {
        object[name] = (...params) => {
            let resp = null;
            for (let index = 0; index < els.length; index++) {
                const el = els[index];
                const binded = Libs.getBinderMap(el);
                if (!binded?.action)
                    continue;
                const evtToken = iEvents.buildEventToken();
                resp ?? (resp = binded.action[name](evtToken.callback, ...params));
                if (!evtToken.token.isContinue)
                    break;
            }
            return resp ?? object;
        };
    }
}

/**
 * Entry module for SelectiveUI.
 *
 * This file exposes the public API surface of the library:
 * - version/name metadata
 * - DOM binding helpers (bind/find/rebind/destroy)
 * - effector factory for imperative effects
 *
 * Notes:
 * - CSS imports below are *side-effect imports* used by bundlers (Vite/Webpack/Rollup)
 *   to include component styles in the final bundle.
 */
/** Base/global styles for SelectiveUI. */
const SECLASS = new Selective();
/**
 * Current library version.
 *
 * Declared as `const` literal type to enable strict typing and easy tree-shaking.
 */
const version = "1.4.1";
/**
 * Library name identifier.
 *
 * Can be used for debugging, logging, telemetry, or exposing global namespace metadata.
 */
const name = "SelectiveUI";
/**
 * Bind SelectiveUI behaviors to elements matched by a CSS selector.
 *
 * Typically used to initialize/select-enhance native `<select>` elements or custom containers.
 *
 * @param query - A CSS selector string used to find target elements in the DOM.
 * @param options - Optional configuration used during initialization.
 *
 * @example
 * bind(".my-select", { searchable: true });
 */
function bind(query, options = {}) {
    SECLASS.bind(query, options);
}
/**
 * Find an existing SelectiveUI instance/actions API by selector.
 *
 * @param query - A CSS selector string previously used with `bind()` (or matching the same element).
 * @returns An action API that allows controlling the instance (open/close/setValue/etc).
 *
 * @remarks
 * The return type is casted to `SelectiveActionApi` for a stable public contract.
 */
function find(query) {
    return SECLASS.find(query);
}
/**
 * Destroy SelectiveUI instance(s) and release related resources.
 *
 * @param query - A CSS selector string identifying which instance(s) to destroy.
 *               If `null`, destroys all instances managed by SelectiveUI.
 *
 * @example
 * destroy(".my-select");
 *
 * @example
 * // Destroy all instances
 * destroy();
 */
function destroy(query) {
    SECLASS.destroy(query);
}
/**
 * Rebind (reinitialize) SelectiveUI on the given selector.
 *
 * Useful when:
 * - The DOM has changed dynamically
 * - Options need to be reapplied
 * - You want a clean re-init without manual destroy + bind
 *
 * @param query - A CSS selector string used to locate target elements.
 * @param options - Optional configuration applied during re-initialization.
 */
function rebind(query, options = {}) {
    SECLASS.rebind(query, options);
}
/**
 * Create an Effector instance for a given element.
 *
 * An effector provides imperative effect utilities bound to an element, such as animations,
 * positioning, UI transitions, or event-driven effects (depending on implementation).
 *
 * @param element - A CSS selector string or a direct HTMLElement reference.
 * @returns An `EffectorInterface` implementation bound to the given element.
 *
 * @example
 * const fx = effector("#popup");
 * fx.show();
 */
function effector(element) {
    return Effector(element);
}
/**
 * Register a Selective plugin globally.
 *
 * @param plugin - Plugin to register.
 */
function registerPlugin(plugin) {
    SECLASS.registerPlugin(plugin);
}
/**
 * Unregister a Selective plugin by id.
 *
 * @param id - Plugin id.
 */
function unregisterPlugin(id) {
    SECLASS.unregisterPlugin(id);
}
let domInitialized = false;
function init() {
    if (domInitialized)
        return;
    domInitialized = true;
    document.addEventListener("mousedown", () => {
        const sels = Libs.getBindedCommand();
        if (sels.length > 0) {
            const actionApi = SECLASS.find(sels.join(", "));
            if (!actionApi.isEmpty)
                actionApi.close();
        }
    });
    SECLASS.Observer();
}
if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    }
    else {
        init();
    }
}

export { bind, destroy, effector, find, name, rebind, registerPlugin, unregisterPlugin, version };
//# sourceMappingURL=selective-ui.esm.js.map
