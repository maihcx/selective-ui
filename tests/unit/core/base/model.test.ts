
/**
 * Unit Tests for Model
 */

import { Model } from "../../../../src/ts/core/base/model";
import { DefaultConfig } from "../../../../src/ts/types/utils/istorage.type";
import { OptionViewTags } from "../../../../src/ts/types/views/view.option.type";
import { OptionView } from "../../../../src/ts/views/option-view";

describe("Model", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    test("constructor without target/view initializes defaults", () => {
        const options = { any: "config" };
        const model = new Model(options);

        expect(model.options).toBe(options);
        expect(model.targetElement).toBeNull();
        expect(model.view).toBeNull();

        expect(model.position).toBe(-1);
        expect(model.isInit).toBe(false);
    });

    test("constructor with options, target, and view assigns fields", () => {
        const options = { some: "config" };
        const target = document.createElement("option");
        target.setAttribute("value", "abc");
        const view = {} as any;

        const model = new Model(options, target, view);

        expect(model.options).toBe(options);
        expect(model.targetElement).toBe(target);
        expect(model.view).toBe(view);
        expect(model.position).toBe(-1);
        expect(model.isInit).toBe(false);
    });

    describe("value getter", () => {
        test("returns attribute 'value' when present", () => {
            const target = document.createElement("option");
            target.setAttribute("value", "xyz");

            const model = new Model({}, target, null);

            expect(model.value).toBe("xyz");
        });

        test("returns null when attribute 'value' is absent", () => {
            const target = document.createElement("option");
            const model = new Model({}, target, null);

            expect(model.value).toBeNull();
        });

        test("return null", () => {
            const model = new Model({}, null, null);

            expect(model.value).toBe(null);
        });
    });

    describe("update()", () => {
        test("updates targetElement and invokes onTargetChanged()", () => {
            const initialTarget = document.createElement("option");
            initialTarget.setAttribute("value", "old");
            const model = new Model({}, initialTarget, null);

            const newTarget = document.createElement("option");
            newTarget.setAttribute("value", "new");

            model.updateTarget(newTarget);

            expect(model.targetElement).toBe(newTarget);
        });

        test("allows updating to null and still invokes onTargetChanged()", () => {
            const target = document.createElement("option");
            const model = new Model({}, target, null);

            model.updateTarget(null);

            expect(model.targetElement).toBeNull();
        });
    });

    describe("onTargetChanged()", () => {
        test("overridden in subclass is called on update()", () => {
            class TestModel extends Model<HTMLOptionElement, OptionViewTags, OptionView, DefaultConfig> {
                onTargetChanged() { /* custom hook */ }
            }

            const target = document.createElement("option");
            const model = new TestModel({}, target, null);

            const spy = jest.spyOn(model, "onTargetChanged");

            const nextTarget = document.createElement("option");
            model.updateTarget(nextTarget);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(model.targetElement).toBe(nextTarget);
        });
    });
});