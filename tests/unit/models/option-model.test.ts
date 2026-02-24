/**
 * Unit Tests for OptionModel
 */
import { OptionModel } from "src/ts/models/option-model";
import { iEvents } from "src/ts/utils/ievents";
import { Libs } from "src/ts/utils/libs";

describe("OptionModel", () => {
    let select, option;

    beforeEach(() => {
        select = createSelect({
            options: [
                {
                    value: "1",
                    text: "Option 1",
                    dataset: { imgsrc: "test.jpg" },
                },
                { value: "2", text: "Option 2", selected: true },
            ],
        });
        option = select.options[0];
    });

    describe("Constructor & Properties", () => {
        test("should create instance with option element", () => {
            const model = new OptionModel({}, option);

            expect(model.targetElement).toBe(option);
            expect(model.value).toBe("1");
            expect(model.text).toBe("Option 1");
        });

        test("should get correct value", () => {
            const model = new OptionModel({}, option);
            expect(model.value).toBe("1");
        });

        test("should get selected state", () => {
            const model1 = new OptionModel({}, select.options[0]);
            const model2 = new OptionModel({}, select.options[1]);

            expect(model1.selected).toBe(false);
            expect(model2.selected).toBe(true);
        });
    });

    describe("Image Handling", () => {
        test("should detect image source from dataset", () => {
            const model = new OptionModel({}, option);

            expect(model.hasImage).toBe(true);
            expect(model.imageSrc).toBe("test.jpg");
        });

        test("should return empty string when no image", () => {
            const model = new OptionModel({}, select.options[1]);

            expect(model.hasImage).toBe(false);
            expect(model.imageSrc).toBe("");
        });
    });

    describe("Selection", () => {
        test("should set selected state", () => {
            const model = new OptionModel({}, option);

            model.selected = true;
            expect(model.selected).toBe(true);
            expect(option.selected).toBe(true);
        });

        test("should trigger onSelected callback", (done) => {
            const model = new OptionModel({}, option);

            model.onSelected((token, el, selected) => {
                expect(el).toBe(model);
                expect(selected).toBe(true);
                done();
            });

            model.selected = true;
        });

        test("should not trigger on selectedNonTrigger", () => {
            const model = new OptionModel({}, option);
            const callback = jest.fn();

            model.onSelected(callback);
            model.selectedNonTrigger = true;

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("Visibility", () => {
        test("should set visibility", () => {
            const model = new OptionModel({}, option);
            const mockView = {
                getView: jest.fn(() => document.createElement("div")),
            } as any;
            model.view = mockView;

            model.visible = false;
            expect(model.visible).toBe(false);
        });

        test("should trigger onVisibilityChanged", (done) => {
            const model = new OptionModel({}, option);
            const mockView = {
                getView: jest.fn(() => document.createElement("div")),
            } as any;
            model.view = mockView;

            model.onVisibilityChanged((token, el, visible) => {
                expect(visible).toBe(false);
                done();
            });

            model.visible = false;
        });
    });

    describe("Highlight", () => {
        test("should set highlight state", () => {
            const model = new OptionModel({}, option);
            const div = document.createElement("div");
            const mockView = {
                getView: jest.fn(() => div),
            } as any;
            model.view = mockView;

            model.highlighted = true;
            expect(model.highlighted).toBe(true);
            expect(div.classList.contains("highlight")).toBe(true);
        });

        test("should remove highlight", () => {
            const model = new OptionModel({}, option);
            const div = document.createElement("div");
            div.classList.add("highlight");
            const mockView = {
                getView: jest.fn(() => div),
            } as any;
            model.view = mockView;

            model.highlighted = false;
            expect(div.classList.contains("highlight")).toBe(false);
        });
    });

    describe("Text Processing", () => {
        test("should return plain text when allowHtml is false", () => {
            const opt = document.createElement("option");
            opt.text = "<b>Bold</b> text";
            document.body.appendChild(opt);

            const model = new OptionModel({ allowHtml: false }, opt);
            expect(model.text).not.toContain("<b>");
        });

        test("should preserve HTML when allowHtml is true", () => {
            const opt = document.createElement("option");
            opt.text = "<b>Bold</b> text";
            document.body.appendChild(opt);

            const model = new OptionModel({ allowHtml: true }, opt);
            expect(model.text).toContain("<b>");
        });
    });

    describe("OptionModel Properties test", () => {
        function makeMockView() {
            const root = document.createElement("div");
            const label = document.createElement("span");
            const img = document.createElement("img");
            const input = document.createElement("input");
            input.type = "checkbox";

            // minimal view contract used by OptionModel:
            // - getView() returns root
            // - view.tags contains LabelContent/OptionImage/OptionInput
            const view = {
                getView: jest.fn(() => root),
                view: {
                    tags: {
                        LabelContent: label,
                        OptionImage: img,
                        OptionInput: input,
                    },
                },
            } as any;

            return { view, root, label, img, input };
        }

        test("visible setter is idempotent (no event when setting same value)", () => {
            const model = new OptionModel({}, option);

            const callSpy = jest.spyOn(iEvents, "callEvent");
            const mock = makeMockView();
            model.view = mock.view;

            // default _visible = true, set true again => should early return
            model.visible = true;

            // class should not be toggled, and callEvent should not fire
            expect(mock.root.classList.contains("hide")).toBe(false);
            expect(callSpy).not.toHaveBeenCalled();
        });

        test("visible=false toggles 'hide' class on view root and emits visibility listeners", () => {
            const model = new OptionModel({}, option);

            const mock = makeMockView();
            model.view = mock.view;

            const callSpy = jest.spyOn(iEvents, "callEvent");
            const cb = jest.fn();
            model.onVisibilityChanged(cb);

            model.visible = false;

            expect(model.visible).toBe(false);
            expect(mock.root.classList.contains("hide")).toBe(true);
            expect(callSpy).toHaveBeenCalled(); // dispatched via iEvents
        });

        test("selectedNonTrigger sets input.checked, toggles checked class, aria-selected, and selected attribute", () => {
            const model = new OptionModel({}, option);

            const mock = makeMockView();
            model.view = mock.view;

            const callSpy = jest.spyOn(iEvents, "callEvent");
            const internalCb = jest.fn();
            model.onInternalSelected(internalCb);

            // pre-state
            expect(option.selected).toBe(false);
            expect(option.hasAttribute("selected")).toBe(false);

            model.selectedNonTrigger = true;

            // input checked
            expect(mock.input.checked).toBe(true);

            // root class + aria
            expect(mock.root.classList.contains("checked")).toBe(true);
            expect(mock.root.getAttribute("aria-selected")).toBe("true");

            // backing option mirrors
            expect(option.selected).toBe(true);
            expect(option.hasAttribute("selected")).toBe(true);

            // internal listeners emitted through iEvents
            expect(callSpy).toHaveBeenCalled();
        });

        test("selected setter emits external listeners (via iEvents) and delegates to selectedNonTrigger", () => {
            const model = new OptionModel({}, option);

            const callSpy = jest.spyOn(iEvents, "callEvent");
            const cb = jest.fn();
            model.onSelected(cb);

            model.selected = true;

            expect(option.selected).toBe(true);
            expect(callSpy).toHaveBeenCalled();
        });

        test("update() with no view: recomputes textToFind and returns without throwing", () => {
            const model = new OptionModel(
                { allowHtml: false } as any,
                option,
                null,
            );

            const updateSpy = jest.spyOn(model as any, "update"); // just to ensure callable
            expect(() => model.update()).not.toThrow();
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(typeof model.textToFind).toBe("string");
        });

        test("update() with view + allowHtml=false writes textContent (not innerHTML) into LabelContent", () => {
            // option text contains tags-like string
            const opt = document.createElement("option");
            opt.value = "x";
            opt.text = "<b>Bold</b> text";
            select.appendChild(opt);

            const model = new OptionModel({ allowHtml: false } as any, opt);

            const mock = makeMockView();
            model.view = mock.view;

            // ensure hasImage false for this branch (no dataset)
            expect(model.hasImage).toBe(false);

            model.update();

            // allowHtml=false => label.textContent gets textContent
            expect(mock.label.textContent).toBe(model.textContent);
        });

        test("update() with view + allowHtml=true writes innerHTML into LabelContent", () => {
            const opt = document.createElement("option");
            opt.value = "x2";
            opt.text = "<i>Italic</i>";
            select.appendChild(opt);

            const model = new OptionModel({ allowHtml: true } as any, opt);

            const mock = makeMockView();
            model.view = mock.view;

            model.update();

            // allowHtml=true => label.innerHTML gets model.text
            expect(mock.label.innerHTML).toBe(model.text);
        });

        test("update() updates image src/alt only when hasImage and when values differ", () => {
            // ensure dataset.imgsrc exists so hasImage = true
            option.dataset.imgsrc = "test.jpg";

            const model = new OptionModel({ allowHtml: false } as any, option);

            const mock = makeMockView();
            model.view = mock.view;

            // pre-set to same value to hit 'if (src != imageSrc)' false branch
            mock.img.src = model.imageSrc;
            mock.img.alt = model.text;

            model.update();

            // still same (no change needed)
            expect(mock.img.src).toContain(model.imageSrc);
            expect(mock.img.alt).toBe(model.text);

            // now force different values to hit true branches
            mock.img.src = "other.jpg";
            mock.img.alt = "other-alt";

            model.update();

            expect(mock.img.src).toContain(model.imageSrc);
            expect(mock.img.alt).toBe(model.text);
        });

        test("update() mirrors backing option.selected via selectedNonTrigger", () => {
            const model = new OptionModel({}, option);

            const mock = makeMockView();
            model.view = mock.view;

            // flip backing option selection directly
            option.selected = true;

            // spy on selectedNonTrigger setter via defineProperty
            const setterSpy = jest.spyOn(
                model as any,
                "selectedNonTrigger",
                "set",
            );

            model.update();

            expect(setterSpy).toHaveBeenCalledWith(true);
        });

        test("destroy() clears listeners/group/textToFind and is idempotent", () => {
            const model = new OptionModel({}, option);

            // attach some listeners + group
            const cb1 = jest.fn();
            const cb2 = jest.fn();
            const cb3 = jest.fn();
            model.onSelected(cb1);
            model.onInternalSelected(cb2);
            model.onVisibilityChanged(cb3);

            (model as any).group = {} as any;

            // ensure textToFind exists
            expect(model.textToFind).toBeTruthy();

            model.destroy();

            // internal fields cleared by destroy()
            expect((model as any).group).toBeNull();
            expect(model.textToFind).toBeNull();

            // second destroy should be no-op
            expect(() => model.destroy()).not.toThrow();
        });
    });
});
