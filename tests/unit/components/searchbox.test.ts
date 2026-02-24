/**
 * @jest-environment jsdom
 *
 * SearchBox unit tests (src/ts/components/searchbox.ts)
 * Goal: maximize branch coverage with stable DOM + Libs mocks.
 */

import type { SelectiveOptions } from "../../../src/ts/types/utils/selective.type";

// ---- Mock Libs used by SearchBox ----
const mountNodeMock = jest.fn();
const randomStringMock = jest.fn();
const stripHtmlMock = jest.fn();

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        mountNode: (...args: any[]) => mountNodeMock(...args),
        randomString: (...args: any[]) => randomStringMock(...args),
        stripHtml: (...args: any[]) => stripHtmlMock(...args),
    },
}));

import { SearchBox } from "../../../src/ts/components/searchbox";

function makeMountResult(options: SelectiveOptions) {
    const root = document.createElement("div");
    root.className = "seui-searchbox hide";

    const input = document.createElement("input");
    input.type = "search";
    input.className = "seui-searchbox-input";
    input.id = "mock-id";
    input.placeholder = options.placeholder ?? "";
    input.setAttribute("role", "searchbox");
    if (options.SEID_LIST)
        input.setAttribute("aria-controls", String(options.SEID_LIST));
    input.setAttribute("aria-autocomplete", "list");

    root.appendChild(input);

    return {
        view: root,
        tags: {
            SearchInput: input,
        },
    };
}

