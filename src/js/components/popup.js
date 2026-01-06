import { Libs } from "../utils/libs.js";
import { OptionHandle } from "./option-handle.js";
import { ResizeObserverService } from "../services/resize-observer.js"
import { ModelManager } from "../core/model-manager.js";
import { OptionModel } from "../models/option-model.js";
import { EmptyState } from "./empty-state.js";
import { LoadingState } from "./loading-state.js";
import { MixedAdapter } from "../adapter/mixed-adapter.js";

/**
 * @class
 */
export class Popup {
    /** @type {ModelManager<OptionModel, MixedAdapter>} */
    #modelManager;

    /**
     * Represents a popup component that manages rendering and interaction for a dropdown panel.
     * Stores a reference to the ModelManager for handling option models and adapter logic.
     *
     * @param {HTMLSelectElement|null} [select=null] - The source select element to bind.
     * @param {object|null} [options=null] - Configuration options for the popup.
     * @param {ModelManager|null} [modelManager=null] - The model manager instance for data handling.
     */
    constructor(select = null, options = null, modelManager = null) {
        this.#modelManager = modelManager;
        if (select && options) {
            this.init(select, options);
        }
    }

    options = null;
    isCreated = false;

    /**
     * @type {MixedAdapter}
     */
    optionAdapter = null;
    
    /**
     * @type {HTMLDivElement}
     */
    node = null;

    /**
     * @type {EffectorInterface}
     */
    #effSvc = null;

    /**
     * @type {ResizeObserverService}
     */
    #resizeObser;

    #parent = null;

    /**
     * @type {OptionHandle}
     */
    optionHandle = null;

    /**
     * @type {EmptyState}
     */
    emptyState = null;

    /**
     * @type {LoadingState}
     */
    loadingState = null;

    /**
     * @type {RecyclerViewContract<MixedAdapter>}
     */
    recyclerView = null;

    /**
     * @type {HTMLDivElement}
     */
    #optionsContainer = null;

    #scrollListener = null;

    /**
     * @type {NodeJS.Timeout}
     */
    #hideLoadHandle = null;
    
    /**
     * Initializes the popup UI: creates DOM structure, wires OptionHandle, LoadingState, and EmptyState,
     * binds ModelManager resources (adapter/recyclerView), and sets up empty-state logic.
     *
     * @param {HTMLSelectElement} select - The source select element to bind.
     * @param {object} options - Configuration for panel, IDs, multiple mode, and texts.
     */
    init(select, options) {
        this.optionHandle = new OptionHandle(options);
        this.emptyState = new EmptyState(options);
        this.loadingState = new LoadingState(options);
        
        const nodeMounted = Libs.mountNode({
            PopupContainer: {
                tag: {node: "div", classList: "selective-ui-popup", style: {maxHeight: options.panelHeight}},
                child: {
                    OptionHandle: {
                        tag: this.optionHandle.node
                    },
                    OptionsContainer: {
                        tag: {id: options.SEID_LIST, node: "div", classList: "selective-ui-options-container", role: "listbox"}
                    },
                    LoadingState: {
                        tag: this.loadingState.node
                    },
                    EmptyState: {
                        tag: this.emptyState.node
                    }
                }
            }
        });
        
        this.node = nodeMounted.view;
        this.#optionsContainer = nodeMounted.tags.OptionsContainer;
        this.#parent = Libs.getBinderMap(select);
        this.options = options;
        
        this.#modelManager.load(this.#optionsContainer, {isMultiple: options.multiple});
        const MMResources = this.#modelManager.getResources();
        this.optionAdapter = MMResources.adapter;
        this.recyclerView = MMResources.recyclerView;

        this.optionHandle.OnSelectAll(() => {
            MMResources.adapter.checkAll(true);
        });
        this.optionHandle.OnDeSelectAll(() => {
            MMResources.adapter.checkAll(false);
        });

        this.#setupEmptyStateLogic();
    }

    /**
     * Shows the loading state and temporarily skips model events.
     * Adjusts size based on current visibility stats and triggers a resize.
     */
    async showLoading() {
        clearTimeout(this.#hideLoadHandle);

        this.#modelManager.skipEvent(true);
        if (Libs.string2Boolean(this.options.loadingfield) === false) return;
        this.loadingState.show(this.optionAdapter.getVisibilityStats().hasVisible);
        // this.#optionsContainer.classList.add("hide");
        this.optionHandle.hide();
        this.triggerResize();
    }

    /**
     * Hides the loading state after a short delay, restores event handling,
     * updates empty state based on adapter visibility stats, and triggers a resize.
     */
    async hideLoading() {
        clearTimeout(this.#hideLoadHandle);

        this.#hideLoadHandle = setTimeout(() => {
            this.#modelManager.skipEvent(false);
            this.loadingState.hide();
    
            const stats = this.optionAdapter.getVisibilityStats();
            this.#updateEmptyState(stats);
            
            this.triggerResize();
        }, 200);
    }

