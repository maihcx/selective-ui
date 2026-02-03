
import { Libs } from "../utils/libs";
import { Refresher } from "../services/refresher";
import { PlaceHolder } from "./placeholder";
import { Directive } from "./directive";
import { Popup } from "./popup/popup";
import { SearchBox } from "./searchbox";
import { Effector } from "../services/effector";
import { iEvents } from "../utils/ievents";
import { ModelManager } from "../core/model-manager";
import { RecyclerView } from "../core/base/recyclerview";
import { AccessoryBox } from "./accessorybox";
import { SearchController } from "../core/search-controller";
import { SelectObserver } from "../services/select-observer";
import { DatasetObserver } from "../services/dataset-observer";
import { MixedAdapter } from "../adapter/mixed-adapter";
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { Lifecycle } from "../core/base/lifecycle";
import { LifecycleState } from "../types/core/base/lifecycle.type";

import type { SelectiveOptions } from "../types/utils/selective.type";
import { IEventToken, IEventCallback } from "../types/utils/ievents.type";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { BinderMap } from "../types/utils/istorage.type";
import { ContainerRuntime, SelectBoxAction } from "../types/components/searchbox.type";
import { AjaxConfig } from "../types/core/search-controller.type";
import { Selective } from "../utils/selective";
import { VirtualRecyclerView } from "../core/base/virtual-recyclerview";
import type { PluginContext, SelectivePlugin } from "../types/plugins/plugin.type";

/**
 * SelectBox
 *
 * Root coordinator component that enhances a native `<select>` element into the library's
 * DOM-driven Select UI. `SelectBox` composes and wires together the major runtime pieces:
 *
 * - **View layer**: {@link PlaceHolder}, {@link Directive}, {@link SearchBox}, {@link Popup}, {@link AccessoryBox}
 * - **Model layer**: {@link ModelManager} with {@link MixedAdapter} resources (groups/options/navigation/visibility)
 * - **Rendering layer**: {@link RecyclerView} or {@link VirtualRecyclerView} (virtual scroll)
 * - **Controllers / services**: {@link SearchController}, {@link Effector}, {@link Refresher}
 * - **Observers**: {@link SelectObserver} and {@link DatasetObserver} for keeping DOM/source-of-truth in sync
 *
 * ### Architecture / Relationships
 * - The native `<select>` remains the canonical form element and is moved into the SelectBox DOM wrapper.
 * - `ModelManager` owns adapter + recyclerview instances and exposes a resource model list.
 * - `Popup` hosts the list UI (adapter ↔ recycler/view) and emits adapter property changes.
 * - `SearchBox` emits external events (search/navigation/enter/esc), which drive adapter navigation and search.
 *
 * ### Lifecycle (Strict FSM)
 * This class uses explicit state guards (`this.state !== ...`) to enforce a strict sequence:
 * - `NEW` → {@link init} (creates subcomponents and runtime wiring) → `INITIALIZED`
 * - {@link mount} (inserts wrapper and relocates `<select>` in DOM) → `MOUNTED`
 * - {@link update} (resize / reactive refresh) → `UPDATED`
 * - {@link destroy} (disconnect observers, destroy children, remove DOM) → `DESTROYED`
 *
 * Each lifecycle entry point is designed to be **idempotent/no-op** when called from an
 * unexpected state.
 *
 * ### External vs Internal Events (Selection)
 * Selection changes can be routed through two different adapter property channels:
 * - `"selected"`: treated as **external** selection (user-triggered) → calls `change(..., true)`
 * - `"selected_internal"`: treated as **internal** selection (non-trigger) → calls `change(..., false)`
 *
 * This separation allows the framework to distinguish “notify observers / emit events”
 * from “silent state sync” (e.g., restoring selection, programmatic updates).
 *
 * ### DOM / a11y Side Effects
 * - Creates a focusable `ViewPanel` and applies listbox-related ARIA attributes on open/close
 *   (`aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-labelledby`, `aria-multiselectable`).
 * - Stops `mousedown` propagation on the view panel to avoid outer click handlers capturing interaction.
 *
 * @extends Lifecycle
 */
export class SelectBox extends Lifecycle {
    /**
     * Runtime container holding:
     * - `view/tags` from {@link Libs.mountNode}
     * - composed child components (placeholder, searchbox, popup, etc.)
     * - runtime services/controllers and observers
     *
     * Declared as a `Partial` because it is progressively populated during {@link init}.
     */
    public container: Partial<ContainerRuntime> = {};

    /**
     * Snapshot of the previous selection value used for rollback in `beforeChange` cancellation
     * and max-selection enforcement.
     *
     * @internal
     */
    private oldValue: unknown = null;

    /**
     * Root wrapper DOM node for the enhanced UI.
     *
     * Created during {@link init} via {@link Libs.mountNode}, inserted into the DOM during {@link mount},
     * and removed during {@link destroy}.
     */
    private node: HTMLDivElement | null = null;

