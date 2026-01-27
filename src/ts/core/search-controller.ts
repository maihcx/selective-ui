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
 * Controller responsible for orchestrating search behavior across the Select UI.
 *
 * Responsibilities:
 * - Manage local (in-memory) filtering and remote (AJAX) searching
 * - Normalize heterogeneous server responses into a common structure
 * - Maintain pagination state (page, totals, loading, hasMore)
 * - Apply remote results back to the underlying <select> element
 * - Coordinate UI updates via Popup (loading indicator, resize, empty/not-found states)
 *
 * Lifecycle:
 * - Constructed with references to the native <select>, ModelManager, and SelectBox
 * - `init()` runs immediately via `initialize()`
 * - Methods `search()`, `loadMore()`, `clear()` are invoked by higher-level components
 *
 * @extends Lifecycle
 */
export class SearchController extends Lifecycle {
    /** Backing native <select> element providing context and initial options. */
    private select: HTMLSelectElement;

    /** Model manager providing access to model resources (items, adapter, recycler). */
    private modelManager: ModelManager<MixedItem, any>;

    /** Current AJAX configuration; when absent, local search is used. */
    private ajaxConfig: AjaxConfig | null = null;

    /** Used to cancel in-flight AJAX requests when a new search starts. */
    private abortController: AbortController | null = null;

    /** Popup instance to reflect UI states (loading, empty/not-found), and sizing. */
    private popup: Popup | null = null;

    /** SelectBox handle (used by custom data builders). */
    private selectBox: SelectBox = null;

    /** Current pagination and loading state for remote searches. */
    private paginationState: PaginationState = {
        currentPage: 0,
        totalPages: 1,
        hasMore: false,
        isLoading: false,
        currentKeyword: "",
        isPaginationEnabled: false,
    };

    /**
     * Initializes the SearchController with a source <select> element and a ModelManager
     * to manage option models and search results.
     *
     * @param selectElement - The native select element that provides context and data source.
     * @param modelManager - Manager responsible for models and rendering updates.
     * @param selectBox - SelectBox handle.
     */
    public constructor(selectElement: HTMLSelectElement, modelManager: ModelManager<MixedItem, any>, selectBox: SelectBox) {
        super();
        this.initialize(selectElement, modelManager, selectBox);
    }

    /**
     * Internal initializer that captures dependencies and starts the lifecycle.
     *
     * @param selectElement - The native select element that provides context and data source.
     * @param modelManager - Manager responsible for models and rendering updates.
     * @param selectBox - SelectBox handle.
     */
    private initialize(selectElement: HTMLSelectElement, modelManager: ModelManager<MixedItem, any>, selectBox: SelectBox): void {
        this.select = selectElement;
        this.modelManager = modelManager;
        this.selectBox = selectBox;

        this.init();
    }

    /**
     * Indicates whether AJAX-based search is configured.
     *
     * @returns True if AJAX config is present; false otherwise.
     */
    public isAjax(): boolean {
        return !!this.ajaxConfig;
    }

    /**
     * Loads specific options by their values from the server.
     *
     * Behavior:
     * - Uses `ajaxConfig.dataByValues` if provided; otherwise builds a default payload.
     * - Supports GET/POST according to `ajaxConfig.method` (defaults to GET).
     * - Normalizes the response via `parseResponse()` and returns normalized items.
     *
     * @param values - Value or list of values to load.
     * @returns Promise resolving with `{ success, items, message? }`.
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
     * Checks whether the provided values already exist in the current <select> options.
     *
     * @param values - Values to check for presence.
     * @returns Partitioned result: `{ existing, missing }`.
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
     *
     * @param config - AJAX configuration (endpoint, method, data builders, etc.).
     */
    public setAjax(config: AjaxConfig | null): void {
        this.ajaxConfig = config;
    }

    /**
     * Attaches a Popup instance to allow UI updates during search (e.g., loading, resize).
     *
     * @param popupInstance - The popup used to display search results and loading state.
     */
    public setPopup(popupInstance: Popup): void {
        this.popup = popupInstance;
    }

    /**
     * Returns a shallow copy of the current pagination state used for search/infinite scroll.
     *
     * @returns Pagination state snapshot.
     */
    public getPaginationState(): PaginationState {
        return { ...this.paginationState };
    }

