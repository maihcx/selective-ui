/**
 * @jest-environment jsdom
 *
 * OptionHandle unit tests (src/ts/components/option-handle.ts)
 *
 * Coverage focus:
 * - available() branches via update(): show vs hide
 * - onSelectAll/onDeSelectAll input validation branches
 * - click handler -> iEvents.callFunctions
 * - destroy() idempotency guard (DESTROYED early return)
 * - show/hide no-op when node is null
 */

import type { SelectiveOptions } from "../../../src/ts/types/utils/selective.type";

// ---- Mocks ----
const mountNodeMock = jest.fn();
const string2BooleanMock = jest.fn();
const callFunctionsMock = jest.fn();

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        mountNode: (...args: any[]) => mountNodeMock(...args),
        string2Boolean: (...args: any[]) => string2BooleanMock(...args),
    },
}));

jest.mock("../../../src/ts/utils/ievents", () => ({
    iEvents: {
        callFunctions: (...args: any[]) => callFunctionsMock(...args),
    },
}));

import { OptionHandle } from "../../../src/ts/components/option-handle";

type MountResult = {
    view: HTMLDivElement;
    tags: {
        SelectAll: HTMLAnchorElement;
        DeSelectAll: HTMLAnchorElement;
    };
};

/**
 * Create minimal DOM structure from the exact config shape
 * OptionHandle passes into Libs.mountNode, and wire onclick handlers.
 */
function makeMountResultFromConfig(config: any): MountResult {
    const rootCfg = config?.OptionHandle?.tag ?? {};
    const selectCfg = config?.OptionHandle?.child?.SelectAll?.tag ?? {};
    const deselectCfg = config?.OptionHandle?.child?.DeSelectAll?.tag ?? {};

    const root = document.createElement(rootCfg.node ?? "div");
    const rootClasses: string[] = Array.isArray(rootCfg.classList)
        ? rootCfg.classList
        : typeof rootCfg.classList === "string"
          ? [rootCfg.classList]
          : [];
    root.className = rootClasses.join(" ");

    const aSelect = document.createElement(selectCfg.node ?? "a");
    if (selectCfg.classList) aSelect.className = String(selectCfg.classList);
    if (selectCfg.textContent != null)
        aSelect.textContent = String(selectCfg.textContent);
    if (typeof selectCfg.onclick === "function")
        aSelect.onclick = selectCfg.onclick;

    const aDeselect = document.createElement(deselectCfg.node ?? "a");
    if (deselectCfg.classList)
        aDeselect.className = String(deselectCfg.classList);
    if (deselectCfg.textContent != null)
        aDeselect.textContent = String(deselectCfg.textContent);
    if (typeof deselectCfg.onclick === "function")
        aDeselect.onclick = deselectCfg.onclick;

    root.appendChild(aSelect);
    root.appendChild(aDeselect);

    return {
        view: root,
        tags: { SelectAll: aSelect, DeSelectAll: aDeselect },
    };
}

