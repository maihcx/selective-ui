import {Libs} from "../utils/libs.js";
import {Refresher} from "../services/refresher.js";
import {PlaceHolder} from "../components/placeholder.js";
import {Directive} from "../components/directive.js";
import {Popup} from "../components/popup.js";
import {SearchBox} from "../components/searchbox.js";
import * as Effector from "../services/effector.js";
import { iEvents } from "../utils/ievents.js";
import { ModelManager } from "../core/model-manager.js";
import { RecyclerView } from "../core/base/recyclerview.js";
import { AccessoryBox } from "./accessorybox.js";
import { SearchController } from "../core/search-controller.js";
import { SelectObserver } from "../services/select-observer.js";
import { DatasetObserver } from "../services/dataset-observer.js";
import { MixedAdapter } from "../adapter/mixed-adapter.js";
import { GroupModel } from "../models/group-model.js";
import { OptionModel } from "../models/option-model.js";

/**
 * @class
 */
export class SelectBox {
    
    /**
     * Initializes a SelectBox instance and, if a source <select> and Selective context are provided,
     * immediately calls init() to set up the enhanced UI and behavior.
     *
     * @param {HTMLSelectElement|null} [select=null] - The native select element to enhance.
     * @param {typeof import('../utils/selective.js').Selective} [Selective=null] - The Selective framework/context used for configuration and services.
     */
    constructor(select = null, Selective = null) {
        select && this.init(select, Selective);
    }
    container = {};
    oldValue = null;

    /** @type {HTMLDivElement} */
    node = null;

    options = null;

    /** @type {ModelManager} */
    optionModelManager = null;

    isOpen = false;

    hasLoadedOnce = false;

    isBeforeSearch = false;

    /** @type {typeof import('../utils/selective.js').Selective} */
    Selective = null;

    /**
     * Gets or sets the disabled state of the SelectBox.
     * When set, updates CSS class and ARIA attributes to reflect the disabled state.
     *
     * @type {boolean}
     */
    get isDisabled() {
        return this.options.disabled;
    }
    set isDisabled(value) {
        this.options.disabled = value;
        this.node.classList.toggle("disabled", value);
        this.node.setAttribute("aria-disabled", value.toString());
        this.container.tags.ViewPanel.setAttribute("aria-disabled", value.toString());
    }

    /**
     * Gets or sets the read-only state of the SelectBox.
     * When set, toggles the "readonly" CSS class to prevent user interaction.
     *
     * @type {boolean}
     */
    get isReadOnly() {
        return this.options.readonly;
    }
    set isReadOnly(value) {
        this.options.readonly = value;
        this.node.classList.toggle("readonly", value);
    }

    /**
     * Gets or sets the visibility state of the SelectBox.
     * When set, toggles the "invisible" CSS class to show or hide the component.
     *
     * @type {boolean}
     */
    get isVisible() {
        return this.options.visible;
    }
    set isVisible(value) {
        this.options.visible = value;
        this.node.classList.toggle("invisible", !value);
    }


