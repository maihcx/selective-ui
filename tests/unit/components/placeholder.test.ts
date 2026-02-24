/**
 * @jest-environment jsdom
 *
 * PlaceHolder unit tests (src/ts/components/placeholder.ts)
 *
 * Coverage focus:
 * - constructor init vs null (no-op)
 * - set() branches: allowHtml true/false, isSave true/false
 * - get() behavior
 * - destroy() idempotency guard
 */

import type { SelectiveOptions } from "../../../src/ts/types/utils/selective.type";

// ---- Mocks for Libs used by PlaceHolder ----
const nodeCreatorMock = jest.fn();
const tagTranslateMock = jest.fn();
const stripHtmlMock = jest.fn();

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        nodeCreator: (...args: any[]) => nodeCreatorMock(...args),
        tagTranslate: (...args: any[]) => tagTranslateMock(...args),
        stripHtml: (...args: any[]) => stripHtmlMock(...args),
    },
}));

import { PlaceHolder } from "../../../src/ts/components/placeholder";

function makeNodeFromConfig(cfg: any): HTMLElement {
    const el = document.createElement(cfg.node ?? "div");
    if (cfg.classList) el.className = String(cfg.classList);
    if (cfg.innerHTML != null) el.innerHTML = String(cfg.innerHTML);
    return el;
}

describe("PlaceHolder", () => {
    const optsNoHtml: SelectiveOptions = {
        placeholder: "Pick one",
        allowHtml: false,
    } as any;

    const optsAllowHtml: SelectiveOptions = {
        placeholder: "<b>Pick</b> one",
        allowHtml: true,
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();

        nodeCreatorMock.mockImplementation((cfg: any) =>
            makeNodeFromConfig(cfg),
        );
        tagTranslateMock.mockImplementation((s: string) => `T(${s})`);
        stripHtmlMock.mockImplementation((s: string) =>
            s.replace(/<[^>]*>/g, ""),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Initialization + get()", () => {
        test("constructor(options) creates node with initial placeholder innerHTML and get() returns options.placeholder", () => {
            const ph = new PlaceHolder(optsNoHtml);

            expect(nodeCreatorMock).toHaveBeenCalledTimes(1);
            expect(nodeCreatorMock).toHaveBeenCalledWith({
                node: "div",
                classList: "seui-placeholder",
                innerHTML: optsNoHtml.placeholder,
            });

            expect(ph.node).toBeInstanceOf(HTMLElement);
            expect(ph.node!.classList.contains("seui-placeholder")).toBe(true);
            expect(ph.node!.innerHTML).toBe(optsNoHtml.placeholder);

            expect(ph.get()).toBe("Pick one");
        });

        test("constructor(null) stays uninitialized: get() returns empty string", () => {
            const ph = new PlaceHolder(null as any);

            expect(ph.node).toBeNull();
            expect(ph.get()).toBe("");
            expect(nodeCreatorMock).not.toHaveBeenCalled();
        });
    });

    describe("set() branches", () => {
        test("set() is no-op when uninitialized (node/options missing)", () => {
            const ph = new PlaceHolder(null as any);
            expect(() => ph.set("X")).not.toThrow();

            expect(tagTranslateMock).not.toHaveBeenCalled();
            expect(stripHtmlMock).not.toHaveBeenCalled();
        });

        test("set(value) default isSave=true persists into options.placeholder", () => {
            const options: SelectiveOptions = {
                placeholder: "A",
                allowHtml: false,
            } as any;
            const ph = new PlaceHolder(options);

            ph.set("NEW");

            // persisted
            expect(options.placeholder).toBe("NEW");
        });

        test("set(value, false) does NOT persist into options.placeholder", () => {
            const options: SelectiveOptions = {
                placeholder: "A",
                allowHtml: false,
            } as any;
            const ph = new PlaceHolder(options);

            ph.set("NEW", false);

            // not persisted
            expect(options.placeholder).toBe("A");
        });

        test("allowHtml=true renders translated HTML as-is (no stripHtml)", () => {
            const options: SelectiveOptions = {
                placeholder: "x",
                allowHtml: true,
            } as any;
            const ph = new PlaceHolder(options);

            ph.set("<b>Hello</b>");

            expect(tagTranslateMock).toHaveBeenCalledWith("<b>Hello</b>");
            expect(stripHtmlMock).not.toHaveBeenCalled();

            // innerHTML should be translated result
            expect(ph.node!.innerHTML).toBe("T(<b>Hello</b>)");
        });

        test("allowHtml=false renders stripHtml(translated)", () => {
            const options: SelectiveOptions = {
                placeholder: "x",
                allowHtml: false,
            } as any;
            const ph = new PlaceHolder(options);

            // stripHtml will remove tags from translated text (mock impl)
            ph.set("<b>Hello</b>");

            expect(tagTranslateMock).toHaveBeenCalledWith("<b>Hello</b>");
            expect(stripHtmlMock).toHaveBeenCalledWith("T(<b>Hello</b>)");

            // With our stripHtml mock, tags are removed:
            // "T(<b>Hello</b>)" -> "T(Hello)"
            expect(ph.node!.innerHTML).toBe("T(Hello)");
        });

        test("allowHtml undefined behaves like false (stripHtml path)", () => {
            const options: SelectiveOptions = { placeholder: "x" } as any; // allowHtml missing
            const ph = new PlaceHolder(options);

            ph.set("<i>Yo</i>");

            expect(tagTranslateMock).toHaveBeenCalledWith("<i>Yo</i>");
            expect(stripHtmlMock).toHaveBeenCalled();
            expect(ph.node!.innerHTML).toBe("T(Yo)");
        });
    });

    describe("destroy() FSM/idempotency", () => {
        test("destroy() removes node and clears refs; second call is no-op", () => {
            const ph = new PlaceHolder(optsAllowHtml);
            document.body.appendChild(ph.node!);

            const removeSpy = jest.spyOn(ph.node!, "remove");
            expect(document.body.contains(ph.node!)).toBe(true);

            ph.destroy();

            expect(removeSpy).toHaveBeenCalledTimes(1);
            expect(ph.node).toBeNull();

            // second destroy should early-return (DESTROYED guard)
            expect(() => ph.destroy()).not.toThrow();
            expect(removeSpy).toHaveBeenCalledTimes(1);
        });
    });
});