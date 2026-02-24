/**
 * @jest-environment jsdom
 *
 * Unit tests for AccessoryBox (src/ts/components/accessorybox.ts)
 * Focus:
 * - lifecycle guards (init/mount/update)
 * - refreshLocation insertion (top/bottom)
 * - setModelData render + click flow + show/hide rules
 * - destroy idempotency and no-op after destroy
 */

const mountNodeMock = jest.fn();
const triggerMock = jest.fn();

jest.mock("src/ts/utils/libs", () => ({
    Libs: {
        mountNode: (...args: any[]) => mountNodeMock(...args),
    },
}));

jest.mock("src/ts/utils/ievents", () => ({
    iEvents: {
        trigger: (...args: any[]) => triggerMock(...args),
    },
}));

import { AccessoryBox } from "src/ts/components/accessorybox";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

type AnyObj = Record<string, any>;

/**
 * Minimal recursive DOM builder for Libs.mountNode configs used in AccessoryBox.
 * Supports:
 * - tag.node / classList / role / ariaLabel / title / innerHTML
 * - onclick / onmouseup
 * - appending into provided parent
 */
function createElFromTag(tag: AnyObj): HTMLElement {
    // If tag is already an element (some mount systems allow passing nodes)
    if (tag instanceof HTMLElement) return tag;

    const el = document.createElement(tag.node ?? "div");

    // classList: array or string
    if (Array.isArray(tag.classList))
        tag.classList.forEach((c: any) => el.classList.add(String(c)));
    else if (typeof tag.classList === "string") el.className = tag.classList;

    // attributes
    if (tag.role) el.setAttribute("role", String(tag.role));
    if (tag.ariaLabel) el.setAttribute("aria-label", String(tag.ariaLabel));
    if (tag.title) el.setAttribute("title", String(tag.title));

    // content
    if (tag.innerHTML != null) el.innerHTML = String(tag.innerHTML);
    if (tag.textContent != null) el.textContent = String(tag.textContent);

    // handlers
    if (typeof tag.onclick === "function") (el as any).onclick = tag.onclick;
    if (typeof tag.onmouseup === "function")
        (el as any).onmouseup = tag.onmouseup;

    return el;
}

function buildTree(nodeDef: AnyObj): { root: HTMLElement; tags: AnyObj } {
    // nodeDef shape: { SomeName: { tag: {...}, child: {...} } }
    const topKey = Object.keys(nodeDef)[0];
    const def = nodeDef[topKey];
    const root = createElFromTag(def.tag);
    const tags: AnyObj = {};

    function walkChildren(children: AnyObj, parent: HTMLElement) {
        if (!children) return;
        for (const key of Object.keys(children)) {
            const childDef = children[key];
            const childEl = createElFromTag(childDef.tag);
            parent.appendChild(childEl);
            tags[key] = childEl;

            // recurse
            if (childDef.child) walkChildren(childDef.child, childEl);
        }
    }

    if (def.child) walkChildren(def.child, root);
    return { root, tags };
}

