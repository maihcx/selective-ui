/**
 * @jest-environment jsdom
 */

import { ModelManager } from "../../../src/ts/core/model-manager";
import { GroupModel } from "../../../src/ts/models/group-model";
import { OptionModel } from "../../../src/ts/models/option-model";
import { Adapter } from "../../../src/ts/core/base/adapter";
import { RecyclerView } from "../../../src/ts/core/base/recyclerview";

class MockAdapter extends Adapter<any, any> {
    constructor(items: any[]) {
        super(items);
        this.isSkipEvent = false;
    }

    syncFromSource = jest.fn();
    updateData = jest.fn();
    changingProp = jest.fn();
    changeProp = jest.fn();
}

class MockRecyclerView extends RecyclerView<any, any> {
    refresh = jest.fn();

    constructor(el: HTMLDivElement | null) {
        super(el);
    }

    setAdapter(adapter: Adapter<any, any>) {
        this.adapter = adapter;
    }
}

function createOption(value: string, label: string = value): HTMLOptionElement {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    return opt;
}

function createGroup(label: string): HTMLOptGroupElement {
    const grp = document.createElement("optgroup");
    grp.label = label;
    return grp;
}

beforeAll(() => {
    jest.spyOn(OptionModel.prototype, "updateTarget")
        .mockImplementation(function (this: OptionModel, el: HTMLOptionElement | null) {
            (this as any).targetElement = el;
        });

    jest.spyOn(GroupModel.prototype, "updateTarget")
        .mockImplementation(function (this: GroupModel, el: HTMLElement) {
            (this as any).targetElement = el;
        });
});

describe("ModelManager", () => {
    let manager: ModelManager<any, any>;

    beforeEach(() => {
        manager = new ModelManager({ multiple: false });
        manager.setupAdapter(MockAdapter);
        manager.setupRecyclerView(MockRecyclerView);
    });

    test("createModelResources creates flat OptionModel list", () => {
        const opt1 = createOption("a");
        const opt2 = createOption("b");

        const models = manager.createModelResources([opt1, opt2]);

        expect(models).toHaveLength(2);
        expect(models[0]).toBeInstanceOf(OptionModel);
        expect(models[1]).toBeInstanceOf(OptionModel);
    });

    test("createModelResources groups options under optgroup", () => {
        const group = createGroup("Group A");
        const opt1 = createOption("1");
        const opt2 = createOption("2");

        opt1["__parentGroup"] = group;
        opt2["__parentGroup"] = group;

        const models = manager.createModelResources([group, opt1, opt2]);

        const grpModel = models[0] as GroupModel;
        expect(grpModel).toBeInstanceOf(GroupModel);
        expect(grpModel.items).toHaveLength(2);
        expect(grpModel.items[0]).toBeInstanceOf(OptionModel);
    });

    test("option without matching parent group is standalone", () => {
        const group = createGroup("Group A");
        const opt = createOption("x");

        const models = manager.createModelResources([group, opt]);

        expect(models).toHaveLength(2);
        expect(models[1]).toBeInstanceOf(OptionModel);
        expect((models[1] as OptionModel).group).toBeNull();
    });

    test("load initializes adapter and recyclerView", () => {
        const opt = createOption("a");
        manager.createModelResources([opt]);

        const container = document.createElement("div");
        manager.load(container);

        const { adapter, recyclerView } = manager.getResources();

        expect(adapter).toBeInstanceOf(MockAdapter);
        expect(recyclerView).toBeInstanceOf(MockRecyclerView);
        expect(recyclerView.adapter).toBe(adapter);
    });

    test("replace syncs adapter and refreshes view", () => {
        const opt1 = createOption("a");
        const opt2 = createOption("b");

        manager.createModelResources([opt1]);
        manager.load(document.createElement("div"));

        manager.replace([opt1, opt2]);

        const { adapter, recyclerView } = manager.getResources();

        expect(adapter.syncFromSource).toHaveBeenCalledTimes(1);
        expect(recyclerView.refresh).toHaveBeenCalled();
    });

    test("update reuses existing OptionModel by value", () => {
        const opt1 = createOption("a");
        const opt2 = createOption("b");

        manager.createModelResources([opt1]);
        manager.load(document.createElement("div"));

        const oldModel = manager.getResources().modelList[0];

        manager.update([opt1, opt2]);

        const models = manager.getResources().modelList;
        expect(models[0]).toBe(oldModel);
        expect(models[1]).toBeInstanceOf(OptionModel);
    });

    test("update reuses GroupModel by label", () => {
        const group = createGroup("Group A");
        const opt = createOption("1");
        opt["__parentGroup"] = group;

        manager.createModelResources([group, opt]);
        manager.load(document.createElement("div"));

        const oldGroup = manager.getResources().modelList[0];

        manager.update([group, opt]);

        const models = manager.getResources().modelList;
        expect(models[0]).toBe(oldGroup);
        expect((models[0] as GroupModel).items).toHaveLength(1);
    });

    test("update notifies adapter and refreshes view", () => {
        const opt = createOption("a");

        manager.createModelResources([opt]);
        manager.load(document.createElement("div"));

        manager.update([opt]);

        const { adapter, recyclerView } = manager.getResources();

        expect(adapter.updateData).toHaveBeenCalledTimes(1);
        expect(recyclerView.refresh).toHaveBeenCalled();
    });

    test("notify refreshes when adapter exists", () => {
        const opt = createOption("a");
        manager.createModelResources([opt]);
        manager.load(document.createElement("div"));

        const spy = jest.spyOn(manager, "refresh");
        manager.notify();

        expect(spy).toHaveBeenCalled();
    });

    test("skipEvent forwards flag to adapter", () => {
        const opt = createOption("a");
        manager.createModelResources([opt]);
        manager.load(document.createElement("div"));

        manager.skipEvent(true);

        expect(manager.getResources().adapter.isSkipEvent).toBe(true);
    });

    test("triggerChanging delegates to adapter", () => {
        const opt = createOption("a");
        manager.createModelResources([opt]);
        manager.load(document.createElement("div"));

        manager.triggerChanging("select");

        expect(manager.getResources().adapter.changingProp)
            .toHaveBeenCalledWith("select");
    });

    test("triggerChanged delegates to adapter", () => {
        const opt = createOption("a");
        manager.createModelResources([opt]);
        manager.load(document.createElement("div"));

        manager.triggerChanged("select");

        expect(manager.getResources().adapter.changeProp)
            .toHaveBeenCalledWith("select");
    });
});

afterAll(() => {
    jest.restoreAllMocks();
});
