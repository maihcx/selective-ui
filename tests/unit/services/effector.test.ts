import { Effector } from "../../../src/ts/services/effector";

describe("Effector", () => {
    beforeAll(() => {
        jest.useFakeTimers();

        global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        }) as typeof requestAnimationFrame;
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    function createElement(): HTMLDivElement {
        const el = document.createElement("div");

        Object.defineProperty(el, "offsetHeight", {
            value: 100,
            configurable: true
        });

        Object.defineProperty(el, "scrollHeight", {
            value: 200,
            configurable: true
        });

        Object.defineProperty(el, "offsetTop", {
            value: 10,
            configurable: true
        });

        el.getBoundingClientRect = () =>
            ({
                width: 300,
                height: 150
            } as DOMRect);

        document.body.appendChild(el);
        return el;
    }

    afterEach(() => {
        document.body.innerHTML = "";
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    test("setElement accepts HTMLElement", () => {
        const el = createElement();
        const eff = Effector();

        eff.setElement(el);

        expect(eff.element).toBe(el);
    });

    test("constructor accepts selector", () => {
        const el = createElement();
        el.id = "target";

        const eff = Effector("#target");

        expect(eff.element).toBe(el);
    });

    test("cancel clears timers and resets isAnimating", () => {
        const el = createElement();
        const eff = Effector(el);

        eff.expand({
            duration: 100,
            width: 100,
            left: 0,
            top: 0,
            maxHeight: 200,
            realHeight: 150
        });

        expect(eff.isAnimating).toBe(true);

        eff.cancel();

        expect(eff.isAnimating).toBe(false);
    });

    test("getHiddenDimensions returns width, height, scrollHeight", () => {
        const el = createElement();
        const eff = Effector(el);

        const dims = eff.getHiddenDimensions("flex");

        expect(dims).toEqual(
            expect.objectContaining({
                width: expect.any(Number),
                height: expect.any(Number),
                scrollHeight: expect.any(Number)
            })
        );
    });

    test("expand sets animating state and calls onComplete", () => {
        const el = createElement();
        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.expand({
            duration: 200,
            width: 100,
            left: 0,
            top: 0,
            maxHeight: 200,
            realHeight: 150,
            onComplete
        });

        expect(eff.isAnimating).toBe(true);

        jest.advanceTimersByTime(200);

        expect(onComplete).toHaveBeenCalled();
        expect(eff.isAnimating).toBe(false);
    });

    test("collapse hides element and calls onComplete", () => {
        const el = createElement();
        el.style.display = "block";

        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.collapse({ duration: 100, onComplete });

        jest.advanceTimersByTime(100);

        expect(el.style.display).toBe("none");
        expect(onComplete).toHaveBeenCalled();
        expect(eff.isAnimating).toBe(false);
    });

    test("showSwipeWidth animates width and completes", () => {
        const el = createElement();
        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.showSwipeWidth({
            duration: 100,
            onComplete
        });

        expect(eff.isAnimating).toBe(true);

        jest.advanceTimersByTime(100);

        expect(onComplete).toHaveBeenCalled();
        expect(eff.isAnimating).toBe(false);
    });

    test("hideSwipeWidth animates width and completes", () => {
        const el = createElement();
        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.hideSwipeWidth({
            duration: 100,
            onComplete
        });

        jest.advanceTimersByTime(100);

        expect(onComplete).toHaveBeenCalled();
        expect(eff.isAnimating).toBe(false);
    });

    test("resize without animation calls onComplete immediately", () => {
        const el = createElement();
        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.resize({
            duration: 200,
            width: 100,
            left: 0,
            top: 0,
            maxHeight: 200,
            realHeight: 150,
            animate: false,
            onComplete
        });

        expect(onComplete).toHaveBeenCalled();
    });

    test("resize with animation calls onComplete after duration", () => {
        const el = createElement();
        const eff = Effector(el);
        const onComplete = jest.fn();

        eff.resize({
            duration: 100,
            width: 100,
            left: 0,
            top: 0,
            maxHeight: 200,
            realHeight: 150,
            animate: true,
            onComplete
        });

        jest.advanceTimersByTime(100);

        expect(onComplete).toHaveBeenCalled();
    });

    test("isAnimating reflects animation state", () => {
        const el = createElement();
        const eff = Effector(el);

        expect(eff.isAnimating).toBe(false);

        eff.expand({
            duration: 100,
            width: 100,
            left: 0,
            top: 0,
            maxHeight: 200,
            realHeight: 150
        });

        expect(eff.isAnimating).toBe(true);

        jest.advanceTimersByTime(100);

        expect(eff.isAnimating).toBe(false);
    });
});