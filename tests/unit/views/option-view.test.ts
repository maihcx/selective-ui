/**
 * @jest-environment jsdom
 *
 * Unit Tests for OptionView (rewritten, stable & higher branch coverage)
 */

const randomStringMock = jest.fn();
const mountNodeMock = jest.fn();

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        randomString: (...args: any[]) => randomStringMock(...args),
        mountNode: (...args: any[]) => mountNodeMock(...args),
    },
}));

import { OptionView } from "../../../src/ts/views/option-view";

function applyClassList(el: HTMLElement, classList: any) {
    if (Array.isArray(classList))
        classList.forEach((c) => el.classList.add(String(c)));
    else if (typeof classList === "string") el.className = classList;
}

function applyStyle(el: HTMLElement, style: any) {
    if (!style) return;
    Object.keys(style).forEach((k) => {
        // @ts-ignore
        el.style[k] = String(style[k]);
    });
}

function createElementFromTag(tag: any): HTMLElement {
    // tag may be HTMLElement OR config object
    if (tag instanceof HTMLElement) return tag;

    const el = document.createElement(tag.node ?? "div");

    applyClassList(el, tag.classList);

    if (tag.id) el.id = String(tag.id);
    if (tag.role) el.setAttribute("role", String(tag.role));

    // OptionView.mount uses ariaSelected + tabIndex (camelCase)
    if (tag.ariaSelected != null)
        el.setAttribute("aria-selected", String(tag.ariaSelected));
    if (tag.tabIndex != null) el.setAttribute("tabindex", String(tag.tabIndex));

    // input-specific
    if (tag.type) (el as HTMLInputElement).type = String(tag.type);

    // label-specific
    if (tag.htmlFor) (el as HTMLLabelElement).htmlFor = String(tag.htmlFor);

    // inline styles
    applyStyle(el, tag.style);

    return el;
}

function buildOptionViewMountResultFromConfig(cfg: any) {
    // cfg shape from OptionView.mount():
    // { OptionView: { tag: {...}, child: { OptionInput, (OptionImage?), OptionLabel{ child: {LabelContent} } } } }

    const rootCfg = cfg?.OptionView?.tag ?? {};
    const child = cfg?.OptionView?.child ?? {};

    const inputCfg = child?.OptionInput?.tag ?? {};
    const imageCfg = child?.OptionImage?.tag ?? null;
    const labelCfg = child?.OptionLabel?.tag ?? {};
    const labelContentCfg = child?.OptionLabel?.child?.LabelContent?.tag ?? {
        node: "div",
    };

    const root = createElementFromTag(rootCfg) as HTMLDivElement;
    const input = createElementFromTag(inputCfg) as HTMLInputElement;

    const label = createElementFromTag(labelCfg) as HTMLLabelElement;
    const labelContent = createElementFromTag(
        labelContentCfg,
    ) as HTMLDivElement;
    label.appendChild(labelContent);

    let img: HTMLImageElement | null = null;
    if (imageCfg) {
        img = createElementFromTag(imageCfg) as HTMLImageElement;
    }

    // DOM order in description: Input, (Image), Label
    root.appendChild(input);
    if (img) root.appendChild(img);
    root.appendChild(label);

    // Important: tags include "id" in your MountViewResult typing in this repo
    // Also keep OptionImage as null when not present (code expects nullable)
    return {
        view: root,
        tags: {
            OptionInput: input,
            OptionImage: img,
            OptionLabel: label,
            LabelContent: labelContent,
            id: root.id || "mock-id",
        },
    } as any;
}

