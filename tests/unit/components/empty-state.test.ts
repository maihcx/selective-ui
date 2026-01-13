/**
 * Unit Tests for EmptyState
 */

import { EmptyState } from "../../../src/ts/components/empty-state";
import { Libs } from "../../../src/ts/utils/libs";

describe("EmptyState", () => {
    const options = {
        textNoData: "No data available",
        textNotFound: "No results found"
    };

    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("constructor without options does not initialize node", () => {
        const es = new EmptyState();
        expect(es.node).toBeNull();
        expect(es.options).toBeNull();
    });

    test("constructor with options initializes node", () => {
        const es = new EmptyState(options);

        expect(es.node).toBeInstanceOf(HTMLDivElement);
        expect(es.options).toBe(options);
        expect(es.node?.classList.contains("selective-ui-empty-state")).toBe(true);
        expect(es.node?.classList.contains("hide")).toBe(true);
        expect(es.node?.getAttribute("role")).toBe("status");
        expect(es.node?.getAttribute("aria-live")).toBe("polite");
    });

    test("show() displays nodata text by default", () => {
        const es = new EmptyState(options);

        es.show();

        expect(es.node?.textContent).toBe(options.textNoData);
        expect(es.node?.classList.contains("hide")).toBe(false);
        expect(es.isVisible).toBe(true);
    });

    test('show("notfound") displays notfound text', () => {
        const es = new EmptyState(options);

        es.show("notfound");

        expect(es.node?.textContent).toBe(options.textNotFound);
        expect(es.node?.classList.contains("hide")).toBe(false);
        expect(es.isVisible).toBe(true);
    });

    test("hide() hides empty state", () => {
        const es = new EmptyState(options);

        es.show();
        es.hide();

        expect(es.node?.classList.contains("hide")).toBe(true);
        expect(es.isVisible).toBe(false);
    });

    test("isVisible reflects visibility correctly", () => {
        const es = new EmptyState(options);

        expect(es.isVisible).toBe(false);

        es.show();
        expect(es.isVisible).toBe(true);

        es.hide();
        expect(es.isVisible).toBe(false);
    });
});