/**
 * Unit Tests for SearchController
 */

describe("SearchController", () => {
    const { SearchController } = require("../../../src/js/core/search-controller");
    const { ModelManager } = require("../../../src/js/core/model-manager");
    const { MixedAdapter } = require("../../../src/js/adapter/mixed-adapter");
    const { RecyclerView } = require("../../../src/js/core/base/recyclerview");
    const { Libs } = require("../../../src/js/utils/libs");

    /** @type {SearchController} */
    let controller;

    function createController(select) {
        const mm = new ModelManager({});
        mm.setupAdapter(MixedAdapter);
        mm.setupRecyclerView(RecyclerView);
        mm.createModelResources(Libs.parseSelectToArray(select));
        return new SearchController(select, mm);
    }

    beforeEach(() => {
        const select = createSelect({
            id: "search-select",
            options: [
                { value: "1", text: "Apple" },
                { value: "2", text: "Banana" },
                { value: "3", text: "Cherry" }
            ]
        });

        controller = createController(select);
    });

    test("initial state without ajax", () => {
        expect(controller.isAjax()).toBe(false);
        const state = controller.getPaginationState();
        expect(state.currentPage).toBe(0);
        expect(state.totalPages).toBe(1);
    });

    test("enable ajax mode", () => {
        controller.setAjax({ url: "/api/search" });
        expect(controller.isAjax()).toBe(true);
    });

    test("local search finds matching items", async () => {
        const result = await controller.search("ban");
        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(true);
    });

    test("local search returns no results", async () => {
        const result = await controller.search("xyz");
        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(false);
    });

    test("local search with empty keyword shows all", async () => {
        const result = await controller.search("");
        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(true);
    });

    test("local search handles vietnamese accents", async () => {
        const select = createSelect({
            options: [
                { value: "1", text: "Táo" },
                { value: "2", text: "Chuối" }
            ]
        });

        const c = createController(select);
        const result = await c.search("tao");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(true);
    });

    test("local search safely handles option without text", async () => {
        const select = document.createElement("select");
        const opt = document.createElement("option");
        opt.value = "1";
        select.appendChild(opt);

        const c = createController(select);
        const result = await c.search("test");

        expect(result.success).toBe(true);
    });

    test("search skips when keyword unchanged", async () => {
        const r1 = await controller.search("apple");
        const r2 = await controller.search("apple");

        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
    });

    test("compareSearchTrigger detects change", async () => {
        await controller.search("a");
        expect(controller.compareSearchTrigger("b")).toBe(true);
        expect(controller.compareSearchTrigger("a")).toBe(false);
    });

    test("clear resets keyword and visibility", async () => {
        await controller.search("ban");
        controller.clear();

        const state = controller.getPaginationState();
        expect(state.currentKeyword).toBe("");
    });

    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("ajax POST request", async () => {
        fetch.mockResolvedValue({
            json: async () => ({ data: [{ value: "1", text: "X" }] })
        });

        controller.setAjax({
            url: "/api/search",
            method: "POST",
            data: { foo: "bar" }
        });

        await controller.search("x");

        expect(fetch).toHaveBeenCalledWith(
            "/api/search",
            expect.objectContaining({
                method: "POST",
                body: expect.any(URLSearchParams)
            })
        );
    });

    test("ajax GET request", async () => {
        fetch.mockResolvedValue({
            json: async () => ({ data: [] })
        });

        controller.setAjax({ url: "/api/search", method: "GET" });
        await controller.search("x");

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/search?"),
            expect.objectContaining({ signal: expect.any(Object) })
        );
    });

    test("ajax handles missing data field", async () => {
        fetch.mockResolvedValue({
            json: async () => ({})
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(false);
    });

    test("ajax allows non-array data (treated as empty)", async () => {
        fetch.mockResolvedValue({
            json: async () => ({ data: "invalid" })
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(false);
    });

    test("ajax handles JSON parse error", async () => {
        fetch.mockResolvedValue({
            json: async () => { throw new Error("Invalid JSON"); }
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid JSON");
    });

    test("ajax handles fetch error", async () => {
        fetch.mockRejectedValue(new Error("Network error"));

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toContain("Network error");
    });

    test("ajax aborts previous request", async () => {
        const abortSpy = jest.fn();
        global.AbortController = jest.fn(() => ({
            signal: {},
            abort: abortSpy
        }));

        fetch.mockResolvedValue({
            json: async () => ({ data: [] })
        });

        controller.setAjax({ url: "/api/search", method: "GET" });

        controller.search("a");
        await controller.search("b");

        expect(global.AbortController).toHaveBeenCalledTimes(2);
    });

    test("pagination enabled when totalPages > 1", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 0,
                totalPages: 3
            })
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.hasPagination).toBe(true);
        expect(result.hasMore).toBe(true);
    });

    test("loadMore loads next page", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 1,
                totalPages: 3
            })
        });

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");

        const result = await controller.loadMore();
        expect(result.success).toBe(true);
        expect(result.currentPage).toBe(1);
    });

    test("loadMore fails when no more pages", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 2,
                totalPages: 3
            })
        });

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");
        await controller.loadMore();
        await controller.loadMore();

        const result = await controller.loadMore();
        expect(result.success).toBe(false);
    });

    test("loadMore fails when pagination disabled", async () => {
        fetch.mockResolvedValue({
            json: async () => ({ data: [] })
        });

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");
        controller.resetPagination();

        const result = await controller.loadMore();
        expect(result.success).toBe(false);
    });

    test("loadMore fails when search not called", async () => {
        controller.setAjax({ url: "/api/search" });

        const result = await controller.loadMore();
        expect(result.success).toBe(false);
    });

    test("loadMore blocked while loading", async () => {
        fetch.mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({ json: async () => ({ data: [] }) }), 100)
            )
        );

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");

        controller.loadMore();
        const result = await controller.loadMore();

        expect(result.success).toBe(false);
    });

    test("resetPagination resets state", async () => {
        controller.resetPagination();
        const state = controller.getPaginationState();

        expect(state.currentPage).toBe(0);
        expect(state.currentKeyword).toBe("");
    });

    test("resetPagination during loading is safe", async () => {
        fetch.mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({ json: async () => ({ data: [] }) }), 50)
            )
        );

        controller.setAjax({ url: "/api/search" });
        controller.search("x");

        controller.resetPagination();
        const state = controller.getPaginationState();

        expect(state.currentPage).toBe(0);
    });

    test("search returns error when ajax enabled but no url", async () => {
        controller.setAjax({});

        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(typeof result.message).toBe("string");
    });

    test("loadMore fails when ajax not enabled", async () => {
        const result = await controller.loadMore();

        expect(result.success).toBe(false);
    });

    test("loadMore fails when keyword is empty", async () => {
        controller.setAjax({ url: "/api/search" });

        const result = await controller.loadMore();
        expect(result.success).toBe(false);
    });

    test("ajax response without pagination fields disables pagination", async () => {
    fetch.mockResolvedValue({
        json: async () => ({
            data: [{ value: "1", text: "A" }]
        })
    });

    controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.hasPagination).toBe(false);
    });

    test("resetPagination during loading does not throw", async () => {
        fetch.mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() =>
                    resolve({ json: async () => ({ data: [] }) }), 50)
            )
        );

        controller.setAjax({ url: "/api/search" });

        controller.search("x");
        expect(() => controller.resetPagination()).not.toThrow();
    });

    test("ajax supports root array response", async () => {
        fetch.mockResolvedValue({
            json: async () => ([
                { value: "1", text: "A" }
            ])
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(true);
    });

    test("ajax supports data.object response", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                object: [{ value: "1", text: "A" }],
                page: 0,
                totalPages: 1
            })
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
    });

    test("ajax supports items with pagination object", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                items: [{ value: "1", text: "A" }],
                pagination: {
                    page: 0,
                    totalPages: 2
                }
            })
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.hasPagination).toBe(true);
        expect(result.hasMore).toBe(true);
    });

    test("ajax parses optgroup response", async () => {
        fetch.mockResolvedValue({
            json: async () => ({
                data: [{
                    label: "Group A",
                    options: [
                        { value: "1", text: "A" }
                    ]
                }]
            })
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
    });

    test("ajax keeps selected options when keepSelected=true", async () => {
        const select = createSelect({
            options: [
                { value: "1", text: "A", selected: true }
            ]
        });

        controller = createController(select);

        fetch.mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "A" }]
            })
        });

        controller.setAjax({ url: "/api/search", keepSelected: true });
        await controller.search("a");

        expect(select.options[0].selected).toBe(true);
    });

    test("ajax supports data as function", async () => {
        fetch.mockResolvedValue({
            json: async () => ({ data: [] })
        });

        controller.setAjax({
            url: "/api/search",
            data: (keyword, page) => ({ q: keyword, page })
        });

        await controller.search("x");

        expect(fetch).toHaveBeenCalled();
    });

    test("ajax returns aborted result on AbortError", async () => {
        const abortError = new Error("aborted");
        abortError.name = "AbortError";

        fetch.mockRejectedValue(abortError);

        controller.setAjax({ url: "/api/search" });

        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Request aborted");
    });
});