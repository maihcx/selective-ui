import { Libs } from "../utils/libs";
import { OptionHandle } from "./option-handle";
import type { EffectorInterface, DimensionObject } from "../types/services/effector.type";
import { ModelManager } from "../core/model-manager";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { MixedAdapter } from "../adapter/mixed-adapter";
import type { RecyclerViewContract } from "../types/core/base/recyclerview.type";
import { ResizeObserverService } from "../services/resize-observer";
import { ElementMetrics } from "../types/services/resize-observer.type";
import { MixedItem, VisibilityStats } from "../types/core/base/mixed-adapter.type";
import { SelectiveOptions } from "../types/utils/selective.type";

type ParentBinderMapLike = {
    container: {
        tags: {
            ViewPanel: HTMLElement;
        };
    };
    [key: string]: unknown;
};

/**
 * @class
 */
export class Popup {
    private _modelManager: ModelManager<MixedItem, MixedAdapter> | null;

    options: SelectiveOptions | null = null;

    isCreated = false;

    optionAdapter: MixedAdapter | null = null;

    node: HTMLDivElement | null = null;

    private _effSvc: EffectorInterface | null = null;

    private _resizeObser: ResizeObserverService | null = null;

    private _parent: ParentBinderMapLike | null = null;

    optionHandle: OptionHandle | null = null;

    emptyState: EmptyState | null = null;

    loadingState: LoadingState | null = null;

    recyclerView: RecyclerViewContract<MixedAdapter> | null = null;

    private _optionsContainer: HTMLDivElement | null = null;

    private _scrollListener: (() => Promise<void>) | null = null;

    private _hideLoadHandle: ReturnType<typeof setTimeout> | null = null;

    /**
     * Represents a popup component that manages rendering and interaction for a dropdown panel.
     * Stores a reference to the ModelManager for handling option models and adapter logic.
     *
     * @param {HTMLSelectElement|null} [select=null] - The source select element to bind.
     * @param {object|null} [options=null] - Configuration options for the popup.
     * @param {ModelManager|null} [modelManager=null] - The model manager instance for data handling.
     */
    constructor(
        select: HTMLSelectElement | null = null,
        options: SelectiveOptions | null = null,
        modelManager: ModelManager<MixedItem, MixedAdapter> | null = null
    ) {
        this._modelManager = modelManager;

        if (select && options) {
            this.init(select, options);
        }
    }

    /**
     * Initializes the popup UI: creates DOM structure, wires OptionHandle, LoadingState, and EmptyState,
     * binds ModelManager resources (adapter/recyclerView), and sets up empty-state logic.
     *
     * @param {HTMLSelectElement} select - The source select element to bind.
     * @param {object} options - Configuration for panel, IDs, multiple mode, and texts.
     */
    init(select: HTMLSelectElement, options: SelectiveOptions): void {
        if (!this._modelManager) throw new Error("Popup requires a ModelManager instance.");

        this.optionHandle = new OptionHandle(options as any);
        this.emptyState = new EmptyState(options as any);
        this.loadingState = new LoadingState(options as any);

        const nodeMounted = Libs.mountNode(
            {
                PopupContainer: {
                    tag: {
                        node: "div",
                        classList: "selective-ui-popup",
                        style: { maxHeight: options.panelHeight },
                    },
                    child: {
                        OptionHandle: { tag: this.optionHandle.node },
                        OptionsContainer: {
                            tag: {
                                id: options.SEID_LIST,
                                node: "div",
                                classList: "selective-ui-options-container",
                                role: "listbox",
                            },
                        },
                        LoadingState: { tag: this.loadingState.node },
                        EmptyState: { tag: this.emptyState.node },
                    },
                },
            },
            null
        ) as any;

        this.node = nodeMounted.view as HTMLDivElement;
        this._optionsContainer = nodeMounted.tags.OptionsContainer as HTMLDivElement;

        this._parent = Libs.getBinderMap(select) as ParentBinderMapLike | null;
        this.options = options;

        // Load ModelManager resources into container
        this._modelManager.load(this._optionsContainer, { isMultiple: options.multiple });

        const MMResources = this._modelManager.getResources() as {
            adapter: MixedAdapter;
            recyclerView: RecyclerViewContract<MixedAdapter>;
        };

        this.optionAdapter = MMResources.adapter;
        this.recyclerView = MMResources.recyclerView;

        this.optionHandle.OnSelectAll(() => {
            MMResources.adapter.checkAll(true);
        });

        this.optionHandle.OnDeSelectAll(() => {
            MMResources.adapter.checkAll(false);
        });

        this._setupEmptyStateLogic();
    }

