/**
 * @jest-environment jsdom
 */

import { ResizeObserverService } from "../../../src/ts/services/resize-observer";

describe("ResizeObserverService", () => {
    let service: ResizeObserverService;

    let originalResizeObserver: typeof ResizeObserver | undefined;
    let originalMutationObserver: typeof MutationObserver | undefined;
    let originalVisualViewport: VisualViewport | undefined;

    // Keep spy references for deeper assertions
    let roObserveSpy: jest.Mock;
    let roDisconnectSpy: jest.Mock;
    let moObserveSpy: jest.Mock;
    let moDisconnectSpy: jest.Mock;

    beforeEach(() => {
        service = new ResizeObserverService();

        originalResizeObserver = global.ResizeObserver;
        originalMutationObserver = global.MutationObserver;
        originalVisualViewport = window.visualViewport;

        roObserveSpy = jest.fn();
        roDisconnectSpy = jest.fn();
        moObserveSpy = jest.fn();
        moDisconnectSpy = jest.fn();

        global.ResizeObserver = jest.fn(() => ({
            observe: roObserveSpy,
            disconnect: roDisconnectSpy,
        })) as unknown as typeof ResizeObserver;

        global.MutationObserver = jest.fn(() => ({
            observe: moObserveSpy,
            disconnect: moDisconnectSpy,
        })) as unknown as typeof MutationObserver;

        // Default: no visualViewport unless a test enables it
        delete (window as any).visualViewport;

        jest.spyOn(window, "addEventListener");
        jest.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
        global.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
        global.MutationObserver =
            originalMutationObserver as typeof MutationObserver;
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
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
    });

    test("trigger emits default metrics when element has no getBoundingClientRect", () => {
        const spy = jest.spyOn(service, "onChanged");

        service.element = {} as HTMLElement;
        service.trigger();

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].width).toBe(0);
    });

    test("trigger computes metrics when element is valid (getComputedStyle available)", () => {
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
            toJSON: () => ({}),
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
            marginLeft: "12px",
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
            margin: { top: 9, right: 10, bottom: 11, left: 12 },
        });
    });

    test("trigger computes metrics with style fallback when getComputedStyle is unavailable", () => {
        const div = document.createElement("div");

        jest.spyOn(div, "getBoundingClientRect").mockReturnValue({
            width: 10,
            height: 20,
            top: 1,
            left: 2,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect);

        const spy = jest.spyOn(service, "onChanged");

        // Temporarily disable getComputedStyle to hit the `style = null` branch
        const original = window.getComputedStyle;
        Object.defineProperty(window, "getComputedStyle", {
            value: undefined,
            configurable: true,
        });

        service.element = div;
        service.trigger();

        expect(spy).toHaveBeenCalledWith({
            width: 10,
            height: 20,
            top: 1,
            left: 2,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            border: { top: 0, right: 0, bottom: 0, left: 0 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        // restore
        Object.defineProperty(window, "getComputedStyle", {
            value: original,
            configurable: true,
        });
    });

    test("connect throws error when element is invalid", () => {
        expect(() => service.connect(null as unknown as HTMLElement)).toThrow(
            "Invalid element",
        );
        expect(() => service.connect({} as HTMLElement)).toThrow(
            "Invalid element",
        );
    });

    test("connect initializes observers and listeners", () => {
        const div = document.createElement("div");

        service.connect(div);

        expect(global.ResizeObserver).toHaveBeenCalled();
        expect(global.MutationObserver).toHaveBeenCalled();

        expect(roObserveSpy).toHaveBeenCalledTimes(1);
        expect(roObserveSpy).toHaveBeenCalledWith(div);

        expect(moObserveSpy).toHaveBeenCalledTimes(1);

        expect(window.addEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
            true,
        );
        expect(window.addEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function),
        );
    });

    test("connect sets MutationObserver.observe with attributes + attributeFilter(['style','class'])", () => {
        const div = document.createElement("div");

        service.connect(div);

        expect(moObserveSpy).toHaveBeenCalledTimes(1);
        expect(moObserveSpy).toHaveBeenCalledWith(div, {
            attributes: true,
            attributeFilter: ["style", "class"],
        });
    });

    test("connect binds visualViewport listeners when available", () => {
        const vv = {
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
            onscroll: null,
        } as any;

        window.visualViewport = vv;

        const div = document.createElement("div");
        service.connect(div);

        expect(vv.addEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function),
        );
        expect(vv.addEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
        );
    });

    test("disconnect stops observers and removes listeners", () => {
        const div = document.createElement("div");
        service.connect(div);

        service.disconnect();

        expect(roDisconnectSpy).toHaveBeenCalledTimes(1);
        expect(moDisconnectSpy).toHaveBeenCalledTimes(1);

        expect(window.removeEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
            true,
        );
        expect(window.removeEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function),
        );

        expect(service.element).toBeNull();
    });

    test("disconnect removes visualViewport listeners when available", () => {
        const vv = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
            height: 0,
            width: 0,
            offsetLeft: 0,
            offsetTop: 0,
            scale: 1,
            pageLeft: 0,
            pageTop: 0,
            onresize: null,
            onscroll: null,
        } as any;

        window.visualViewport = vv;

        const div = document.createElement("div");
        service.connect(div);

        service.disconnect();

        expect(vv.removeEventListener).toHaveBeenCalledWith(
            "resize",
            expect.any(Function),
        );
        expect(vv.removeEventListener).toHaveBeenCalledWith(
            "scroll",
            expect.any(Function),
        );
    });

    test("disconnect resets onChanged to no-op (no further emissions)", () => {
        const div = document.createElement("div");

        jest.spyOn(div, "getBoundingClientRect").mockReturnValue({
            width: 1,
            height: 1,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect);

        const spy = jest.spyOn(service, "onChanged");

        service.connect(div);
        service.disconnect();

        // even if element set again, onChanged should now be no-op
        service.element = div;
        service.trigger();

        expect(spy).toHaveBeenCalledTimes(0);
    });

    test("disconnect is safe to call without connect", () => {
        expect(() => service.disconnect()).not.toThrow();
    });
});