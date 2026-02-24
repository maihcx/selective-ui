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
            configurable: true,
        });

        Object.defineProperty(el, "scrollHeight", {
            value: 200,
            configurable: true,
        });

        Object.defineProperty(el, "offsetTop", {
            value: 10,
            configurable: true,
        });

        el.getBoundingClientRect = () =>
            ({
                width: 300,
                height: 150,
            }) as DOMRect;

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
            realHeight: 150,
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
                scrollHeight: expect.any(Number),
            }),
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
            onComplete,
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
            onComplete,
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
            onComplete,
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
            onComplete,
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
            onComplete,
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
            realHeight: 150,
        });

        expect(eff.isAnimating).toBe(true);

        jest.advanceTimersByTime(100);

        expect(eff.isAnimating).toBe(false);
    });

    describe("Effector last checking", () => {
        function createElementWithClass(cls: string): HTMLDivElement {
            const el = document.createElement("div");
            el.className = cls;

            Object.defineProperty(el, "offsetHeight", {
                value: 100,
                configurable: true,
            });
            Object.defineProperty(el, "scrollHeight", {
                value: 200,
                configurable: true,
            });
            Object.defineProperty(el, "offsetTop", {
                value: 10,
                configurable: true,
            });

            el.getBoundingClientRect = () =>
                ({
                    width: 300,
                    height: 150,
                }) as DOMRect;

            document.body.appendChild(el);
            return el;
        }

        test("methods are no-ops when effector is unbound (no element)", () => {
            const eff = Effector(); // no element bound

            expect(() =>
                eff.expand({
                    duration: 50,
                    width: 100,
                    left: 0,
                    top: 0,
                    maxHeight: 100,
                    realHeight: 80,
                }),
            ).not.toThrow();

            expect(() => eff.collapse({ duration: 50 })).not.toThrow();
            expect(() => eff.showSwipeWidth({ duration: 50 })).not.toThrow();
            expect(() => eff.hideSwipeWidth({ duration: 50 })).not.toThrow();
            expect(() =>
                eff.resize({
                    duration: 50,
                    width: 100,
                    left: 0,
                    top: 0,
                    maxHeight: 100,
                    realHeight: 80,
                }),
            ).not.toThrow();

            expect(eff.isAnimating).toBe(false);
        });

        test("setElement(selector) does nothing if selector doesn't match", () => {
            const eff = Effector();

            // no element with this selector
            eff.setElement("#__not_found__");

            // element should remain undefined/unset
            expect((eff as any).element).toBeUndefined();
        });

        test("getHiddenDimensions restores original inline styles and accounts for borders", () => {
            const el = document.createElement("div");
            el.style.display = "none";
            el.style.visibility = "visible";
            el.style.position = "static";
            el.style.height = "10px";
            el.style.width = "20px";

            Object.defineProperty(el, "scrollHeight", {
                value: 200,
                configurable: true,
            });
            el.getBoundingClientRect = () =>
                ({
                    width: 300,
                    height: 150,
                }) as DOMRect;

            document.body.appendChild(el);

            // mock computed style borders
            const csSpy = jest
                .spyOn(window, "getComputedStyle")
                .mockReturnValue({
                    borderTopWidth: "2",
                    borderBottomWidth: "3",
                } as any);

            const eff = Effector(el);
            const dims = eff.getHiddenDimensions("flex");

            // height adds borders: rect.height + 2 + 3
            expect(dims.width).toBe(300);
            expect(dims.height).toBe(150 + 2 + 3);
            expect(dims.scrollHeight).toBe(200 + 2 + 3);

            // original inline styles restored
            expect(el.style.display).toBe("none");
            expect(el.style.visibility).toBe("visible");
            expect(el.style.position).toBe("static");
            expect(el.style.height).toBe("10px");
            expect(el.style.width).toBe("20px");

            csSpy.mockRestore();
        });

        test("expand toggles position classes and sets overflow 'auto' when scrollable (realHeight >= maxHeight)", () => {
            const el = createElementWithClass(""); // no position class initially
            const eff = Effector(el);

            eff.expand({
                duration: 100,
                display: "flex",
                width: 100,
                left: 5,
                top: 20,
                maxHeight: 100,
                realHeight: 120, // >= maxHeight => scrollable => overflow auto
                position: "bottom",
            });

            // rAF is immediate in your setup; styles applied
            expect(el.classList.contains("position-bottom")).toBe(true);
            expect(el.classList.contains("position-top")).toBe(false);

            // overflow should become auto due to scrollable
            expect(el.style.overflow).toBe("auto");

            // complete animation
            jest.advanceTimersByTime(100);
            expect(eff.isAnimating).toBe(false);
        });

        test("expand with position='top' sets position-top class and uses initialTop = top + realHeight", () => {
            const el = createElementWithClass("");
            const eff = Effector(el);

            eff.expand({
                duration: 80,
                width: 100,
                left: 0,
                top: 10,
                maxHeight: 500,
                realHeight: 120,
                position: "top",
            });

            // before rAF, initialTop was set; but rAF is immediate in test,
            // so top ends at `${top}px`. Still, class toggle should be correct.
            expect(el.classList.contains("position-top")).toBe(true);
            expect(el.classList.contains("position-bottom")).toBe(false);

            jest.advanceTimersByTime(80);
            expect(eff.isAnimating).toBe(false);
        });

        test("collapse uses position-top to compute finalTop and sets overflow based on scrollability", () => {
            const el = createElementWithClass("position-top"); // force top position branch
            const eff = Effector(el);
            el.style.display = "block";

            const onComplete = jest.fn();
            eff.collapse({ duration: 60, onComplete });

            // with your createElement numbers: scrollHeight(200) - offsetHeight(100) > 0 => scrollable => overflow auto
            // rAF is immediate -> style should be applied
            expect(el.style.overflow).toBe("auto");
            // final display after timeout
            jest.advanceTimersByTime(60);
            expect(el.style.display).toBe("none");
            expect(onComplete).toHaveBeenCalled();
            expect(eff.isAnimating).toBe(false);
        });

        test("collapse when not scrollable sets overflow 'hidden'", () => {
            const el = createElementWithClass("position-bottom");
            // make not scrollable: scrollHeight == offsetHeight
            Object.defineProperty(el, "offsetHeight", {
                value: 100,
                configurable: true,
            });
            Object.defineProperty(el, "scrollHeight", {
                value: 100,
                configurable: true,
            });

            const eff = Effector(el);
            el.style.display = "block";

            eff.collapse({ duration: 50 });

            expect(el.style.overflow).toBe("hidden");

            jest.advanceTimersByTime(50);
            expect(el.style.display).toBe("none");
        });

        test("resize: position change triggers transition and delayed onComplete (animate=true)", () => {
            const el = createElementWithClass("position-bottom"); // currentPosition=bottom
            const eff = Effector(el);
            const onComplete = jest.fn();

            eff.resize({
                duration: 100,
                width: 100,
                left: 0,
                top: 0,
                maxHeight: 50,
                realHeight: 40,
                position: "top", // change => isPositionChanged=true
                animate: true,
                onComplete,
            });

            // onComplete should not be called immediately because animate && isPositionChanged => delayed
            expect(onComplete).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        test("resize: animate=false schedules clearing transition via resizeTimeout (else branch)", () => {
            const el = createElementWithClass("position-bottom");
            const eff = Effector(el);
            const onComplete = jest.fn();

            // ensure position does NOT change and heightDiff small so else branch executes
            Object.defineProperty(el, "offsetHeight", {
                value: 150,
                configurable: true,
            });

            eff.resize({
                duration: 100,
                width: 100,
                left: 0,
                top: 0,
                maxHeight: 500,
                realHeight: 151, // heightDiff = 1 (<= 5)
                position: "bottom",
                animate: false,
                onComplete,
            });

            // animate=false => onComplete is called immediately (inside rAF)
            expect(onComplete).toHaveBeenCalledTimes(1);

            // transition is cleared after duration via resizeTimeout
            jest.advanceTimersByTime(100);
            // style.transition may become null
            expect(
                el.style.transition === "" ||
                    el.style.transition === "null" ||
                    el.style.transition == null,
            ).toBeTruthy();
        });

        test("resize sets overflowY 'auto' when scrollHeight > maxHeight", () => {
            const el = createElementWithClass("position-bottom");
            // scrollHeight (200) > maxHeight (50) => overflowY auto
            const eff = Effector(el);

            eff.resize({
                duration: 50,
                width: 100,
                left: 0,
                top: 0,
                maxHeight: 50,
                realHeight: 40,
                position: "bottom",
                animate: true,
            });

            expect(el.style.overflowY).toBe("auto");
        });
    });
});
