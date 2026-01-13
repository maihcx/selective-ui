import { DatasetObserver } from "../../../src/ts/services/dataset-observer";

describe("DatasetObserver branch coverage", () => {
    let element: HTMLDivElement;
    let mutationCallback: (mutations: MutationRecord[]) => void;

    beforeEach(() => {
        jest.useFakeTimers();

        element = document.createElement("div");
        element.dataset.foo = "bar";

        global.MutationObserver = jest.fn(
            (cb: (mutations: MutationRecord[]) => void) => {
                mutationCallback = cb;
                return {
                    observe: jest.fn(),
                    disconnect: jest.fn()
                } as unknown as MutationObserver;
            }
        ) as unknown as typeof MutationObserver;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("does NOT call onChanged when no data-* attributes changed", () => {
        const observer = new DatasetObserver(element);
        observer.onChanged = jest.fn();

        mutationCallback([
            {
                type: "attributes",
                attributeName: "class",
                target: element
            } as any
        ]);

        jest.advanceTimersByTime(100);

        expect(observer.onChanged).not.toHaveBeenCalled();
    });

    test("calls onChanged when data-* attribute changes", () => {
        const observer = new DatasetObserver(element);
        observer.onChanged = jest.fn();

        element.dataset.foo = "baz";

        mutationCallback([
            {
                type: "attributes",
                attributeName: "data-foo",
                target: element
            } as any
        ]);

        jest.advanceTimersByTime(60);

        expect(observer.onChanged).toHaveBeenCalledTimes(1);
        expect(observer.onChanged).toHaveBeenCalledWith(
            expect.objectContaining({ foo: "baz" })
        );
    });
});