    /**
     * Subscribes to adapter visibility and item changes to keep the empty state in sync.
     * Triggers resize when items change to reflect layout updates.
     */
    #setupEmptyStateLogic() {
        this.optionAdapter.onVisibilityChanged((stats) => {
            this.#updateEmptyState(stats);
        });
        
        this.optionAdapter.onPropChanged("items", () => {
            const stats = this.optionAdapter.getVisibilityStats();
            this.#updateEmptyState(stats);

            this.triggerResize();
        });
    }

    /**
     * Updates the empty state and option container visibility based on aggregated stats.
     * Shows "no data" when empty, "not found" when no visible items, otherwise shows options and handle.
     *
     * @param {{visibleCount:number,totalCount:number,hasVisible:boolean,isEmpty:boolean}|undefined} stats - Visibility stats; computed if omitted.
     */
    #updateEmptyState(stats = null) {
        if (!stats) {
            stats = this.optionAdapter.getVisibilityStats();
        }

        if (stats?.isEmpty) {
            this.emptyState.show("nodata");
            this.#optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else if (stats && !stats.hasVisible) {
            this.emptyState.show("notfound");
            this.#optionsContainer.classList.add("hide");
            this.optionHandle.hide();
        } else {
            this.emptyState.hide();
            this.#optionsContainer.classList.remove("hide");
            this.optionHandle.refresh();
        }
    }

    /**
     * Registers a callback for adapter property pre-change notifications.
     *
     * @param {string} propName - The adapter property to observe.
     * @param {Function} callback - Invoked before the property changes.
     */
    onAdapterPropChanging(propName, callback) {
        this.optionAdapter.onPropChanging(propName, callback);
    }

    /**
     * Registers a callback for adapter property post-change notifications.
     *
     * @param {string} propName - The adapter property to observe.
     * @param {Function} callback - Invoked after the property changes.
     */
    onAdapterPropChanged(propName, callback) {
        this.optionAdapter.onPropChanged(propName, callback);
    }

    /**
     * Injects an effector service used to perform side effects (e.g., animations or external actions).
     *
     * @param {EffectorInterface} effectorSvc - The effector service instance.
     */
    setupEffector(effectorSvc) {
        this.#effSvc = effectorSvc;
    }

    /**
     * Opens the popup: creates and attaches DOM if needed, initializes observers and effector,
     * computes position and dimensions, and runs expand animation. Invokes callback on completion.
     *
     * @param {Function|null} [callback=null] - Function to call after the popup finishes expanding.
     */
    open(callback = null) {
        if (!this.isCreated) {
            document.body.appendChild(this.node);
            this.isCreated = true;

            this.#resizeObser = new ResizeObserverService();
            this.#effSvc.setElement(this.node);

            this.node.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
        }

        this.optionHandle.refresh();
        this.#updateEmptyState();
        
        const location = this.#getParentLocation();
        const {position, top, maxHeight, realHeight} = this.#calculatePosition(location);
        
        this.#effSvc.expand({
            duration: this.options.animationtime,
            display: "flex",
            width: location.width,
            left: location.left,
            top: top,
            maxHeight: maxHeight,
            realHeight: realHeight,
            position: position,
            onComplete: () => {
                this.#resizeObser.onChanged = (newLocation) => this.#handleResize(newLocation);
                this.#resizeObser.connect(this.#parent.container.tags.ViewPanel);
                callback && callback();
            }
        });
    }

    /**
     * Closes the popup: disconnects the resize observer and runs collapse animation.
     * Safely no-ops if the popup has not been created.
     *
     * @param {Function|null} [callback=null] - Function to call after the popup finishes collapsing.
     */
    close(callback = null) {
        if (!this.isCreated) {
            return;
        }

        this.#resizeObser.disconnect();
        
        this.#effSvc.collapse({
            duration: this.options.animationtime,
            onComplete: callback
        });
    }

    /**
     * Programmatically triggers a resize recalculation if the popup is created,
     * causing the layout to update based on the current parent dimensions.
     */
    triggerResize() {
        if (this.isCreated) {
            this.#resizeObser.trigger();
        }
    }

    /**
     * Enables infinite scroll by listening to container scroll events and loading more data
     * when nearing the bottom, respecting pagination state (enabled/loading/hasMore).
     *
     * @param {object} searchController - Controller providing pagination state and loadMore().
     * @param {object} options - Additional configuration for the infinite scroll behavior.
     */
    setupInfiniteScroll(searchController, options) {
        this.#scrollListener = async () => {
            const state = searchController.getPaginationState();
            
            if (!state.isPaginationEnabled) {
                return;
            }

            const container = this.node;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            
            if (scrollHeight - scrollTop - clientHeight < 100) {
                if (!state.isLoading && state.hasMore) {
                    const result = await searchController.loadMore();
                    
                    if (!result.success && result.message) {
                        console.log("Load more:", result.message);
                    }
                }
            }
        };

        this.node.addEventListener("scroll", this.#scrollListener);
    }

    /**
     * Computes the parent panel's location and box metrics, including size, position,
     * padding, and border, accounting for iOS visual viewport offsets.
     *
     * @returns {{
     *   width:number, height:number, top:number, left:number,
     *   padding:{top:number,right:number,bottom:number,left:number},
     *   border:{top:number,right:number,bottom:number,left:number}
     * }} - The parent panel metrics in viewport coordinates.
     */
    #getParentLocation() {
        const viewPanel = this.#parent.container.tags.ViewPanel;
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
            }
        };
    }

    /**
     * Determines popup placement (top/bottom) and height constraints based on available viewport space,
     * content size, and configured min/max heights; returns final position, top, and heights.
     *
     * @param {{width:number,height:number,top:number,left:number}} location - Parent panel metrics.
     * @returns {{position:string, top:number, maxHeight:number, realHeight:number, contentHeight:number}}
     *          - Calculated layout values for the popup.
     */
    #calculatePosition(location) {
        const vv = window.visualViewport;
        const is_ios = Libs.IsIOS();
        const viewportHeight = vv?.height ?? window.innerHeight;
        const viewportOffsetY = vv && is_ios ? vv.offsetTop : 0;

        const gap = 3;
        const safeMargin = 15;
        
        const dimensions = this.#effSvc.getHiddenDimensions("flex");
        const contentHeight = dimensions.scrollHeight;

        const configMaxHeight = parseFloat(this.options.panelHeight) || 220;
        const configMinHeight = parseFloat(this.options.panelMinHeight) || 100;

        const spaceBelow = viewportHeight - (location.top + location.height) - gap;
        const spaceAbove = location.top - gap;

        let position = "bottom";
        let maxHeight = configMaxHeight;
        let realHeight = Math.min(contentHeight, maxHeight);
        const heightOri = spaceBelow - safeMargin;
        
        if (realHeight >= configMinHeight ? heightOri >= configMinHeight : heightOri >= realHeight) {
            position = "bottom";
            maxHeight = Math.min(spaceBelow - safeMargin, configMaxHeight);
        } 
        else if (spaceAbove >= Math.max(realHeight, configMinHeight)) {
            position = "top";
            maxHeight = Math.min(spaceAbove - safeMargin, configMaxHeight);
        }
        else {
            if (spaceBelow >= spaceAbove) {
                position = "bottom";
                maxHeight = Math.max(spaceBelow - safeMargin, configMinHeight);
            } else {
                position = "top";
                maxHeight = Math.max(spaceAbove - safeMargin, configMinHeight);
            }
        }

        realHeight = Math.min(contentHeight, maxHeight);
        
        const top = position === "bottom"
            ? (location.top + location.height + gap + viewportOffsetY)
            : (location.top - realHeight - gap + viewportOffsetY);

        return {position, top, maxHeight, realHeight, contentHeight};
    }

    /**
     * Handles parent resize events by recalculating placement and dimensions,
     * then animates the popup to the new size and position.
     *
     * @param {{width:number,height:number,top:number,left:number}} location - Updated parent metrics.
     */
    #handleResize(location) {
        const {position, top, maxHeight, realHeight} = this.#calculatePosition(location);
        
        this.#effSvc.resize({
            duration: this.options.animationtime,
            width: location.width,
            left: location.left,
            top: top,
            maxHeight: maxHeight,
            realHeight: realHeight,
            position: position,
            animate: true
        });
    }
}