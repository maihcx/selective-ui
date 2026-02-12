import { Libs } from "../../utils/libs";
import { OptionHandle } from "../option-handle";
import type { EffectorInterface, DimensionObject } from "../../types/services/effector.type";
import { ModelManager } from "../../core/model-manager";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { MixedAdapter } from "../../adapter/mixed-adapter";
import type { RecyclerViewContract } from "../../types/core/base/recyclerview.type";
import { ResizeObserverService } from "../../services/resize-observer";
import { ElementMetrics } from "../../types/services/resize-observer.type";
import { MixedItem, VisibilityStats } from "../../types/core/base/mixed-adapter.type";
import { SelectiveOptions } from "../../types/utils/selective.type";
import { ParentBinderMapLike, VirtualRecyclerOptions } from "../../types/components/popup.type";
import { Lifecycle } from "../../core/base/lifecycle";
import { LifecycleState } from "../../types/core/base/lifecycle.type";
import { MountViewResult } from "src/ts/types/utils/libs.type";

/**
 * Popup panel that renders and manages the dropdown surface.
 *
 * Responsibilities:
 * - Build and attach the dropdown DOM structure
 * - Integrate state components (OptionHandle, LoadingState, EmptyState)
 * - Bind to ModelManager resources (adapter + recycler view)
 * - Handle virtual scrolling and infinite scroll
 * - Compute placement (top/bottom) and animate open/close/resize via Effector
 * - Keep "empty/not found" states in sync with adapter visibility stats
 *
 * Lifecycle:
 * - Created via constructor → `initialize()` (when args provided) → `init()` → `mount()`
 * - `open()` attaches and animates the panel
 * - `close()` collapses the panel
 * - `destroy()` fully tears down all resources
 *
 * @extends Lifecycle
 */
export class Popup extends Lifecycle {
    /** ModelManager reference used to provide adapter and recycler view resources */
    private modelManager: ModelManager<MixedItem, MixedAdapter> | null;

    /** Active configuration for the popup behavior and text labels */
    private options: SelectiveOptions | null = null;

    /** Indicates whether the popup DOM has been attached to the document body at least once */
    private isCreated = false;

    /** Mixed adapter handling items/models and visibility stats */
    public optionAdapter: MixedAdapter | null = null;

    /** Root popup container (the floating panel) */
    public node: HTMLDivElement | null = null;

    /** Effector service used to measure/animate the popup */
    private effSvc: EffectorInterface | null = null;

    /** Resize observer to react to parent panel size changes */
    private resizeObser: ResizeObserverService | null = null;

    /** Binder map for parent elements (anchors to compute placement from) */
    private parent: ParentBinderMapLike | null = null;

    /** Header control exposing "Select All / Deselect All" actions */
    public optionHandle: OptionHandle | null = null;

    /** "Empty / Not found" feedback component */
    public emptyState: EmptyState | null = null;

    /** Loading indicator component */
    public loadingState: LoadingState | null = null;

    /** Virtualized recycler view for performant lists */
    public recyclerView: RecyclerViewContract<MixedAdapter> | null = null;

    /** Container that holds the list of options */
    private optionsContainer: HTMLDivElement | null = null;

    /** Scroll handler used by infinite scroll */
    private scrollListener: (() => Promise<void>) | null = null;

    /** Handle to defer hiding the loading indicator */
    private hideLoadHandle: ReturnType<typeof setTimeout> | null = null;

    /** Default virtual scroll configuration (tuned for typical option heights) */
    private virtualScrollConfig = {
        /** Estimated item height in pixels (improves initial layout calculation) */
        estimateItemHeight: 36,
        /** Number of extra items to render above/below the viewport */
        overscan: 8,
        /** Whether the list contains items with dynamic (non-uniform) heights */
        dynamicHeights: true
    };

    /**
     * Creates a Popup instance that manages the dropdown panel for a Select-like UI.
     *
     * If `select` and `options` are provided, the popup is initialized immediately.
     *
     * @param select - Source `<select>` element this popup is bound to.
     * @param options - Configuration options (panel sizing, flags, texts, etc.).
     * @param modelManager - Model manager that supplies the adapter and recycler view.
     */
    public constructor(
        select: HTMLSelectElement | null = null,
        options: SelectiveOptions | null = null,
        modelManager: ModelManager<MixedItem, MixedAdapter> | null = null
    ) {
        super();
        this.modelManager = modelManager;

        if (select && options) {
            this.initialize(select, options);
        }
    }

