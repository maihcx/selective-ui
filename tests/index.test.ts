import { LibsMock, SelectiveMockInstance } from "./__mocks__/selective";

/**
 * @jest-environment jsdom
 *
 * Tests for SelectiveUI entry module (src/ts/index.ts)
 * Focus:
 * - DOM ready branches (loading vs complete)
 * - init() idempotency (domInitialized guard)
 * - mousedown handler branches
 * - Public API passthrough (bind/find/rebind/destroy/plugins/effector)
 *
 * Key rule:
 * - index.ts instantiates `const SECLASS = new Selective()` at import time,
 *   so we MUST mock `./utils/selective` BEFORE requiring index.ts.
 */
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
    Object.defineProperty(document, "readyState", {
        configurable: true,
        value,
    });
}

describe("SelectiveUI Entry Module (index.ts) [jsdom]", () => {
    function resetEntryModule() {
        jest.resetModules();
        jest.clearAllMocks();
    }

    function loadEntryModule() {
        let entry: any;
        jest.isolateModules(() => {
            entry = require("../src/ts/index");
        });
        return entry;
    }

    function mockDeps(opts?: {
        selectiveInstance?: SelectiveMockInstance;
        libsMock?: Partial<LibsMock>;
        effectorImpl?: any;
    }) {
        const selectiveInstance =
            opts?.selectiveInstance ?? createSelectiveMock();

        // Mock Selective constructor used by: const SECLASS = new Selective()
        const selectiveAbs = require.resolve("../src/ts/utils/selective");
        jest.doMock(selectiveAbs, () => ({
            Selective: jest.fn().mockImplementation(() => selectiveInstance),
        }));

        // Mock Libs.getBindedCommand used by mousedown handler
        const libsAbs = require.resolve("../src/ts/utils/libs");
        const libsMock: LibsMock = {
            getBindedCommand: jest.fn().mockReturnValue([]),
            ...(opts?.libsMock ?? {}),
        };
        jest.doMock(libsAbs, () => ({ Libs: libsMock }));

        // Mock Effector factory
        const effectorAbs = require.resolve("../src/ts/services/effector");
        const effectorFn =
            opts?.effectorImpl ?? jest.fn((el: any) => ({ el, __fx: true }));
        jest.doMock(effectorAbs, () => ({ Effector: effectorFn }));

        return { selectiveInstance, libsMock, effectorFn };
    }

    afterEach(() => {
        jest.restoreAllMocks();
        try {
            jest.dontMock(require.resolve("../src/ts/utils/selective"));
            jest.dontMock(require.resolve("../src/ts/utils/libs"));
            jest.dontMock(require.resolve("../src/ts/services/effector"));
        } catch {
            // ignore
        }
    });

    describe("DOM ready branch: document.readyState === 'loading'", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("loading");
        });

        test("registers DOMContentLoaded listener (init deferred)", () => {
            const { selectiveInstance } = mockDeps();
            const addEvtSpy = jest.spyOn(document, "addEventListener");

            const entry = loadEntryModule();

            expect(entry).toBeDefined();
            expect(typeof entry.bind).toBe("function");
            expect(typeof entry.find).toBe("function");
            expect(typeof entry.destroy).toBe("function");
            expect(typeof entry.rebind).toBe("function");
            expect(typeof entry.registerPlugin).toBe("function");
            expect(typeof entry.unregisterPlugin).toBe("function");
            expect(typeof entry.effector).toBe("function");

            expect(addEvtSpy).toHaveBeenCalledWith(
                "DOMContentLoaded",
                expect.any(Function),
            );

            // init deferred => Observer not called yet
            expect(selectiveInstance.Observer).not.toHaveBeenCalled();
        });

        test("DOMContentLoaded triggers init only once (idempotency guard)", () => {
            const { selectiveInstance } = mockDeps();
            const addEvtSpy = jest.spyOn(document, "addEventListener");

            loadEntryModule();

            const domReadyCb = addEvtSpy.mock.calls.find(
                (c) => c[0] === "DOMContentLoaded",
            )?.[1] as EventListener | undefined;

            expect(domReadyCb).toBeDefined();

            // Fire twice => second call should early-return
            domReadyCb!(new Event("DOMContentLoaded"));
            domReadyCb!(new Event("DOMContentLoaded"));

            expect(selectiveInstance.Observer).toHaveBeenCalledTimes(1);

            const mousedownCalls = addEvtSpy.mock.calls.filter(
                (c) => c[0] === "mousedown",
            );
            expect(mousedownCalls).toHaveLength(1);
        });
    });

    describe("DOM ready branch: document.readyState !== 'loading' (init immediate)", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("complete");
        });

        test("initializes immediately: registers mousedown and calls Observer()", () => {
            const { selectiveInstance } = mockDeps();
            const addEvtSpy = jest.spyOn(document, "addEventListener");

            loadEntryModule();

            expect(addEvtSpy).toHaveBeenCalledWith(
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

        test("sels.length > 0 & actionApi.isEmpty === true -> no close()", () => {
            const closeSpy = jest.fn();
            const actionApi = { isEmpty: true, close: closeSpy };

            const { selectiveInstance } = mockDeps({
                libsMock: {
                    getBindedCommand: jest.fn().mockReturnValue([".select"]),
                },
            });

            loadEntryModule();
            // persistent return avoids undefined inside event handler
            selectiveInstance.find.mockReturnValue(actionApi);

            document.dispatchEvent(new MouseEvent("mousedown"));

            expect(selectiveInstance.find).toHaveBeenCalledWith(".select");
            expect(closeSpy).not.toHaveBeenCalled();
        });

        test("sels.length > 0 & actionApi.isEmpty === false -> calls close()", () => {
            const closeSpy = jest.fn();
            const actionApi = { isEmpty: false, close: closeSpy };

            const { selectiveInstance } = mockDeps({
                libsMock: {
                    getBindedCommand: jest.fn().mockReturnValue([".select"]),
                },
            });

            loadEntryModule();
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

    describe("Public API passthrough", () => {
        beforeEach(() => {
            resetEntryModule();
            setReadyState("complete");
        });

        test("bind/find/rebind/destroy delegate to Selective instance", () => {
            const { selectiveInstance } = mockDeps();
            const entry = loadEntryModule();

            entry.bind(".x", { searchable: true });
            entry.find(".x");
            entry.rebind(".y", { searchable: false });
            entry.destroy(".z");
            entry.destroy(null);

            expect(selectiveInstance.bind).toHaveBeenCalledWith(".x", {
                searchable: true,
            });
            expect(selectiveInstance.find).toHaveBeenCalledWith(".x");
            expect(selectiveInstance.rebind).toHaveBeenCalledWith(".y", {
                searchable: false,
            });
            expect(selectiveInstance.destroy).toHaveBeenCalledWith(".z");
            expect(selectiveInstance.destroy).toHaveBeenCalledWith(null);
        });

        test("registerPlugin/unregisterPlugin delegate to Selective instance", () => {
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

        test("effector delegates to Effector(element) (HTMLElement and selector)", () => {
            const effectorImpl = jest.fn((el: any) => ({ el, ok: true }));
            const { effectorFn } = mockDeps({ effectorImpl });
            const entry = loadEntryModule();

            const div = document.createElement("div");
            document.body.appendChild(div);

            const fx1 = entry.effector(div);
            const fx2 = entry.effector("#x");

            expect(effectorFn).toHaveBeenCalledWith(div);
            expect(effectorFn).toHaveBeenCalledWith("#x");
            expect(fx1).toEqual({ el: div, ok: true });
            expect(fx2).toEqual({ el: "#x", ok: true });
        });
    });
});
