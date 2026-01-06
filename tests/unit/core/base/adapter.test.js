import { Adapter } from "../../../../src/js/core/base/adapter";
import { Libs } from "../../../../src/js//utils/libs";

describe("Adapter", () => {

    beforeEach(() => {
        jest.spyOn(Libs.timerProcess, "setExecute").mockImplementation(() => {});
        jest.spyOn(Libs.timerProcess, "run").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function createItem(isInit = false) {
        return {
            isInit,
            view: {
                render: jest.fn(),
                update: jest.fn()
            }
        };
    }

    test("constructor initializes items and calls onInit", () => {
        class TestAdapter extends Adapter {
            onInit() {
                this.inited = true;
            }
        }

        const items = [createItem()];
        const adapter = new TestAdapter(items);

        expect(adapter.items).toBe(items);
        expect(adapter.inited).toBe(true);
    });

    test("itemCount returns number of items", () => {
        const adapter = new Adapter([1, 2, 3]);
        expect(adapter.itemCount()).toBe(3);
    });

    test("onViewHolder renders when item is not initialized", () => {
        const adapter = new Adapter();
        const item = createItem(false);

        adapter.onViewHolder(item, item.view, 0);

        expect(item.view.render).toHaveBeenCalled();
        expect(item.view.update).not.toHaveBeenCalled();
    });

    test("onViewHolder updates when item is initialized", () => {
        const adapter = new Adapter();
        const item = createItem(true);

        adapter.onViewHolder(item, item.view, 0);

        expect(item.view.update).toHaveBeenCalled();
        expect(item.view.render).not.toHaveBeenCalled();
    });

    test("onPropChanging registers debounced callback", () => {
        const adapter = new Adapter();
        const cb = jest.fn();

        adapter.onPropChanging("items", cb);

        expect(Libs.timerProcess.setExecute).toHaveBeenCalledWith(
            expect.stringContaining("itemsing_"),
            cb,
            1
        );
    });

    test("onPropChanged registers callback", () => {
        const adapter = new Adapter();
        const cb = jest.fn();

        adapter.onPropChanged("items", cb);

        expect(Libs.timerProcess.setExecute).toHaveBeenCalledWith(
            expect.stringContaining("items_"),
            cb
        );
    });

    test("changingProp runs pre-change pipeline", () => {
        const adapter = new Adapter();

        adapter.changingProp("items", 1, 2);

        expect(Libs.timerProcess.run).toHaveBeenCalledWith(
            expect.stringContaining("itemsing_"),
            1,
            2
        );
    });

    test("changeProp runs post-change pipeline", () => {
        const adapter = new Adapter();

        adapter.changeProp("items", "a");

        expect(Libs.timerProcess.run).toHaveBeenCalledWith(
            expect.stringContaining("items_"),
            "a"
        );
    });

    test("setItems triggers changing and changed pipelines in order", () => {
        const adapter = new Adapter();
        const items = [1, 2];

        adapter.setItems(items);

        expect(Libs.timerProcess.run).toHaveBeenCalledWith(
            expect.stringContaining("itemsing_"),
            items
        );

        expect(adapter.items).toBe(items);

        expect(Libs.timerProcess.run).toHaveBeenCalledWith(
            expect.stringContaining("items_"),
            items
        );
    });

    test("syncFromSource delegates to setItems", () => {
        const adapter = new Adapter();
        const spy = jest.spyOn(adapter, "setItems");
        const items = [3];

        adapter.syncFromSource(items);

        expect(spy).toHaveBeenCalledWith(items);
    });

    test("viewHolder default implementation returns null", () => {
        const adapter = new Adapter();
        expect(adapter.viewHolder(document.createElement("div"), {})).toBeNull();
    });

    test("updateRecyclerView initializes items and binds viewers", () => {
        const parent = document.createElement("div");

        const item1 = createItem(false);
        const item2 = createItem(true);

        const adapter = new class extends Adapter {
            viewHolder(parent, item) {
                return item.view;
            }
        }([item1, item2]);

        adapter.updateRecyclerView(parent);

        expect(item1.view.render).toHaveBeenCalled();
        expect(item2.view.update).toHaveBeenCalled();

        expect(item1.isInit).toBe(true);
        expect(item2.isInit).toBe(true);
    });

    test("updateData is a no-op but callable", () => {
        const adapter = new Adapter();

        expect(() => adapter.updateData([1, 2])).not.toThrow();
    });
});