    /**
     * Shows the loading state and temporarily skips model events.
     * Adjusts size based on current visibility stats and triggers a resize.
     */
    async showLoading(): Promise<void> {
        if (!this.options || !this.loadingState || !this.optionHandle || !this.optionAdapter || !this._modelManager) return;

        if (this._hideLoadHandle) clearTimeout(this._hideLoadHandle);
        this._modelManager.skipEvent(true);

        if (Libs.string2Boolean(this.options.loadingfield) === false) return;

        this.loadingState.show(this.optionAdapter.getVisibilityStats().hasVisible);
        this.optionHandle.hide();
        this.triggerResize();
    }

    /**
     * Hides the loading state after a short delay, restores event handling,
     * updates empty state based on adapter visibility stats, and triggers a resize.
     */
    async hideLoading(): Promise<void> {
        if (!this.options || !this.loadingState || !this.optionAdapter || !this._modelManager) return;

        if (this._hideLoadHandle) clearTimeout(this._hideLoadHandle);

        this._hideLoadHandle = setTimeout(() => {
            this._modelManager?.skipEvent(false);
            this.loadingState?.hide();

            const stats = this.optionAdapter?.getVisibilityStats();
            this._updateEmptyState(stats ?? undefined);

            this.triggerResize();
        }, 200);
    }

    /**
     * Subscribes to adapter visibility and item changes to keep the empty state in sync.
     * Triggers resize when items change to reflect layout updates.
     */
    private _setupEmptyStateLogic(): void {
        if (!this.optionAdapter) return;

        this.optionAdapter.onVisibilityChanged((stats: VisibilityStats) => {
            this._updateEmptyState(stats);
        });

        this.optionAdapter.onPropChanged("items", () => {
            const stats = this.optionAdapter!.getVisibilityStats();
            this._updateEmptyState(stats);
            this.triggerResize();
        });
    }

