import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { Adapter } from "./base/adapter";

/**
 * @template {ModelContract<any, any>} TModel
 * @template {Adapter} TAdapter
 */
export class ModelManager {
    /** @type {Array<GroupModel|OptionModel>} */
    #privModelList = [];

    /** @type {new (...args: any[]) => TAdapter} */
    #privAdapter;

    /** @type {TAdapter} */
    #privAdapterHandle;

    /** @type {new (...args: any[]) => RecyclerViewContract<TAdapter>} */
    #privRecyclerView;

    /** @type {RecyclerViewContract<TAdapter>} */
    #privRecyclerViewHandle;

    #lastFingerprint = null;

    options = null;
    
    /**
     * Constructs a ModelManager with configuration options used by created models and components.
     *
     * @param {object} options - Configuration object passed to GroupModel/OptionModel and view infrastructure.
     */
    constructor(options) {
        this.options = options;
    }

    /**
     * Registers the adapter class to be used for rendering and managing models.
     *
     * @param {new (...args: any[]) => TAdapter} adapter - The adapter constructor (class) to instantiate.
     */
    setupAdapter(adapter) {
        this.#privAdapter = adapter;
    }

    /**
     * Registers the RecyclerView class responsible for hosting and updating item views.
     *
     * @param {new (...args: any[]) => RecyclerViewContract<TAdapter>} recyclerView - The recycler view constructor.
     */
    setupRecyclerView(recyclerView) {
        this.#privRecyclerView = recyclerView;
    }

    /**
     * Checks whether the provided model data differs from the last recorded fingerprint.
     * Computes a new fingerprint and compares it to the previous one; if different,
     * updates the stored fingerprint and returns true, otherwise returns false.
     *
     * @param {Array<HTMLOptionElement|HTMLOptGroupElement>} modelData - The current model data (options/optgroups).
     * @returns {boolean} True if there are real changes; false otherwise.
     */
    hasRealChanges(modelData) {
        const newFingerprint = this.#createFingerprint(modelData);
        const hasChanges = newFingerprint !== this.#lastFingerprint;
        
        if (hasChanges) {
            this.#lastFingerprint = newFingerprint;
        }
        
        return hasChanges;
    }

