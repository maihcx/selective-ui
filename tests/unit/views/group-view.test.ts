/**
 * @jest-environment jsdom
 *
 * Unit Tests for GroupView (rewritten, stable & higher branch coverage)
 */

const randomStringMock = jest.fn();
const mountNodeMock = jest.fn();

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        randomString: (...args: any[]) => randomStringMock(...args),
        mountNode: (...args: any[]) => mountNodeMock(...args),
    },
}));

import { GroupView } from "../../../src/ts/views/group-view";

function createElementFromTag(tag: any): HTMLElement {
    // tag can be either:
    // - an HTMLElement itself (some mount systems allow passing existing nodes)
    // - a config object { node, classList, role, id, ariaLabelledby, ... }
    if (tag instanceof HTMLElement) return tag;

    const el = document.createElement(tag.node ?? "div");

    // classList may be array or string
    if (Array.isArray(tag.classList)) {
        tag.classList.forEach((c: string) => el.classList.add(c));
    } else if (typeof tag.classList === "string") {
        el.className = tag.classList;
    }

    if (tag.role) el.setAttribute("role", String(tag.role));
    if (tag.id) el.id = String(tag.id);

    // mountNode in your code uses ariaLabelledby prop (camelCase)
    if (tag.ariaLabelledby)
        el.setAttribute("aria-labelledby", String(tag.ariaLabelledby));

    return el;
}

function buildMountResultFromConfig(cfg: any) {
    // cfg shape from GroupView.mount():
    // { GroupView: { tag: {...}, child: { GroupHeader: {tag:{...}}, GroupItems:{tag:{...}} } } }
    const rootCfg = cfg?.GroupView?.tag ?? {};
    const headerCfg = cfg?.GroupView?.child?.GroupHeader?.tag ?? {};
    const itemsCfg = cfg?.GroupView?.child?.GroupItems?.tag ?? {};

    const root = createElementFromTag(rootCfg) as HTMLDivElement;
    const header = createElementFromTag(headerCfg) as HTMLDivElement;
    const items = createElementFromTag(itemsCfg) as HTMLDivElement;

    root.appendChild(header);
    root.appendChild(items);

    // NOTE: Some of your MountViewResult typings require tags include { id: string }.
    // Provide it to satisfy runtime and reduce TS friction.
    return {
        view: root,
        tags: {
            GroupHeader: header,
            GroupItems: items,
            id: root.id || "mock-id",
        },
    } as any;
}

