
import { Libs } from "../utils/libs";
import { Refresher } from "../services/refresher";
import { PlaceHolder } from "./placeholder";
import { Directive } from "./directive";
import { Popup } from "./popup";
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

import type { SelectiveOptions } from "../types/utils/selective.type";
import { IEventToken, IEventCallback } from "../types/utils/ievents.type";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { BinderMap } from "../types/utils/istorage.type";
import { ContainerRuntime, SelectBoxAction } from "../types/components/searchbox.type";
import { AjaxConfig } from "../types/core/search-controller.type";
import { Selective } from "../utils/selective";
import { VirtualRecyclerView } from "../core/base/virtual-recyclerview";

/**
 * @class
 */
export class SelectBox {
    /**
     * Initializes a SelectBox instance and, if a source <select> and Selective context are provided,
     * immediately calls init() to set up the enhanced UI and behavior.
     *
     * @param {HTMLSelectElement|null} [select=null] - The native select element to enhance.
     * @param {any|null} [Selective=null] - The Selective framework/context used for configuration and services.
     */
    constructor(select: HTMLSelectElement | null = null, Selective: any | null = null) {
        if (select) this.init(select, Selective);
    }

    container: Partial<ContainerRuntime> = {};

    oldValue: unknown = null;

    node: HTMLDivElement | null = null;

    options: SelectiveOptions | null = null;

    optionModelManager: ModelManager<MixedItem, MixedAdapter> | null = null;

    isOpen = false;
    hasLoadedOnce = false;
    isBeforeSearch = false;

    /** Selective context (global helper) */
    Selective: Selective | null = null;

    /**
     * Gets or sets the disabled state of the SelectBox.
     * When set, updates CSS class and ARIA attributes to reflect the disabled state.
     */
    get isDisabled(): boolean {
        return !!this.options?.disabled;
    }
    set isDisabled(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.disabled = value;
        this.node.classList.toggle("disabled", value);
        this.node.setAttribute("aria-disabled", String(value));
        this.container.tags?.ViewPanel?.setAttribute("aria-disabled", String(value));
    }

    /**
     * Gets or sets the read-only state of the SelectBox.
     * When set, toggles the "readonly" CSS class to prevent user interaction.
     */
    get isReadOnly(): boolean {
        return !!this.options?.readonly;
    }
    set isReadOnly(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.readonly = value;
        this.node.classList.toggle("readonly", value);
    }

    /**
     * Gets or sets the visibility state of the SelectBox.
     * When set, toggles the "invisible" CSS class to show or hide the component.
     */
    get isVisible(): boolean {
        return !!this.options?.visible;
    }
    set isVisible(value: boolean) {
        if (!this.options || !this.node) return;
        this.options.visible = value;
        this.node.classList.toggle("invisible", !value);
    }

