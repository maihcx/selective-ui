import { ResizeObserverService } from "../../../src/ts/services/resize-observer";

describe("ResizeObserverService", () => {
    let service: ResizeObserverService;
    let originalResizeObserver: typeof ResizeObserver | undefined;
    let originalMutationObserver: typeof MutationObserver | undefined;
    let originalVisualViewport: VisualViewport | undefined;

    beforeEach(() => {
        service = new ResizeObserverService();

        originalResizeObserver = global.ResizeObserver;
        originalMutationObserver = global.MutationObserver;
        originalVisualViewport = window.visualViewport;

        global.ResizeObserver = jest.fn(() => ({
            observe: jest.fn(),
            disconnect: jest.fn()
        })) as unknown as typeof ResizeObserver;

        global.MutationObserver = jest.fn(() => ({
            observe: jest.fn(),
            disconnect: jest.fn()
        })) as unknown as typeof MutationObserver;

        delete (window as any).visualViewport;

        jest.spyOn(window, "addEventListener");
        jest.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
        global.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
        global.MutationObserver = originalMutationObserver as typeof MutationObserver;
        window.visualViewport = originalVisualViewport as VisualViewport;

        jest.restoreAllMocks();
    });

    test("constructor initializes service", () => {
        expect(service.isInit).toBe(true);
    });

    test("trigger emits default metrics when element is null", () => {
        const spy = jest.spyOn(service, "onChanged");

        service.trigger();

        expect(spy).toHaveBeenCalledWith({
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            border: { top: 0, right: 0, bottom: 0, left: 0 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
    });

    test("trigger emits default metrics when element has no getBoundingClientRect", () => {
        const spy = jest.spyOn(service, "onChanged");

        service.element = {} as HTMLElement;
        service.trigger();

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].width).toBe(0);
    });

    test("trigger computes metrics when element is valid", () => {
        const div = document.createElement("div");

        jest.spyOn(div, "getBoundingClientRect").mockReturnValue({
            width: 100,
            height: 50,
            top: 10,
            left: 20,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({})
        } as DOMRect);

        jest.spyOn(window, "getComputedStyle").mockReturnValue({
            paddingTop: "1px",
            paddingRight: "2px",
            paddingBottom: "3px",
            paddingLeft: "4px",
            borderTopWidth: "5px",
            borderRightWidth: "6px",
            borderBottomWidth: "7px",
            borderLeftWidth: "8px",
            marginTop: "9px",
            marginRight: "10px",
            marginBottom: "11px",
            marginLeft: "12px"
        } as CSSStyleDeclaration);

        const spy = jest.spyOn(service, "onChanged");

        service.element = div;
        service.trigger();

        expect(spy).toHaveBeenCalledWith({
            width: 100,
            height: 50,
            top: 10,
            left: 20,
            padding: { top: 1, right: 2, bottom: 3, left: 4 },
            border: { top: 5, right: 6, bottom: 7, left: 8 },
            margin: { top: 9, right: 10, bottom: 11, left: 12 }
        });
    });

    test("connect throws error when element is invalid", () => {
        expect(() => service.connect(null as unknown as HTMLElement)).toThrow("Invalid element");
        expect(() => service.connect({} as HTMLElement)).toThrow("Invalid element");
    });

    test("connect initializes observers and listeners", () => {
        const div = document.createElement("div");

        service.connect(div);

        expect(global.ResizeObserver).toHaveBeenCalled();
        expect(global.MutationObserver).toHaveBeenCalled();

        expect(window.addEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
            true
        );
        expect(window.addEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function)
        );
    });

    test("connect binds visualViewport listeners when available", () => {
        window.visualViewport = {
            dispatchEvent: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            height: 0,
            width: 0,
            offsetLeft: 0,
            offsetTop: 0,
            scale: 1,
            pageLeft: 0,
            pageTop: 0,
            onresize: null,
            onscroll: null
        };

        const div = document.createElement("div");
        service.connect(div);

        expect(window.visualViewport.addEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function)
        );
        expect(window.visualViewport.addEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function)
        );
    });

    test("disconnect stops observers and removes listeners", () => {
        const div = document.createElement("div");
        service.connect(div);

        service.disconnect();

        expect(window.removeEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
            true
        );
        expect(window.removeEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function)
        );

        expect(service.element).toBeNull();
    });

    test("disconnect is safe to call without connect", () => {
        expect(() => service.disconnect()).not.toThrow();
    });
});