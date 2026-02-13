import { Popup } from "../components/popup/popup";
import { SelectBox } from "../components/selectbox";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { AjaxConfig, NormalizedAjaxItem, PaginationState, ParseResponseResult } from "../types/core/search-controller.type";
import { Libs } from "../utils/libs";
import { Lifecycle } from "./base/lifecycle";
import { ModelManager } from "./model-manager";

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
export class SearchController extends Lifecycle {
    /** Backing native `<select>` element providing context and the authoritative option DOM. */
    private select: HTMLSelectElement;

    /** Model manager providing access to current model resources (items, adapter, recycler). */
    private modelManager: ModelManager<MixedItem, any>;

    /**
     * AJAX configuration; when `null`, {@link search} falls back to local filtering.
     * @see {@link setAjax}
     */
    private ajaxConfig: AjaxConfig | null = null;

    /** Abort handle used to cancel an in-flight AJAX request when a newer request starts. */
    private abortController: AbortController | null = null;

    /** Optional popup handle used for showing/hiding loading UI during remote operations. */
    private popup: Popup | null = null;

    /**
     * SelectBox handle used by custom data builder functions that require Selective context.
     * NOTE: This is a reference; the controller does not own/destroy the SelectBox.
     */
    private selectBox: SelectBox = null;

    /**
     * Remote pagination and loading state.
     * - `currentKeyword` is the last keyword used to compute pagination identity.
     * - `isPaginationEnabled` is inferred from server response shape.
     */
    private paginationState: PaginationState = {
        currentPage: 0,
        totalPages: 1,
        hasMore: false,
        isLoading: false,
        currentKeyword: "",
        isPaginationEnabled: false,
    };