    /**
     * Initializes the popup UI:
     * - Creates the container and child components (OptionHandle, LoadingState, EmptyState)
     * - Binds to ModelManager resources (adapter/recyclerView)
     * - Enables empty-state synchronization with adapter
     * - Applies virtual scroll options (when enabled)
     *
     * @param select - The source select element to bind.
     * @param options - Panel configuration (dimensions, IDs, labels, flags).
     * @throws Error if a ModelManager is not provided.
     */
    private initialize(select: HTMLSelectElement, options: SelectiveOptions): void {
        if (!this.modelManager) throw new Error("Popup requires a ModelManager instance.");

        this.optionHandle = new OptionHandle(options);
        this.emptyState = new EmptyState(options);
        this.loadingState = new LoadingState(options);

        const nodeMounted = Libs.mountNode<MountViewResult>(
            {
                PopupContainer: {
                    tag: {
                        node: "div",
                        classList: "seui-popup",
                        style: { maxHeight: options.panelHeight },
                    },
                    child: {
                        OptionHandle: { tag: this.optionHandle.node },
                        OptionsContainer: {
                            tag: {
                                id: options.SEID_LIST,
                                node: "div",
                                classList: "seui-options-container",
                                role: "listbox",
                            },
                        },
                        LoadingState: { tag: this.loadingState.node },
                        EmptyState: { tag: this.emptyState.node },
                    },
                },
            },
            null
        );

        this.node = nodeMounted.view as HTMLDivElement;
        this.optionsContainer = nodeMounted.tags.OptionsContainer as HTMLDivElement;

        this.parent = Libs.getBinderMap<ParentBinderMapLike>(select);
        this.options = options;
        this.init();
        
        const recyclerViewOpt = options.virtualScroll
            ? { 
                scrollEl: this.node, 
                estimateItemHeight: this.virtualScrollConfig.estimateItemHeight, 
                overscan: this.virtualScrollConfig.overscan, 
                dynamicHeights: this.virtualScrollConfig.dynamicHeights }
            : {}
        ;

        // Load ModelManager resources into the list container
        this.modelManager.load<VirtualRecyclerOptions>(this.optionsContainer, { isMultiple: options.multiple }, recyclerViewOpt);

        const MMResources = this.modelManager.getResources();

        this.optionAdapter = MMResources.adapter;
        this.recyclerView = MMResources.recyclerView;

        this.optionHandle.onSelectAll(() => {
            MMResources.adapter.checkAll(true);
        });

        this.optionHandle.onDeSelectAll(() => {
            MMResources.adapter.checkAll(false);
        });

        this.setupEmptyStateLogic();

        this.mount();
    }

    /**
     * Shows the loading state and temporarily suspends adapter/model events.
     *
     * Behavior:
     * - Cancels any pending hide-timeout
     * - Instructs `ModelManager` to skip events
     * - Shows loading indicator (compact mode if there are visible items)
     * - Triggers a resize to accommodate layout changes
     */
    public async showLoading(): Promise<void> {
        if (!this.options || !this.loadingState || !this.optionHandle || !this.optionAdapter || !this.modelManager) return;

        if (this.hideLoadHandle) clearTimeout(this.hideLoadHandle);
        this.modelManager.skipEvent(true);

        if (Libs.string2Boolean(this.options.loadingfield) === false) return;

        this.emptyState.hide();
        this.loadingState.show(this.optionAdapter.getVisibilityStats().hasVisible);
        this.triggerResize();
    }

    /**
     * Hides the loading state (after a configured delay), resumes events, syncs empty state,
     * and triggers a resize.
     *
     * Debounce: Uses `animationtime` as a short delay before hiding the loading indicator.
     */
    public async hideLoading(): Promise<void> {
        if (!this.options || !this.loadingState || !this.optionAdapter || !this.modelManager) return;

        if (this.hideLoadHandle) clearTimeout(this.hideLoadHandle);

        this.hideLoadHandle = setTimeout(() => {
            this.modelManager?.skipEvent(false);
            this.loadingState?.hide();

            const stats = this.optionAdapter?.getVisibilityStats();
            this.updateEmptyState(stats ?? undefined);

            this.triggerResize();
        }, this.options.animationtime);
    }

    /**
     * Subscribes to adapter events to keep the empty state synchronized.
     *
     * - `onVisibilityChanged`: updates empty/not-found visibility
     * - `onPropChanged('items')`: updates visibility after items are mutated
     */
    private setupEmptyStateLogic(): void {
        if (!this.optionAdapter) return;

        this.optionAdapter.onVisibilityChanged((stats: VisibilityStats) => {
            this.updateEmptyState(stats);
        });

        this.optionAdapter.onPropChanged("items", () => {
            const stats = this.optionAdapter!.getVisibilityStats();
            this.updateEmptyState(stats);
            this.triggerResize();
        });
    }