    /**
     * Initializes the SelectBox UI and behavior by wiring core components (Placeholder, Directive,
     * SearchBox, Popup, AccessoryBox), setting ARIA attributes, mounting DOM structure, and connecting
     * observers (SelectObserver, DatasetObserver). Configures ModelManager with MixedAdapter and
     * RecyclerView, sets up search (including optional AJAX with debouncing), infinite scroll, and
     * event handlers for selection, highlighting, collapsing, and keyboard navigation.
     *
     * @param {HTMLSelectElement} select - The native <select> element to enhance.
     * @param {typeof import('../utils/selective.js').Selective} Selective - The Selective framework/context for services and configuration.
     */
    init(select, Selective) {
        const 
            bindedMap = Libs.getBinderMap(select),
            options = bindedMap.options,
            placeholder = new PlaceHolder(options),
            directive = new Directive(),
            searchbox = new SearchBox(options),
            effector = Effector.Effector(),
            optionModelManager = new ModelManager(options),
            accessoryBox = new AccessoryBox(options),
            searchController = new SearchController(
                select,
                optionModelManager
            ),
            selectObserver = new SelectObserver(select),
            datasetObserver = new DatasetObserver(select)
        ;
        
        this.Selective = Selective;
        this.options = options;

        placeholder.node.id = options.SEID_HOLDER;

        const container = Libs.mountNode({
            Container: {
                tag: {node: "div", classList: "selective-ui-MAIN"},
                child: {
                    ViewPanel: {
                        tag: {
                            node: "div", 
                            classList: "selective-ui-view", 
                            tabIndex: 0, 
                            role: "combobox",
                            ariaExpanded: "false",
                            ariaLabelledby: options.SEID_HOLDER,
                            ariaControls: options.SEID_LIST,
                            ariaHaspopup: "true",
                            ariaMultiselectable: options.multiple ? "true" : "false",
                            onkeydown: (e) => {
                                if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                                    e.preventDefault();
                                    this.getAction()?.open();
                                }
                            }
                        },
                        child: {
                            PlaceHolder: {
                                tag: placeholder.node
                            },
                            Directive: {
                                tag: directive.node
                            },
                            SearchBox: {
                                tag: searchbox.node
                            }
                        }
                    }
                }
            }
        });
        
        this.container = container;

        this.node = this.container.view;

        select.parentNode.insertBefore(this.node, select);

        this.node.insertBefore(select, container.tags.ViewPanel);

        accessoryBox.setRoot(container.tags.ViewPanel);
        accessoryBox.setModelManager(optionModelManager);

