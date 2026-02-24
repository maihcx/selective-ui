/**
 * @jest-environment jsdom
 *
 * Unit tests for View (src/ts/core/base/view.ts)
 *
 * Focus:
 * - getView() throws when not mounted
 * - getView() returns root element when mounted
 * - destroy() removes root element, clears references, and is idempotent
 */

import { MountViewResult } from "src/ts/types/utils/libs.type";
import { View } from "../../../../src/ts/core/base/view";

describe("View<TTags>", () => {
    type Tags = { Any: HTMLElement };
    
    function makeMountedView(root: HTMLElement): MountViewResult<Tags> {
        const mounted = {
            view: root,
            tags: { id: "test-id" },
        };

        return mounted as unknown as MountViewResult<Tags>;
    }


    test("constructor sets parent and initializes lifecycle (no throw)", () => {
        const parent = document.createElement("div");
        const v = new View<Tags>(parent);

        expect(v.parent).toBe(parent);
        // view is not set by base constructor
        expect(v.view).toBeNull();
    });

    test("getView() throws if view is not mounted (view is null)", () => {
        const parent = document.createElement("div");
        const v = new View<Tags>(parent);

        expect(() => v.getView()).toThrow("View is not mounted");
    });

    test("getView() throws if view.view is missing", () => {
        const parent = document.createElement("div");
        const v = new View<Tags>(parent);

        // simulate incorrect mount shape
        (v as any).view = { view: null, tags: {} };

        expect(() => v.getView()).toThrow("View is not mounted");
    });

    test("getView() returns the root element when mounted", () => {
        const parent = document.createElement("div");
        const v = new View<Tags>(parent);

        const root = document.createElement("div");
        root.id = "root";

        // simulate mount performed by framework/subclass
        v.view = makeMountedView(root);

        expect(v.getView()).toBe(root);
        expect(v.getView().id).toBe("root");
    });

    test("destroy() removes root element, clears refs, and is idempotent", () => {
        const parent = document.createElement("div");
        document.body.appendChild(parent);

        const v = new View<Tags>(parent);

        const root = document.createElement("div");
        root.id = "root";
        parent.appendChild(root);

        v.view = makeMountedView(root);

        // sanity
        expect(parent.contains(root)).toBe(true);

        const removeSpy = jest.spyOn(root, "remove");

        v.destroy();

        // removed once
        expect(removeSpy).toHaveBeenCalledTimes(1);
        expect(parent.contains(root)).toBe(false);

        // refs cleared
        expect(v.parent).toBeNull();
        expect(v.view).toBeNull();

        // idempotent: second destroy should early-return (no throw, no extra remove)
        expect(() => v.destroy()).not.toThrow();
        expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    test("destroy() is safe even if root element has no remove() (defensive optional chaining)", () => {
        const parent = document.createElement("div");
        const v = new View<Tags>(parent);

        // mount a fake root without remove function
        const fakeRoot: any = { id: "fake-root" };
        v.view = { view: fakeRoot, tags: {} as Tags } as any;

        // destroy should not throw because it uses ?.remove?.()
        expect(() => v.destroy()).not.toThrow();
        expect(v.parent).toBeNull();
        expect(v.view).toBeNull();
    });
});