    /**
     * Parsed configuration (bound from the `<select>` element via binder map).
     *
     * Provides feature flags (multiple/disabled/readonly/visible/virtualScroll/ajax/autoclose…),
     * a11y ids (e.g. `SEID_LIST`, `SEID_HOLDER`) and user callbacks under `options.on`.
     *
     * @internal
     */
    private options: SelectiveOptions | null = null;

    /**
     * Manager that owns model resources and bridges the Adapter ↔ RecyclerView pipeline.
     *
     * The configured adapter is {@link MixedAdapter}. The recyclerview implementation is chosen
     * based on `options.virtualScroll` (standard {@link RecyclerView} vs {@link VirtualRecyclerView}).
     *
     * @internal
     */
    private optionModelManager: ModelManager<MixedItem, MixedAdapter> | null = null;

    /**
     * Whether the popup/list UI is currently open.
     *
     * This is authoritative for the action API (`getAction().isOpen`) and open/close guards.
     *
     * @internal
     */
    private isOpen = false;

    /**
     * Tracks whether an initial AJAX load has been performed at least once.
     * Used to avoid redundant initial fetches on open.
     *
     * @internal
     */
    private hasLoadedOnce = false;

    /**
     * Tracks whether the instance is in "pre-search" mode (a search is about to happen).
     * Used as a hint to perform AJAX refresh on open.
     *
     * @internal
     */
    private isBeforeSearch = false;

    /**
     * Selective context (global helper / registry).
     *
     * Used to locate the instance wrapper via `Selective.find(...)` and to close other open instances.
     */
    public Selective: Selective | null = null;

    /**
     * Registered plugins for this SelectBox instance.
     */
    private plugins: SelectivePlugin[] = [];

    /**
     * Cached plugin context for this SelectBox instance.
     */
    private pluginContext: PluginContext | null = null;

    /**
     * Creates a {@link SelectBox} bound to a native `<select>` element.
     *
     * When both `select` and `Selective` are provided, the instance initializes immediately
     * (bind options from dataset/binder map and enters the lifecycle via {@link init}).
     *
     * @param select - The native select element to enhance.
     * @param Selective - The Selective framework context used for registry/services.
     */
    public constructor(select: HTMLSelectElement, Selective: Selective) {
        super();
        if (select && Selective) this.initialize(select, Selective);
    }

    /**
     * Disabled state mirror for both runtime behavior and DOM/a11y representation.
     *
     * Side effects when set:
     * - Updates `options.disabled`
     * - Toggles `.disabled` on the root wrapper
     * - Sets `aria-disabled` on wrapper and view panel
     */
    public get isDisabled(): boolean {
        return !!this.options?.disabled;
    }
    public set isDisabled(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.disabled = value;
        this.node.classList.toggle("disabled", value);
        this.node.setAttribute("aria-disabled", String(value));
        this.container.tags?.ViewPanel?.setAttribute("aria-disabled", String(value));
    }

    /**
     * Read-only state mirror.
     *
     * Side effects when set:
     * - Updates `options.readonly`
     * - Toggles `.readonly` on the root wrapper to prevent user interaction in UI layer
     */
    public get isReadOnly(): boolean {
        return !!this.options?.readonly;
    }
    public set isReadOnly(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.readonly = value;
        this.node.classList.toggle("readonly", value);
    }

    /**
     * Visibility state mirror.
     *
     * Side effects when set:
     * - Updates `options.visible`
     * - Toggles `.invisible` class on the root wrapper
     */
    public get isVisible(): boolean {
        return !!this.options?.visible;
    }
    public set isVisible(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.visible = value;
        this.node.classList.toggle("invisible", !value);
    }

    /**
     * Binds configuration and Selective context, then enters lifecycle initialization.
     *
     * Sources configuration from the select element binder map:
     * - {@link Libs.getBinderMap} → {@link BinderMap.options} → {@link SelectiveOptions}
     *
     * @param select - Native select element being enhanced.
     * @param Selective - Selective runtime context.
     * @internal
     */
    private initialize(select: HTMLSelectElement, Selective: Selective): void {
        const bindedMap = Libs.getBinderMap(select) as BinderMap;
        this.options = bindedMap.options as SelectiveOptions;
        this.Selective = Selective;
        
        this.init(select);
    }

