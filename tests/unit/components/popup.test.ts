/**
 * @jest-environment jsdom
 */

import { Popup } from "../../../src/ts/components/popup";
import { Libs } from "../../../src/ts/utils/libs";
import { ResizeObserverService } from "../../../src/ts/services/resize-observer";
import { ModelManager } from "../../../src/ts/core/model-manager";

jest.mock("../../../src/ts/utils/libs", () => ({
    Libs: {
        mountNode: jest.fn(),
        getBinderMap: jest.fn(),
        string2Boolean: jest.fn(() => true),
        IsIOS: jest.fn(() => false)
    }
}));

jest.mock("../../../src/ts/components/option-handle", () => ({
    OptionHandle: jest.fn()
}));

jest.mock("../../../src/ts/components/empty-state", () => ({
    EmptyState: jest.fn()
}));

jest.mock("../../../src/ts/components/loading-state", () => ({
    LoadingState: jest.fn()
}));

jest.mock("../../../src/ts/services/resize-observer", () => ({
    ResizeObserverService: jest.fn()
}));

type MockAdapter = {
    getVisibilityStats: jest.Mock;
    onVisibilityChanged: jest.Mock;
    onPropChanged: jest.Mock;
    checkAll: jest.Mock;
};

function createModelManager() {
    const mm = new ModelManager<any, any>({} as any);

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

    (mm as any).load = jest.fn();
    (mm as any).skipEvent = jest.fn();
    (mm as any).getResources = jest.fn(() => ({
        adapter,
        recyclerView: {}
    }));

    return { mm, adapter };
}

type MockEffector = {
    setElement: jest.Mock;
    expand: jest.Mock;
    collapse: jest.Mock;
    resize: jest.Mock;
    getHiddenDimensions: jest.Mock;
};

function createEffector(): MockEffector {
    return {
        setElement: jest.fn(),
        expand: jest.fn(({ onComplete }: { onComplete?: () => void }) => onComplete?.()),
        collapse: jest.fn(({ onComplete }: { onComplete?: () => void }) => onComplete?.()),
        resize: jest.fn(),
        getHiddenDimensions: jest.fn(() => ({
            scrollHeight: 150
        }))
    };
}

describe("Popup", () => {
    let popup: Popup;
    let adapter: MockAdapter;
    let effector: MockEffector;
    let select: HTMLSelectElement;
    let options: Record<string, any>;

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

        (require("../../../src/ts/components/option-handle").OptionHandle as jest.Mock)
            .mockImplementation(() => optionHandleInstance);

        (require("../../../src/ts/components/empty-state").EmptyState as jest.Mock)
            .mockImplementation(() => emptyStateInstance);

        (require("../../../src/ts/components/loading-state").LoadingState as jest.Mock)
            .mockImplementation(() => loadingStateInstance);

        (ResizeObserverService as jest.Mock).mockImplementation(() => ({
            connect: jest.fn(),
            disconnect: jest.fn(),
            trigger: jest.fn(),
            onChanged: null
        }));

        const { mm, adapter: ad } = createModelManager();
        adapter = ad;

        (Libs.mountNode as jest.Mock).mockReturnValue({
            view: document.createElement("div"),
            tags: {
                OptionsContainer: document.createElement("div")
            }
        });

        (Libs.getBinderMap as jest.Mock).mockReturnValue({
            container: {
                tags: {
                    ViewPanel: document.createElement("div")
                }
            }
        });

        popup = new Popup(select, options, mm);
        effector = createEffector();
        popup.setupEffector(effector as any);
    });

    test("init creates popup structure", () => {
        expect(popup.node).toBeInstanceOf(HTMLElement);
        expect(popup.optionHandle).toBeDefined();
        expect(popup.emptyState).toBeDefined();
        expect(popup.loadingState).toBeDefined();
    });

    test("showLoading enables loading state", async () => {
        await popup.showLoading();
        expect(popup.loadingState?.show).toHaveBeenCalled();
    });

    test("hideLoading restores state", async () => {
        jest.useFakeTimers();

        await popup.hideLoading();
        jest.runAllTimers();

        expect(popup.loadingState?.hide).toHaveBeenCalled();
    });

    test("open mounts popup and runs expand", () => {
        popup.open(null, true);
        expect(document.body.contains(popup.node)).toBe(true);
        expect(effector.expand).toHaveBeenCalled();
    });

    test("close collapses popup safely", () => {
        popup.open(null, true);
        popup.close();
        expect(effector.collapse).toHaveBeenCalled();
    });

    test("empty state shows nodata", () => {
        adapter.getVisibilityStats.mockReturnValueOnce({
            isEmpty: true,
            hasVisible: false
        });

        popup.open(null, true);
        expect(popup.emptyState?.show).toHaveBeenCalledWith("nodata");
    });

    test("empty state shows notfound", () => {
        adapter.getVisibilityStats.mockReturnValueOnce({
            isEmpty: false,
            hasVisible: false
        });

        popup.open(null, true);
        expect(popup.emptyState?.show).toHaveBeenCalledWith("notfound");
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

        popup.open(null, true);
        popup.setupInfiniteScroll(searchController as any);

        Object.defineProperty(popup.node, "scrollHeight", {
            configurable: true,
            value: 300
        });

        Object.defineProperty(popup.node, "clientHeight", {
            configurable: true,
            value: 150
        });

        popup.node!.scrollTop = 200;
        popup.node?.dispatchEvent(new Event("scroll"));

        expect(loadMore).toHaveBeenCalled();
    });
});