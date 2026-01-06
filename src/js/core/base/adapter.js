import { Libs } from "../../utils/libs";
import { Model } from "./model";

/**
 * @template {ModelContract<any, any>} TItem
 * @implements {AdapterContract<TItem>}
 */
export class Adapter {
    /** @type {TItem[]} */
    items = [];
    adapterKey = Libs.randomString(12);

    isSkipEvent = false;


    /**
     * Initializes the adapter with an optional array of items and invokes onInit()
     * to perform any subclass-specific setup. Accepts a generic list of models.
     *
     * @param {TItem[]} [items=[]] - Initial items to be managed by the adapter.
     */
    constructor(items = []) {
        this.items = items;
        this.onInit();
    }

    /**
     * Lifecycle hook called once after construction. Override in subclasses to
     * perform setup tasks (e.g., event wiring, cache building).
     */
    onInit() {}

    /**
     * Binds an item model to its viewer at a given position. If the item has not
     * been initialized yet, renders the viewer; otherwise triggers an update.
     *
     * @param {any} item - The model instance to bind to the view.
     * @param {any} viewer - The view instance responsible for rendering the model.
     * @param {number} position - The index of the item within the adapter.
     */
    onViewHolder(item, viewer, position) {
        if (!item.isInit) {
            viewer.render();
        }
        else {
            viewer.update();
        }
    }

    /**
     * Registers a pre-change (debounced) callback for a property change pipeline.
     * The callback is scheduled with a minimal delay to batch rapid updates.
     *
     * @param {string} propName - The property name to observe (e.g., "items").
     * @param {Function} callback - Function to execute before the property changes.
     */
    onPropChanging(propName, callback) {
        Libs.timerProcess.setExecute(`${propName}ing_${this.adapterKey}`, callback, 1);
    }

    /**
     * Registers a post-change callback for a property change pipeline.
     * The callback is executed after the property is updated.
     *
     * @param {string} propName - The property name to observe (e.g., "items").
     * @param {Function} callback - Function to execute after the property changes.
     */
    onPropChanged(propName, callback) {
        Libs.timerProcess.setExecute(`${propName}_${this.adapterKey}`, callback);
    }

    /**
     * Triggers the post-change pipeline for a given property, passing optional parameters
     * to registered callbacks. Use this after mutating adapter state.
     *
     * @param {string} propName - The property name to emit (e.g., "items").
     * @param {...any} params - Parameters forwarded to the callbacks.
     */
    changeProp(propName, ...params) {
        Libs.timerProcess.run(`${propName}_${this.adapterKey}`, ...params);
    }

    /**
     * Triggers the pre-change pipeline for a given property, passing optional parameters
     * to registered callbacks. Use this before mutating adapter state.
     *
     * @param {string} propName - The property name to emit (e.g., "items").
     * @param {...any} params - Parameters forwarded to the callbacks.
     */
    changingProp(propName, ...params) {
        Libs.timerProcess.run(`${propName}ing_${this.adapterKey}`, ...params);
    }


    /**
     * Creates and returns a viewer instance for the given item within the specified parent container.
     * Override in subclasses to return a concrete view implementation tailored to TItem.
     *
     * @param {HTMLElement} parent - The container element that will host the viewer.
     * @param {TItem} item - The model instance for which the viewer is created.
     * @returns {any} - The created viewer instance; null by default.
     */
    viewHolder(parent, item) {
        return null;
    }

    /**
     * Returns the total number of items currently managed by the adapter.
     *
     * @returns {number} - The item count.
     */
    itemCount() {
        return this.items.length;
    }

    /**
     * Replaces the adapter's items with a new collection, emitting pre-change and post-change
     * notifications to observers. Does not render; call updateRecyclerView() to apply to the DOM.
     *
     * @param {TItem[]} items - The new list of items to set.
     */
    setItems(items) {
        this.changingProp("items", items);
        this.items = items;
        this.changeProp("items", items);
    }

    /**
     * Synchronizes adapter items from an external source by delegating to setItems().
     * Useful for keeping adapter state aligned with another data store.
     *
     * @param {TItem[]} items - The source list of items to synchronize.
     */
    syncFromSource(items) {
        this.setItems(items);
    }

    /**
     * Iterates through all items and ensures each has a viewer. For new items, calls viewHolder()
     * to create the viewer, then binds via onViewHolder() and marks the item as initialized.
     *
     * @param {HTMLElement|null} parent - The container element in which item viewers are rendered.
     */
    updateRecyclerView(parent) {
        for (let index = 0; index < this.itemCount(); index++) {
            let viewer = this.items[index].view;
            if (!this.items[index].isInit) {
                viewer = this.viewHolder(parent, this.items[index]);
            }
            this.onViewHolder(this.items[index], viewer, index);

            this.items[index].isInit = true;
        }
    }

    /**
     * Updates adapter data without performing any default actions.
     * Override in subclasses to implement custom data refresh logic.
     *
     * @param {TItem[]} items - The incoming data to apply to the adapter.
     */
    updateData(items) { }
}