    /**
     * Lifecycle: `init` (composition / wiring stage).
     *
     * Strict FSM:
     * - No-ops unless `state === NEW`.
     *
     * Responsibilities:
     * - Instantiate view subcomponents (placeholder/directive/searchbox/accessory/popup).
     * - Create and mount the container DOM structure (but does not insert into document yet).
     * - Configure {@link ModelManager} with {@link MixedAdapter} and a RecyclerView implementation
     *   ({@link VirtualRecyclerView} when `options.virtualScroll`).
     * - Create initial model resources by parsing the source `<select>`.
     * - Wire controller/service flows:
     *   - search events → {@link SearchController} → adapter updates → popup resize/highlight resets
     *   - adapter selection changes → action API {@link SelectBoxAction.change} with trigger rules
     * - Connect observers for two-way synchronization:
     *   - {@link SelectObserver} for option changes in `<select>`
     *   - {@link DatasetObserver} for runtime flags (disabled/readonly/visible) from dataset
     *
     * DOM/a11y:
     * - Ensures placeholder node has an id for `aria-labelledby` usage.
     * - Adds a keydown handler on `ViewPanel` to open on Enter/Space/ArrowDown.
     *
     * @param select - Native select element used as source of truth for options/value.
     */
    public init(select?: HTMLSelectElement): void {
        if (this.state !== LifecycleState.NEW) return;
        if (!select || !this.options) return;

        const options = this.options;

        // Create all components
        const placeholder = new PlaceHolder(options);
        const directive = new Directive();
        const searchbox = new SearchBox(options);
        const effector = Effector();
        const optionModelManager = new ModelManager<MixedItem, MixedAdapter>(options);
        const accessoryBox = new AccessoryBox(options);
        const searchController = new SearchController(select, optionModelManager, this);

        const selectObserver = new SelectObserver(select);
        const datasetObserver = new DatasetObserver(select);

        // ensure placeholder has id for aria-labelledby usage
        if (placeholder.node) placeholder.node.id = String(options.SEID_HOLDER ?? "");

        const container = Libs.mountNode(
            {
                Container: {
                    tag: { node: "div", classList: "seui-MAIN" },
                    child: {
                        ViewPanel: {
                            tag: {
                                node: "div",
                                classList: "seui-view",
                                tabIndex: 0,
                                onkeydown: (e: KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        this.getAction()?.open();
                                    }
                                },
                            },
                            child: {
                                PlaceHolder: { tag: placeholder.node },
                                Directive: { tag: directive.node },
                                SearchBox: { tag: searchbox.node },
                            },
                        },
                    },
                },
            },
            null
        ) as ContainerRuntime;

        this.container = container;
        this.node = container.view as HTMLDivElement;

        // Store references on container
        container.searchController = searchController;
        container.placeholder = placeholder;
        container.directive = directive;
        container.searchbox = searchbox;
        container.effector = effector;
        container.targetElement = select;
        container.accessorybox = accessoryBox;
        container.selectObserver = selectObserver;
        container.datasetObserver = datasetObserver;

        // ModelManager setup
        optionModelManager.setupAdapter(MixedAdapter);
        if (options.virtualScroll) {
            optionModelManager.setupRecyclerView(VirtualRecyclerView);
        } else {
            optionModelManager.setupRecyclerView(RecyclerView);
        }
        optionModelManager.createModelResources(Libs.parseSelectToArray(select));

        optionModelManager.on("onUpdate", () => {
            container.popup?.triggerResize?.();
        });

        this.optionModelManager = optionModelManager;

        // Popup
        container.popup = new Popup(select, options, optionModelManager);
        container.popup!.setupEffector(effector);
        container.popup!.setupInfiniteScroll(searchController, options);

        container.popup!.onAdapterPropChanged("selected", () => {
            this.getAction()?.change(null, true);
        });
        container.popup!.onAdapterPropChanged("selected_internal", () => {
            this.getAction()?.change(null, false);
        });
        container.popup!.onAdapterPropChanging("select", () => {
            this.oldValue = this.getAction()?.value ?? "";
        });

        accessoryBox.setRoot(container.tags.ViewPanel);
        accessoryBox.setModelManager(optionModelManager);

        this.setupEventHandlers(select, container, options, searchController, searchbox);
        this.setupObservers(selectObserver, datasetObserver, select, optionModelManager);

        this.plugins = this.Selective?.getPlugins?.() ?? [];
        if (this.plugins.length) {
            const resources = optionModelManager.getResources();
            const pluginContext: PluginContext = {
                selectBox: this,
                options,
                adapter: resources.adapter,
                recycler: resources.recyclerView,
                viewTags: container.tags,
                actions: this.getAction(),
            };
            this.pluginContext = pluginContext;
            this.runPluginHook("init", (plugin) => plugin.init?.(pluginContext));
        }

        // Initial states
        this.isDisabled = Libs.string2Boolean(options.disabled);
        this.isReadOnly = Libs.string2Boolean(options.readonly);