    /**
     * Resets pagination counters while preserving whether pagination is enabled.
     * Clears page, totals, loading flags, and current keyword.
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
     * Clears the current keyword and makes all options visible (local reset).
     *
     * No network requests are made; operates on the current model set.
     */
    public clear(): void {
        this.paginationState.currentKeyword = "";

        const { modelList } = this.modelManager.getResources();
        const flatOptions: OptionModel[] = [];

        for (const m of modelList as MixedItem[]) {
            if (m instanceof OptionModel) flatOptions.push(m);
            else if (m instanceof GroupModel && Array.isArray(m.items)) flatOptions.push(...m.items);
        }

        flatOptions.forEach((opt) => {
            opt.visible = true;
        });
    }

    /**
     * Performs a search with either AJAX or local filtering depending on configuration.
     *
     * @param keyword - The search term to apply.
     * @param append - For AJAX mode: whether to append results (next page). Defaults to false.
     * @returns An implementation-specific result object.
     */
    public async search(keyword: string, append: boolean = false): Promise<any> {
        if (this.ajaxConfig) return this.ajaxSearch(keyword, append);
        return this.localSearch(keyword);
    }

    /**
     * Loads the next page for AJAX pagination if enabled and not already loading.
     *
     * @returns Result of the paginated AJAX request, or an error when not applicable.
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
     * Executes a local (in-memory) search by normalizing the keyword (lowercase, non-accent)
     * and toggling each option's visibility based on text match.
     *
     * @param keyword - Keyword to filter against local options.
     * @returns Summary flags: `{ success, hasResults, isEmpty }`.
     */
    private async localSearch(keyword: string): Promise<{ success: boolean; hasResults: boolean; isEmpty: boolean }> {
        if (this.compareSearchTrigger(keyword)) this.paginationState.currentKeyword = keyword;

        const lower = String(keyword ?? "").toLowerCase();
        const lowerNA = Libs.string2normalize(lower);

        const { modelList } = this.modelManager.getResources();

        const flatOptions: OptionModel[] = [];
        for (const m of modelList as MixedItem[]) {
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
     * Checks whether the provided keyword differs from the current one,
     * to determine if a new search should be triggered.
     *
     * @param keyword - The keyword to compare with the current search term.
     * @returns True if a new search should be triggered; otherwise false.
     */
    public compareSearchTrigger(keyword: string): boolean {
        return keyword !== this.paginationState.currentKeyword;
    }

    /**
     * Executes an AJAX-based search with optional appending.
     *
     * Behavior:
     * - Aborts any in-flight request before starting a new search
     * - Shows loading in the popup (if available)
     * - Supports GET/POST with data built from config or function
     * - Applies normalized results to the <select>, respecting `keepSelected`
     * - Updates pagination state when server response includes pagination info
     *
     * @param keyword - Search keyword.
     * @param append - Whether to append results (true = next page); defaults to false.
     * @returns An implementation-specific result object with success and pagination flags.
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
            payload = cfg.data.bind(this.selectBox.Selective.find(this.selectBox.container.targetElement))(keyword, page);
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
     * Normalizes various server response shapes into a standard structure for options and groups.
     *
     * Supported shapes (examples):
     * - `{ object: [...], page?, totalPages?, hasMore? }`
     * - `{ data: [...], page?, totalPages?, hasMore? }`
     * - `{ items: [...], pagination: { page, totalPages, hasMore } }`
     * - `[...]` (array of items)
     *
     * Each item can represent either:
     * - An option: `{ type: "option", value, text, selected?, data? }`
     * - A group: `{ type: "optgroup", label, data?, options: [...] }`
     *
     * @param data - Server response (any shape).
     * @returns `{ items, hasPagination, page, totalPages, hasMore }`
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
     * Applies normalized AJAX results to the underlying <select> element.
     *
     * Behavior:
     * - Optionally preserves existing selections (`keepSelected`)
     * - Clears existing children unless `append` is true
     * - Supports adding either normalized items or raw HTMLOption/HTMLOptGroup elements
     *
     * @param items - Normalized items (or raw HTMLOption/HTMLOptGroup).
     * @param keepSelected - Preserve previously selected options.
     * @param append - Append to existing options instead of replacing.
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
     *
     * Notes:
     * - In-flight requests are not aborted here; consumers should abort if needed before destroy.
     * - The linked Popup/ModelManager exist outside this controller and are not destroyed here.
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