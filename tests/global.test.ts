/**
 * @jest-environment jsdom
 *
 * Tests for SelectiveUI entry module (src/ts/global.ts) in JSDOM env.
 * Covers:
 * - DOM ready branching (loading vs complete)
 * - init idempotency
 * - mousedown branches
 * - duplicate load
 * - public API passthrough
 */

import { LibsMock, SelectiveMockInstance } from "./__mocks__/selective";

function createSelectiveMock(): SelectiveMockInstance {
    return {
        bind: jest.fn(),
        find: jest.fn(),
        destroy: jest.fn(),
        rebind: jest.fn(),
        registerPlugin: jest.fn(),
        unregisterPlugin: jest.fn(),
        Observer: jest.fn(),
    };
}

function setReadyState(value: DocumentReadyState) {
    // readyState is configurable in JSDOM; this is safe
    Object.defineProperty(document, "readyState", {
        configurable: true,
        value,
    });
}

describe("SelectiveUI Entry Module (global.ts) [jsdom]", () => {
    function resetEntryModule() {
        jest.resetModules();
        jest.clearAllMocks();
        delete (globalThis as any).GLOBAL_SEUI;
    }

    function loadEntryModule() {
        let entry: any;
        jest.isolateModules(() => {
            entry = require("../src/ts/global");
        });
        return entry;
    }

    /**
     * Mock deps BEFORE requiring global.ts.
     * IMPORTANT: global.ts instantiates new Selective() at import-time.
     */
    function mockDeps(opts?: {
        selectiveInstance?: SelectiveMockInstance;
        libsMock?: Partial<LibsMock>;
        effectorImpl?: any;
    }) {
        const selectiveInstance =
            opts?.selectiveInstance ?? createSelectiveMock();

        const selectiveAbs = require.resolve("../src/ts/utils/selective");
        jest.doMock(selectiveAbs, () => ({
            Selective: jest.fn().mockImplementation(() => selectiveInstance),
        }));

        const libsAbs = require.resolve("../src/ts/utils/libs");
        const libsMock: LibsMock = {
            getBindedCommand: jest.fn().mockReturnValue([]),
            ...(opts?.libsMock ?? {}),
        };
        jest.doMock(libsAbs, () => ({ Libs: libsMock }));

        const effectorAbs = require.resolve("../src/ts/services/effector");
        const effectorFn =
            opts?.effectorImpl ?? jest.fn((el: any) => ({ el, __fx: true }));
        jest.doMock(effectorAbs, () => ({ Effector: effectorFn }));

        return { selectiveInstance, libsMock, effectorFn };
    }

    afterEach(() => {
        jest.restoreAllMocks();
        // don't touch globalThis.document here (non-configurable in jsdom env)
        try {
            jest.dontMock(require.resolve("../src/ts/utils/selective"));
            jest.dontMock(require.resolve("../src/ts/utils/libs"));
            jest.dontMock(require.resolve("../src/ts/services/effector"));
        } catch {
            // ignore
        }
    });

    describe("First load (document.readyState === 'loading')", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("loading");
        });

        test("initializes GLOBAL_SEUI and registers DOMContentLoaded listener", () => {
            const { selectiveInstance } = mockDeps();
            const addEventSpy = jest.spyOn(document, "addEventListener");

            const entry = loadEntryModule();

            expect(globalThis.GLOBAL_SEUI).toBeDefined();
            expect(typeof globalThis.GLOBAL_SEUI.bind).toBe("function");
            expect(typeof globalThis.GLOBAL_SEUI.find).toBe("function");
            expect(typeof globalThis.GLOBAL_SEUI.destroy).toBe("function");

            expect(addEventSpy).toHaveBeenCalledWith(
                "DOMContentLoaded",
                expect.any(Function),
            );

            // init deferred
            expect(selectiveInstance.Observer).not.toHaveBeenCalled();

            expect(entry.version).toBeDefined();
            expect(entry.name).toBeDefined();
        });

        test("DOMContentLoaded triggers init exactly once (idempotency)", () => {
            const { selectiveInstance } = mockDeps();
            const addEventSpy = jest.spyOn(document, "addEventListener");

            loadEntryModule();

            const domReadyCb = addEventSpy.mock.calls.find(
                (c) => c[0] === "DOMContentLoaded",
            )?.[1] as EventListener | undefined;

            expect(domReadyCb).toBeDefined();

            domReadyCb!(new Event("DOMContentLoaded"));
            domReadyCb!(new Event("DOMContentLoaded")); // should no-op

            expect(selectiveInstance.Observer).toHaveBeenCalledTimes(1);

            const mousedownCalls = addEventSpy.mock.calls.filter(
                (c) => c[0] === "mousedown",
            );
            expect(mousedownCalls).toHaveLength(1);
        });
    });

    describe("First load (document already ready)", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("complete");
        });

        test("initializes immediately, registers mousedown listener, and calls Observer()", () => {
            const { selectiveInstance } = mockDeps();
            const addEventSpy = jest.spyOn(document, "addEventListener");

            loadEntryModule();

            expect(globalThis.GLOBAL_SEUI).toBeDefined();
            expect(addEventSpy).toHaveBeenCalledWith(
                "mousedown",
                expect.any(Function),
            );
            expect(selectiveInstance.Observer).toHaveBeenCalledTimes(1);
        });
    });

    describe("mousedown handler branching", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("complete");
        });

        test("sels.length === 0 -> does not call find()", () => {
            const { selectiveInstance, libsMock } = mockDeps({
                libsMock: { getBindedCommand: jest.fn().mockReturnValue([]) },
            });

            loadEntryModule();
            document.dispatchEvent(new MouseEvent("mousedown"));

            expect(libsMock.getBindedCommand).toHaveBeenCalledTimes(1);
            expect(selectiveInstance.find).not.toHaveBeenCalled();
        });

        test("sels.length > 0 and actionApi.isEmpty === true -> does not call close()", () => {
            const closeSpy = jest.fn();
            const actionApi = { isEmpty: true, close: closeSpy };

            const { selectiveInstance } = mockDeps({
                libsMock: {
                    getBindedCommand: jest.fn().mockReturnValue([".select"]),
                },
            });

            loadEntryModule();

            // Set AFTER module load, persistent return (avoids undefined in handler)
            selectiveInstance.find.mockReturnValue(actionApi);

            document.dispatchEvent(new MouseEvent("mousedown"));

            expect(selectiveInstance.find).toHaveBeenCalledWith(".select");
            expect(closeSpy).not.toHaveBeenCalled();
        });

        test("sels.length > 0 and actionApi.isEmpty === false -> calls close()", () => {
            const closeSpy = jest.fn();
            const actionApi = { isEmpty: false, close: closeSpy };

            const { selectiveInstance } = mockDeps({
                libsMock: {
                    getBindedCommand: jest.fn().mockReturnValue([".select"]),
                },
            });

            loadEntryModule();

            // Persistent return avoids actionApi undefined
            selectiveInstance.find.mockReturnValue(actionApi);

            document.dispatchEvent(new MouseEvent("mousedown"));

            expect(selectiveInstance.find).toHaveBeenCalledWith(".select");
            expect(closeSpy).toHaveBeenCalledTimes(1);
        });

        test("multiple selectors -> join(', ') path", () => {
            const closeSpy = jest.fn();
            const actionApi = { isEmpty: false, close: closeSpy };

            const { selectiveInstance } = mockDeps({
                libsMock: {
                    getBindedCommand: jest.fn().mockReturnValue([".a", ".b"]),
                },
            });

            loadEntryModule();
            selectiveInstance.find.mockReturnValue(actionApi);

            document.dispatchEvent(new MouseEvent("mousedown"));

            expect(selectiveInstance.find).toHaveBeenCalledWith(".a, .b");
            expect(closeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("Duplicate load (GLOBAL_SEUI already exists)", () => {
        beforeEach(() => {
            resetEntryModule();
            (globalThis as any).GLOBAL_SEUI = {
                version: "1.0.0",
                name: "SelectiveUI",
                bind: jest.fn(),
                find: jest.fn(),
                destroy: jest.fn(),
                rebind: jest.fn(),
                effector: jest.fn(),
                registerPlugin: jest.fn(),
                unregisterPlugin: jest.fn(),
            };
            jest.spyOn(console, "warn").mockImplementation(() => {});
        });

        test("warns and reuses existing GLOBAL_SEUI", () => {
            mockDeps(); // irrelevant, init branch is skipped
            const entry = loadEntryModule();

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining("Already loaded"),
            );
            expect(entry.version).toBe("1.0.0");
            expect(entry.name).toBe("SelectiveUI");
        });
    });

    describe("Public API passthrough", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("complete");
        });

        test("bind / rebind / destroy / find delegate to Selective instance", () => {
            const { selectiveInstance } = mockDeps();
            const entry = loadEntryModule();

            entry.bind(".x", { searchable: true });
            entry.rebind(".y", { searchable: false });
            entry.destroy(".z");
            entry.destroy(null);
            entry.find(".x");

            expect(selectiveInstance.bind).toHaveBeenCalledWith(".x", {
                searchable: true,
            });
            expect(selectiveInstance.rebind).toHaveBeenCalledWith(".y", {
                searchable: false,
            });
            expect(selectiveInstance.destroy).toHaveBeenCalledWith(".z");
            expect(selectiveInstance.destroy).toHaveBeenCalledWith(null);
            expect(selectiveInstance.find).toHaveBeenCalledWith(".x");
        });

        test("registerPlugin / unregisterPlugin delegate to Selective instance", () => {
            const { selectiveInstance } = mockDeps();
            const entry = loadEntryModule();

            const plugin = { id: "p1" } as any;
            entry.registerPlugin(plugin);
            entry.unregisterPlugin("p1");

            expect(selectiveInstance.registerPlugin).toHaveBeenCalledWith(
                plugin,
            );
            expect(selectiveInstance.unregisterPlugin).toHaveBeenCalledWith(
                "p1",
            );
        });

        test("effector delegates to Effector factory", () => {
            const effectorImpl = jest.fn((el: any) => ({ el, ok: true }));
            const { effectorFn } = mockDeps({ effectorImpl });
            const entry = loadEntryModule();

            const div = document.createElement("div");
            document.body.appendChild(div);

            const fx = entry.effector(div);

            expect(effectorFn).toHaveBeenCalledWith(div);
            expect(fx).toEqual({ el: div, ok: true });
        });
    });
});
