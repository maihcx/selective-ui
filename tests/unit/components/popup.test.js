/**
 * @jest-environment jsdom
 */

import { Popup } from "../../../src/js/components/popup";
import { Libs } from "../../../src/js/utils/libs";
import { ResizeObserverService } from "../../../src/js/services/resize-observer";
import { ModelManager } from "../../../src/js/core/model-manager";

/* =====================================================
 * MOCKS (KHÔNG DÙNG document TRONG FACTORY)
 * ===================================================== */

jest.mock("../../../src/js/utils/libs.js", () => ({
    Libs: {
        mountNode: jest.fn(),
        getBinderMap: jest.fn(),
        string2Boolean: jest.fn(() => true),
        IsIOS: jest.fn(() => false)
    }
}));

jest.mock("../../../src/js/components/option-handle", () => ({
    OptionHandle: jest.fn()
}));

jest.mock("../../../src/js/components/empty-state", () => ({
    EmptyState: jest.fn()
}));

jest.mock("../../../src/js/components/loading-state", () => ({
    LoadingState: jest.fn()
}));

jest.mock("../../../src/js/services/resize-observer", () => ({
    ResizeObserverService: jest.fn()
}));

/* =====================================================
 * HELPERS
 * ===================================================== */

function createModelManager() {
    const mm = new ModelManager({});

    const adapter = {
        getVisibilityStats: jest.fn(() => ({
            isEmpty: false,
            hasVisible: true,
            visibleCount: 1,
            totalCount: 1
        })),
        onVisibilityChanged: jest.fn(),
        onPropChanged: jest.fn(),
        checkAll: jest.fn()
    };

    mm.load = jest.fn();
    mm.skipEvent = jest.fn();
    mm.getResources = jest.fn(() => ({
        adapter,
        recyclerView: {}
    }));

    return { mm, adapter };
}

function createEffector() {
    return {
        setElement: jest.fn(),
        expand: jest.fn(({ onComplete }) => onComplete && onComplete()),
        collapse: jest.fn(({ onComplete }) => onComplete && onComplete()),
        resize: jest.fn(),
        getHiddenDimensions: jest.fn(() => ({
            scrollHeight: 150
        }))
    };
}

/* =====================================================
 * TESTS
 * ===================================================== */

describe("Popup", () => {
    let popup;
    let adapter;
    let effector;
    let select;
    let options;

    beforeEach(() => {
        document.body.innerHTML = "";

        select = document.createElement("select");
        document.body.appendChild(select);

        options = {
            SEID_LIST: "list",
            multiple: false,
            panelHeight: "200",
            panelMinHeight: "100",
            animationtime: 0,
            loadingfield: true
        };

        /* --------- runtime DOM (SAFE) --------- */
        const optionHandleInstance = {
            node: document.createElement("div"),
            hide: jest.fn(),
            refresh: jest.fn(),
            OnSelectAll: jest.fn(),
            OnDeSelectAll: jest.fn()
        };

        const emptyStateInstance = {
            node: document.createElement("div"),
            show: jest.fn(),
            hide: jest.fn()
        };

        const loadingStateInstance = {
            node: document.createElement("div"),
            show: jest.fn(),
            hide: jest.fn()
        };

        require("../../../src/js/components/option-handle").OptionHandle
            .mockImplementation(() => optionHandleInstance);

        require("../../../src/js/components/empty-state").EmptyState
            .mockImplementation(() => emptyStateInstance);

        require("../../../src/js/components/loading-state").LoadingState
            .mockImplementation(() => loadingStateInstance);

        ResizeObserverService.mockImplementation(() => ({
            connect: jest.fn(),
            disconnect: jest.fn(),
            trigger: jest.fn(),
            onChanged: null
        }));

        const { mm, adapter: ad } = createModelManager();
        adapter = ad;

        Libs.mountNode.mockReturnValue({
            view: document.createElement("div"),
            tags: {
                OptionsContainer: document.createElement("div")
            }
        });

        Libs.getBinderMap.mockReturnValue({
            container: {
                tags: {
                    ViewPanel: document.createElement("div")
                }
            }
        });

        popup = new Popup(select, options, mm);
        effector = createEffector();
        popup.setupEffector(effector);
    });

    /* ================================================= */

    test("init creates popup structure", () => {
        expect(popup.node).toBeInstanceOf(HTMLElement);
        expect(popup.optionHandle).toBeDefined();
        expect(popup.emptyState).toBeDefined();
        expect(popup.loadingState).toBeDefined();
    });

    test("showLoading enables loading state", async () => {
        await popup.showLoading();
        expect(popup.loadingState.show).toHaveBeenCalled();
    });

    test("hideLoading restores state", async () => {
        jest.useFakeTimers();

        await popup.hideLoading();
        jest.runAllTimers();

        expect(popup.loadingState.hide).toHaveBeenCalled();
    });

    test("open mounts popup and runs expand", () => {
        popup.open();
        expect(document.body.contains(popup.node)).toBe(true);
        expect(effector.expand).toHaveBeenCalled();
    });

    test("close collapses popup safely", () => {
        popup.open();
        popup.close();
        expect(effector.collapse).toHaveBeenCalled();
    });

    test("empty state shows nodata", () => {
        adapter.getVisibilityStats.mockReturnValueOnce({
            isEmpty: true,
            hasVisible: false
        });

        popup.open();
        expect(popup.emptyState.show).toHaveBeenCalledWith("nodata");
    });

    test("empty state shows notfound", () => {
        adapter.getVisibilityStats.mockReturnValueOnce({
            isEmpty: false,
            hasVisible: false
        });

        popup.open();
        expect(popup.emptyState.show).toHaveBeenCalledWith("notfound");
    });

    test("setupInfiniteScroll triggers loadMore", async () => {
        const loadMore = jest.fn().mockResolvedValue({ success: true });

        const searchController = {
            getPaginationState: () => ({
                isPaginationEnabled: true,
                isLoading: false,
                hasMore: true
            }),
            loadMore
        };

        popup.open();
        popup.setupInfiniteScroll(searchController);

        Object.defineProperty(popup.node, "scrollHeight", {
            configurable: true,
            value: 300
        });

        Object.defineProperty(popup.node, "clientHeight", {
            configurable: true,
            value: 150
        });

        popup.node.scrollTop = 200;

        popup.node.dispatchEvent(new Event("scroll"));
        expect(loadMore).toHaveBeenCalled();
    });
});