describe("AccessoryBox", () => {
    let maskParent: HTMLDivElement;
    let mask: HTMLDivElement;

    beforeEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();

        maskParent = document.createElement("div");
        mask = document.createElement("div");
        mask.className = "mask";
        maskParent.appendChild(mask);
        document.body.appendChild(maskParent);

        // Default mountNode behavior:
        // - If parent is provided, append built root into parent and return { view: root, tags: { id } }
        // - Else return { view: root, tags: { id } }
        mountNodeMock.mockImplementation(
            (cfg: AnyObj, parent?: HTMLElement | null) => {
                const { root, tags } = buildTree(cfg);
                if (parent) parent.appendChild(root);
                // Provide tags.id because some typings in repo require it
                return {
                    view: root,
                    tags: { ...tags, id: root.id || "mock-id" },
                };
            },
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    function makeOptions(overrides: Partial<any> = {}) {
        return {
            accessoryStyle: "bottom",
            accessoryVisible: true,
            multiple: true,
            textAccessoryDeselect: "Remove: ",
            ...overrides,
        };
    }

    function makeModelManager() {
        return {
            triggerChanging: jest.fn().mockResolvedValue(undefined),
        } as any;
    }

    function makeOptionModel(text = "<b>A</b>", textContent = "A") {
        let _selected = true;
        const selectedSet = jest.fn((v: boolean) => {
            _selected = v;
        });

        const opt: any = {
            text,
            textContent,
            get selected() {
                return _selected;
            },
            set selected(v: boolean) {
                selectedSet(v);
            },
            __selectedSet: selectedSet,
        };

        return opt;
    }

    test("init() creates root node with base classes and onmouseup stopPropagation", () => {
        const box = new AccessoryBox(makeOptions());

        // init should have run via constructor -> initialize -> init
        // (node is private; we can find the created node via mountNodeMock return: appended nowhere yet)
        // But our mountNodeMock doesn't auto-append for init (parent is undefined),
        // so we can locate it through the return value by re-reading mock calls.
        expect(mountNodeMock).toHaveBeenCalled();

        // verify the config passed to mountNode for root contains expected classes + onmouseup
        const initCfg = mountNodeMock.mock.calls[0][0];
        const tag = initCfg.AccessoryBox.tag;

        expect(tag.classList).toEqual(["seui-accessorybox", "hide"]);
        expect(typeof tag.onmouseup).toBe("function");

        // simulate onmouseup stopPropagation
        const evt = { stopPropagation: jest.fn() } as any;
        tag.onmouseup(evt);
        expect(evt.stopPropagation).toHaveBeenCalledTimes(1);

        // state should be INITIALIZED after init
        expect((box as any).state).toBe(LifecycleState.INITIALIZED);
    });

    test("setRoot places node AFTER mask by default (accessoryStyle != 'top')", () => {
        const box = new AccessoryBox(makeOptions({ accessoryStyle: "bottom" }));
        // create a sibling after mask to ensure insertion point is correct
        const after = document.createElement("div");
        after.className = "after";
        maskParent.appendChild(after);

        box.setRoot(mask);

        const nodes = Array.from(maskParent.children);
        // Expect order: mask, accessorybox, after
        expect(nodes[0]).toBe(mask);
        expect(
            (nodes[1] as HTMLElement).classList.contains("seui-accessorybox"),
        ).toBe(true);
        expect(nodes[2]).toBe(after);

        // mount should have happened
        expect((box as any).state).toBe(LifecycleState.MOUNTED);
    });

    test("setRoot places node BEFORE mask when accessoryStyle === 'top'", () => {
        const box = new AccessoryBox(makeOptions({ accessoryStyle: "top" }));
        box.setRoot(mask);

        const nodes = Array.from(maskParent.children);
        // Expect order: accessorybox, mask
        expect(
            (nodes[0] as HTMLElement).classList.contains("seui-accessorybox"),
        ).toBe(true);
        expect(nodes[1]).toBe(mask);
        expect((box as any).state).toBe(LifecycleState.MOUNTED);
    });

    test("mount() is guarded: calling mount before init does nothing", () => {
        // create box without options => initialize not called => state NEW
        const box = new AccessoryBox(null as any);

        expect((box as any).state).toBe(LifecycleState.NEW);

        // calling mount directly should no-op (guard requires INITIALIZED)
        expect(() => box.mount()).not.toThrow();
        expect((box as any).state).toBe(LifecycleState.NEW);
    });

    test("setModelData renders chips only when multiple=true and list non-empty; triggers resize event", async () => {
        const box = new AccessoryBox(
            makeOptions({ multiple: true, accessoryVisible: true }),
        );
        const mm = makeModelManager();
        box.setModelManager(mm);
        box.setRoot(mask);

        const opt = makeOptionModel("<b>A</b>", "A");
        box.setModelData([opt]);

        // should trigger global resize
        expect(triggerMock).toHaveBeenCalledWith(window, "resize");

        // accessory should be visible (remove hide)
        const accessoryNode = maskParent.querySelector(
            ".seui-accessorybox",
        ) as HTMLDivElement;
        expect(accessoryNode).toBeTruthy();
        expect(accessoryNode.classList.contains("hide")).toBe(false);

        // chip DOM exists
        const chip = accessoryNode.querySelector(
            ".accessory-item",
        ) as HTMLElement;
        expect(chip).toBeTruthy();

        const btn = accessoryNode.querySelector(
            ".accessory-item-button",
        ) as HTMLElement;
        const content = accessoryNode.querySelector(
            ".accessory-item-content",
        ) as HTMLElement;

        expect(btn.getAttribute("role")).toBe("button");
        expect(btn.getAttribute("aria-label")).toBe("Remove: A");
        expect(btn.getAttribute("title")).toBe("Remove: A");
        expect(content.innerHTML).toBe("<b>A</b>");

        // click flow: preventDefault + await triggerChanging('select') + selected=false
        const clickEvt = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
        });
        // dispatchEvent triggers onclick in jsdom
        btn.dispatchEvent(clickEvt);

        // preventDefault should be called inside handler => event default prevented
        expect(clickEvt.defaultPrevented).toBe(true);

        // await microtasks for async onclick
        await Promise.resolve();

        expect(mm.triggerChanging).toHaveBeenCalledWith("select");
        expect(opt.__selectedSet).toHaveBeenCalledWith(false);
    });

    test("setModelData normalizes to empty list when multiple=false or list empty; hides box", () => {
        // multiple=false
        const box = new AccessoryBox(
            makeOptions({ multiple: false, accessoryVisible: true }),
        );
        box.setRoot(mask);

        box.setModelData([makeOptionModel("X", "X")]);

        const accessoryNode = maskParent.querySelector(
            ".seui-accessorybox",
        ) as HTMLDivElement;
        expect(accessoryNode.classList.contains("hide")).toBe(true);
        expect(accessoryNode.querySelector(".accessory-item")).toBeNull();

        // empty list with multiple=true
        const box2 = new AccessoryBox(
            makeOptions({ multiple: true, accessoryVisible: true }),
        );
        box2.setRoot(mask);

        box2.setModelData([]);

        const accessoryNode2 = maskParent.querySelectorAll(
            ".seui-accessorybox",
        )[1] as HTMLDivElement;
        expect(accessoryNode2.classList.contains("hide")).toBe(true);
        expect(accessoryNode2.querySelector(".accessory-item")).toBeNull();
    });

    test("accessoryVisible=false forces hide even when multiple and list non-empty", () => {
        const box = new AccessoryBox(
            makeOptions({ multiple: true, accessoryVisible: false }),
        );
        box.setRoot(mask);

        box.setModelData([makeOptionModel("X", "X")]);

        const accessoryNode = maskParent.querySelector(
            ".seui-accessorybox",
        ) as HTMLDivElement;
        expect(accessoryNode.classList.contains("hide")).toBe(true);
    });

    test("update() is guarded: does nothing when not mounted", () => {
        const box = new AccessoryBox(makeOptions());
        // not mounted because setRoot not called yet
        expect((box as any).state).toBe(LifecycleState.INITIALIZED);

        // update should no-op (guard requires MOUNTED)
        expect(() => box.update()).not.toThrow();
        expect((box as any).state).toBe(LifecycleState.INITIALIZED);
    });

    test("destroy() removes node, clears references, and is idempotent", () => {
        const box = new AccessoryBox(makeOptions());
        box.setRoot(mask);

        const accessoryNode = maskParent.querySelector(
            ".seui-accessorybox",
        ) as HTMLDivElement;
        expect(accessoryNode).toBeTruthy();

        box.destroy();

        expect(maskParent.querySelector(".seui-accessorybox")).toBeNull();
        expect((box as any).state).toBe(LifecycleState.DESTROYED);

        // idempotent
        expect(() => box.destroy()).not.toThrow();
    });

    test("setModelData is no-op after destroy (does not throw, does not trigger resize)", () => {
        const box = new AccessoryBox(makeOptions());
        box.setRoot(mask);
        box.destroy();

        triggerMock.mockClear();

        expect(() =>
            box.setModelData([makeOptionModel("X", "X")]),
        ).not.toThrow();
        expect(triggerMock).not.toHaveBeenCalled();
    });

    test("refreshLocation is tolerant when anchors/options missing (no throw)", () => {
        const box = new AccessoryBox(makeOptions());

        // simulate missing DOM anchors by not calling setRoot yet
        expect(() => box.refreshLocation()).not.toThrow();

        // simulate options missing (private) by force-null and call refreshLocation again
        (box as any).options = null;
        expect(() => box.refreshLocation()).not.toThrow();
    });
});