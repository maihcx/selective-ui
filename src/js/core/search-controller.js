import { Popup } from "../components/popup";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { Libs } from "../utils/libs";
import { ModelManager } from "./model-manager";

export class SearchController {
    #select;
    /** @type {ModelManager<OptionModel>} */
    #modelManager;

    #ajaxConfig = null;

    #abortController = null;

    /** @type {Popup} */
    #popup = null;
    
    #paginationState = {
        currentPage: 0,
        totalPages: 1,
        hasMore: false,
        isLoading: false,
        currentKeyword: "",
        isPaginationEnabled: false
    };

    /**
     * Initializes the SearchController with a source <select> element and a ModelManager
     * to manage option models and search results.
     *
     * @param {HTMLSelectElement} selectElement - The native select element that provides context and data source.
     * @param {ModelManager<OptionModel>} modelManager - Manager responsible for models and rendering updates.
     */
    constructor(selectElement, modelManager) {
        this.#select = selectElement;
        this.#modelManager = modelManager;
    }

    /**
     * Indicates whether AJAX-based search is configured.
     *
     * @returns {boolean} - True if AJAX config is present; false otherwise.
     */
    isAjax() {
        return !(!this.#ajaxConfig);
    }

    /**
     * Load specific options by their values from server
     * @param {string|string[]} values - Values to load
     * @returns {Promise<{success: boolean, items: Array, message?: string}>}
     */
    async loadByValues(values) {
        if (!this.#ajaxConfig) {
            return { success: false, items: [], message: "Ajax not configured" };
        }

        const valuesArray = Array.isArray(values) ? values : [values];
        if (valuesArray.length === 0) {
            return { success: true, items: [] };
        }
        
        try {
            const cfg = this.#ajaxConfig;
            
            let payload;
            if (typeof cfg.dataByValues === "function") {
                payload = cfg.dataByValues(valuesArray);
            } else {
                payload = {
                    values: valuesArray.join(","),
                    load_by_values: "1",
                    ...(typeof cfg.data === "function" ? cfg.data("", 0) : (cfg.data || {}))
                };
            }

            let response;
            if (cfg.method === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach(key => {
                    formData.append(key, payload[key]);
                });

                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                });
            } else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const result = this.#parseResponse(data);
            
            return {
                success: true,
                items: result.items
            };
        } catch (error) {
            console.error("Load by values error:", error);
            return { 
                success: false, 
                message: error.message,
                items: []
            };
        }
    }

    /**
     * Check if values exist in current options
     * @param {string[]} values - Values to check
     * @returns {{existing: string[], missing: string[]}}
     */
    checkMissingValues(values) {
        const allOptions = Array.from(this.#select.options);
        const existingValues = allOptions.map(opt => opt.value);
        
        const existing = values.filter(v => existingValues.includes(v));
        const missing = values.filter(v => !existingValues.includes(v));
        
        return { existing, missing };
    }

    /**
     * Configures AJAX settings used for remote searching and pagination.
     *
     * @param {object} config - AJAX configuration object (e.g., endpoint, headers, query params).
     */
    setAjax(config) {
        this.#ajaxConfig = config;
    }

    /**
     * Attaches a Popup instance to allow UI updates during search (e.g., loading, resize).
     *
     * @param {Popup} popupInstance - The popup used to display search results and loading state.
     */
    setPopup(popupInstance) {
        this.#popup = popupInstance;
    }


    /**
     * Returns a shallow copy of the current pagination state used for search/infinite scroll.
     *
     * @returns {{
     *   currentPage:number, totalPages:number, hasMore:boolean, isLoading:boolean,
     *   currentKeyword:string, isPaginationEnabled:boolean
     * }}
     */
    getPaginationState() {
        return { ...this.#paginationState };
    }

    /**
     * Resets pagination counters while preserving whether pagination is enabled.
     * Clears page, totals, loading flags, and current keyword.
     */
    resetPagination() {
        this.#paginationState = {
            currentPage: 0,
            totalPages: 1,
            hasMore: false,
            isLoading: false,
            currentKeyword: "",
            isPaginationEnabled: this.#paginationState.isPaginationEnabled
        };
    }

    /**
     * Clears the current keyword and makes all options visible (local reset).
     * Flattens groups and options, then sets `visible = true` for each option.
     */
    clear() {
        this.#paginationState.currentKeyword = "";
        const { modelList } = this.#modelManager.getResources();
        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel) flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items)) flatOptions.push(...m.items);
        }
        flatOptions.forEach(opt => { opt.visible = true; });
    }

    /**
     * Performs a search with either AJAX or local filtering depending on configuration.
     *
     * @param {string} keyword - The search term to apply.
     * @param {boolean} [append=false] - When using AJAX, whether to append results to existing items.
     * @returns {Promise<{success:boolean, hasResults:boolean, isEmpty:boolean} | any>}
     */
    async search(keyword, append = false) {
        if (this.#ajaxConfig && this.#ajaxConfig) {
            return this.#ajaxSearch(keyword, append);
        }
        return this.#localSearch(keyword);
    }

    /**
     * Loads the next page for AJAX pagination if enabled and not already loading,
     * otherwise returns an error object indicating the reason.
     *
     * @returns {Promise<{success:boolean, message?:string} | any>}
     */
    async loadMore() {
        if (!this.#ajaxConfig || !this.#ajaxConfig) {
            return { success: false, message: "Ajax not enabled" };
        }

        if (this.#paginationState.isLoading) {
            return { success: false, message: "Already loading" };
        }

        if (!this.#paginationState.isPaginationEnabled) {
            return { success: false, message: "Pagination not enabled" };
        }

        if (!this.#paginationState.hasMore) {
            return { success: false, message: "No more data" };
        }

        this.#paginationState.currentPage++;
        return this.#ajaxSearch(this.#paginationState.currentKeyword, true);
    }

    /**
     * Executes a local (in-memory) search by normalizing the keyword (lowercase, non-accent)
     * and toggling each option's visibility based on text match. Returns summary flags.
     *
     * @param {string} keyword - The search term.
     * @returns {Promise<{success:boolean, hasResults:boolean, isEmpty:boolean}>}
     */
    async #localSearch(keyword) {
        if (this.compareSearchTrigger(keyword)) {
            this.#paginationState.currentKeyword = keyword;
        }
            
        const lower = String(keyword || "").toLowerCase();
        const lowerNA = Libs.string2normalize(lower);

        const { modelList } = this.#modelManager.getResources();
        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel) {
                flatOptions.push(m);
            } else if (m instanceof GroupModel && Array.isArray(m.items)) {
                flatOptions.push(...m.items);
            }
        }

        let hasVisibleItems = false;
        flatOptions.forEach(opt => {
            const text = String(opt.textContent || opt.text || "").toLowerCase();
            const textNA = Libs.string2normalize(text);
            const isVisible =
                lower === "" ||
                text.includes(lower) ||
                textNA.includes(lowerNA);
            opt.visible = isVisible;
            if (isVisible) hasVisibleItems = true;
        });

        return {
            success: true,
            hasResults: hasVisibleItems,
            isEmpty: flatOptions.length === 0
        };
    }

    /**
     * Checks whether the provided keyword differs from the current one,
     * to determine if a new search should be triggered.
     *
     * @param {string} keyword - The candidate search term.
     * @returns {boolean} - True if different from the current keyword; otherwise false.
     */
    compareSearchTrigger(keyword) {
        if (keyword !== this.#paginationState.currentKeyword) {
            return true;
        }
        return false;
    }

    /**
     * Executes an AJAX-based search with optional appending. Manages pagination,
     * aborts previous requests, shows/hides loading, builds payload, and applies results.
     *
     * @param {string} keyword - The search term.
     * @param {boolean} [append=false] - Whether to append results instead of replacing.
     * @returns {Promise<{
     *   success:boolean, hasResults:boolean, isEmpty:boolean,
     *   hasPagination:boolean, hasMore:boolean, currentPage:number, totalPages:number
     * } | {success:false, message:string}>}
     */
    async #ajaxSearch(keyword, append = false) {
        const cfg = this.#ajaxConfig;

        if (this.compareSearchTrigger(keyword)) {
            this.resetPagination();
            this.#paginationState.currentKeyword = keyword;
            append = false;
        }

        this.#paginationState.isLoading = true;
        this.#popup?.showLoading();

        this.#abortController?.abort();
        this.#abortController = new AbortController();

        const page = this.#paginationState.currentPage;
        
        const selectedValues = Array.from(this.#select.selectedOptions)
            .map(opt => opt.value)
            .join(",");
        
        let payload;
        if (typeof cfg.data === "function") {
            payload = cfg.data(keyword, page);
            if (payload && !payload.selectedValue) {
                payload.selectedValue = selectedValues;
            }
        } else {
            payload = {
                search: keyword,
                page: page,
                selectedValue: selectedValues,
                ...(cfg.data || {})
            };
        }

        try {
            let response;

            if (cfg.method === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach(key => {
                    formData.append(key, payload[key]);
                });

                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    signal: this.#abortController.signal
                });
            } else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`, {
                    signal: this.#abortController.signal
                });
            }

            let data = await response.json();
            
            const result = this.#parseResponse(data);
            
            if (result.hasPagination) {
                this.#paginationState.isPaginationEnabled = true;
                this.#paginationState.currentPage = result.page;
                this.#paginationState.totalPages = result.totalPages;
                this.#paginationState.hasMore = result.hasMore;
            } else {
                this.#paginationState.isPaginationEnabled = false;
            }

            this.#applyAjaxResult(result.items, cfg.keepSelected, append);
            
            this.#paginationState.isLoading = false;
            this.#popup?.hideLoading();

            return {
                success: true,
                hasResults: result.items.length > 0,
                isEmpty: result.items.length === 0,
                hasPagination: result.hasPagination,
                hasMore: result.hasMore,
                currentPage: result.page,
                totalPages: result.totalPages
            };
        } catch (error) {
            this.#paginationState.isLoading = false;
            this.#popup?.hideLoading();
            
            if (error.name === "AbortError") {
                return { success: false, message: "Request aborted" };
            }
            
            console.error("Ajax search error:", error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Parses various server response shapes into a normalized structure for options and groups.
     * Supports arrays at keys: `object`, `data`, `items`, or a root array; detects pagination metadata.
     * Each item is mapped to either an "option" or "optgroup" descriptor, preserving custom data fields.
     *
     * @param {any} data - The raw response payload from the AJAX request.
     * @returns {{
     *   items: Array<
     *     | HTMLOptionElement
     *     | HTMLOptGroupElement
     *     | {
     *         type: "option",
     *         value: string,
     *         text: string,
     *         selected?: boolean,
     *         data?: Record<string, any>
     *       }
     *     | {
     *         type: "optgroup",
     *         label: string,
     *         data?: Record<string, any>,
     *         options: Array<{
     *           value: string,
     *           text: string,
     *           selected?: boolean,
     *           data?: Record<string, any>
     *         }>
     *       }
     *   >,
     *   hasPagination: boolean,
     *   page: number,
     *   totalPages: number,
     *   hasMore: boolean
     * }}
     */
    #parseResponse(data) {
        let items = [];
        let hasPagination = false;
        let page = 0;
        let totalPages = 1;
        let hasMore = false;

        if (data.object && Array.isArray(data.object)) {
            items = data.object;
            if (typeof data.page !== "undefined") {
                hasPagination = true;
                page = parseInt(data.page) || 0;
                totalPages = parseInt(data.totalPages || data.total_page) || 1;
                hasMore = page < totalPages - 1;
            }
        }
        else if (data.data && Array.isArray(data.data)) {
            items = data.data;
            if (typeof data.page !== "undefined") {
                hasPagination = true;
                page = parseInt(data.page) || 0;
                totalPages = parseInt(data.totalPages || data.total_page) || 1;
                hasMore = data.hasMore ?? (page < totalPages - 1);
            }
        }
        else if (Array.isArray(data)) {
            items = data;
        }
        else if (data.items && Array.isArray(data.items)) {
            items = data.items;
            if (data.pagination) {
                hasPagination = true;
                page = parseInt(data.pagination.page) || 0;
                totalPages = parseInt(data.pagination.totalPages || data.pagination.total_page) || 1;
                hasMore = data.pagination.hasMore ?? (page < totalPages - 1);
            }
        }

        items = items.map(item => {
            if (item instanceof HTMLOptionElement || item instanceof HTMLOptGroupElement) {
                return item;
            }

            if (item.type === "optgroup" || item.isGroup || item.group || item.label) {
                return {
                    type: "optgroup",
                    label: item.label || item.name || item.title || "",
                    data: item.data || {},
                    options: (item.options || item.items || []).map(opt => ({
                        value: opt.value || opt.id || opt.key || "",
                        text: opt.text || opt.label || opt.name || opt.title || "",
                        selected: opt.selected || false,
                        data: opt.data || (opt.imgsrc ? { imgsrc: opt.imgsrc } : {})
                    }))
                };
            }

            let data = item.data || {};
            if (item?.imgsrc) {
                data.imgsrc = item.imgsrc;
            }
            
            return {
                type: "option",
                value: item.value || item.id || item.key || "",
                text: item.text || item.label || item.name || item.title || "",
                selected: item.selected || false,
                data: data
            };
        });

        return {
            items,
            hasPagination,
            page,
            totalPages,
            hasMore
        };
    }

    /**
     * Applies normalized AJAX results to the underlying <select> element.
     * Optionally keeps previous selections, supports appending, and preserves
     * custom data attributes for both options and optgroups. Emits "options:changed".
     *
     * @param {Array<
     *   | HTMLOptionElement
     *   | HTMLOptGroupElement
     *   | {type:"option", value:string, text:string, selected?:boolean, data?:Record<string, any>}
     *   | {type:"optgroup", label:string, data?:Record<string, any>, options:Array<{value:string, text:string, selected?:boolean, data?:Record<string, any>}>}
     * >} items - The normalized list of items to apply.
     * @param {boolean} keepSelected - If true, previously selected values are preserved when possible.
     * @param {boolean} [append=false] - If true, append to existing options; otherwise replace them.
     */
    #applyAjaxResult(items, keepSelected, append = false) {
        const select = this.#select;
        
        let oldSelected = [];
        if (keepSelected) {
            oldSelected = Array.from(select.selectedOptions).map(o => o.value);
        }

        if (!append) {
            select.innerHTML = "";
        }

        items.forEach(item => {
            if ((item["type"] === "option" || !item["type"]) && item["value"] === "" && item["text"] === "") {
                return;
            }

            if (item instanceof HTMLOptionElement || item instanceof HTMLOptGroupElement) {
                select.appendChild(item);
                return;
            }

            if (item.type === "optgroup") {
                const optgroup = document.createElement("optgroup");
                optgroup.label = item.label;

                if (item.data) {
                    Object.keys(item.data).forEach(key => {
                        optgroup.dataset[key] = item.data[key];
                    });
                }

                if (item.options && Array.isArray(item.options)) {
                    item.options.forEach(opt => {
                        const option = document.createElement("option");
                        option.value = opt.value;
                        option.text = opt.text;

                        if (opt.data) {
                            Object.keys(opt.data).forEach(key => {
                                option.dataset[key] = opt.data[key];
                            });
                        }

                        if (opt.selected || (keepSelected && oldSelected.includes(option.value))) {
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
                    Object.keys(item.data).forEach(key => {
                        option.dataset[key] = item.data[key];
                    });
                }

                if (item.selected || (keepSelected && oldSelected.includes(option.value))) {
                    option.selected = true;
                }

                select.appendChild(option);
            }
        });

        select.dispatchEvent(new CustomEvent("options:changed"));
    }
}