    /**
     * Creates a SearchController bound to a native `<select>` and an existing {@link ModelManager}.
     * Immediately transitions lifecycle `NEW → INITIALIZED` via {@link Lifecycle.init}.
     *
     * @param {HTMLSelectElement} selectElement - Native select element acting as the authoritative data source/target.
     * @param {ModelManager<MixedItem, any>} modelManager - Manager responsible for model resources and rendering refresh.
     * @param {SelectBox} selectBox - SelectBox handle used by configured AJAX data builders.
     */
    public constructor(selectElement: HTMLSelectElement, modelManager: ModelManager<MixedItem, any>, selectBox: SelectBox) {
        super();
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
    private initialize(selectElement: HTMLSelectElement, modelManager: ModelManager<MixedItem, any>, selectBox: SelectBox): void {
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
    public isAjax(): boolean {
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
    async loadByValues(values: string | string[]): Promise<{ success: boolean; items: NormalizedAjaxItem[]; message?: string }> {
        if (!this.ajaxConfig) {
            return { success: false, items: [], message: "Ajax not configured" };
        }

        const valuesArray = Array.isArray(values) ? values : [values];
        if (valuesArray.length === 0) return { success: true, items: [] };

        try {
            const cfg = this.ajaxConfig;

            let payload: Record<string, any>;
            if (typeof cfg.dataByValues === "function") {
                payload = cfg.dataByValues(valuesArray);
            } else {
                payload = {
                    values: valuesArray.join(","),
                    load_by_values: "1",
                    ...(typeof cfg.data === "function"
                        ? cfg.data.bind(this.selectBox.Selective.find(this.selectBox.container.targetElement))("", 0)
                        : cfg.data ?? {}),
                };
            }

            let response: Response;

            if ((cfg.method ?? "GET") === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach((key) => formData.append(key, String(payload[key])));
                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });
            } else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`);
            }

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const result = this.parseResponse(data);

            this.update();

            return { success: true, items: result.items };
        } catch (error: any) {
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
    public checkMissingValues(values: string[]): { existing: string[]; missing: string[] } {
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
     * @param {AjaxConfig | null} config - AJAX configuration (endpoint, method, data builders, keepSelected, ...).
     * @returns {void}
     */
    public setAjax(config: AjaxConfig | null): void {
        this.ajaxConfig = config;
    }

    /**
     * Attaches a popup instance so the controller can reflect transient UI states
     * during remote operations (e.g., loading indicator).
     *
     * @param {Popup} popupInstance - Popup used to show results and loading state.
     * @returns {void}
     */
    public setPopup(popupInstance: Popup): void {
        this.popup = popupInstance;
    }

    /**
     * Returns a shallow snapshot of the current pagination state.
     *
     * @returns {PaginationState} State snapshot (defensive copy).
     */
    public getPaginationState(): PaginationState {
        return { ...this.paginationState };
    }

    /**
     * Resets pagination counters while preserving whether pagination is enabled.
     * Clears page/totals/loading flags and the current keyword.
     *
     * @returns {void}
     */
    public resetPagination(): void {
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
    public clear(): void {
        this.paginationState.currentKeyword = "";

        const { modelList } = this.modelManager.getResources();
        const flatOptions: OptionModel[] = [];

        for (const m of modelList) {
            if (m instanceof OptionModel) flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items)) flatOptions.push(...m.items);
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
    public async search(keyword: string, append: boolean = false): Promise<any> {
        if (this.ajaxConfig) return this.ajaxSearch(keyword, append);
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
    public async loadMore(): Promise<any> {
        if (!this.ajaxConfig) return { success: false, message: "Ajax not enabled" };
        if (this.paginationState.isLoading) return { success: false, message: "Already loading" };
        if (!this.paginationState.isPaginationEnabled) return { success: false, message: "Pagination not enabled" };
        if (!this.paginationState.hasMore) return { success: false, message: "No more data" };

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
    private async localSearch(keyword: string): Promise<{ success: boolean; hasResults: boolean; isEmpty: boolean }> {
        if (this.compareSearchTrigger(keyword)) this.paginationState.currentKeyword = keyword;

        const lower = String(keyword ?? "").toLowerCase();
        const lowerNA = Libs.string2normalize(lower);

        const { modelList } = this.modelManager.getResources();

        const flatOptions: OptionModel[] = [];
        for (const m of modelList) {
            if (m instanceof OptionModel) flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items)) flatOptions.push(...m.items);
        }

        let hasVisibleItems = false;

        flatOptions.forEach((opt) => {
            const isVisible = lower === "" || opt.textToFind.includes(lowerNA);

            opt.visible = isVisible;
            if (isVisible) hasVisibleItems = true;
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
    public compareSearchTrigger(keyword: string): boolean {
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
    private async ajaxSearch(keyword: string, append: boolean = false): Promise<any> {
        const cfg = this.ajaxConfig!;
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

        let payload: Record<string, any>;
        if (typeof cfg.data === "function") {
            const selectiveInstance = this.selectBox?.Selective?.find(this.selectBox?.container?.targetElement);
            payload = cfg.data.call(selectiveInstance, keyword, page);
            if (payload && typeof payload.selectedValue === "undefined") payload.selectedValue = selectedValues;
        } else {
            payload = { search: keyword, page, selectedValue: selectedValues, ...(cfg.data ?? {}) };
        }

        try {
            let response: Response;

            if ((cfg.method ?? "GET") === "POST") {
                const formData = new URLSearchParams();
                Object.keys(payload).forEach((key) => formData.append(key, String(payload[key])));
                response = await fetch(cfg.url, {
                    method: "POST",
                    body: formData,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    signal: this.abortController.signal,
                });
            } else {
                const params = new URLSearchParams(payload).toString();
                response = await fetch(`${cfg.url}?${params}`, { signal: this.abortController.signal });
            }

            const data = await response.json();
            const result = this.parseResponse(data);

            if (result.hasPagination) {
                this.paginationState.isPaginationEnabled = true;
                this.paginationState.currentPage = result.page;
                this.paginationState.totalPages = result.totalPages;
                this.paginationState.hasMore = result.hasMore;
            } else {
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
        } catch (error: any) {
            this.paginationState.isLoading = false;
            this.popup?.hideLoading();

            if (error?.name === "AbortError") return { success: false, message: "Request aborted" };

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
    private parseResponse(data: any): ParseResponseResult {
        let items: any[] = [];
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
        } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
            if (typeof data.page !== "undefined") {
                hasPagination = true;
                page = parseInt(data.page ?? 0, 10);
                totalPages = parseInt(data.totalPages ?? data.total_page ?? 1, 10);
                hasMore = data.hasMore ?? (page < totalPages - 1);
            }
        } else if (Array.isArray(data)) {
            items = data;
        } else if (data.items && Array.isArray(data.items)) {
            items = data.items;
            if (data.pagination) {
                hasPagination = true;
                page = parseInt(data.pagination.page ?? 0, 10);
                totalPages = parseInt(data.pagination.totalPages ?? data.pagination.total_page ?? 1, 10);
                hasMore = data.pagination.hasMore ?? (page < totalPages - 1);
            }
        }

        const normalized: NormalizedAjaxItem[] = items.map((item: any) => {
            if (item instanceof HTMLOptionElement || item instanceof HTMLOptGroupElement) return item;

            if (item.type === "optgroup" || item.isGroup || item.group || item.label) {
                const label = item.label ?? item.name ?? item.title ?? "";
                const dataObj = item.data ?? {};
                const opts = (item.options ?? item.items ?? []).map((opt: any) => ({
                    value: opt.value ?? opt.id ?? opt.key ?? "",
                    text: opt.text ?? opt.label ?? opt.name ?? opt.title ?? "",
                    selected: opt.selected ?? false,
                    data: opt.data ?? (opt.imgsrc ? { imgsrc: opt.imgsrc } : {}),
                }));

                return { type: "optgroup", label, data: dataObj, options: opts };
            }

            const dataObj = item.data ?? {};
            if (item?.imgsrc) dataObj.imgsrc = item.imgsrc;

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
    public applyAjaxResult(items: NormalizedAjaxItem[], keepSelected: boolean, append: boolean = false): void {
        const select = this.select;

        let oldSelected: string[] = [];
        if (keepSelected) oldSelected = Array.from(select.selectedOptions).map((o) => o.value);

        if (!append) select.innerHTML = "";

        items.forEach((item: any) => {
            // Skip empty item (defensive guard)
            if ((item["type"] === "option" || !item["type"]) && item["value"] === "" && item["text"] === "") return;

            if (item instanceof HTMLOptionElement || item instanceof HTMLOptGroupElement) {
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
                    item.options.forEach((opt: any) => {
                        const option = document.createElement("option");
                        option.value = opt.value;
                        option.text = opt.text;

                        if (opt.data) {
                            Object.keys(opt.data).forEach((key) => {
                                option.dataset[key] = String(opt.data[key]);
                            });
                        }

                        if (opt.selected || (keepSelected && oldSelected.includes(option.value))) {
                            option.selected = true;
                        }

                        optgroup.appendChild(option);
                    });
                }

                select.appendChild(optgroup);
            } else {
                const option = document.createElement("option");
                option.value = item.value;
                option.text = item.text;

                if (item.data) {
                    Object.keys(item.data).forEach((key) => {
                        option.dataset[key] = String(item.data[key]);
                    });
                }

                if (item.selected || (keepSelected && oldSelected.includes(option.value))) {
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
    public override destroy(): void {
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