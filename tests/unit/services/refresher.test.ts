/**
 * @jest-environment jsdom
 *
 * Refresher.resizeBox unit tests
 * Focus:
 * - no-op when binder map/options missing
 * - offset size -> width/height
 * - computedStyle fallback when offset=0 and computed != auto
 * - options width/height override when parseInt > 0
 * - minWidth/minHeight always applied (when options exist)
 */

import { Refresher } from "src/ts/services/refresher";

// Mock Libs.getBinderMap
const getBinderMapMock = jest.fn();

jest.mock("src/ts/utils/libs", () => ({
    Libs: {
        getBinderMap: (...args: any[]) => getBinderMapMock(...args),
    },
}));

describe("Refresher.resizeBox", () => {
    let select: HTMLSelectElement;
    let view: HTMLDivElement;

    beforeEach(() => {
        jest.clearAllMocks();

        select = document.createElement("select");
        view = document.createElement("div");

        // Default computed style: auto (so fallback shouldn't kick in unless we override)
        jest.spyOn(window, "getComputedStyle").mockImplementation(() => {
            return { width: "auto", height: "auto" } as any;
        });

        // Default offsets (jsdom often 0 by default; we will define per-test)
        Object.defineProperty(select, "offsetWidth", {
            configurable: true,
            value: 120,
        });
        Object.defineProperty(select, "offsetHeight", {
            configurable: true,
            value: 40,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("no-op when binder map is missing", () => {
        getBinderMapMock.mockReturnValue(null);

        Refresher.resizeBox(select, view);

        // style should remain untouched
        expect(view.style.width).toBe("");
        expect(view.style.height).toBe("");
        expect(view.style.minWidth).toBe("");
        expect(view.style.minHeight).toBe("");
    });

    test("no-op when binder map has no options", () => {
        getBinderMapMock.mockReturnValue({ options: null });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("");
        expect(view.style.height).toBe("");
    });

    test("uses offsetWidth/offsetHeight when config width/height invalid or not set", () => {
        getBinderMapMock.mockReturnValue({
            options: {
                width: "", // parseInt => NaN
                height: "0", // parseInt => 0 (not > 0)
                minWidth: "10px",
                minHeight: "20px",
            },
        });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("120px");
        expect(view.style.height).toBe("40px");
        expect(view.style.minWidth).toBe("10px");
        expect(view.style.minHeight).toBe("20px");
    });

    test("falls back to computedStyle when offset is 0px and computed style is not auto", () => {
        Object.defineProperty(select, "offsetWidth", {
            configurable: true,
            value: 0,
        });
        Object.defineProperty(select, "offsetHeight", {
            configurable: true,
            value: 0,
        });

        (window.getComputedStyle as any).mockReturnValue({
            width: "333px",
            height: "44px",
        });

        getBinderMapMock.mockReturnValue({
            options: {
                width: "", // not overriding
                height: "", // not overriding
                minWidth: "1px",
                minHeight: "2px",
            },
        });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("333px");
        expect(view.style.height).toBe("44px");
        expect(view.style.minWidth).toBe("1px");
        expect(view.style.minHeight).toBe("2px");
    });

    test("does NOT fallback to computedStyle when computed style is auto (keeps 0px)", () => {
        Object.defineProperty(select, "offsetWidth", {
            configurable: true,
            value: 0,
        });
        Object.defineProperty(select, "offsetHeight", {
            configurable: true,
            value: 0,
        });

        (window.getComputedStyle as any).mockReturnValue({
            width: "auto",
            height: "auto",
        });

        getBinderMapMock.mockReturnValue({
            options: {
                width: "",
                height: "",
                minWidth: "0",
                minHeight: "0",
            },
        });

        Refresher.resizeBox(select, view);

        // remains "0px" (no fallback)
        expect(view.style.width).toBe("0px");
        expect(view.style.height).toBe("0px");
    });

    test("options.width/height override offsets when parseInt(...) > 0", () => {
        getBinderMapMock.mockReturnValue({
            options: {
                width: "250px", // parseInt => 250 > 0 => override
                height: "60px", // parseInt => 60 > 0 => override
                minWidth: "100px",
                minHeight: "10px",
            },
        });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("250px");
        expect(view.style.height).toBe("60px");
        expect(view.style.minWidth).toBe("100px");
        expect(view.style.minHeight).toBe("10px");
    });

    test("width override only (height uses offset/computed path)", () => {
        // offsetHeight non-zero => should use offsetHeight
        Object.defineProperty(select, "offsetWidth", {
            configurable: true,
            value: 80,
        });
        Object.defineProperty(select, "offsetHeight", {
            configurable: true,
            value: 22,
        });

        getBinderMapMock.mockReturnValue({
            options: {
                width: "300px", // override
                height: "0", // parseInt => 0 => no override
                minWidth: "",
                minHeight: "",
            },
        });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("300px");
        expect(view.style.height).toBe("22px");
    });

    test("height override only (width uses offset/computed path)", () => {
        Object.defineProperty(select, "offsetWidth", {
            configurable: true,
            value: 90,
        });
        Object.defineProperty(select, "offsetHeight", {
            configurable: true,
            value: 10,
        });

        getBinderMapMock.mockReturnValue({
            options: {
                width: "0", // no override
                height: "77px", // override
                minWidth: "",
                minHeight: "",
            },
        });

        Refresher.resizeBox(select, view);

        expect(view.style.width).toBe("90px");
        expect(view.style.height).toBe("77px");
    });
});