    /**
     * Updates the empty state and option container visibility based on aggregated stats.
     * Shows "no data" when empty, "not found" when no visible items, otherwise shows options and handle.
     *
     * @param {VisibilityStats|undefined} stats - Visibility stats; computed if omitted.
     */
    private _updateEmptyState(stats?: VisibilityStats): void {
        if (!this.optionAdapter || !this.emptyState || !this.optionHandle || !this._optionsContainer) return;

        const s = stats ?? this.optionAdapter.getVisibilityStats();

        if (s.isEmpty) {
            this.emptyState.show("nodata");
            this._optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else if (!s.hasVisible) {
            this.emptyState.show("notfound");
            this._optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else {
            this.emptyState.hide();
            this._optionsContainer.classList.remove("hide");
            this.optionHandle.refresh();
        }
    }

    /**
     * Registers a callback for adapter property pre-change notifications.
     */
    onAdapterPropChanging(propName: string, callback: (...args: unknown[]) => void): void {
        this.optionAdapter?.onPropChanging(propName, callback);
    }

    /**
     * Registers a callback for adapter property post-change notifications.
     */
    onAdapterPropChanged(propName: string, callback: (...args: unknown[]) => void): void {
        this.optionAdapter?.onPropChanged(propName, callback);
    }

    /**
     * Injects an effector service used to perform side effects (e.g., animations or external actions).
     */
    setupEffector(effectorSvc: EffectorInterface): void {
        this._effSvc = effectorSvc;
    }

    /**
     * Opens the popup: creates and attaches DOM if needed, initializes observers and effector,
     * computes position and dimensions, and runs expand animation. Invokes callback on completion.
     */
    open(callback: (() => void) | null = null): void {
        if (!this.node || !this.options || !this.optionHandle || !this._parent || !this._effSvc) return;

        if (!this.isCreated) {
            document.body.appendChild(this.node);
            this.isCreated = true;

            this._resizeObser = new ResizeObserverService();
            this._effSvc.setElement(this.node);

            this.node.addEventListener("mousedown", (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
            });
        }

        this.optionHandle.refresh();
        this._updateEmptyState();

        const location = this._getParentLocation();
        const { position, top, maxHeight, realHeight } = this._calculatePosition(location);

        this._effSvc.expand({
            duration: this.options.animationtime,
            display: "flex",
            width: location.width,
            left: location.left,
            top,
            maxHeight,
            realHeight,
            position,
            onComplete: () => {
                if (!this._resizeObser || !this._parent) return;

                this._resizeObser.onChanged = (_metrics: ElementMetrics) => {
                    // Recompute from parent each time to keep behavior identical.
                    const loc = this._getParentLocation();
                    this._handleResize(loc);
                };

                this._resizeObser.connect(this._parent.container.tags.ViewPanel);
                callback?.();
            },
        });
    }

    /**
     * Closes the popup: disconnects the resize observer and runs collapse animation.
     * Safely no-ops if the popup has not been created.
     */
    close(callback: (() => void) | null = null): void {
        if (!this.isCreated || !this.options || !this._resizeObser || !this._effSvc) return;

        this._resizeObser.disconnect();
        this._effSvc.collapse({
            duration: this.options.animationtime,
            onComplete: callback ?? undefined,
        });
    }

    /**
     * Programmatically triggers a resize recalculation if the popup is created,
     * causing the layout to update based on the current parent dimensions.
     */
    triggerResize(): void {
        if (this.isCreated) this._resizeObser?.trigger();
    }

    /**
     * Enables infinite scroll by listening to container scroll events and loading more data
     * when nearing the bottom, respecting pagination state (enabled/loading/hasMore).
     *
     * @param searchController - Provides pagination state and a method to load more items.
     * @param _options - Optional SelectiveOptions (reserved for future behavior tuning).
     */
    setupInfiniteScroll(
        searchController: {
            getPaginationState(): { isPaginationEnabled: boolean; isLoading: boolean; hasMore: boolean };
            loadMore(): Promise<{ success: boolean; message?: string }>;
        },
        _options?: SelectiveOptions
    ): void {
        if (!this.node) return;

        this._scrollListener = async () => {
            const state = searchController.getPaginationState();
            if (!state.isPaginationEnabled) return;

            const container = this.node!;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            if (scrollHeight - scrollTop - clientHeight < 100) {
                if (!state.isLoading && state.hasMore) {
                    const result = await searchController.loadMore();
                    if (!result.success && result.message) {
                        // Keep original behavior.
                        console.log("Load more:", result.message);
                    }
                }
            }
        };

        this.node.addEventListener("scroll", this._scrollListener);
    }
    
    /**
     * Completely tear down the popup instance and release all resources.
     * 
     * Responsibilities:
     *  - Clear any pending timeouts and cancel animations/effects.
     *  - Remove event listeners (scroll, mousedown) and disconnect ResizeObserver.
     *  - Unmount and remove the DOM node; sever references to Effector/ModelManager.
     *  - Dispose adapter/recycler and child components (OptionHandle, EmptyState, LoadingState).
     *  - Reset flags and null out references to avoid memory leaks.
     * 
     * Safe to call multiple times; all operations are guarded via optional chaining.
     */
    detroy(): void {
        if (this._hideLoadHandle) {
            clearTimeout(this._hideLoadHandle);
            this._hideLoadHandle = null;
        }

        if (this.node && this._scrollListener) {
            this.node.removeEventListener("scroll", this._scrollListener);
            this._scrollListener = null;
        }

        try {
            this._resizeObser?.disconnect();
        } catch (_) {}
        this._resizeObser = null;

        try {
            this._effSvc?.setElement?.(null as any);
        } catch (_) {}
        this._effSvc = null;

        if (this.node) {
            try {
                const clone = this.node.cloneNode(true) as HTMLDivElement;
                this.node.replaceWith(clone);
                clone.remove();
            } catch (_) {
                this.node.remove();
            }
        }
        this.node = null;
        this._optionsContainer = null;

        try {
            this._modelManager?.skipEvent?.(false);

            this.recyclerView?.clear?.();
            this.recyclerView = null;

            this.optionAdapter = null;

            this.node.remove();
        } catch (_) {}

        this._modelManager = null;
        this.optionHandle = null;
        this.emptyState = null;
        this.loadingState = null;

        this._parent = null;
        this.options = null;

        this.isCreated = false;
    }

    /**
     * Computes the parent panel's location and box metrics, including size, position,
     * padding, and border, accounting for iOS visual viewport offsets.
     */
    private _getParentLocation(): {
        width: number;
        height: number;
        top: number;
        left: number;
        padding: { top: number; right: number; bottom: number; left: number };
        border: { top: number; right: number; bottom: number; left: number };
    } {
        const viewPanel = this._parent!.container.tags.ViewPanel;
        const rect = viewPanel.getBoundingClientRect();
        const style = window.getComputedStyle(viewPanel);

        const vv = window.visualViewport;
        const is_ios = Libs.IsIOS();
        const viewportOffsetY = vv && is_ios ? vv.offsetTop : 0;
        const viewportOffsetX = vv && is_ios ? vv.offsetLeft : 0;

        return {
            width: rect.width,
            height: rect.height,
            top: rect.top - viewportOffsetY,
            left: rect.left - viewportOffsetX,
            padding: {
                top: parseFloat(style.paddingTop),
                right: parseFloat(style.paddingRight),
                bottom: parseFloat(style.paddingBottom),
                left: parseFloat(style.paddingLeft),
            },
            border: {
                top: parseFloat(style.borderTopWidth),
                right: parseFloat(style.borderRightWidth),
                bottom: parseFloat(style.borderBottomWidth),
                left: parseFloat(style.borderLeftWidth),
            },
        };
    }

    /**
     * Determines popup placement (top/bottom) and height constraints based on available viewport space,
     * content size, and configured min/max heights; returns final position, top, and heights.
     */
    private _calculatePosition(location: { width: number; height: number; top: number; left: number }): {
        position: "top" | "bottom";
        top: number;
        maxHeight: number;
        realHeight: number;
        contentHeight: number;
    } {
        const vv = window.visualViewport;
        const is_ios = Libs.IsIOS();

        const viewportHeight = vv?.height ?? window.innerHeight;
        const viewportOffsetY = vv && is_ios ? vv.offsetTop : 0;

        const gap = 3;
        const safeMargin = 15;

        const dimensions: DimensionObject = this._effSvc!.getHiddenDimensions("flex");
        const contentHeight = dimensions.scrollHeight;

        const configMaxHeight = parseFloat(this.options?.panelHeight ?? "220") || 220;
        const configMinHeight = parseFloat(this.options?.panelMinHeight ?? "100") || 100;

        const spaceBelow = viewportHeight - (location.top + location.height) - gap;
        const spaceAbove = location.top - gap;

        let position: "top" | "bottom" = "bottom";
        let maxHeight = configMaxHeight;
        let realHeight = Math.min(contentHeight, maxHeight);

        const heightOri = spaceBelow - safeMargin;

        if (realHeight >= configMinHeight ? heightOri >= configMinHeight : heightOri >= realHeight) {
            position = "bottom";
            maxHeight = Math.min(spaceBelow - safeMargin, configMaxHeight);
        } else if (spaceAbove >= Math.max(realHeight, configMinHeight)) {
            position = "top";
            maxHeight = Math.min(spaceAbove - safeMargin, configMaxHeight);
        } else {
            if (spaceBelow >= spaceAbove) {
                position = "bottom";
                maxHeight = Math.max(spaceBelow - safeMargin, configMinHeight);
            } else {
                position = "top";
                maxHeight = Math.max(spaceAbove - safeMargin, configMinHeight);
            }
        }

        realHeight = Math.min(contentHeight, maxHeight);

        const top =
            position === "bottom"
                ? location.top + location.height + gap + viewportOffsetY
                : location.top - realHeight - gap + viewportOffsetY;

        return { position, top, maxHeight, realHeight, contentHeight };
    }

    /**
     * Handles parent resize events by recalculating placement and dimensions,
     * then animates the popup to the new size and position.
     */
    private _handleResize(location: { width: number; height: number; top: number; left: number }): void {
        if (!this.options || !this._effSvc) return;

        const { position, top, maxHeight, realHeight } = this._calculatePosition(location);

        this._effSvc.resize({
            duration: this.options.animationtime,
            width: location.width,
            left: location.left,
            top,
            maxHeight,
            realHeight,
            position,
            animate: true,
        });
    }
}