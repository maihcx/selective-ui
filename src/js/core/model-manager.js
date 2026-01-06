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
        const oldModels = this.#privModelList;
        const newModels = [];
        
        const oldGroupMap = new Map();
        const oldOptionMap = new Map();
        
        oldModels.forEach(model => {
            if (model instanceof GroupModel) {
                oldGroupMap.set(model.label, model);
            } else if (model instanceof OptionModel) {
                oldOptionMap.set(model.value, model);
            }
        });

        let currentGroup = null;
        let position = 0;

        modelData.forEach((data, index) => {
            if (data.tagName === "OPTGROUP") {
                let dataVset = /** @type {HTMLOptGroupElement} */ (data);
                const existingGroup = oldGroupMap.get(dataVset.label);
                
                if (existingGroup) {
                    existingGroup.update(dataVset);
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
                const existingOption = oldOptionMap.get(dataVset.value);
                
                if (existingOption) {
                    existingOption.update(dataVset);
                    existingOption.position = position;
                    
                    if (dataVset["__parentGroup"] && currentGroup) {
                        currentGroup.addItem(existingOption);
                        existingOption.group = currentGroup;
                    } else {
                        existingOption.group = null;
                        newModels.push(existingOption);
                    }
                    
                    oldOptionMap.delete(dataVset.value);
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
