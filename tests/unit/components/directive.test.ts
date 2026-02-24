/**
 * @jest-environment jsdom
 *
 * Directive unit tests (src/ts/components/directive.ts)
 *
 * Coverage focus:
 * - init() side effects (Libs.nodeCreator config, a11y attrs)
 * - setDropdown(true/false) branches
 * - destroy() idempotency guard (DESTROYED early return)
 */

const nodeCreatorMock = jest.fn();

// Mock Libs.nodeCreator used by Directive.init()
jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        nodeCreator: (...args: any[]) => nodeCreatorMock(...args),
    },
}));

import { Directive } from "../../../src/ts/components/directive";

function makeNodeFromConfig(cfg: any): HTMLElement {
    const el = document.createElement(cfg.node ?? "div");
    if (cfg.classList) el.className = String(cfg.classList);
    if (cfg.role) el.setAttribute("role", String(cfg.role));
    if (cfg.ariaLabel) el.setAttribute("aria-label", String(cfg.ariaLabel));
    return el;
}

describe("Directive", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        nodeCreatorMock.mockImplementation((cfg: any) =>
            makeNodeFromConfig(cfg),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("init() / constructor()", () => {
        test("constructor() initializes immediately via init() and creates DOM node via Libs.nodeCreator", () => {
            const d = new Directive();

            expect(nodeCreatorMock).toHaveBeenCalledTimes(1);
            expect(nodeCreatorMock).toHaveBeenCalledWith({
                node: "div",
                classList: "seui-directive",
                role: "button",
                ariaLabel: "Toggle dropdown",
            });

            expect(d.node).toBeInstanceOf(HTMLElement);
            expect(d.node.classList.contains("seui-directive")).toBe(true);

            // a11y attrs
            expect(d.node.getAttribute("role")).toBe("button");
            expect(d.node.getAttribute("aria-label")).toBe("Toggle dropdown");
        });
    });

    describe("setDropdown(value) branches", () => {
        test("setDropdown(true) adds 'drop-down' class", () => {
            const d = new Directive();
            expect(d.node.classList.contains("drop-down")).toBe(false);

            d.setDropdown(true);
            expect(d.node.classList.contains("drop-down")).toBe(true);
        });

        test("setDropdown(false) removes 'drop-down' class", () => {
            const d = new Directive();

            d.setDropdown(true);
            expect(d.node.classList.contains("drop-down")).toBe(true);

            d.setDropdown(false);
            expect(d.node.classList.contains("drop-down")).toBe(false);
        });

        test("setDropdown is safe to call repeatedly (idempotency-ish)", () => {
            const d = new Directive();

            d.setDropdown(true);
            d.setDropdown(true);
            expect(d.node.classList.contains("drop-down")).toBe(true);

            d.setDropdown(false);
            d.setDropdown(false);
            expect(d.node.classList.contains("drop-down")).toBe(false);
        });
    });

    describe("destroy() FSM/idempotency", () => {
        test("destroy() removes node from DOM and nulls references", () => {
            const d = new Directive();
            document.body.appendChild(d.node);

            const removeSpy = jest.spyOn(d.node, "remove");

            expect(document.body.contains(d.node)).toBe(true);

            d.destroy();

            // node.remove() called once
            expect(removeSpy).toHaveBeenCalledTimes(1);

            // node reference nulled
            expect(d.node).toBeNull();
        });

        test("destroy() is idempotent: second call early-returns and does not throw", () => {
            const d = new Directive();
            document.body.appendChild(d.node);

            const removeSpy = jest.spyOn(d.node, "remove");

            d.destroy();
            expect(removeSpy).toHaveBeenCalledTimes(1);

            // Second destroy should not attempt another remove and should not throw
            expect(() => d.destroy()).not.toThrow();
            expect(removeSpy).toHaveBeenCalledTimes(1);
        });
    });
});
