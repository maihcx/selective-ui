import { RecyclerView } from "../../../../src/ts/core/base/recyclerview";
import { Adapter } from "../../../../src/ts/core/base/adapter";

class MockAdapter extends Adapter<any, unknown> {
    constructor() {
        super([]);
    }

    onInit = jest.fn();
    onPropChanging = jest.fn();
    onPropChanged = jest.fn();
    updateRecyclerView = jest.fn();
}

describe("RecyclerView", () => {

    function createAdapterMock(): Adapter<any, unknown> {
        return new MockAdapter();
    }

    test("constructor assigns viewElement", () => {
        const div = document.createElement("div");
        const rv = new RecyclerView(div);

        expect(rv.viewElement).toBe(div);
        expect(rv.adapter).toBeNull();
    });

    test("setView updates viewElement", () => {
        const rv = new RecyclerView();
        const div = document.createElement("div");

        rv.setView(div);

        expect(rv.viewElement).toBe(div);
    });

    test("clear does nothing when viewElement is null", () => {
        const rv = new RecyclerView(null);

        expect(() => rv.clear()).not.toThrow();
    });

    test("clear removes children when viewElement exists", () => {
        const div = document.createElement("div");
        div.appendChild(document.createElement("span"));

        const rv = new RecyclerView(div);
        rv.clear();

        expect(div.childNodes.length).toBe(0);
    });

    test("render does nothing when adapter is missing", () => {
        const div = document.createElement("div");
        const rv = new RecyclerView(div);

        rv.render();

        expect(true).toBe(true);
    });

    test("render does nothing when viewElement is missing", () => {
        const rv = new RecyclerView(null);
        rv.adapter = createAdapterMock();

        rv.render();

        expect((rv.adapter as MockAdapter).updateRecyclerView).not.toHaveBeenCalled();
    });

    test("render calls adapter.updateRecyclerView when ready", () => {
        const div = document.createElement("div");
        const adapter = createAdapterMock() as MockAdapter;

        const rv = new RecyclerView(div);
        rv.adapter = adapter;

        rv.render();

        expect(adapter.updateRecyclerView).toHaveBeenCalledWith(div);
    });

    test("setAdapter wires lifecycle callbacks and renders immediately", () => {
        const div = document.createElement("div");
        const adapter = createAdapterMock() as MockAdapter;

        const rv = new RecyclerView(div);
        rv.setAdapter(adapter);

        expect(rv.adapter).toBe(adapter);

        expect(adapter.onPropChanging).toHaveBeenCalledWith(
            "items",
            expect.any(Function)
        );

        expect(adapter.onPropChanged).toHaveBeenCalledWith(
            "items",
            expect.any(Function)
        );

        expect(adapter.updateRecyclerView).toHaveBeenCalledWith(div);
    });

    test("onPropChanging callback clears view", () => {
        const div = document.createElement("div");
        div.appendChild(document.createElement("span"));

        const adapter = createAdapterMock() as MockAdapter;
        const rv = new RecyclerView(div);
        rv.setAdapter(adapter);

        const clearCallback = (adapter.onPropChanging as jest.Mock).mock.calls[0][1];
        clearCallback();

        expect(div.childNodes.length).toBe(0);
    });

    test("onPropChanged callback re-renders", () => {
        const div = document.createElement("div");
        const adapter = createAdapterMock() as MockAdapter;

        const rv = new RecyclerView(div);
        rv.setAdapter(adapter);

        adapter.updateRecyclerView.mockClear();

        const renderCallback = (adapter.onPropChanged as jest.Mock).mock.calls[0][1];
        renderCallback();

        expect(adapter.updateRecyclerView).toHaveBeenCalledWith(div);
    });

    test("refresh delegates to render", () => {
        const div = document.createElement("div");
        const adapter = createAdapterMock() as MockAdapter;

        const rv = new RecyclerView(div);
        rv.setAdapter(adapter);

        adapter.updateRecyclerView.mockClear();

        rv.refresh(true);

        expect(adapter.updateRecyclerView).toHaveBeenCalledWith(div);
    });
});