describe("OptionView", () => {
    let parent: HTMLDivElement;

    beforeEach(() => {
        document.body.innerHTML = "";
        parent = document.createElement("div");
        document.body.appendChild(parent);

        jest.clearAllMocks();

        // stabilize IDs for deterministic tests
        randomStringMock.mockReturnValue("ABC1234");

        // mock mountNode to build real DOM according to config passed from OptionView.mount
        mountNodeMock.mockImplementation((cfg: any) =>
            buildOptionViewMountResultFromConfig(cfg),
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    describe("Initialization / no-op before mount", () => {
        test("constructor sets default config values (no DOM yet)", () => {
            const view = new OptionView(parent);

            // default config from initialize()
            expect(view.isMultiple).toBe(false);
            expect(view.hasImage).toBe(false);

            // not mounted yet
            expect(view.view).toBeNull();
            expect(parent.children.length).toBe(0);
        });

        test("config Proxy does not call applyPartialChange before mount (isRendered=false)", () => {
            const view = new OptionView(parent);
            const spy = jest.spyOn(view as any, "applyPartialChange");

            // Change config before mount: should not trigger partial change
            view.isMultiple = true;
            view.hasImage = true;
            view.optionConfig = {
                imagePosition: "left",
                imageWidth: "10px",
            } as any;

            expect(spy).not.toHaveBeenCalled();

            // After mount, partial changes are allowed
            view.mount();
            view.isMultiple = false; // triggers
            expect(spy).toHaveBeenCalled();
        });

        test("optionConfig setter is no-op when null", () => {
            const view = new OptionView(parent);
            expect(() => {
                view.optionConfig = null as any;
            }).not.toThrow();
        });
    });

    describe("Rendering (mount)", () => {
        test("mount renders basic structure and appends to parent", () => {
            const view = new OptionView(parent);
            view.mount();

            const root = view.getView();
            expect(parent.contains(root)).toBe(true);

            expect(root.classList.contains("seui-option-view")).toBe(true);
            expect(root.getAttribute("role")).toBe("option");
            expect(root.getAttribute("aria-selected")).toBe("false");
            expect(root.getAttribute("tabindex")).toBe("-1");

            // ids from randomString
            expect(root.id).toBe("seui-ABC1234-option");

            // input + label linking
            const input = view.view!.tags.OptionInput;
            const label = view.view!.tags.OptionLabel;

            expect(input.id).toBe("option_ABC1234");
            expect(label.htmlFor).toBe("option_ABC1234");
        });

        test("mount renders checkbox and 'multiple' class when isMultiple=true", () => {
            const view = new OptionView(parent);
            view.isMultiple = true;
            view.mount();

            const root = view.getView();
            const input = view.view!.tags.OptionInput;

            expect(root.classList.contains("multiple")).toBe(true);
            expect(input.type).toBe("checkbox");
        });

        test("mount renders radio (single) when isMultiple=false", () => {
            const view = new OptionView(parent);
            view.isMultiple = false;
            view.mount();

            const input = view.view!.tags.OptionInput;
            expect(input.type).toBe("radio");
        });

        test("mount renders image when hasImage=true (class + image-{pos} + styles)", () => {
            const view = new OptionView(parent);
            view.hasImage = true;
            view.optionConfig = {
                imageWidth: "50px",
                imageHeight: "40px",
                imageBorderRadius: "5px",
                imagePosition: "left",
            } as any;

            view.mount();

            const root = view.getView();
            expect(root.classList.contains("has-image")).toBe(true);
            expect(root.className).toContain("image-left");

            const img = view.view!.tags.OptionImage as HTMLImageElement;
            expect(img).toBeTruthy();
            expect(img.classList.contains("option-image")).toBe(true);

            // style applied from config at mount
            expect(img.style.width).toBe("50px");
            expect(img.style.height).toBe("40px");
            expect(img.style.borderRadius).toBe("5px");
        });
    });

    describe("Reactive updates after mount (applyPartialChange)", () => {
        test("isMultiple toggles class and switches input type (radio <-> checkbox)", () => {
            const view = new OptionView(parent);
            view.mount();

            const root = view.getView();
            const input = view.view!.tags.OptionInput;

            // initial single
            expect(root.classList.contains("multiple")).toBe(false);
            expect(input.type).toBe("radio");

            view.isMultiple = true;
            expect(root.classList.contains("multiple")).toBe(true);
            expect(input.type).toBe("checkbox");

            // set again to same value should be no-op (proxy guard)
            const typeBefore = input.type;
            view.isMultiple = true;
            expect(input.type).toBe(typeBefore);

            view.isMultiple = false;
            expect(root.classList.contains("multiple")).toBe(false);
            expect(input.type).toBe("radio");
        });

        test("hasImage=true creates image and adds classes; hasImage=false removes image and cleans classes", () => {
            const view = new OptionView(parent);
            view.mount();

            const root = view.getView();
            expect(root.classList.contains("has-image")).toBe(false);
            expect(view.view!.tags.OptionImage).toBeNull();

            // enable image
            view.hasImage = true;

            expect(root.classList.contains("has-image")).toBe(true);
            // default config imagePosition is "right" so class should include image-right
            expect(root.className).toContain("image-right");

            const img1 = view.view!.tags.OptionImage as HTMLImageElement;
            expect(img1).toBeTruthy();
            expect(root.querySelectorAll("img.option-image").length).toBe(1);

            // calling hasImage=true again should NOT create another image
            view.hasImage = true;
            expect(root.querySelectorAll("img.option-image").length).toBe(1);

            // disable image
            view.hasImage = false;

            expect(root.classList.contains("has-image")).toBe(false);
            expect(root.className).not.toMatch(/image-(top|right|bottom|left)/);
            expect(view.view!.tags.OptionImage).toBeNull();
            expect(root.querySelector("img.option-image")).toBeNull();
        });

        test("imagePosition updates root class only when hasImage=true", () => {
            const view = new OptionView(parent);
            view.mount();
            const root = view.getView();

            // hasImage=false => changing imagePosition should not mutate DOM classes
            view.optionConfig = { imagePosition: "left" } as any;
            expect(root.className).not.toMatch(/image-(top|right|bottom|left)/);

            // enable image => should use latest config value ("left"), not default
            view.hasImage = true;
            expect(root.classList.contains("has-image")).toBe(true);
            expect(root.className).toContain("image-left");

            // now change position while hasImage=true => should replace image-left with image-right
            view.optionConfig = { imagePosition: "right" } as any;
            expect(root.className).toContain("image-right");
            expect(root.className).not.toContain("image-left");
        });

        test("imageWidth/Height/BorderRadius update image inline styles when image exists", () => {
            const view = new OptionView(parent);
            view.hasImage = true;
            view.mount();

            const img = view.view!.tags.OptionImage as HTMLImageElement;
            expect(img).toBeTruthy();

            view.optionConfig = {
                imageWidth: "10px",
                imageHeight: "11px",
                imageBorderRadius: "12px",
            } as any;

            expect(img.style.width).toBe("10px");
            expect(img.style.height).toBe("11px");
            expect(img.style.borderRadius).toBe("12px");
        });

        test("labelValign/Halign update label className", () => {
            const view = new OptionView(parent);
            view.mount();

            const label = view.view!.tags.OptionLabel as HTMLLabelElement;
            expect(label.className).toContain("align-vertical-center");
            expect(label.className).toContain("align-horizontal-left");

            view.optionConfig = {
                labelValign: "top",
                labelHalign: "right",
            } as any;

            expect(label.className).toBe(
                "align-vertical-top align-horizontal-right",
            );
        });

        test("optionConfig batch setter only applies diffed properties (proxy guard)", () => {
            const view = new OptionView(parent);
            view.hasImage = true;
            view.mount();

            const spy = jest.spyOn(view as any, "applyPartialChange");

            // default imageWidth is "60px" => setting same should produce no changes
            view.optionConfig = { imageWidth: "60px" } as any;
            expect(spy).not.toHaveBeenCalled();

            // change width => should call applyPartialChange for imageWidth
            view.optionConfig = { imageWidth: "61px" } as any;
            expect(spy).toHaveBeenCalled();
            // you can be stricter if needed:
            // expect(spy).toHaveBeenCalledWith("imageWidth", "61px", "60px");
        });
    });

    describe("Libs integration sanity", () => {
        test("mount() calls Libs.randomString(7) and Libs.mountNode once", () => {
            const view = new OptionView(parent);
            view.mount();

            expect(randomStringMock).toHaveBeenCalledWith(7);
            expect(mountNodeMock).toHaveBeenCalledTimes(1);
        });
    });
});