    /**
     * Produces a stable string fingerprint for the given model data.
     * For <optgroup>, includes the label and a pipe-joined hash of its child options
     * (value:text:selected). For plain <option>, includes its value, text, and selected state.
     * The entire list is joined by '||' to form the final fingerprint.
     *
     * @param {Array<HTMLOptionElement|HTMLOptGroupElement>} modelData - The current model data to fingerprint.
     * @returns {string} A deterministic fingerprint representing the structure and selection state.
     */
    #createFingerprint(modelData) {
        return modelData.map(item => {
            if (item.tagName === "OPTGROUP") {
                const optionsHash = Array.from(item.children)
                    .map((/** @type {HTMLOptionElement} */ opt) => `${opt.value}:${opt.text}:${opt.selected}`)
                    .join('|');
                return `G:${item.label}:${optionsHash}`;
            } else {
                const oItem = /** @type {HTMLOptionElement} */ (item);
                return `O:${oItem.value}:${oItem.text}:${oItem.selected}`;
            }
        }).join('||');
    }

    /**
     * Builds model instances (GroupModel/OptionModel) from raw <optgroup>/<option> elements.
     * Preserves grouping relationships and returns the structured list.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - Parsed DOM elements from the source <select>.
     * @returns {Array<GroupModel|OptionModel>} - The ordered list of group and option models.
     */
    createModelResources(modelData) {
        this.#privModelList = [];
        let currentGroup = null;
        
        modelData.forEach(data => {
            if (data.tagName === "OPTGROUP") {
                currentGroup = new GroupModel(this.options, data);
                this.#privModelList.push(currentGroup);
            } 
            else if (data.tagName === "OPTION") {
                const optionModel = new OptionModel(this.options, /** @type {HTMLOptionElement} */ (data));
                
                if (data["__parentGroup"] && currentGroup && 
                    data["__parentGroup"] === currentGroup.targetElement) {
                    currentGroup.addItem(optionModel);
                    optionModel.group = currentGroup;
                } else {
                    this.#privModelList.push(optionModel);
                    currentGroup = null;
                }
            }
        });

        return this.#privModelList;
    }

    /**
     * Replaces the current model list with new data and syncs it into the adapter,
     * then refreshes the view to reflect changes.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - New source elements to rebuild models from.
     */
    replace(modelData) {
        this.#lastFingerprint = null;
        
        this.createModelResources(modelData);

        if (this.#privAdapterHandle) {
            this.#privAdapterHandle.syncFromSource(this.#privModelList);
        }

        this.refresh();
    }

    /**
     * Requests a view refresh if an adapter has been initialized,
     * typically used after external updates to model data.
     */
    notify() {
        if (!this.#privAdapterHandle) return;
        
        this.refresh();
    }

    /**
     * Initializes adapter and recycler view instances, attaches them to a container element,
     * and applies optional configuration overrides for adapter and recyclerView.
     *
     * @param {HTMLElement} viewElement - The container element where items will be rendered.
     * @param {object} [adapterOpt={}] - Optional properties to merge into the adapter instance.
     * @param {object} [recyclerViewOpt={}] - Optional properties to merge into the recycler view instance.
     */
    load(viewElement, adapterOpt = {}, recyclerViewOpt = {}) {
        this.#privAdapterHandle = new this.#privAdapter(this.#privModelList);
        Object.assign(this.#privAdapterHandle, adapterOpt);

        this.#privRecyclerViewHandle = new this.#privRecyclerView(viewElement);
        this.#privRecyclerViewHandle.setAdapter(this.#privAdapterHandle);
        Object.assign(this.#privRecyclerViewHandle, recyclerViewOpt);
    }

    /**
     * Diffs existing models against new <optgroup>/<option> data to update in place:
     * reuses existing models when possible, updates positions and group membership,
     * removes stale views, and notifies adapter and listeners about updates.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - Fresh DOM elements reflecting the latest state.
     */
    update(modelData) {
        if (!this.hasRealChanges(modelData)) {
            return;
        }

        const oldModels = this.#privModelList;
        const newModels = [];
        
        const oldGroupMap = new Map();
        const oldOptionMap = new Map();
        
        oldModels.forEach(model => {
            if (model instanceof GroupModel) {
                oldGroupMap.set(model.label, model);
            } else if (model instanceof OptionModel) {
                const key = `${model.value}::${model.textContent}`;
                oldOptionMap.set(key, model);
            }
        });

        let currentGroup = null;
        let position = 0;
        const changesToApply = [];

        modelData.forEach((data, index) => {
            if (data.tagName === "OPTGROUP") {
                let dataVset = /** @type {HTMLOptGroupElement} */ (data);
                const existingGroup = /** @type {GroupModel} */ (oldGroupMap.get(dataVset.label));
                
                if (existingGroup) {
                    const hasLabelChange = existingGroup.label !== dataVset.label;
                    
                    if (hasLabelChange) {
                        changesToApply.push(() => {
                            existingGroup.update(dataVset);
                        });
                    }
                    
                    existingGroup.position = position;
                    existingGroup.items = [];
                    currentGroup = existingGroup;
                    newModels.push(existingGroup);
                    oldGroupMap.delete(dataVset.label);
                } else {
                    currentGroup = new GroupModel(this.options, dataVset);
                    currentGroup.position = position;
                    newModels.push(currentGroup);
                }
                position++;
            }
            else if (data.tagName === "OPTION") {
                let dataVset = /** @type {HTMLOptionElement} */ (data);
                const key = `${dataVset.value}::${dataVset.text}`;
                const existingOption = /** @type {OptionModel} */ (oldOptionMap.get(key));
                
                if (existingOption) {
                    const hasSelectedChange = existingOption.selected !== dataVset.selected;
                    const hasPositionChange = existingOption.position !== position;
                    
                    if (hasSelectedChange || hasPositionChange) {
                        changesToApply.push(() => {
                            existingOption.update(dataVset);
                            existingOption.position = position;
                        });
                    } else {
                        existingOption.position = position;
                    }
                    
                    if (dataVset["__parentGroup"] && currentGroup) {
                        currentGroup.addItem(existingOption);
                        existingOption.group = currentGroup;
                    } else {
                        existingOption.group = null;
                        newModels.push(existingOption);
                    }
                    
                    oldOptionMap.delete(key);
                } else {
                    const newOption = new OptionModel(this.options, dataVset);
                    newOption.position = position;
                    
                    if (dataVset["__parentGroup"] && currentGroup) {
                        currentGroup.addItem(newOption);
                        newOption.group = currentGroup;
                    } else {
                        newModels.push(newOption);
                    }
                }
                position++;
            }
        });

        if (changesToApply.length > 0) {
            requestAnimationFrame(() => {
                changesToApply.forEach(change => change());
            });
        }

        oldGroupMap.forEach(removedGroup => {
            if (removedGroup.view) {
                removedGroup.view.getView()?.remove();
            }
        });
        
        oldOptionMap.forEach(removedOption => {
            if (removedOption.view) {
                removedOption.view.getView()?.remove();
            }
        });

        this.#privModelList = newModels;
        
        if (this.#privAdapterHandle) {
            this.#privAdapterHandle.updateData(this.#privModelList);
        }

        this.onUpdated();
        this.refresh();
    }

    /**
     * Hook invoked after the manager completes an update or refresh cycle.
     * Override to run side effects (e.g., layout adjustments or analytics).
     */
    onUpdated() { }

    /**
     * Instructs the adapter to temporarily skip event handling (e.g., during batch updates).
     *
     * @param {boolean} value - True to skip events; false to restore normal behavior.
     */
    skipEvent(value) {
        this.#privAdapterHandle.isSkipEvent = value;
    }

    /**
     * Re-renders the recycler view if present and invokes the post-refresh hook.
     * No-op if the recycler view is not initialized.
     */
    refresh() {
        if (!this.#privRecyclerViewHandle) return;
        this.#privRecyclerViewHandle.refresh();
        this.onUpdated();
    }

    /**
     * Returns handles to the current resources, including the model list,
     * adapter instance, and recycler view instance.
     *
     * @returns {{modelList: (GroupModel|OptionModel)[], adapter: TAdapter, recyclerView: RecyclerViewContract<TAdapter>}}
     */
    getResources() {
        return {
            modelList: this.#privModelList,
            adapter: this.#privAdapterHandle,
            recyclerView: this.#privRecyclerViewHandle
        };
    }

    /**
     * Triggers the adapter's pre-change pipeline for a named event,
     * enabling observers to react before a change is applied.
     *
     * @param {string} event_name - The event or property name (e.g., "items", "select").
     */
    triggerChanging(event_name) {
        this.#privAdapterHandle.changingProp(event_name);
    }

    /**
     * Triggers the adapter's post-change pipeline for a named event,
     * notifying observers after a change has been applied.
     *
     * @param {string} event_name - The event or property name (e.g., "items", "select").
     */
    triggerChanged(event_name) {
        this.#privAdapterHandle.changeProp(event_name);
    }
}
