/**
 * Unit Tests for GroupModel
 */
import { OptionModel } from "src/ts/models/option-model";
import { GroupModel } from "src/ts/models/group-model";
import { iEvents } from "src/ts/utils/ievents";
import { Libs } from "src/ts/utils/libs";

describe("GroupModel", () => {
    let select, optgroup;

    beforeEach(() => {
        select = createSelect({
            groups: [
                {
                    label: "Group 1",
                    options: [
                        { value: "1", text: "Option 1" },
                        { value: "2", text: "Option 2", selected: true },
                    ],
                },
            ],
        });
        optgroup = select.querySelector("optgroup");
    });

    describe("Constructor & Properties", () => {
        test("should create instance with optgroup element", () => {
            const model = new GroupModel({}, optgroup);

            expect(model.targetElement).toBe(optgroup);
            expect(model.label).toBe("Group 1");
        });

        test("should initialize with empty items array", () => {
            const model = new GroupModel({}, optgroup);
            expect(model.items).toEqual([]);
        });

        test("should read collapsed state from dataset", () => {
            optgroup.dataset.collapsed = "true";
            const model = new GroupModel({}, optgroup);

            expect(model.collapsed).toBe(true);
        });
    });

    describe("Item Management", () => {
        test("should add option item", () => {
            const model = new GroupModel({}, optgroup);
            const optionModel = { value: "1" } as OptionModel;

            model.addItem(optionModel);

            expect(model.items).toContain(optionModel);
            expect(optionModel.group).toBe(model);
        });

        test("should remove option item", () => {
            const model = new GroupModel({}, optgroup);
            const optionModel = { value: "1" } as OptionModel;

            model.addItem(optionModel);
            model.removeItem(optionModel);

            expect(model.items).not.toContain(optionModel);
            expect(optionModel.group).toBe(null);
        });

        test("should get selected items", () => {
            const model = new GroupModel({}, optgroup);
            const opt1 = { selected: true, value: "1" } as OptionModel;
            const opt2 = { selected: false, value: "2" } as OptionModel;

            model.addItem(opt1);
            model.addItem(opt2);

            expect(model.selectedItems).toEqual([opt1]);
        });

        test("should get visible items", () => {
            const model = new GroupModel({}, optgroup);
            const opt1 = { visible: true, value: "1" } as OptionModel;
            const opt2 = { visible: false, value: "2" } as OptionModel;

            model.addItem(opt1);
            model.addItem(opt2);

            expect(model.visibleItems).toEqual([opt1]);
        });
    });

    describe("Collapse State", () => {
        test("should toggle collapse", () => {
            const model = new GroupModel({}, optgroup);
            const initialState = model.collapsed;

            model.toggleCollapse();

            expect(model.collapsed).toBe(!initialState);
        });

        test("should trigger onCollapsedChanged", (done) => {
            const model = new GroupModel({}, optgroup);

            model.onCollapsedChanged((token, m, collapsed) => {
                expect(m).toBe(model);
                expect(typeof collapsed).toBe("boolean");
                done();
            });

            model.toggleCollapse();
        });
    });

    describe("Value Getters", () => {
        test("should return array of values from items", () => {
            const model = new GroupModel({}, optgroup);
            model.addItem({ value: "1" } as OptionModel);
            model.addItem({ value: "2" } as OptionModel);

            expect(model.value).toEqual(["1", "2"]);
        });

        test("should check hasVisibleItems", () => {
            const model = new GroupModel({}, optgroup);
            model.addItem({ visible: true } as OptionModel);

            expect(model.hasVisibleItems).toBe(true);
        });
    });

    describe("Constructor collapsed parsing", () => {
        test("collapsed is false when dataset is missing", () => {
            const model = new GroupModel({}, optgroup);
            expect(model.collapsed).toBe(false);
        });

        test('collapsed is false when dataset.collapsed = "false"', () => {
            optgroup.dataset.collapsed = "false";
            const model = new GroupModel({}, optgroup);
            expect(model.collapsed).toBe(false);
        });
    });

    describe("Update without view", () => {
        test("update does not throw when view is null", () => {
            const model = new GroupModel({}, optgroup);

            optgroup.label = "New Label";

            expect(() => {
                model.updateTarget(optgroup);
            }).not.toThrow();

            expect(model.label).toBe("New Label");
        });
    });

    describe("toggleCollapse behavior", () => {
        test("calls view.setCollapsed with new state", () => {
            const model = new GroupModel({}, optgroup);
            const setCollapsed = jest.fn();

            model.view = { setCollapsed } as any;

            model.toggleCollapse();

            expect(setCollapsed).toHaveBeenCalledWith(model.collapsed);
        });

        test("toggleCollapse toggles state multiple times", () => {
            const model = new GroupModel({}, optgroup);
            const first = model.collapsed;

            model.toggleCollapse();
            expect(model.collapsed).toBe(!first);

            model.toggleCollapse();
            expect(model.collapsed).toBe(first);
        });
    });

    describe("removeItem edge cases", () => {
        test("removeItem does nothing when item is not in group", () => {
            const model = new GroupModel({}, optgroup);
            const option = { value: "x", group: null } as OptionModel;

            expect(() => {
                model.removeItem(option);
            }).not.toThrow();

            expect(model.items.length).toBe(0);
            expect(option.group).toBe(null);
        });
    });

    describe("updateVisibility", () => {
        test("calls view.updateVisibility when view exists", () => {
            const model = new GroupModel({}, optgroup);
            const updateVisibility = jest.fn();

            model.view = { updateVisibility } as any;

            model.updateVisibility();

            expect(updateVisibility).toHaveBeenCalled();
        });

        test("updateVisibility does nothing when view is null", () => {
            const model = new GroupModel({}, optgroup);

            expect(() => {
                model.updateVisibility();
            }).not.toThrow();
        });
    });

    describe("lifecycle/view/event", () => {
        test("destroy() calls destroy() on all child items and clears items", () => {
            const model = new GroupModel({}, optgroup);

            const child1 = {
                value: "1",
                destroy: jest.fn(),
            } as any as OptionModel;
            const child2 = {
                value: "2",
                destroy: jest.fn(),
            } as any as OptionModel;

            model.addItem(child1);
            model.addItem(child2);

            expect(model.items).toHaveLength(2);

            model.destroy();

            expect(child1.destroy).toHaveBeenCalledTimes(1);
            expect(child2.destroy).toHaveBeenCalledTimes(1);
            expect(model.items).toEqual([]);
        });

        test("destroy() is idempotent: second call is a no-op (does not destroy children again)", () => {
            const model = new GroupModel({}, optgroup);

            const child = {
                value: "1",
                destroy: jest.fn(),
            } as any as OptionModel;
            model.addItem(child);

            model.destroy();
            expect(child.destroy).toHaveBeenCalledTimes(1);

            expect(() => model.destroy()).not.toThrow();
            expect(child.destroy).toHaveBeenCalledTimes(1);
        });

        test("update() with view calls view.updateLabel(label) and view.setCollapsed(collapsed)", () => {
            const model = new GroupModel({}, optgroup);

            const updateLabel = jest.fn();
            const setCollapsed = jest.fn();

            model.view = { updateLabel, setCollapsed } as any;

            model.label = "New Label";
            model.collapsed = true;

            expect(() => model.update()).not.toThrow();

            expect(updateLabel).toHaveBeenCalledWith("New Label");
            expect(setCollapsed).toHaveBeenCalledWith(true);
        });

        test("updateTarget() with view updates label and calls view.updateLabel, then update()", () => {
            const model = new GroupModel({}, optgroup);

            const updateLabel = jest.fn();
            const setCollapsed = jest.fn();

            // spy update() so we know updateTarget triggers lifecycle update
            const updateSpy = jest.spyOn(model, "update");

            model.view = { updateLabel, setCollapsed } as any;

            optgroup.label = "Group Renamed";

            model.updateTarget(optgroup);

            expect(model.label).toBe("Group Renamed");
            expect(updateLabel).toHaveBeenCalledWith("Group Renamed");
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        test("toggleCollapse() dispatches callbacks via iEvents.callEvent with [model, collapsed] payload", () => {
            const model = new GroupModel({}, optgroup);

            const callEventSpy = jest.spyOn(iEvents, "callEvent");

            const cb = jest.fn();
            model.onCollapsedChanged(cb);

            model.toggleCollapse();

            expect(callEventSpy).toHaveBeenCalled();

            const args = callEventSpy.mock.calls[0];

            // args[0] should be the payload array: [this, this.collapsed]
            expect(Array.isArray(args[0])).toBe(true);
            expect(args[0][0]).toBe(model);
            expect(typeof args[0][1]).toBe("boolean");

            // callbacks are passed after the payload
            expect(args).toEqual(expect.arrayContaining([cb]));
        });

        test("constructor reads dataset.collapsed using Libs.string2Boolean (spy)", () => {
            optgroup.dataset.collapsed = "true";

            const spy = jest.spyOn(Libs, "string2Boolean");
            const model = new GroupModel({}, optgroup);

            expect(spy).toHaveBeenCalled();
            expect(model.collapsed).toBe(true);
        });
    });
});