describe("GroupView (rewritten)", () => {
    let parent: HTMLDivElement;

    beforeEach(() => {
        document.body.innerHTML = "";
        parent = document.createElement("div");
        document.body.appendChild(parent);

        jest.clearAllMocks();

        // Stabilize IDs: GroupView.mount uses Libs.randomString(7)
        randomStringMock.mockReturnValue("ABC1234");

        // Create DOM for view based on the mount config passed into Libs.mountNode
        mountNodeMock.mockImplementation((cfg: any) =>
            buildMountResultFromConfig(cfg),
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    describe("No-op guards before mount (branch coverage)", () => {
        test("updateLabel() is no-op when not mounted", () => {
            const view = new GroupView(parent);
            expect(() => view.updateLabel("X")).not.toThrow();
            // still not mounted
            expect(view.view).toBeNull();
        });

        test("updateVisibility() is no-op when not mounted", () => {
            const view = new GroupView(parent);
            expect(() => view.updateVisibility()).not.toThrow();
            expect(view.view).toBeNull();
        });

        test("setCollapsed() is no-op when not mounted", () => {
            const view = new GroupView(parent);
            expect(() => view.setCollapsed(true)).not.toThrow();
            expect(view.view).toBeNull();
        });

        test("getItemsContainer() throws when not mounted", () => {
            const view = new GroupView(parent);
            expect(() => view.getItemsContainer()).toThrow(
                "GroupView has not been rendered.",
            );
        });
    });

    describe("Rendering – parent append & roles", () => {
        test("mount() appends root view to parent container", () => {
            const view = new GroupView(parent);
            view.mount();

            const viewEl = view.getView();
            expect(parent.contains(viewEl)).toBe(true);
            expect(viewEl.classList.contains("seui-group")).toBe(true);
        });

        test("mount() sets proper roles on root/header/items", () => {
            const view = new GroupView(parent);
            view.mount();

            const root = view.getView();
            const header = view.view!.tags.GroupHeader;
            const items = view.view!.tags.GroupItems;

            expect(root.getAttribute("role")).toBe("group");
            expect(header.getAttribute("role")).toBe("presentation");
            expect(items.getAttribute("role")).toBe("group");
        });
    });

    describe("ARIA linkage + IDs (stable)", () => {
        test("root aria-labelledby points to header id", () => {
            const view = new GroupView(parent);
            view.mount();

            const root = view.getView();
            const header = view.view!.tags.GroupHeader;

            expect(root.getAttribute("aria-labelledby")).toBe(header.id);
        });

        test('ids follow "seui-<token>-group" and "seui-<token>-header" with same token', () => {
            const view = new GroupView(parent);
            view.mount();

            const root = view.getView();
            const header = view.view!.tags.GroupHeader;

            expect(root.id).toBe("seui-ABC1234-group");
            expect(header.id).toBe("seui-ABC1234-header");

            const rootToken = root.id
                .replace(/^seui-/, "")
                .replace(/-group$/, "");
            const headerToken = header.id
                .replace(/^seui-/, "")
                .replace(/-header$/, "");
            expect(rootToken).toBe(headerToken);
        });
    });

    describe("Update lifecycle behavior", () => {
        test("update() delegates to updateLabel()", () => {
            const view = new GroupView(parent);
            view.mount();

            const spy = jest.spyOn(view, "updateLabel");
            view.update();

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test("updateLabel(label) updates header textContent", () => {
            const view = new GroupView(parent);
            view.mount();

            const header = view.view!.tags.GroupHeader;
            expect(header.textContent).toBe(""); // initial

            view.updateLabel("Hello");
            expect(header.textContent).toBe("Hello");
        });

        test("updateLabel(null) preserves existing header text", () => {
            const view = new GroupView(parent);
            view.mount();

            const header = view.view!.tags.GroupHeader;
            header.textContent = "Initial Label";

            view.updateLabel(null);

            expect(header.textContent).toBe("Initial Label");
        });
    });

    describe("Collapse State", () => {
        test('setCollapsed(true) adds "collapsed" class and aria-expanded="false"', () => {
            const view = new GroupView(parent);
            view.mount();

            view.setCollapsed(true);

            const root = view.getView();
            const header = view.view!.tags.GroupHeader;

            expect(root.classList.contains("collapsed")).toBe(true);
            expect(header.getAttribute("aria-expanded")).toBe("false");
        });

        test('setCollapsed(false) removes "collapsed" class and aria-expanded="true"', () => {
            const view = new GroupView(parent);
            view.mount();

            // Start collapsed then expand
            view.setCollapsed(true);
            expect(view.getView().classList.contains("collapsed")).toBe(true);

            view.setCollapsed(false);

            const root = view.getView();
            const header = view.view!.tags.GroupHeader;

            expect(root.classList.contains("collapsed")).toBe(false);
            expect(header.getAttribute("aria-expanded")).toBe("true");
        });
    });

    describe("Visibility (children hide class)", () => {
        test("updateVisibility() hides root when there are no visible children (0 children case)", () => {
            const view = new GroupView(parent);
            view.mount();

            // no children added to GroupItems
            view.updateVisibility();

            expect(view.getView().classList.contains("hide")).toBe(true);
        });

        test("updateVisibility() shows root when at least one child is visible among hidden children", () => {
            const view = new GroupView(parent);
            view.mount();

            const items = view.view!.tags.GroupItems;

            const hiddenChild = document.createElement("div");
            hiddenChild.classList.add("hide");

            const visibleChild = document.createElement("div"); // no hide class

            items.appendChild(hiddenChild);
            items.appendChild(visibleChild);

            view.updateVisibility();

            expect(view.getView().classList.contains("hide")).toBe(false);
        });

        test("updateVisibility() hides root when all children are hidden (multiple)", () => {
            const view = new GroupView(parent);
            view.mount();

            const items = view.view!.tags.GroupItems;

            const hidden1 = document.createElement("div");
            hidden1.classList.add("hide");

            const hidden2 = document.createElement("div");
            hidden2.classList.add("hide");

            items.appendChild(hidden1);
            items.appendChild(hidden2);

            view.updateVisibility();

            expect(view.getView().classList.contains("hide")).toBe(true);
        });
    });

    describe("Items Container – identity & type", () => {
        test("getItemsContainer() returns the same element as GroupItems tag", () => {
            const view = new GroupView(parent);
            view.mount();

            const containerEl = view.getItemsContainer();
            const tagEl = view.view!.tags.GroupItems;

            expect(containerEl).toBe(tagEl);
        });

        test("items container should be an HTMLDivElement", () => {
            const view = new GroupView(parent);
            view.mount();

            const containerEl = view.getItemsContainer();
            expect(containerEl).toBeInstanceOf(HTMLDivElement);
        });
    });

    describe("Libs integration (mountNode/randomString called correctly)", () => {
        test("mount() calls Libs.randomString(7) and Libs.mountNode once", () => {
            const view = new GroupView(parent);
            view.mount();

            expect(randomStringMock).toHaveBeenCalledWith(7);
            expect(mountNodeMock).toHaveBeenCalledTimes(1);
        });
    });
});