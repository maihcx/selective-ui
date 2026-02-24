/**
 * Unit Tests for SearchController
 */

import { SearchController } from "../../../src/ts/core/search-controller";
import { ModelManager } from "../../../src/ts/core/model-manager";
import { MixedAdapter } from "../../../src/ts/adapter/mixed-adapter";
import { RecyclerView } from "../../../src/ts/core/base/recyclerview";
import { Libs } from "../../../src/ts/utils/libs";
import { AjaxConfig } from "src/ts/types/core/search-controller.type";

describe("SearchController", () => {
    let controller: SearchController;
    let abortSpy: jest.Mock;

    function createController(
        select: HTMLSelectElement,
        selectBoxOverride: any = null,
    ) {
        const mm = new ModelManager({});
        mm.setupAdapter(MixedAdapter);
        mm.setupRecyclerView(RecyclerView);
        mm.createModelResources(Libs.parseSelectToArray(select));

        const defaultSelectBoxStub = {
            container: { targetElement: select },
            Selective: { find: jest.fn(() => ({})) },
        };

        return new SearchController(
            select,
            mm,
            selectBoxOverride ?? defaultSelectBoxStub,
        );
    }

    beforeEach(() => {
        const select = createSelect({
            id: "search-select",
            options: [
                { value: "1", text: "Apple" },
                { value: "2", text: "Banana" },
                { value: "3", text: "Cherry" },
            ],
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
                { value: "2", text: "Chuối" },
            ],
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

        abortSpy = jest.fn();

        global.AbortController = jest.fn(() => ({
            signal: {},
            abort: abortSpy,
        })) as any;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("ajax POST request", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [{ value: "1", text: "X" }] }),
        });

        controller.setAjax({
            url: "/api/search",
            method: "POST",
            data: { foo: "bar" },
        });

        await controller.search("x");

        expect(fetch).toHaveBeenCalledWith(
            "/api/search",
            expect.objectContaining({
                method: "POST",
                body: expect.any(URLSearchParams),
            }),
        );
    });

    test("ajax GET request", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [] }),
        });

        controller.setAjax({ url: "/api/search", method: "GET" });
        await controller.search("x");

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/search?"),
            expect.objectContaining({ signal: expect.any(Object) }),
        );
    });

    test("ajax handles missing data field", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({}),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(false);
    });

    test("ajax allows non-array data (treated as empty)", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: "invalid" }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(false);
    });

    test("ajax handles JSON parse error", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => {
                throw new Error("Invalid JSON");
            },
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid JSON");
    });

    test("ajax handles fetch error", async () => {
        (global.fetch as jest.Mock).mockRejectedValue(
            new Error("Network error"),
        );

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toContain("Network error");
    });

    test("ajax aborts previous request (deterministic)", async () => {
        // capture abort functions per controller instance
        const abortFns: jest.Mock[] = [];

        (global as any).AbortController = jest.fn(() => {
            const abort = jest.fn();
            abortFns.push(abort);
            return { signal: {}, abort };
        });

        // deferred promises to keep fetch #1 pending
        let resolve1!: (v: any) => void;
        let resolve2!: (v: any) => void;

        const p1 = new Promise((res) => (resolve1 = res));
        const p2 = new Promise((res) => (resolve2 = res));

        (global.fetch as jest.Mock)
            .mockReturnValueOnce(p1)
            .mockReturnValueOnce(p2);

        controller.setAjax({ url: "/api/search", method: "GET" } as any);

        // start first request (do not await)
        const s1 = controller.search("a");
        // allow async function to run until first await(fetch)
        await Promise.resolve();

        // start second request
        const s2 = controller.search("b");
        await Promise.resolve();

        // two controllers created
        expect(global.AbortController).toHaveBeenCalledTimes(2);

        // second search should abort the first controller
        expect(abortFns[0]).toHaveBeenCalledTimes(1);

        // finish both fetch calls so promises resolve
        resolve1({ json: async () => ({ data: [] }) });
        resolve2({ json: async () => ({ data: [] }) });

        await Promise.all([s1, s2]);
    });

    test("pagination enabled when totalPages > 1", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 0,
                totalPages: 3,
            }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("x");

        expect(result.hasPagination).toBe(true);
        expect(result.hasMore).toBe(true);
    });

    test("loadMore loads next page", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 1,
                totalPages: 3,
            }),
        });

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");

        const result = await controller.loadMore();
        expect(result.success).toBe(true);
        expect(result.currentPage).toBe(1);
    });

    test("loadMore fails when no more pages", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "X" }],
                page: 2,
                totalPages: 3,
            }),
        });

        controller.setAjax({ url: "/api/search" });
        await controller.search("x");
        await controller.loadMore();
        await controller.loadMore();

        const result = await controller.loadMore();
        expect(result.success).toBe(false);
    });

    test("loadMore fails when pagination disabled", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [] }),
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
        (global.fetch as jest.Mock).mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () => resolve({ json: async () => ({ data: [] }) }),
                        100,
                    ),
                ),
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
        (global.fetch as jest.Mock).mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () => resolve({ json: async () => ({ data: [] }) }),
                        50,
                    ),
                ),
        );

        controller.setAjax({ url: "/api/search" });
        controller.search("x");

        controller.resetPagination();
        const state = controller.getPaginationState();

        expect(state.currentPage).toBe(0);
    });

    test("search returns error when ajax enabled but no url", async () => {
        controller.setAjax({} as AjaxConfig);

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
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "A" }],
            }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.hasPagination).toBe(false);
    });

    test("resetPagination during loading does not throw", async () => {
        (global.fetch as jest.Mock).mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () => resolve({ json: async () => ({ data: [] }) }),
                        50,
                    ),
                ),
        );

        controller.setAjax({ url: "/api/search" });

        controller.search("x");
        expect(() => controller.resetPagination()).not.toThrow();
    });

    test("ajax supports root array response", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => [{ value: "1", text: "A" }],
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
        expect(result.hasResults).toBe(true);
    });

    test("ajax supports data.object response", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                object: [{ value: "1", text: "A" }],
                page: 0,
                totalPages: 1,
            }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
    });

    test("ajax supports items with pagination object", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                items: [{ value: "1", text: "A" }],
                pagination: {
                    page: 0,
                    totalPages: 2,
                },
            }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.hasPagination).toBe(true);
        expect(result.hasMore).toBe(true);
    });

    test("ajax parses optgroup response", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [
                    {
                        label: "Group A",
                        options: [{ value: "1", text: "A" }],
                    },
                ],
            }),
        });

        controller.setAjax({ url: "/api/search" });
        const result = await controller.search("a");

        expect(result.success).toBe(true);
    });

    test("ajax keeps selected options when keepSelected=true", async () => {
        const select = createSelect({
            options: [{ value: "1", text: "A", selected: true }],
        });

        controller = createController(select);

        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "1", text: "A" }],
            }),
        });

        controller.setAjax({ url: "/api/search", keepSelected: true });
        await controller.search("a");

        expect(select.options[0].selected).toBe(true);
    });

    test("ajax supports data as function", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [] }),
        });

        controller.setAjax({
            url: "/api/search",
            data: (keyword, page) => ({ q: keyword, page }),
        });

        await controller.search("x");

        expect(fetch).toHaveBeenCalled();
    });

    test("ajax returns aborted result on AbortError", async () => {
        const abortError = new Error("aborted");
        abortError.name = "AbortError";

        (global.fetch as jest.Mock).mockRejectedValue(abortError);

        controller.setAjax({ url: "/api/search" });

        const result = await controller.search("x");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Request aborted");
    });

    let select: HTMLSelectElement;
    beforeEach(() => {
        // tạo select đơn giản (dùng helper createSelect của bạn nếu đã có sẵn)
        select = createSelect({
            id: "search-select",
            options: [
                { value: "1", text: "Apple", selected: true },
                { value: "2", text: "Banana" },
            ],
        });

        controller = createController(select);

        global.fetch = jest.fn();
        // AbortController mock (để ajaxSearch không crash)
        (global as any).AbortController = jest.fn(() => ({
            signal: {},
            abort: jest.fn(),
        }));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("loadByValues: returns failure when ajax not configured", async () => {
        const result = await controller.loadByValues(["1"]);
        expect(result.success).toBe(false);
        expect(result.items).toEqual([]);
        expect(result.message).toContain("Ajax not configured");
        expect(fetch).not.toHaveBeenCalled();
    });

    test("loadByValues: empty values returns success with empty items and does not fetch", async () => {
        controller.setAjax({ url: "/api/search" } as any);
        const result = await controller.loadByValues([]);
        expect(result.success).toBe(true);
        expect(result.items).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    test("loadByValues: uses dataByValues(values[]) when provided (GET)", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ value: "9", text: "X" }] }),
        });

        const dataByValues = jest.fn((values: string[]) => ({
            values: values.join("|"),
            foo: "bar",
        }));

        controller.setAjax({
            url: "/api/search",
            method: "GET",
            dataByValues,
            data: { base: "1" },
        } as any);

        const result = await controller.loadByValues(["1", "2"]);

        expect(result.success).toBe(true);
        expect(dataByValues).toHaveBeenCalledWith(["1", "2"]);

        // ✅ GET path calls fetch(url) with ONE argument
        expect(fetch).toHaveBeenCalledTimes(1);
        expect((fetch as jest.Mock).mock.calls[0]).toHaveLength(1);

        const url = (fetch as jest.Mock).mock.calls[0][0] as string;
        expect(url).toContain("/api/search?");
        expect(url).toContain("values=1%7C2");
        expect(url).toContain("foo=bar");
    });

    test("loadByValues: default payload uses cfg.data function bound to Selective.find(...) (POST)", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ value: "1", text: "Loaded" }] }),
        });

        const ctxObj = { ctx: 1 };
        let seenThis: any = null;

        const dataFn = function (_keyword: string, _page: number) {
            // should be bound to ctxObj
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            seenThis = this;
            return { extra: "ok" };
        };

        const selectBoxStub = {
            container: { targetElement: select },
            Selective: { find: jest.fn(() => ctxObj) },
        };

        controller = createController(select, selectBoxStub);

        controller.setAjax({
            url: "/api/search",
            method: "POST",
            data: dataFn,
        } as any);

        const result = await controller.loadByValues(["A", "B"]);

        expect(result.success).toBe(true);
        expect(seenThis).toBe(ctxObj);

        // POST body should include values and load_by_values
        expect(fetch).toHaveBeenCalledWith(
            "/api/search",
            expect.objectContaining({
                method: "POST",
                body: expect.any(URLSearchParams),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }),
        );

        const body = (fetch as jest.Mock).mock.calls[0][1]
            .body as URLSearchParams;
        expect(body.get("values")).toBe("A,B");
        expect(body.get("load_by_values")).toBe("1");
        expect(body.get("extra")).toBe("ok");
    });

    test("loadByValues: response.ok=false returns success=false and message contains status", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        controller.setAjax({ url: "/api/search", method: "GET" } as any);

        const result = await controller.loadByValues("1");
        expect(result.success).toBe(false);
        expect(result.items).toEqual([]);
        expect(result.message).toContain("HTTP error");
        expect(result.message).toContain("500");
    });

    test("ajaxSearch: calls popup.showLoading/hideLoading when popup is set (success path)", async () => {
        const popup = {
            showLoading: jest.fn(),
            hideLoading: jest.fn(),
        } as any;
        controller.setPopup(popup);

        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [{ value: "7", text: "Z" }] }),
        });

        controller.setAjax({ url: "/api/search", method: "GET" } as any);

        const res = await controller.search("z");
        expect(res.success).toBe(true);
        expect(popup.showLoading).toHaveBeenCalledTimes(1);
        expect(popup.hideLoading).toHaveBeenCalledTimes(1);
    });

    test("ajaxSearch: cfg.data function without selectedValue gets selectedValue auto-injected", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ data: [] }),
        });

        const ctxObj = {};
        const selectBoxStub = {
            container: { targetElement: select },
            Selective: { find: jest.fn(() => ctxObj) },
        };

        controller = createController(select, selectBoxStub);

        const dataFn = jest.fn((_keyword: string, _page: number) => ({
            q: "x",
            page: 0,
        })); // no selectedValue

        controller.setAjax({
            url: "/api/search",
            method: "GET",
            data: dataFn,
        } as any);

        await controller.search("x");

        // fetch url should include selectedValue=<selectedOptionValue>
        const url = (fetch as jest.Mock).mock.calls[0][0] as string;
        expect(url).toContain("selectedValue=1"); // option "1" selected in beforeEach
    });

    test("ajaxSearch: non-AbortError returns success=false and hideLoading is called", async () => {
        const popup = {
            showLoading: jest.fn(),
            hideLoading: jest.fn(),
        } as any;
        controller.setPopup(popup);

        (global.fetch as jest.Mock).mockRejectedValue(new Error("Boom"));

        controller.setAjax({ url: "/api/search", method: "GET" } as any);
        const res = await controller.search("x");

        expect(res.success).toBe(false);
        expect(res.message).toContain("Boom");
        expect(popup.showLoading).toHaveBeenCalledTimes(1);
        expect(popup.hideLoading).toHaveBeenCalledTimes(1);
    });

    test("applyAjaxResult: skips empty option item (value/text empty)", () => {
        // start with empty select
        select.innerHTML = "";

        controller.applyAjaxResult(
            [{ type: "option", value: "", text: "" }] as any,
            false,
            false,
        );

        expect(select.options.length).toBe(0);
    });

    test("applyAjaxResult: append=false replaces existing options; append=true preserves existing", () => {
        select.innerHTML = `<option value="old">Old</option>`;

        // replace
        controller.applyAjaxResult(
            [{ type: "option", value: "new1", text: "New1" }] as any,
            false,
            false,
        );
        expect(Array.from(select.options).map((o) => o.value)).toEqual([
            "new1",
        ]);

        // append
        controller.applyAjaxResult(
            [{ type: "option", value: "new2", text: "New2" }] as any,
            false,
            true,
        );
        expect(Array.from(select.options).map((o) => o.value)).toEqual([
            "new1",
            "new2",
        ]);
    });

    test("applyAjaxResult: supports raw HTMLOptionElement and HTMLOptGroupElement passthrough", () => {
        select.innerHTML = "";

        const opt = document.createElement("option");
        opt.value = "dom1";
        opt.text = "DOM1";

        const group = document.createElement("optgroup");
        group.label = "G";
        const opt2 = document.createElement("option");
        opt2.value = "dom2";
        opt2.text = "DOM2";
        group.appendChild(opt2);

        controller.applyAjaxResult([opt as any, group as any], false, false);

        expect(select.querySelector('option[value="dom1"]')).toBeTruthy();
        expect(
            select.querySelector('optgroup[label="G"] option[value="dom2"]'),
        ).toBeTruthy();
    });

    test("applyAjaxResult: optgroup + data datasets + keepSelected", () => {
        // IMPORTANT: allow multiple selected, otherwise v2.selected=true will deselect keep
        select.multiple = true;

        // Setup a reliably selected option in JSDOM
        select.innerHTML = "";
        const keep = new Option("Keep", "keep", true, true);
        select.appendChild(keep);

        // Optional but sometimes helps jsdom reflect selectedOptions
        document.body.appendChild(select);

        expect(
            Array.from(select.selectedOptions).map((o) => o.value),
        ).toContain("keep");

        controller.applyAjaxResult(
            [
                {
                    type: "optgroup",
                    label: "Group A",
                    data: { gid: 123 },
                    options: [
                        {
                            value: "keep",
                            text: "Keep",
                            selected: false,
                            data: { x: 1 },
                        },
                        {
                            value: "v2",
                            text: "V2",
                            selected: true,
                            data: { y: 2 },
                        },
                    ],
                },
            ] as any,
            true,
            false,
        );

        const og = select.querySelector("optgroup") as HTMLOptGroupElement;
        expect(og).toBeTruthy();
        expect(og.label).toBe("Group A");
        expect(og.dataset.gid).toBe("123");

        const keepOpt = select.querySelector(
            'option[value="keep"]',
        ) as HTMLOptionElement;
        const v2Opt = select.querySelector(
            'option[value="v2"]',
        ) as HTMLOptionElement;

        // Now both can be selected
        expect(keepOpt.selected).toBe(true); // preserved by keepSelected
        expect(v2Opt.selected).toBe(true); // selected from payload

        expect(keepOpt.dataset.x).toBe("1");
        expect(v2Opt.dataset.y).toBe("2");
    });

    test("ajaxSearch normalize imgsrc -> dataset.imgsrc after apply", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: async () => ({
                data: [{ value: "i1", text: "Img", imgsrc: "a.png" }],
            }),
        });

        controller.setAjax({ url: "/api/search", method: "GET" } as any);

        await controller.search("img");

        const opt = select.querySelector(
            'option[value="i1"]',
        ) as HTMLOptionElement;
        expect(opt).toBeTruthy();
        expect(opt.dataset.imgsrc).toBe("a.png");
    });

    test("loadMore: returns 'Pagination not enabled' when ajax configured but pagination disabled", async () => {
        controller.setAjax({ url: "/api/search" } as any);

        // ensure default pagination disabled
        const res = await controller.loadMore();
        expect(res.success).toBe(false);
        expect(res.message).toContain("Pagination not enabled");
    });
});
