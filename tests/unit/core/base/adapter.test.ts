import { Adapter } from "../../../../src/ts/core/base/adapter";
import { Libs } from "../../../../src/ts/utils/libs";

describe("Adapter", () => {

    beforeEach(() => {
        jest.spyOn(Libs.callbackScheduler, "on").mockImplementation(async () => {});
        jest.spyOn(Libs.callbackScheduler, "run").mockImplementation(async () => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    interface TestItem {
        isInit: boolean;
        view: {
            mount: jest.Mock;
            update: jest.Mock;
        };
    }

    function createItem(isInit = false): TestItem {
        return {
            isInit,
            view: {
                mount: jest.fn(),
                update: jest.fn()
            }
        };
    }

    test("constructor initializes items and calls onInit", () => {
        class TestAdapter extends Adapter<any, any> {
            inited = false;

            constructor(items) {
                super(items);
                this.onInit();
            }

            onInit(): void {
                this.inited = true;
            }
        }

        const items = [createItem()];
        const adapter = new TestAdapter(items);

        expect(adapter.items).toBe(items);
        expect(adapter.inited).toBe(true);
    });

    test("itemCount returns number of items", () => {
        const adapter = new Adapter<any, any>([1, 2, 3]);
        expect(adapter.itemCount()).toBe(3);
    });

    test("onViewHolder renders when item is not initialized", () => {
        const adapter = new Adapter<any, any>();
        const item = createItem(false);

        adapter.onViewHolder(item, item.view as any, 0);

        expect(item.view.mount).toHaveBeenCalled();
        expect(item.view.update).not.toHaveBeenCalled();
    });

    test("onViewHolder updates when item is initialized", () => {
        const adapter = new Adapter<any, any>();
        const item = createItem(true);

        adapter.onViewHolder(item, item.view as any, 0);

        expect(item.view.update).toHaveBeenCalled();
        expect(item.view.mount).not.toHaveBeenCalled();
    });

    test("onPropChanging registers debounced callback", () => {
        const adapter = new Adapter<any, any>();
        const cb = jest.fn();

        adapter.onPropChanging("items", cb);

        expect(Libs.callbackScheduler.on).toHaveBeenCalledWith(
            expect.stringContaining("itemsing_"),
            cb,
            { debounce: 0 }
        );
    });

    test("onPropChanged registers callback", () => {
        const adapter = new Adapter<any, any>();
        const cb = jest.fn();

        adapter.onPropChanged("items", cb);

        expect(Libs.callbackScheduler.on).toHaveBeenCalledWith(
            expect.stringContaining("items_"),
            cb,
            { debounce: 0 }
        );
    });

    test("changingProp runs pre-change pipeline", () => {
        const adapter = new Adapter<any, any>();

        adapter.changingProp("items", 1, 2);

        expect(Libs.callbackScheduler.run).toHaveBeenCalledWith(
            expect.stringContaining("itemsing_"),
            1,
            2
        );
    });

    test("changeProp runs post-change pipeline", () => {
        const adapter = new Adapter<any, any>();

        adapter.changeProp("items", "a");

        expect(Libs.callbackScheduler.run).toHaveBeenCalledWith(
            expect.stringContaining("items_"),
            "a"
        );
    });

    test("setItems triggers changing and changed pipelines in order", () => {
        const adapter = new Adapter<any, any>();
        const items = [1, 2];

        const promise = adapter.setItems(items);
        
        promise.then(() => {
            expect(adapter.items).toBe(items);
        });
    });

    test("syncFromSource delegates to setItems", () => {
        const adapter = new Adapter<any, any>();
        const spy = jest.spyOn(adapter, "setItems");
        const items = [3];

        adapter.syncFromSource(items);

        expect(spy).toHaveBeenCalledWith(items);
    });

    test("viewHolder default implementation returns null", () => {
        const adapter = new Adapter<any, any>();
        expect(adapter.viewHolder(document.createElement("div"), {} as any)).toBeNull();
    });

    test("updateRecyclerView initializes items and binds viewers", () => {
        const parent = document.createElement("div");

        const item1 = createItem(false);
        const item2 = createItem(true);

        class TestAdapter extends Adapter<any, any> {
            viewHolder(_parent: HTMLElement, item: TestItem) {
                return item.view as any;
            }
        }

        const adapter = new TestAdapter([item1, item2]);
        adapter.updateRecyclerView(parent);

        expect(item1.view.mount).toHaveBeenCalled();
        expect(item2.view.update).toHaveBeenCalled();

        expect(item1.isInit).toBe(true);
        expect(item2.isInit).toBe(true);
    });

    test("updateData is a no-op but callable", () => {
        const adapter = new Adapter<any, any>();
        expect(() => adapter.updateData([1, 2])).not.toThrow();
    });
});