describe("SearchBox", () => {
    const optsSearchable: SelectiveOptions = {
        placeholder: "Search...",
        searchable: true,
        SEID_LIST: "list-id",
    } as any;

    const optsNotSearchable: SelectiveOptions = {
        placeholder: "No search",
        searchable: false,
        SEID_LIST: "list-id",
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Stable helpers
        randomStringMock.mockReturnValue("mock-id");
        stripHtmlMock.mockImplementation((s: string) =>
            s.replace(/<[^>]*>/g, ""),
        );

        // Default mount node returns a root+input structure
        mountNodeMock.mockImplementation(() => makeMountResult(optsSearchable));

        // requestAnimationFrame stub (call immediately)
        (globalThis as any).requestAnimationFrame = (
            cb: FrameRequestCallback,
        ) => {
            cb(0);
            return 0;
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Initialization", () => {
        test("constructor(options) initializes DOM and applies basic attributes", () => {
            const sb = new SearchBox(optsSearchable);

            expect(sb.node).toBeInstanceOf(HTMLDivElement);
            expect(sb.node!.classList.contains("hide")).toBe(true);

            const input = sb.node!.querySelector("input") as HTMLInputElement;
            expect(input).toBeTruthy();
            expect(input.type).toBe("search");
            expect(input.getAttribute("role")).toBe("searchbox");
            expect(input.getAttribute("aria-controls")).toBe("list-id");
            expect(input.getAttribute("aria-autocomplete")).toBe("list");

            // ensure Libs helpers are used
            expect(randomStringMock).toHaveBeenCalled();
            expect(mountNodeMock).toHaveBeenCalled();
        });

        test("constructor(null) stays uninitialized and methods are no-ops", () => {
            const sb = new SearchBox(null);

            expect(sb.node).toBeNull();

            expect(() => sb.show()).not.toThrow();
            expect(() => sb.hide()).not.toThrow();
            expect(() => sb.clear()).not.toThrow();
            expect(() => sb.setPlaceHolder("x")).not.toThrow();
            expect(() => sb.setActiveDescendant("id")).not.toThrow();
            expect(() => sb.destroy()).not.toThrow();

            // no DOM was mounted
            expect(mountNodeMock).not.toHaveBeenCalled();
        });
    });

    describe("show/hide branches", () => {
        test("show() no-op when not initialized", () => {
            const sb = new SearchBox(null);

            expect(() => sb.show()).not.toThrow();
        });

        test("show() searchable=true removes hide, sets readOnly=false, focuses via rAF", () => {
            mountNodeMock.mockImplementation(() =>
                makeMountResult(optsSearchable),
            );
            const sb = new SearchBox(optsSearchable);

            // attach to DOM so focus behavior is realistic
            document.body.appendChild(sb.node!);

            const input = sb.node!.querySelector("input") as HTMLInputElement;
            const focusSpy = jest.spyOn(input, "focus");

            sb.show();

            expect(sb.node!.classList.contains("hide")).toBe(false);
            expect(input.readOnly).toBe(false);
            expect(focusSpy).toHaveBeenCalledTimes(1);
        });

        test("show() searchable=false removes hide, sets readOnly=true, does NOT focus", () => {
            mountNodeMock.mockImplementation(() =>
                makeMountResult(optsNotSearchable),
            );
            const sb = new SearchBox(optsNotSearchable);

            document.body.appendChild(sb.node!);
            const input = sb.node!.querySelector("input") as HTMLInputElement;
            const focusSpy = jest.spyOn(input, "focus");

            sb.show();

            expect(sb.node!.classList.contains("hide")).toBe(false);
            expect(input.readOnly).toBe(true);
            expect(focusSpy).not.toHaveBeenCalled();
        });

        test("hide() no-op when not initialized", () => {
            const sb = new SearchBox(null);
            expect(() => sb.hide()).not.toThrow();
        });

        test("hide() adds hide class", () => {
            const sb = new SearchBox(optsSearchable);
            sb.show(); // remove hide first
            expect(sb.node!.classList.contains("hide")).toBe(false);

            sb.hide();
            expect(sb.node!.classList.contains("hide")).toBe(true);
        });
    });

    describe("clear branches", () => {
        test("clear() no-op when not initialized", () => {
            const sb = new SearchBox(null);
            const onSearch = jest.fn();
            sb.onSearch = onSearch;

            sb.clear(); // should no-op
            expect(onSearch).not.toHaveBeenCalled();
        });

        test("clear() default isTrigger=true calls onSearch('', true) and empties input", () => {
            const sb = new SearchBox(optsSearchable);
            const onSearch = jest.fn();
            sb.onSearch = onSearch;

            const input = sb.node!.querySelector("input") as HTMLInputElement;
            input.value = "abc";

            sb.clear(); // default true

            expect(input.value).toBe("");
            expect(onSearch).toHaveBeenCalledWith("", true);
        });

        test("clear(false) calls onSearch('', false)", () => {
            const sb = new SearchBox(optsSearchable);
            const onSearch = jest.fn();
            sb.onSearch = onSearch;

            const input = sb.node!.querySelector("input") as HTMLInputElement;
            input.value = "abc";

            sb.clear(false);

            expect(input.value).toBe("");
            expect(onSearch).toHaveBeenCalledWith("", false);
        });
    });

    describe("placeholder & aria helpers", () => {
        test("setPlaceHolder() no-op when SearchInput is null (uninitialized)", () => {
            const sb = new SearchBox(null);
            expect(() => sb.setPlaceHolder("<b>x</b>")).not.toThrow();
            expect(stripHtmlMock).not.toHaveBeenCalled();
        });

        test("setPlaceHolder() strips HTML and sets placeholder", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            sb.setPlaceHolder("<b>Hello</b> <i>World</i>");

            expect(stripHtmlMock).toHaveBeenCalled();
            expect(input.placeholder).toBe("Hello World");
        });

        test("setActiveDescendant() no-op when SearchInput is null (uninitialized)", () => {
            const sb = new SearchBox(null);
            expect(() => sb.setActiveDescendant("opt-1")).not.toThrow();
        });

        test("setActiveDescendant() sets aria-activedescendant", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            sb.setActiveDescendant("opt-1");

            expect(input.getAttribute("aria-activedescendant")).toBe("opt-1");
        });
    });

    describe("Event model branches", () => {
        test("mousedown/mouseup stopPropagation (no bubbling to parent)", () => {
            const sb = new SearchBox(optsSearchable);

            const parent = document.createElement("div");
            parent.appendChild(sb.node!);
            document.body.appendChild(parent);

            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const parentMouseDown = jest.fn();
            const parentMouseUp = jest.fn();
            parent.addEventListener("mousedown", parentMouseDown);
            parent.addEventListener("mouseup", parentMouseUp);

            input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

            expect(parentMouseDown).not.toHaveBeenCalled();
            expect(parentMouseUp).not.toHaveBeenCalled();
        });

        
        test.each(["ArrowDown", "Tab"] as const)(
            "keydown %s calls onNavigate(+1), prevents default, stops propagation; input after control does NOT trigger onSearch",
            (key) => {
                const sb = new SearchBox(optsSearchable);

                const input = sb.node!.querySelector("input") as HTMLInputElement;
                const onNavigate = jest.fn();
                const onSearch = jest.fn();
                sb.onNavigate = onNavigate;
                sb.onSearch = onSearch;

                // parent should not receive bubbling keydown
                const parent = document.createElement("div");
                parent.appendChild(sb.node!);
                document.body.appendChild(parent);

                const parentKeyDown = jest.fn();
                parent.addEventListener("keydown", parentKeyDown);

                const e = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
                });
                input.dispatchEvent(e);

                // Prevent default & navigate
                expect(e.defaultPrevented).toBe(true);
                expect(onNavigate).toHaveBeenCalledWith(1);

                // Always stopPropagation => parent shouldn't see it
                expect(parentKeyDown).not.toHaveBeenCalled();

                // Subsequent input event should be ignored because isControlKey=true
                input.value = "should-not-search";
                input.dispatchEvent(new Event("input", { bubbles: true }));
                expect(onSearch).not.toHaveBeenCalled();
            }
        );

        test("keydown ArrowUp calls onNavigate(-1)", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const onNavigate = jest.fn();
            sb.onNavigate = onNavigate;

            const e = new KeyboardEvent("keydown", {
                key: "ArrowUp",
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(e);

            expect(e.defaultPrevented).toBe(true);
            expect(onNavigate).toHaveBeenCalledWith(-1);
        });

        test("keydown Enter calls onEnter()", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const onEnter = jest.fn();
            sb.onEnter = onEnter;

            const e = new KeyboardEvent("keydown", {
                key: "Enter",
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(e);

            expect(e.defaultPrevented).toBe(true);
            expect(onEnter).toHaveBeenCalledTimes(1);
        });

        test("keydown Escape calls onEsc()", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const onEsc = jest.fn();
            sb.onEsc = onEsc;

            const e = new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(e);

            expect(e.defaultPrevented).toBe(true);
            expect(onEsc).toHaveBeenCalledTimes(1);
        });
        
        test("keydown non-control key only stops propagation (no preventDefault), and input triggers onSearch", () => {
            const sb = new SearchBox(optsSearchable);

            const input = sb.node!.querySelector("input") as HTMLInputElement;
            const onNavigate = jest.fn();
            const onEnter = jest.fn();
            const onEsc = jest.fn();
            const onSearch = jest.fn();

            sb.onNavigate = onNavigate;
            sb.onEnter = onEnter;
            sb.onEsc = onEsc;
            sb.onSearch = onSearch;

            const parent = document.createElement("div");
            parent.appendChild(sb.node!);
            document.body.appendChild(parent);

            const parentKeyDown = jest.fn();
            parent.addEventListener("keydown", parentKeyDown);

            const e = new KeyboardEvent("keydown", {
                key: "a",
                bubbles: true,
                cancelable: true,
            });
            input.dispatchEvent(e);

            // Should not prevent default for non-control keys
            expect(e.defaultPrevented).toBe(false);

            // Should not call control hooks
            expect(onNavigate).not.toHaveBeenCalled();
            expect(onEnter).not.toHaveBeenCalled();
            expect(onEsc).not.toHaveBeenCalled();

            // stopPropagation always => parent should not see keydown
            expect(parentKeyDown).not.toHaveBeenCalled();

            // Now input should trigger onSearch because isControlKey=false
            input.value = "hello";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            expect(onSearch).toHaveBeenCalledWith("hello", true);
        });

        test("input event (non-control) triggers onSearch(value, true)", () => {
            const sb = new SearchBox(optsSearchable);
            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const onSearch = jest.fn();
            sb.onSearch = onSearch;

            input.value = "hello";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            expect(onSearch).toHaveBeenCalledWith("hello", true);
        });
    });

    describe("destroy (FSM/idempotency)", () => {
        test("destroy removes node from DOM and is idempotent", () => {
            const sb = new SearchBox(optsSearchable);
            document.body.appendChild(sb.node!);

            const input = sb.node!.querySelector("input") as HTMLInputElement;

            const onSearch = jest.fn();
            const onNavigate = jest.fn();
            const onEnter = jest.fn();
            const onEsc = jest.fn();
            sb.onSearch = onSearch;
            sb.onNavigate = onNavigate;
            sb.onEnter = onEnter;
            sb.onEsc = onEsc;

            // pre-check: node exists in DOM
            expect(document.body.contains(sb.node!)).toBe(true);

            sb.destroy();

            // node removed
            expect(document.body.contains(sb.node as any)).toBe(false);
            expect(sb.node).toBeNull();

            // calling destroy again should be no-op (no throw)
            expect(() => sb.destroy()).not.toThrow();

            // After destroy, events should not call handlers because refs were nulled
            // (input is detached, but still dispatchable; handlers exist on element, yet callbacks in instance are null)
            input.value = "x";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            expect(onSearch).not.toHaveBeenCalled();
            expect(onNavigate).not.toHaveBeenCalled();
            expect(onEnter).not.toHaveBeenCalled();
            expect(onEsc).not.toHaveBeenCalled();
        });
    });
});