        // Call parent lifecycle init
        super.init();
    }

    /**
     * Lifecycle: `mount` (DOM insertion stage).
     *
     * Strict FSM:
     * - No-ops unless `state === INITIALIZED`.
     *
     * DOM operations:
     * - Inserts the SelectBox wrapper before the original `<select>`.
     * - Moves the `<select>` inside the wrapper (before `ViewPanel`) to preserve form behavior.
     * - Adds a `mousedown` handler to `ViewPanel` to contain interactions and prevent outer handlers.
     * - Applies initial sizing (`Refresher.resizeBox`) and marks the select as initialized (`.init`).
     * - Applies an initial "mask" refresh via `change(null, false)` without emitting external triggers.
     */
    public mount(): void {
        if (this.state !== LifecycleState.INITIALIZED) return;
        if (!this.node || !this.container.targetElement) return;

        const select = this.container.targetElement;
        const container = this.container as ContainerRuntime;

        // Mount into DOM: wrapper before select, then move select inside
        select.parentNode?.insertBefore(this.node, select);
        this.node.insertBefore(select, container.tags.ViewPanel);

        container.tags.ViewPanel.addEventListener("mousedown", (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
        });

        Refresher.resizeBox(select, container.tags.ViewPanel);
        select.classList.add("init");

        // initial mask
        this.getAction()?.change(null, false);

        // Call parent lifecycle mount
        super.mount();
    }

    /**
     * Lifecycle: `update` (reactive refresh stage).
     *
     * Strict FSM:
     * - No-ops unless `state === MOUNTED`.
     *
     * Behavior:
     * - Triggers popup resize recalculation to keep layout consistent with content changes
     *   (e.g. filtering results, collapses/expands, accessory changes).
     *
     * Note:
     * - Actual data mutations are driven by adapter/model updates and action API methods,
     *   not by this method directly.
     */
    public update(): void {
        if (this.state !== LifecycleState.MOUNTED) return;

        // Trigger any update logic here
        this.container.popup?.triggerResize?.();

        super.update();
    }

    /**
     * Wires event handlers between UI components, controller, and adapter.
     *
     * Key flows:
     * - SearchBox input → SearchController.search/clear → Popup resize + adapter highlight reset
     * - SearchBox navigation/enter/esc → MixedAdapter.navigate/selectHighlighted + close + focus restore
     * - Adapter highlight changes → SearchBox `aria-activedescendant`
     * - Adapter collapsed changes → Popup resize
     *
     * Trigger semantics:
     * - The `isTrigger` boolean from SearchBox is used to distinguish user-driven vs programmatic clears.
     * - AJAX searches optionally show/hide loading UI and respect `delaysearchtime`.
     *
     * @param select - The enhanced native select element.
     * @param container - The assembled runtime container.
     * @param options - Bound configuration flags and callbacks.
     * @param searchController - Controller responsible for local/AJAX searches and pagination.
     * @param searchbox - Search input component emitting search/navigation intents.
     * @internal
     */
    private setupEventHandlers(
        select: HTMLSelectElement,
        container: ContainerRuntime,
        options: SelectiveOptions,
        searchController: SearchController,
        searchbox: SearchBox
    ): void {
        const optionAdapter = container.popup!.optionAdapter as MixedAdapter;
        let hightlightTimer: ReturnType<typeof setTimeout> | null = null;

        const searchHandle = (keyword: string, isTrigger: boolean) => {
            if (!isTrigger && keyword === "") {
                searchController.clear();
            } else {
                if (keyword !== "") this.isBeforeSearch = true;

                searchController
                    .search(keyword)
                    .then((result: any) => {
                        clearTimeout(hightlightTimer!);
                        Libs.callbackScheduler.clear(`sche_vis_proxy_${optionAdapter.adapterKey}`);
                        Libs.callbackScheduler.on(
                            `sche_vis_proxy_${optionAdapter.adapterKey}`,
                            () => {
                                container.popup?.triggerResize?.();

                                if (result?.hasResults) {
                                    hightlightTimer = setTimeout(() => {
                                        optionAdapter.resetHighlight();
                                        container.popup?.triggerResize?.();
                                    }, options.animationtime ?? 0);
                                }
                            },
                            { debounce: 10 }
                        );
                    })
                    .catch((error: unknown) => {
                        console.error("Search error:", error);
                    });
            }
        };

        let searchHandleTimer: ReturnType<typeof setTimeout> | null = null;

        searchbox.onSearch = (keyword: string, isTrigger: boolean) => {
            if (!searchController.compareSearchTrigger(keyword)) return;
            if (searchHandleTimer) clearTimeout(searchHandleTimer);

            if (searchController.isAjax()) {
                container.popup?.showLoading?.();
                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, options.delaysearchtime ?? 0);
            } else {
                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, 10);
            }
        };

        searchController.setPopup(container.popup!);

        searchbox.onNavigate = (direction: 1 | -1) => {
            optionAdapter.navigate(direction);
        };
        searchbox.onEnter = () => {
            optionAdapter.selectHighlighted();
        };
        searchbox.onEsc = () => {
            this.getAction()?.close();
            container.tags.ViewPanel.focus();
        };

        optionAdapter.onHighlightChange = (_index: number, id?: string) => {
            if (id) searchbox.setActiveDescendant(id);
        };

        optionAdapter.onCollapsedChange = () => {
            container.popup?.triggerResize?.();
        };

        // AJAX setup (if provided)
        if (options.ajax) {
            if (options.ajax?.keepSelected == undefined) {
                options.ajax.keepSelected = options.keepSelected;
            }
            searchController.setAjax(options.ajax);
        }
    }

    /**
     * Connects and wires observers that synchronize the enhanced UI with the source `<select>`
     * element and its dataset-based runtime flags.
     *
     * - {@link SelectObserver}:
     *   - On change, re-parses the select into resources and refreshes the selection mask.
     * - {@link DatasetObserver}:
     *   - On change, mirrors dataset flags into runtime properties:
     *     `disabled` / `readonly` / `visible`
     *
     * @param selectObserver - Observer tracking select option/value mutations.
     * @param datasetObserver - Observer tracking dataset attribute changes.
     * @param select - The enhanced native select element.
     * @param optionModelManager - Model manager to update from parsed select.
     * @internal
     */
    private setupObservers(
        selectObserver: SelectObserver,
        datasetObserver: DatasetObserver,
        select: HTMLSelectElement,
        optionModelManager: ModelManager<MixedItem, MixedAdapter>
    ): void {
        selectObserver.connect();
        selectObserver.onChanged = (sel) => {
            optionModelManager.updateModel(Libs.parseSelectToArray(sel));
            this.getAction()?.refreshMask();
        };

        datasetObserver.connect();
        datasetObserver.onChanged = (dataset) => {
            if (Libs.string2Boolean(dataset.disabled) !== this.isDisabled) {
                this.isDisabled = Libs.string2Boolean(dataset.disabled);
            }
            if (Libs.string2Boolean(dataset.readonly) !== this.isReadOnly) {
                this.isReadOnly = Libs.string2Boolean(dataset.readonly);
            }
            if (Libs.string2Boolean(dataset.visible) !== this.isVisible) {
                this.isVisible = Libs.string2Boolean(dataset.visible ?? "1");
            }
        };
    }

    /**
     * Disconnects observers associated with this instance.
     *
     * This is used during {@link destroy} to ensure external DOM observers are stopped,
     * preventing memory leaks and unintended background updates.
     */
    public deInit(): void {
        const c: any = this.container ?? {};
        const { selectObserver, datasetObserver } = c;

        if (this.plugins.length) {
            this.runPluginHook("destroy", (plugin) => plugin.destroy?.());
        }
        this.plugins = [];
        this.pluginContext = null;

        if (selectObserver?.disconnect) selectObserver.disconnect();
        if (datasetObserver?.disconnect) datasetObserver.disconnect();
    }

    /**
     * Lifecycle: `destroy` (teardown stage).
     *
     * Strict FSM / idempotency:
     * - No-ops when already in {@link LifecycleState.DESTROYED}.
     *
     * Responsibilities:
     * - Disconnect observers.
     * - Destroy composed child components/controllers.
     * - Remove wrapper DOM from the document.
     * - Clear references to enable garbage collection.
     *
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        // Disconnect observers
        this.deInit();

        // Destroy child components
        const container = this.container;
        container.searchController.destroy();
        container.directive.destroy();
        container.popup.destroy();
        container.accessorybox.destroy();
        container.placeholder.destroy();
        container.searchbox.destroy();
        this.optionModelManager.destroy();

        // Remove from DOM
        this.node?.remove();

        // Clear all references
        this.container = {};
        this.node = null;
        this.options = null;
        this.optionModelManager = null;
        this.Selective = null;
        this.oldValue = null;
        this.isOpen = false;
        this.hasLoadedOnce = false;
        this.isBeforeSearch = false;

        // Call parent lifecycle destroy
        super.destroy();
    }

    /**
     * Builds and returns an imperative action API for controlling this SelectBox instance.
     *
     * The returned object is a "facade" used by external consumers (and internal wiring) to:
     * - read/write selection values (`value`, `valueArray`, `setValue`, `selectAll`, `deSelectAll`)
     * - control popup visibility (`open`, `close`, `toggle`)
     * - refresh mask/placeholder (`refreshMask`)
     * - attach event callbacks (`on`)
     * - configure AJAX (`ajax`, `loadAjax`)
     *
     * ### Triggering contract (external vs internal)
     * Many methods accept a `trigger`/`canTrigger` boolean which controls whether:
     * - `beforeChange` / `change` callbacks are invoked via {@link iEvents.callEvent}
     * - native DOM `"change"` is fired on the underlying select
     *
     * This mirrors the library convention of distinguishing user-visible change events from
     * internal/non-trigger state synchronization.
     *
     * ### Side effects
     * - Mutates `OptionModel.selectedNonTrigger` flags to update selection.
     * - Writes to the native select value for single-select mode.
     * - Updates UI mask and accessory box, and requests popup resizing where needed.
     * - Applies a11y attributes to `ViewPanel` on open/close.
     *
     * No-ops:
     * - Returns `null` when the binder map is missing for the current target element.
     *
     * @returns An action facade for controlling this instance, or `null` if not bound.
     */
    public getAction(): SelectBoxAction | null {
        const container = this.container;
        const superThis = this;
        const getInstance = () => {
            return this.Selective.find(container.targetElement);
        };

        const bindedMap = Libs.getBinderMap(container.targetElement) as BinderMap | null;
        if (!bindedMap) return null;

        const bindedOptions = bindedMap.options;

        const resp: Partial<SelectBoxAction> & Record<string, any> = {
            get targetElement() {
                return container.targetElement;
            },

            get placeholder() {
                return container.placeholder.get();
            },

            set placeholder(value: string) {
                container.placeholder?.set(value);
                container.searchbox?.setPlaceHolder(value);
            },

            get oldValue() {
                return superThis.oldValue;
            },

            set value(value: any) {
                this.setValue(null, value, true);
            },

            get value() {
                const item_list = this.valueArray as string[];
                const valLength = item_list.length;
                return valLength > 1 ? item_list : valLength === 0 ? "" : item_list[0];
            },

            get valueArray() {
                const item_list: string[] = [];
                superThis.getModelOption().forEach((m) => {
                    if (m.selected) item_list.push(m.value);
                });
                return item_list;
            },

            get valueString() {
                const customDelimiter = bindedOptions.customDelimiter;
                const item_list = this.valueArray as string[];
                return item_list.join(customDelimiter);
            },

            get valueOptions() {
                const item_list: OptionModel[] = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m);
                });
                return item_list;
            },

            get mask() {
                const item_list: string[] = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m.text);
                });
                return item_list;
            },

            get valueText() {
                const item_list: string[] = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(m.text);
                });
                const valLength = item_list.length;
                return valLength > 1 ? item_list : valLength === 0 ? "" : item_list[0];
            },

            get isOpen() {
                return superThis.isOpen;
            },

            getParent(_evtToken?: IEventCallback) {
                return container.view.parentElement;
            },

            valueDataset(_evtToken?: IEventCallback, strDataset: string = null, isArray: boolean = false) {
                var item_list = [];
                superThis.getModelOption(true).forEach((m) => {
                    item_list.push(strDataset ? m.dataset[strDataset] : m.dataset);
                });

                if (!isArray) {
                    if (item_list.length == 0) {
                        return "";
                    } else if (item_list.length == 1) {
                        return item_list[0];
                    }
                }

                return item_list;
            },

            selectAll(_evtToken?: IEventCallback, trigger: boolean = true) {
                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (superThis.getModelOption().length > bindedOptions.maxSelected) return;
                }

                if (this.disabled || this.readonly || !bindedOptions.multiple) return;

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) return;
                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = true;
                });

                this.change(false, trigger);
            },

            deSelectAll(_evtToken?: IEventCallback, trigger: boolean = true) {
                if (this.disabled || this.readonly || !bindedOptions.multiple) return;

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) return;
                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = false;
                });

                this.change(false, trigger);
            },

            setValue(_evtToken: IEventCallback | null = null, value: any, trigger: boolean = true, force: boolean = false) {
                if (!Array.isArray(value)) value = [value];
                value = value.filter((v: any) => v !== "" && v != null);

                if (value.length === 0) {
                    superThis.getModelOption().forEach((m) => (m.selectedNonTrigger = false));
                    this.change(false, trigger);
                    return;
                }

                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (value.length > bindedOptions.maxSelected) {
                        console.warn(`Cannot select more than ${bindedOptions.maxSelected} items`);
                        return;
                    }
                }

                if (!force && (this.disabled || this.readonly)) return;

                // AJAX: load missing values
                if (container.searchController?.isAjax?.()) {
                    const { missing } = container.searchController.checkMissingValues(value);

                    if (missing.length > 0) {
                        (async () => {
                            if (bindedOptions.loadingfield) container.popup?.showLoading?.();

                            try {
                                container.searchController.resetPagination();
                                const result = await container.searchController.loadByValues(missing);
                                if (result.success && result.items.length > 0) {
                                    result.items.forEach((it: any) => {
                                        if (missing.includes(it.value)) it.selected = true;
                                    });

                                    // keep legacy private hook access
                                    container.searchController.applyAjaxResult?.(result.items, true, true);

                                    setTimeout(() => {
                                        superThis.getModelOption().forEach((m) => {
                                            m.selectedNonTrigger = value.some((v: any) => v == m.value);
                                        });
                                        this.change(false, false);
                                    }, 100);
                                } else if (missing.length > 0) {
                                    console.warn(`Could not load ${missing.length} values:`, missing);
                                }
                            } catch (error) {
                                console.error("Error loading missing values:", error);
                            } finally {
                                if (bindedOptions.loadingfield) container.popup?.hideLoading?.();
                            }
                        })();
                        return;
                    }
                }

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) return;
                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach((m) => {
                    m.selectedNonTrigger = value.some((v: any) => v == m.value);
                });

                if (!bindedOptions.multiple && value.length > 0) {
                    container.targetElement.value = value[0];
                }

                this.change(false, trigger);
            },

            open() {
                if (superThis.isOpen) return;

                const findAnother = superThis.Selective?.find?.();
                if (findAnother && !findAnother.isEmpty) {
                    const closeToken: IEventToken = findAnother.close();
                    if (closeToken.isCancel) return;
                }

                if (this.disabled) return;

                const beforeShowToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeShow);
                if (beforeShowToken.isCancel) return;

                superThis.isOpen = true;
                container.directive.setDropdown(true);

                const adapter: MixedAdapter = container.popup.optionAdapter;
                const selectedOption = adapter.getSelectedItem();
                if (selectedOption) adapter.setHighlight(selectedOption, false);
                else adapter.resetHighlight();

                if ((!superThis.hasLoadedOnce || superThis.isBeforeSearch) && bindedOptions?.ajax) {
                    container.searchController.resetPagination();
                    container.popup.showLoading();
                    superThis.hasLoadedOnce = true;
                    superThis.isBeforeSearch = false;

                    setTimeout(() => {
                        if (!container.popup || !container.searchController) return;
                        container.searchController
                            .search("")
                            .then(() => container.popup?.triggerResize?.())
                            .catch((err: unknown) => console.error("Initial ajax load error:", err));
                    }, bindedOptions.animationtime);
                    container.popup.open(null, false);
                } else {
                    container.popup.open(null, true);
                }

                container.searchbox.show();

                const ViewPanel: HTMLElement = container.tags.ViewPanel;
                ViewPanel.setAttribute("aria-expanded", "true");
                ViewPanel.setAttribute("aria-controls", bindedOptions.SEID_LIST);
                ViewPanel.setAttribute("aria-haspopup", "listbox");
                ViewPanel.setAttribute("aria-labelledby", bindedOptions.SEID_HOLDER);

                if (bindedOptions.multiple) ViewPanel.setAttribute("aria-multiselectable", "true");

                iEvents.callEvent([getInstance()], ...bindedOptions.on.show);
                if (superThis.pluginContext) {
                    superThis.runPluginHook("onOpen", (plugin) => plugin.onOpen?.(superThis.pluginContext));
                }
                return;
            },

            close() {
                if (!superThis.isOpen) return;

                const beforeCloseToken = iEvents.callEvent([getInstance()], ...bindedOptions.on.beforeClose);
                if (beforeCloseToken.isCancel) return;

                superThis.isOpen = false;
                container.directive.setDropdown(false);

                container.popup.close(() => {
                    container.searchbox.clear(false);
                });

                container.searchbox.hide();
                container.tags.ViewPanel.setAttribute("aria-expanded", "false");

                iEvents.callEvent([getInstance()], ...bindedOptions.on.close);
                if (superThis.pluginContext) {
                    superThis.runPluginHook("onClose", (plugin) => plugin.onClose?.(superThis.pluginContext));
                }
                return;
            },

            toggle() {
                if (superThis.isOpen) this.close();
                else this.open();
            },

            change(_evtToken: IEventCallback | null = null, canTrigger: boolean = true) {
                if (canTrigger) {
                    if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                        if (this.valueArray.length > bindedOptions.maxSelected) {
                            this.setValue(null, this.oldValue, false, true);
                        }
                    }

                    if (this.disabled || this.readonly) {
                        this.setValue(null, this.oldValue, false, true);
                        return;
                    }

                    const beforeChangeToken = iEvents.callEvent([getInstance(), this.value], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) {
                        this.setValue(null, this.oldValue, false);
                        return;
                    }
                }

                this.refreshMask();
                container.accessorybox.setModelData(this.valueOptions);

                if (canTrigger) {
                    if (container.targetElement) iEvents.trigger(container.targetElement, "change");
                    iEvents.callEvent([getInstance(), this.value], ...bindedOptions.on.change);

                    if (superThis.options?.autoclose) this.close();
                }

                // Trigger update lifecycle
                if (superThis.is(LifecycleState.MOUNTED)) {
                    superThis.update();
                }

                if (superThis.pluginContext && superThis.optionModelManager) {
                    const resources = superThis.optionModelManager.getResources();
                    superThis.runPluginHook("onChange", (plugin) =>
                        plugin.onChange?.(this.value, resources.modelList, resources.adapter, superThis.pluginContext)
                    );
                }
            },

            refreshMask() {
                let mask = bindedOptions.placeholder;

                if (!bindedOptions.multiple && superThis.getModelOption().length > 0) {
                    mask = this.mask[0];
                }

                mask ??= bindedOptions.placeholder;

                container.placeholder.set(mask, false);
                container.searchbox.setPlaceHolder(mask);
            },

            on(_evtToken: IEventCallback, evtName: string, handle: (...args: any[]) => any) {
                if (!bindedOptions.on[evtName]) bindedOptions.on[evtName] = [];
                bindedOptions.on[evtName].push(handle);
            },

            ajax(_evtToken: IEventCallback, obj: AjaxConfig) {
                if (obj.keepSelected == undefined) {
                    obj.keepSelected = superThis.options.keepSelected;
                }
                container.searchController.setAjax(obj);
            },

            loadAjax(_evtToken: IEventCallback) {
                return new Promise((resove, reject) => {
                    container.popup.showLoading();
                    container.searchController.resetPagination();
                    superThis.hasLoadedOnce = true;
                    superThis.isBeforeSearch = false;

                    if (!container.popup || !container.searchController) {
                        resove(getInstance());
                    } else {
                        container.searchController
                            .search("")
                            .then(() => {
                                container.popup?.triggerResize?.();
                                resove(getInstance());
                            })
                            .catch((err: unknown) => {
                                console.error("Initial ajax load error:", err);
                                reject(err);
                            });
                    }
                });
            },
        };

        // mirror properties: disabled / readonly / visible
        this.createSymProp(resp, "disabled", "isDisabled");
        this.createSymProp(resp, "readonly", "isReadOnly");
        this.createSymProp(resp, "visible", "isVisible");

        return resp as SelectBoxAction;
    }

    /**
     * Defines a mirrored facade property on an arbitrary object.
     *
     * This helper is used when building the {@link SelectBoxAction} facade to expose
     * `disabled` / `readonly` / `visible` as ergonomic properties while keeping them
     * synchronized with the underlying {@link SelectBox} runtime state.
     *
     * ### Behavior
     * - Getter proxies the current runtime value from `this[privateProp]`.
     * - Setter coerces the incoming value to boolean and writes it to `this[privateProp]`.
     * - Additionally reflects the value onto `targetElement.dataset[prop]` when available,
     *   allowing external dataset observers (and DOM tooling) to observe state changes.
     *
     * ### Side effects
     * - Mutates the action facade object via `Object.defineProperty`.
     * - Mutates DOM dataset on the underlying `<select>` element (if present).
     *
     * No-ops:
     * - Dataset reflection is skipped when `container.targetElement.dataset` is unavailable.
     *
     * @param obj - The facade object to define the property on.
     * @param prop - The public facade property name (`disabled` | `readonly` | `visible`).
     * @param privateProp - The backing SelectBox property name (`isDisabled` | `isReadOnly` | `isVisible`).
     * @internal
     */
    private createSymProp(
        obj: Record<string, any>,
        prop: "disabled" | "readonly" | "visible",
        privateProp: "isDisabled" | "isReadOnly" | "isVisible"
    ): void {
        const superThis = this;

        Object.defineProperty(obj, prop, {
            get() {
                return superThis[privateProp];
            },
            set(value: any) {
                superThis[privateProp] = !!value;
                if (superThis.container?.targetElement?.dataset) {
                    superThis.container.targetElement.dataset[prop] = String(!!value);
                }
            },
            enumerable: true,
            configurable: true,
        });
    }

    /**
     * Returns a flat list of {@link OptionModel} items from current model resources.
     *
     * The underlying resource list may contain a mix of:
     * - {@link OptionModel} (standalone options)
     * - {@link GroupModel} (group headers with nested `items`)
     *
     * This method flattens the structure into a single array of options, optionally
     * filtered by the *current* selection state.
     *
     * ### Filtering
     * - When `isSelected` is `true` or `false`, filters by `OptionModel.selected`.
     * - When `isSelected` is `null`, returns all available options.
     *
     * No-ops:
     * - Returns an empty array if the {@link optionModelManager} is not available.
     *
     * @param isSelected - Optional selection filter (`true` | `false` | `null`). Defaults to `null`.
     * @returns A flat array of option models (possibly filtered).
     * @internal
     */
    private getModelOption(isSelected: boolean | null = null): OptionModel[] {
        if (!this.optionModelManager) return [];

        const { modelList } = this.optionModelManager.getResources();
        const flatOptions: OptionModel[] = [];

        for (const m of modelList) {
            if (m instanceof OptionModel) {
                flatOptions.push(m);
            } else if (m instanceof GroupModel) {
                if (Array.isArray(m.items) && m.items.length) flatOptions.push(...m.items);
            }
        }

        if (typeof isSelected === "boolean") {
            return flatOptions.filter((o) => o.selected === isSelected);
        }

        return flatOptions;
    }

    /**
     * Safely runs a hook across all registered plugins.
     *
     * Any plugin failure is isolated to prevent breaking the current flow.
     *
     * @param hook - Hook name for logging context.
     * @param runner - Hook invocation handler.
     * @internal
     */
    private runPluginHook(hook: string, runner: (plugin: SelectivePlugin) => void): void {
        if (!this.plugins.length) return;

        this.plugins.forEach((plugin) => {
            try {
                runner(plugin);
            } catch (error) {
                console.error(`Plugin "${plugin.id}" ${hook} error:`, error);
            }
        });
    }
}
