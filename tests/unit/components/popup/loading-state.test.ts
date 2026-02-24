/**
 * Unit Tests for LoadingState
 */

import { LoadingState } from "src/ts/components/popup/loading-state";

describe("LoadingState", () => {
    const options = {
        textLoading: "Loading data..."
    };

    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("constructor without options does not initialize node", () => {
        const ls = new LoadingState();

        expect(ls.node).toBeNull();
        expect(ls.options).toBeNull();
    });

    test("constructor with options initializes node", () => {
        const ls = new LoadingState(options);

        expect(ls.node).toBeInstanceOf(HTMLDivElement);
        expect(ls.options).toBe(options);
        expect(ls.node?.textContent).toBe(options.textLoading);
        expect(ls.node?.classList.contains("seui-loading-state")).toBe(true);
        expect(ls.node?.classList.contains("hide")).toBe(true);
        expect(ls.node?.getAttribute("role")).toBe("status");
        expect(ls.node?.getAttribute("aria-live")).toBe("polite");
    });

    test("show(false) shows loading state without small class", () => {
        const ls = new LoadingState(options);

        ls.show(false);

        expect(ls.node?.textContent).toBe(options.textLoading);
        expect(ls.node?.classList.contains("hide")).toBe(false);
        expect(ls.node?.classList.contains("small")).toBe(false);
        expect(ls.isVisible).toBe(true);
    });

    test("show(true) shows loading state with small class", () => {
        const ls = new LoadingState(options);

        ls.show(true);

        expect(ls.node?.classList.contains("small")).toBe(true);
        expect(ls.node?.classList.contains("hide")).toBe(false);
        expect(ls.isVisible).toBe(true);
    });

    test("hide() hides loading state", () => {
        const ls = new LoadingState(options);

        ls.show(true);
        ls.hide();

        expect(ls.node?.classList.contains("hide")).toBe(true);
        expect(ls.isVisible).toBe(false);
    });

    test("isVisible reflects visibility correctly", () => {
        const ls = new LoadingState(options);

        expect(ls.isVisible).toBe(false);

        ls.show(false);
        expect(ls.isVisible).toBe(true);

        ls.hide();
        expect(ls.isVisible).toBe(false);
    });
});