    /**
     * Initializes the SelectBox UI and behavior by wiring core components.
     *
     * @param {HTMLSelectElement} select - The native <select> element to enhance.
     * @param {any} Selective - The Selective framework/context for services and configuration.
     */
    init(select: HTMLSelectElement, Selective: any): void {
        const bindedMap = Libs.getBinderMap(select) as BinderMap;
        const options = bindedMap.options as SelectiveOptions;

        const placeholder = new PlaceHolder(options);
        const directive = new Directive();
        const searchbox = new SearchBox(options);
        const effector = Effector();
        const optionModelManager = new ModelManager<MixedItem, MixedAdapter>(options);
        const accessoryBox = new AccessoryBox(options);
        const searchController = new SearchController(select, optionModelManager, this);

        const selectObserver = new SelectObserver(select);
        const datasetObserver = new DatasetObserver(select);

        this.Selective = Selective;
        this.options = options;

        // ensure placeholder has id for aria-labelledby usage
        if (placeholder.node) placeholder.node.id = String((options).SEID_HOLDER ?? "");

        const container = Libs.mountNode(
            {
                Container: {
                    tag: { node: "div", classList: "selective-ui-MAIN" },
                    child: {
                        ViewPanel: {
                            tag: {
                                node: "div",
                                classList: "selective-ui-view",
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
        ) as unknown as ContainerRuntime;

        this.container = container;
        this.node = container.view as HTMLDivElement;

        // Mount into DOM: wrapper before select, then move select inside
        select.parentNode?.insertBefore(this.node, select);
        this.node.insertBefore(select, container.tags.ViewPanel);

        accessoryBox.setRoot(container.tags.ViewPanel);
        accessoryBox.setModelManager(optionModelManager);

        container.tags.ViewPanel.addEventListener("mousedown", (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
        });

        Refresher.resizeBox(select, container.tags.ViewPanel);
        select.classList.add("init");

        // ModelManager setup
        optionModelManager.setupAdapter(MixedAdapter);
        if (options.virtualScroll) {
            optionModelManager.setupRecyclerView(VirtualRecyclerView);
        }
        else {
            optionModelManager.setupRecyclerView(RecyclerView);
        }
        optionModelManager.createModelResources(Libs.parseSelectToArray(select));

        optionModelManager.onUpdated = () => {
            container.popup?.triggerResize?.();
        };

        this.optionModelManager = optionModelManager;

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

        // initial mask
        this.getAction()?.change(null, false);

        // Observers
        selectObserver.connect();
        selectObserver.onChanged = (sel) => {
            optionModelManager.update(Libs.parseSelectToArray(sel));
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

        // Custom event (manual refresh)
        select.addEventListener("options:changed", () => {
            optionModelManager.update(Libs.parseSelectToArray(select));
            this.getAction()?.refreshMask();
            container.popup?.triggerResize?.();
        });

        // AJAX setup (if provided)
        if (options.ajax) {
            searchController.setAjax(options.ajax);
        }

        const optionAdapter = container.popup!.optionAdapter as MixedAdapter;

        const searchHandle = (keyword: string, isTrigger: boolean) => {
            if (!isTrigger && keyword === "") {
                searchController.clear();
            } else {
                if (keyword !== "") this.isBeforeSearch = true;

                searchController
                    .search(keyword)
                    .then((result: any) => {
                        container.popup?.triggerResize?.();
                        if (result?.hasResults) {
                            setTimeout(() => {
                                container.popup?.triggerResize?.();
                                optionAdapter.resetHighlight();
                            }, options.animationtime ? options.animationtime + 10 : 0);
                        }
                    })
                    .catch((error: unknown) => {
                        console.error("Search error:", error);
                    });
            }
        };

        let searchHandleTimer: ReturnType<typeof setTimeout> | null = null;

        searchbox.onSearch = (keyword: string, isTrigger: boolean) => {
            if (!searchController.compareSearchTrigger(keyword)) return;

            if (searchController.isAjax()) {
                if (searchHandleTimer) clearTimeout(searchHandleTimer);
                container.popup?.showLoading?.();
                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, options.delaysearchtime ?? 0);
            } else {
                searchHandle(keyword, isTrigger);
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

        // Initial states
        this.isDisabled = Libs.string2Boolean(options.disabled);
        this.isReadOnly = Libs.string2Boolean(options.readonly);
    }

    /**
     * Disconnects observers associated with the SelectBox instance.
     */
    deInit(): void {
        const c: any = this.container ?? {};
        const { selectObserver, datasetObserver } = c;

        if (selectObserver?.disconnect) selectObserver.disconnect();
        if (datasetObserver?.disconnect) datasetObserver.disconnect();
    }

    /**
     * Returns an action API for controlling the SelectBox instance.
     */
    getAction(): SelectBoxAction | null {
        const container = this.container;
        const superThis = this;
        const getInstance = () => {
            return this.Selective.find(container.targetElement);
        }
        
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
                superThis.getModelOption(true).forEach(m => {
                    item_list.push(strDataset ? m.dataset[strDataset] : m.dataset);
                });
                
                if (!isArray) {
                    if (item_list.length == 0) {
                        return "";
                    }
                    else if (item_list.length == 1) {
                        return item_list[0]
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
                }
                else {
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
                    }
                    else {
                        container.searchController
                            .search("")
                            .then(() => {
                                container.popup?.triggerResize?.();
                                resove(getInstance());
                            })
                            .catch((err: unknown) => {
                                console.error("Initial ajax load error:", err);
                                reject(err);
                            })
                        ;
                    }
                })
            }
        };

        // mirror properties: disabled / readonly / visible
        this.createSymProp(resp, "disabled", "isDisabled");
        this.createSymProp(resp, "readonly", "isReadOnly");
        this.createSymProp(resp, "visible", "isVisible");

        return resp as SelectBoxAction;
    }

    /**
     * Creates a property on the given object with custom getter and setter behavior.
     */
    createSymProp(
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
     * Flattens and returns all option models from the current resources.
     */
    getModelOption(isSelected: boolean | null = null): OptionModel[] {
        if (!this.optionModelManager) return [];

        const { modelList } = this.optionModelManager.getResources();
        const flatOptions: OptionModel[] = [];

        for (const m of modelList as MixedItem[]) {
            if (m instanceof OptionModel) {
                flatOptions.push(m);
            }
            else if (m instanceof GroupModel) {
                if (Array.isArray(m.items) && m.items.length) flatOptions.push(...m.items);
            }
        }

        if (typeof isSelected === "boolean") {
            return flatOptions.filter((o) => o.selected === isSelected);
        }

        return flatOptions;
    }

    detroy() {
        this.container.popup!.detroy();
    }
}