describe("OptionHandle", () => {
    const baseOpts: SelectiveOptions = {
        textSelectAll: "Select all",
        textDeselectAll: "Deselect all",
        multiple: true,
        selectall: true,
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default: mountNode returns DOM + correctly wired onclick based on config
        mountNodeMock.mockImplementation((cfg: any) =>
            makeMountResultFromConfig(cfg),
        );

        // Default: string2Boolean behaves like Boolean()
        string2BooleanMock.mockImplementation((v: any) => !!v);

        // Default: callFunctions executes callbacks it receives
        callFunctionsMock.mockImplementation((fns: any[]) => {
            if (Array.isArray(fns)) {
                for (const fn of fns) if (typeof fn === "function") fn();
            }
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Initialization", () => {
        test("constructor(options) initializes DOM and wires click handlers", () => {
            const oh = new OptionHandle(baseOpts);

            expect(mountNodeMock).toHaveBeenCalledTimes(1);
            expect(oh.node).toBeInstanceOf(HTMLDivElement);

            // Root has hide initially
            expect(oh.node!.classList.contains("hide")).toBe(true);

            const anchors = oh.node!.querySelectorAll("a");
            expect(anchors).toHaveLength(2);
            expect((anchors[0] as HTMLAnchorElement).textContent).toBe(
                "Select all",
            );
            expect((anchors[1] as HTMLAnchorElement).textContent).toBe(
                "Deselect all",
            );
        });

        test("constructor(null) stays uninitialized; update/show/hide are safe no-ops", () => {
            const oh = new OptionHandle(null);

            expect(oh.node).toBeNull();
            expect(mountNodeMock).not.toHaveBeenCalled();

            expect(() => oh.update()).not.toThrow();
            expect(() => oh.show()).not.toThrow();
            expect(() => oh.hide()).not.toThrow();

            // IMPORTANT: current implementation throws if destroy() called before init (node is null)
            expect(() => oh.destroy()).toThrow(TypeError);
        });
    });

    describe("available() -> update() branches (show/hide)", () => {
        test("update(): available=true -> show() removes 'hide'", () => {
            // multiple=true && selectall=true
            string2BooleanMock.mockReturnValue(true);

            const oh = new OptionHandle(baseOpts);
            expect(oh.node!.classList.contains("hide")).toBe(true);

            oh.update();

            expect(string2BooleanMock).toHaveBeenCalled();
            expect(oh.node!.classList.contains("hide")).toBe(false);
        });

        test("update(): available=false -> hide() adds 'hide' (short-circuit possible)", () => {
            // Make multiple false => available false
            string2BooleanMock.mockReturnValueOnce(false);

            const oh = new OptionHandle(baseOpts);
            oh.node!.classList.remove("hide");

            oh.update();

            expect(oh.node!.classList.contains("hide")).toBe(true);
        });

        test("update(): options missing -> available() returns false -> hides", () => {
            // cover the `if (!this.options) return false` branch
            const oh = new OptionHandle(baseOpts);

            // simulate corrupted state: node exists but options null
            (oh as any).options = null;

            // remove hide so we can observe hide() is applied
            oh.node!.classList.remove("hide");
            oh.update();

            expect(oh.node!.classList.contains("hide")).toBe(true);
        });

        test("update(): when node is null -> does not throw (no DOM toggling)", () => {
            const oh = new OptionHandle(baseOpts);
            oh.destroy(); // node becomes null, state DESTROYED

            expect(oh.node).toBeNull();
            expect(() => oh.update()).not.toThrow();
        });
    });

    describe("Callbacks registration + click dispatch", () => {
        test("onSelectAll registers only functions; click dispatches via iEvents.callFunctions", () => {
            const oh = new OptionHandle(baseOpts);

            const fn1 = jest.fn();
            const fn2 = jest.fn();

            // ignored
            // @ts-ignore
            oh.onSelectAll("nope");
            oh.onSelectAll(null);

            // accepted
            oh.onSelectAll(fn1);
            oh.onSelectAll(fn2);

            const selectAnchor = oh.node!.querySelectorAll(
                "a",
            )[0] as HTMLAnchorElement;
            selectAnchor.click();

            expect(callFunctionsMock).toHaveBeenCalledTimes(1);
            expect(fn1).toHaveBeenCalledTimes(1);
            expect(fn2).toHaveBeenCalledTimes(1);
        });

        test("onDeSelectAll registers only functions; click dispatches via iEvents.callFunctions", () => {
            const oh = new OptionHandle(baseOpts);

            const fn = jest.fn();

            oh.onDeSelectAll(null);
            oh.onDeSelectAll(fn);

            const deselectAnchor = oh.node!.querySelectorAll(
                "a",
            )[1] as HTMLAnchorElement;
            deselectAnchor.click();

            expect(callFunctionsMock).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test("click dispatch with no registered callbacks still calls callFunctions with empty list", () => {
            callFunctionsMock.mockImplementation(() => {
                /* no-op */
            });

            const oh = new OptionHandle(baseOpts);
            const selectAnchor = oh.node!.querySelectorAll(
                "a",
            )[0] as HTMLAnchorElement;

            selectAnchor.click();

            expect(callFunctionsMock).toHaveBeenCalledTimes(1);

            const arg0 = callFunctionsMock.mock.calls[0][0];
            expect(Array.isArray(arg0)).toBe(true);
            expect(arg0.length).toBe(0);
        });
    });

    describe("show/hide no-ops", () => {
        test("show()/hide() do not throw when node is null (after destroy)", () => {
            const oh = new OptionHandle(baseOpts);
            oh.destroy();

            expect(oh.node).toBeNull();
            expect(() => oh.show()).not.toThrow();
            expect(() => oh.hide()).not.toThrow();
        });
    });

    describe("destroy() FSM/idempotency", () => {
        test("destroy() removes node from DOM, clears refs, and is idempotent", () => {
            const oh = new OptionHandle(baseOpts);
            document.body.appendChild(oh.node!);

            const removeSpy = jest.spyOn(oh.node!, "remove");
            expect(document.body.contains(oh.node!)).toBe(true);

            oh.destroy();

            expect(removeSpy).toHaveBeenCalledTimes(1);
            expect(oh.node).toBeNull();

            // second destroy should early-return because lifecycle is DESTROYED
            expect(() => oh.destroy()).not.toThrow();
            expect(removeSpy).toHaveBeenCalledTimes(1);
        });
    });
});