    /**
     * Updates the empty/not-found state and the options container visibility.
     *
     * Rules:
     * - `isEmpty` → show "No data", hide options & handle
     * - `!hasVisible` → show "Not found", hide options & handle
     * - otherwise → show options, hide empty state, refresh handle
     *
     * @param stats - Optionally provide precomputed visibility stats.
     */
    private updateEmptyState(stats?: VisibilityStats): void {
        if (!this.optionAdapter || !this.emptyState || !this.optionHandle || !this.optionsContainer) return;

        const s = stats ?? this.optionAdapter.getVisibilityStats();

        if (s.isEmpty) {
            this.emptyState.show("nodata");
            this.optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else if (!s.hasVisible) {
            this.emptyState.show("notfound");
            this.optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else {
            this.emptyState.hide();
            this.optionsContainer.classList.remove("hide");
            this.optionHandle.update();
        }
    }

    /**
     * Subscribes to adapter property pre-change notifications.
     *
     * @param propName - Adapter property name to observe.
     * @param callback - Handler invoked before the property changes.
     */
    public onAdapterPropChanging(propName: string, callback: (...args: unknown[]) => void): void {
        this.optionAdapter?.onPropChanging(propName, callback);
    }

    /**
     * Subscribes to adapter property post-change notifications.
     *
     * @param propName - Adapter property name to observe.
     * @param callback - Handler invoked after the property changes.
     */
    public onAdapterPropChanged(propName: string, callback: (...args: unknown[]) => void): void {
        this.optionAdapter?.onPropChanged(propName, callback);
    }

    /**
     * Injects an effector service used for size measurement and animations.
     *
     * @param effectorSvc - Effector instance to bind to the popup element.
     */
    public setupEffector(effectorSvc: EffectorInterface): void {
        this.effSvc = effectorSvc;
    }

    /**
     * Opens (expands) the popup:
     * - On first open: appends to `document.body`, sets up resize observer, and blocks outside mousedown
     * - Synchronizes the OptionHandle visibility and (optionally) the empty state
     * - Computes placement from the parent anchor and runs the expand animation
     * - Resumes recycler view after the animation completes
     *
     * @param callback - Optional callback invoked when the opening animation completes.
     * @param isShowEmptyState - If true, evaluates and applies empty/not-found state before animation.
     */
    public open(callback: (() => void) | null = null, isShowEmptyState: boolean): void {
        if (!this.node || !this.options || !this.optionHandle || !this.parent || !this.effSvc) return;

        if (!this.isCreated) {
            document.body.appendChild(this.node);
            this.isCreated = true;

            this.resizeObser = new ResizeObserverService();
            this.effSvc.setElement(this.node);

            // Prevent the popup from closing when clicking inside
            this.node.addEventListener("mousedown", (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
            });
        }

        this.optionHandle.update();
        if (isShowEmptyState) {
            this.updateEmptyState();
        }

        const location = this.getParentLocation();
        const { position, top, maxHeight, realHeight } = this.calculatePosition(location);

        this.effSvc.expand({
            duration: this.options.animationtime,
            display: "flex",
            width: location.width,
            left: location.left,
            top,
            maxHeight,
            realHeight,
            position,
            onComplete: () => {
                if (!this.resizeObser || !this.parent) return;

                this.resizeObser.onChanged = (_metrics: ElementMetrics) => {
                    // Recompute from parent each time to keep behavior identical.
                    const loc = this.getParentLocation();
                    this.handleResize(loc);
                };

                this.resizeObser.connect(this.parent.container.tags.ViewPanel);
                callback?.();
                
                const rv: any = this.recyclerView;
                rv?.resume?.();
            },
        });
    }

    /**
     * Closes (collapses) the popup:
     * - Suspends the recycler view
     * - Disconnects the resize observer
     * - Runs the collapse animation
     *
     * Safely no-ops when the popup has not been created.
     *
     * @param callback - Optional callback invoked when the closing animation completes.
     */
    public close(callback: (() => void) | null = null): void {
        if (!this.isCreated || !this.options || !this.resizeObser || !this.effSvc) return;
        const rv: any = this.recyclerView;
        rv?.suspend?.();

        this.resizeObser.disconnect();
        this.effSvc.collapse({
            duration: this.options.animationtime,
            onComplete: callback ?? undefined,
        });
    }

    /**
     * Programmatically triggers a resize recalculation (if created),
     * causing the popup to recompute placement and dimensions.
     */
    public triggerResize(): void {
        if (this.isCreated) this.resizeObser?.trigger();
    }

    /**
     * Enables infinite scrolling:
     * - Listens to scroll events on the popup container
     * - When within 100px of the bottom, attempts to load more items (if enabled and not already loading)
     *
     * @param searchController - Provides pagination state and a `loadMore()` method.
     * @param _options - Optional SelectiveOptions (reserved for future tuning).
     */
    public setupInfiniteScroll(
        searchController: {
            getPaginationState(): { isPaginationEnabled: boolean; isLoading: boolean; hasMore: boolean };
            loadMore(): Promise<{ success: boolean; message?: string }>;
        },
        _options?: SelectiveOptions
    ): void {
        if (!this.node) return;

        this.scrollListener = async () => {
            const state = searchController.getPaginationState();
            if (!state.isPaginationEnabled) return;

            const container = this.node!;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            // Near-bottom threshold: 100px
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

        this.node.addEventListener("scroll", this.scrollListener);
    }
    
    /**
     * Completely tears down the popup and releases all resources.
     *
     * Operations:
     * - Clear pending timeouts
     * - Remove event listeners (scroll, mousedown)
     * - Disconnect resize observer
     * - Unbind effector from the element
     * - Remove DOM node (replace-with-clone fallback)
     * - Reset ModelManager event skipping
     * - Clear recycler view, adapter, and child components
     * - Null out references to avoid leaks and mark as not created
     *
     * Idempotent: safe to call multiple times.
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        clearTimeout(this.hideLoadHandle!);
        this.hideLoadHandle = null;

        if (this.node && this.scrollListener) {
            this.node.removeEventListener("scroll", this.scrollListener);
            this.scrollListener = null;
        }

        this.emptyState.destroy();
        this.loadingState.destroy();
        this.optionHandle.destroy();
        this.resizeObser?.disconnect?.();
        this.effSvc?.setElement?.(null);
        this.modelManager?.skipEvent?.(false);
        this.recyclerView?.clear?.();
        this.node?.remove?.();

        if (this.node) {
            try {
                const clone = Libs.nodeCloner<HTMLDivElement>(this.node);
                this.node.replaceWith(clone);
                clone.remove();
            } catch (_) {
                this.node.remove();
            }
        }
        
        this.node = null;
        this.optionsContainer = null;
        this.modelManager = null;
        this.optionHandle = null;
        this.emptyState = null;
        this.loadingState = null;
        this.parent = null;
        this.options = null;
        this.isCreated = false;
        this.effSvc = null;
        this.resizeObser = null;
        this.recyclerView = null;
        this.optionAdapter = null;

        super.destroy();
    }

    /**
     * Computes the parent panel's location and box metrics
     * (size, position, padding, border). Accounts for iOS visual viewport offsets.
     */
    private getParentLocation(): {
        width: number;
        height: number;
        top: number;
        left: number;
        padding: { top: number; right: number; bottom: number; left: number };
        border: { top: number; right: number; bottom: number; left: number };
    } {
        const viewPanel = this.parent!.container.tags.ViewPanel;
        const rect = viewPanel.getBoundingClientRect();
        const style = window.getComputedStyle(viewPanel);

        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
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
     * Determines popup placement (top/bottom) and height constraints based on:
     * - Available viewport space above/below the anchor
     * - Content size from effector's hidden measurement
     * - Configured min/max heights
     *
     * Returns the final placement, top offset, and computed heights.
     */
    private calculatePosition(location: { width: number; height: number; top: number; left: number }): {
        position: "top" | "bottom";
        top: number;
        maxHeight: number;
        realHeight: number;
        contentHeight: number;
    } {
        const vv = window.visualViewport;
        const is_ios = Libs.IsIOS();

        const viewportHeight = vv?.height ?? window.innerHeight;

        const gap = 3;
        const safeMargin = 15;

        const dimensions: DimensionObject = this.effSvc!.getHiddenDimensions("flex");
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

        const viewportOffsetY = vv && is_ios ? vv.offsetTop : 0;
        
        const top =
            position === "bottom"
                ? location.top + location.height + gap + viewportOffsetY
                : location.top - realHeight - gap + viewportOffsetY;

        return { position, top, maxHeight, realHeight, contentHeight };
    }

    /**
     * Handles parent resize by recalculating placement and dimensions,
     * then animates the popup to the new size and position.
     */
    private handleResize(location: { width: number; height: number; top: number; left: number }): void {
        if (!this.options || !this.effSvc) return;

        const { position, top, maxHeight, realHeight } = this.calculatePosition(location);

        this.effSvc.resize({
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