        container.tags.ViewPanel.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
        });

        Refresher.resizeBox(select, container.tags.ViewPanel);

        select.classList.add("init");

        // optionModelManager.setupModel(OptionModel);
        optionModelManager.setupAdapter(MixedAdapter);
        optionModelManager.setupRecyclerView(RecyclerView);
        optionModelManager.createModelResources(Libs.parseSelectToArray(select));
        optionModelManager.onUpdated = () => {
            container.popup.triggerResize();
        };
        
        this.optionModelManager = optionModelManager;

        container.searchController = searchController;

        container.placeholder = placeholder;
        container.directive = directive;
        container.popup = new Popup(select, options, optionModelManager);
        container.popup.setupEffector(effector);
        container.popup.setupInfiniteScroll(searchController, options);
        container.popup.onAdapterPropChanged("selected", () => {
            this.getAction()?.change(null, true);
        });
        container.popup.onAdapterPropChanged("selected_internal", () => {
            this.getAction()?.change(null, false);
        });
        container.popup.onAdapterPropChanging("select", () => {
            this.oldValue = this.getAction()?.value ?? "";
        });
        container.searchbox = searchbox;
        container.effector = effector;
        container.targetElement = select;
        container.accessorybox = accessoryBox;
        this.getAction()?.change(null, false);

        selectObserver.connect();
        selectObserver.onChanged = options => {
            optionModelManager.update(Libs.parseSelectToArray(options));
            this.getAction()?.refreshMask();
        };
        container.selectObserver = selectObserver;

        container.datasetObserver = datasetObserver;
        datasetObserver.connect();
        
        select.addEventListener('options:changed', () => {
            optionModelManager.update(Libs.parseSelectToArray(select));
            this.getAction()?.refreshMask();
            container.popup?.triggerResize?.();
        });

        datasetObserver.onChanged = dataset => {
            if (Libs.string2Boolean(dataset.disabled) != this.isDisabled) {
                this.isDisabled = Libs.string2Boolean(dataset.disabled);
            }

            if (Libs.string2Boolean(dataset.readonly) != this.isReadOnly) {
                this.isReadOnly = Libs.string2Boolean(dataset.readonly);
            }

            if (Libs.string2Boolean(dataset.visible) != this.isVisible) {
                this.isVisible = Libs.string2Boolean(dataset.visible ?? "1");
            }
        }

        if (options.ajax) {
            searchController.setAjax(options.ajax);
        }

        const optionAdapter = container.popup.optionAdapter;

        let searchHandle = (keyword, isTrigger) => {
            if (!isTrigger && keyword == "") {
                searchController.clear();
            }
            else {
                if (keyword != "") {
                    this.isBeforeSearch = true;
                }
                searchController.search(keyword).then((result) => {
                    container.popup.triggerResize();
                    
                    if (result.hasResults) {
                        setTimeout(() => {
                            optionAdapter.resetHighlight();
                        }, options.animationtime);
                    }
                }).catch(error => {
                    console.error("Search error:", error);
                });
            }
        }
        let searchHandleTimer = null;
        searchbox.onSearch = (keyword, isTrigger) => {
            if (!searchController.compareSearchTrigger(keyword)) {
                return;
            }

            if (searchController.isAjax()) {
                clearTimeout(searchHandleTimer);
                container.popup.showLoading();

                searchHandleTimer = setTimeout(() => {
                    searchHandle(keyword, isTrigger);
                }, options.delaysearchtime);
            }
            else {
                searchHandle(keyword, isTrigger);
            }
        };

        searchController.setPopup(container.popup);
        searchbox.onNavigate = (direction) => {
            optionAdapter.navigate(direction);
        };

        searchbox.onEnter = () => {
            optionAdapter.selectHighlighted();
        };

        optionAdapter.onHighlightChange = (index, id) => {
            searchbox.setActiveDescendant(id);
        }

        optionAdapter.onCollapsedChange = () => {
            container.popup.triggerResize();
        }

        searchbox.onEsc = () => {
            this.getAction()?.close();
            container.tags.ViewPanel.focus();
        };

        this.isDisabled = Libs.string2Boolean(options.disabled);
        this.isReadOnly = Libs.string2Boolean(options.readonly);
    }

    /**
     * Disconnects observers associated with the SelectBox instance,
     * including SelectObserver and DatasetObserver, to clean up resources
     * and stop monitoring changes.
     */
    deInit() {
        const container = this.container || {};
        const { selectObserver, datasetObserver } = container;
        if (selectObserver?.disconnect) selectObserver.disconnect();
        if (datasetObserver?.disconnect) datasetObserver.disconnect();
    }
    
    /**
     * Returns an action API for controlling the SelectBox instance.
     * The API exposes getters/setters and operations that synchronize UI, model, and events:
     * - placeholder: get/set placeholder (updates Placeholder & SearchBox)
     * - oldValue/value/valueArray/valueString/valueOptions/valueText/mask: read current selection(s)
     * - disabled/readonly/visible: proxy component state to dataset & CSS/ARIA
     * - selectAll/deSelectAll: bulk select/deselect (respects multiple & maxSelected, emits beforeChange/change)
     * - setValue: programmatically set selection(s) (array or single), with optional trigger/force
     * - open/close/toggle: control popup visibility (runs beforeShow/show and beforeClose/close hooks)
     * - change: commit selection changes, refresh mask, update AccessoryBox, fire DOM "change" & custom events, and auto-close if configured
     * - refreshMask: recompute displayed label (single-select uses selected text; otherwise placeholder)
     * - on: register custom event handlers into options.on
     * - ajax: configure AJAX search behavior via SearchController
     * Internally uses ModelManager/adapter to highlight, resize, and keep ARIA attributes in sync.
     */
    getAction() {
        const container = this.container;
        const superThis = this;
        const bindedMap = Libs.getBinderMap(container.targetElement);
        if (!bindedMap) {
            return null;
        }
        const bindedOptions = bindedMap.options;
        let resp = {
            get placeholder() {
                return container.placeholder.get();
            },
            set placeholder(value) {
                container.placeholder?.set(value);
                container.searchbox?.setPlaceHolder(value);
            },
            get oldValue() {
                return superThis.oldValue;
            },
            set value(value) {
                this.setValue(null, value, true);
            },
            get value() {
                let item_list = this.valueArray;
                
                const valLength = item_list.length;
                return valLength > 1 ? item_list : (valLength == 0 ? "" : item_list[0]);
            },
            get valueArray() {
                let item_list = [];
                superThis.getModelOption().forEach(modelElement => {
                    modelElement["selected"] && (item_list.push(modelElement["value"]));
                });
                return item_list;
            },
            get valueString() {
                const customDelimiter = bindedOptions.customDelimiter;
                let item_list = this.valueArray;

                return item_list.join(customDelimiter);
            },
            get valueOptions() {
                let item_list = [];
                superThis.getModelOption().forEach(modelElement => {
                    modelElement["selected"] && (item_list.push(modelElement));
                });
                return item_list;
            },
            get mask() {
                let item_list = [];
                superThis.getModelOption().forEach(modelOption => {
                    modelOption["selected"] && (item_list.push(modelOption["text"]));
                });
                return item_list;
            },
            get valueText() {
                var item_list = [];
                superThis.getModelOption().forEach(modelOption => {
                    modelOption["selected"] && (item_list.push(modelOption["text"]));
                });
                
                const valLength = item_list.length;
                return valLength > 1 ? item_list : (valLength == 0 ? "" : item_list[0]);
            },
            get isOpen() {
                return superThis.isOpen;
            },
            selectAll(evtToken, trigger = true) {
                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (superThis.getModelOption().length > bindedOptions.maxSelected) {
                        return
                    }
                }

                if (this.disabled || this.readonly || !bindedOptions.multiple) {
                    return;
                }

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([this], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) {
                        return;
                    }

                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach(modelOption => {
                    modelOption["selectedNonTrigger"] = true;
                });
                
                this.change(false, trigger);
            },
            deSelectAll(evtToken, trigger = true) {
                if (this.disabled || this.readonly || !bindedOptions.multiple) {
                    return;
                }

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([this], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) {
                        return;
                    }

                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach(modelOption => {
                    modelOption["selectedNonTrigger"] = false;
                });
                
                this.change(false, trigger);
            },
            setValue(evtToken = null, value, trigger = true, force = false) {
                !Array.isArray(value) && (value = [value]);

                if (bindedOptions.multiple && bindedOptions.maxSelected > 0) {
                    if (value.length > bindedOptions.maxSelected) {
                        return
                    }
                }

                if (!force && (this.disabled || this.readonly)) {
                    return;
                }

                if (trigger) {
                    const beforeChangeToken = iEvents.callEvent([this], ...bindedOptions.on.beforeChange);
                    if (beforeChangeToken.isCancel) {
                        return;
                    }

                    superThis.oldValue = this.value;
                }

                superThis.getModelOption().forEach(modelOption => {
                    modelOption["selectedNonTrigger"] = value.some(v => v == modelOption["value"]);
                });
                
                if (!bindedOptions.multiple){
                    container.targetElement.value = value[0];
                }
                
                this.change(false, trigger);
            },
            open() {
                if (superThis.isOpen) return false;
                let findAnother = superThis.Selective.find();
                if (!findAnother.isEmpty) {
                    /** @type {IEventToken} */
                    const closeToken = findAnother.close();
                    if (closeToken.isCancel) {
                        return false;
                    }
                }

                if (this.disabled) {
                    return false;
                }
                
                const beforeShowToken = iEvents.callEvent([this], ...bindedOptions.on.beforeShow);
                if (beforeShowToken.isCancel) {
                    return false;
                }

                superThis.isOpen = true;
                container.directive.setDropdown(true);

                const adapter = container.popup.optionAdapter;
                const selectedOption = adapter.getSelectedItem();
                if (selectedOption) {
                    adapter.setHighlight(selectedOption, false);
                } else {
                    adapter.resetHighlight();
                }

                if ((!superThis.hasLoadedOnce || superThis.isBeforeSearch) && bindedOptions?.ajax) {
                    container.popup.showLoading();
                    superThis.hasLoadedOnce = true;
                    superThis.isBeforeSearch = false;
                    
                    setTimeout(() => {
                        if (!container.popup || !container.searchController) return;
                        container.searchController.search("")
                            .then(() => container.popup?.triggerResize?.())
                            .catch(err => console.error("Initial ajax load error:", err));
                    }, bindedOptions.animationtime);
                }
                
                container.popup.open();
                container.searchbox.show();

                container.tags.ViewPanel.setAttribute("aria-expanded", "true");
                
                iEvents.callEvent([this], ...bindedOptions.on.show);

                return true;
            },
            close() {
                if (!superThis.isOpen) return false;

                const beforeCloseToken = iEvents.callEvent([this], ...bindedOptions.on.beforeClose);
                if (beforeCloseToken.isCancel) {
                    return false;
                }
                
                superThis.isOpen = false;
                
                container.directive.setDropdown(false);
                container.popup.close(() => {
                    container.searchbox.clear(false);
                });
                container.searchbox.hide();
                container.tags.ViewPanel.setAttribute("aria-expanded", "false");

                iEvents.callEvent([this], ...bindedOptions.on.close);

                return true;
            },
            toggle() {
                if (superThis.isOpen) {
                    this.close();
                }
                else {
                    this.open();
                }
            },
            change(evtToken = null, canTrigger = true) {
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

                    const beforeChangeToken = iEvents.callEvent([this, this.value], ...bindedOptions.on.beforeChange);
                    
                    if (beforeChangeToken.isCancel) {
                        this.setValue(null, this.oldValue, false);
                        return;
                    }
                }

                this.refreshMask();
                container.accessorybox.setModelData(this.valueOptions);
                if (canTrigger) {
                    if (container.targetElement) {
                        iEvents.trigger(container.targetElement, "change");
                    }
                    iEvents.callEvent([this, this.value], ...bindedOptions.on.change);

                    if (superThis.options.autoclose) {
                        this.close();
                    }
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
            on(evtToken, evtName, handle) {
                if (!bindedOptions.on[evtName]) {
                    bindedOptions.on[evtName] = [];
                }
                bindedOptions.on[evtName].push(handle);
            },
            ajax(evtToken, obj) {
                container.searchController.setAjax(obj);
            }
        };

        this.createSymProp(resp, "disabled", "isDisabled");
        this.createSymProp(resp, "readonly", "isReadOnly");
        this.createSymProp(resp, "visible", "isVisible");

        return resp;
    }

    /**
     * Creates a property on the given object with custom getter and setter behavior.
     * The getter returns the value stored in a private property on the current instance (`this`),
     * and the setter updates both the private property and a corresponding data-* attribute
     * on the instance's `container.targetElement`.
     *
     * @param {Object} obj - The object on which to define the public property.
     * @param {string} prop - The public property name to create on `obj`.
     * @param {string} privateProp - The private property name on `this` that stores the actual value.
     */
    createSymProp(obj, prop, privateProp) {
        const superThis = this;

        Object.defineProperty(obj, prop, {
            get() { return superThis[privateProp]; },
            set(value) {
                superThis[privateProp] = value;
                superThis.container.targetElement.dataset[prop] = value;
            },
            enumerable: true,
            configurable: true
        });
    }

    /**
     * Flattens and returns all option models from the current resources.
     * Collects OptionModel instances directly and items within GroupModel.
     * If `isSelected` is a boolean, filters by selection state; otherwise returns all.
     *
     * @param {boolean|null} [isSelected=null] - Optional filter to return only selected or unselected options.
     * @returns {(GroupModel|OptionModel)[]} - A flat array of option models (and/or group items).
     */
    getModelOption(isSelected = null) {
        if (!this.optionModelManager) return [];

        const { modelList } = this.optionModelManager.getResources();

        const flatOptions = [];
        for (const m of modelList) {
            if (m instanceof OptionModel) {
                flatOptions.push(m);
            } else if (m instanceof GroupModel) {
                if (Array.isArray(m.items) && m.items.length) {
                    flatOptions.push(...m.items);
                }
            }
        }

        if (typeof isSelected === "boolean") {
            return flatOptions.filter(o => o.selected === isSelected);
        }
        return flatOptions;
    }
}