import { Libs } from "../../utils/libs";
import type { ModelContract } from "../../types/core/base/model.type";
import type { AdapterContract } from "../../types/core/base/adapter.type";
import { ViewContract } from "src/ts/types/core/base/view.type";

/**
 * @template TItem
 * @template TViewer
 * @implements {AdapterContract<TItem>}
 */
export class Adapter<
    TItem extends ModelContract<any, any> & { view: TViewer | null; isInit: boolean },
    TViewer extends ViewContract<any>
> implements AdapterContract<TItem> {
    items: TItem[] = [];

    adapterKey = Libs.randomString(12);

    isSkipEvent = false;
    
    recyclerView: any;

    /**
     * Initializes the adapter with an optional array of items and invokes onInit()
     * to perform any subclass-specific setup. Accepts a generic list of models.
     *
     * @param {TItem[]} [items=[]] - Initial items to be managed by the adapter.
     */
    constructor(items: TItem[] = []) {
        this.items = items;
        this.onInit();
    }

    /**
     * Lifecycle hook called once after construction. Override in subclasses to
     * perform setup tasks (e.g., event wiring, cache building).
     */
    public onInit(): void { }

    /**
     * Binds an item model to its viewer at a given position. If the item has not
     * been initialized yet, renders the viewer; otherwise triggers an update.
     *
     * @param {TItem} item - The model instance to bind to the view.
     * @param {TViewer|null} viewer - The view instance responsible for rendering the model.
     * @param {number} position - The index of the item within the adapter.
     */
    public onViewHolder(item: TItem, viewer: TViewer | null, position: number): void {
        void position;

        const v = viewer;
        if (item.isInit) {
            v?.update?.();
        } else {
            v?.render?.();
        }
    }

    /**
     * Registers a pre-change (debounced) callback for a property change pipeline.
     * The callback is scheduled with a minimal delay to batch rapid updates.
     *
     * @param {string} propName - The property name to observe (e.g., "items").
     * @param {Function} callback - Function to execute before the property changes.
     */
    public onPropChanging(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}ing_${this.adapterKey}`, callback, { debounce: 1 });
    }

    /**
     * Registers a post-change callback for a property change pipeline.
     * The callback is executed after the property is updated.
     *
     * @param {string} propName - The property name to observe (e.g., "items").
     * @param {Function} callback - Function to execute after the property changes.
     */
    public onPropChanged(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}_${this.adapterKey}`, callback);
    }

    /**
     * Triggers the post-change pipeline for a given property, passing optional parameters
     * to registered callbacks. Use this after mutating adapter state.
     *
     * @param {string} propName - The property name to emit (e.g., "items").
     * @param {...any} params - Parameters forwarded to the callbacks.
     */
    public changeProp(propName: string, ...params: unknown[]): void {
        Libs.callbackScheduler.run(`${propName}_${this.adapterKey}`, ...params);
    }

    /**
     * Triggers the pre-change pipeline for a given property, passing optional parameters
     * to registered callbacks. Use this before mutating adapter state.
     *
     * @param {string} propName - The property name to emit (e.g., "items").
     * @param {...any} params - Parameters forwarded to the callbacks.
     */
    public changingProp(propName: string, ...params: unknown[]): void {
        Libs.callbackScheduler.run(`${propName}ing_${this.adapterKey}`, ...params);
    }

    /**
     * Creates and returns a viewer instance for the given item within the specified parent container.
     * Override in subclasses to return a concrete view implementation tailored to TItem.
     *
     * @param {HTMLElement} parent - The container element that will host the viewer.
     * @param {TItem} item - The model instance for which the viewer is created.
     * @returns {TViewer|null} - The created viewer instance; null by default.
     */
    public viewHolder(parent: HTMLElement, item: TItem): TViewer | null {
        void parent;
        void item;
        return null;
    }

    /**
     * Returns the total number of items currently managed by the adapter.
     *
     * @returns {number} - The item count.
     */
    public itemCount(): number {
        return this.items.length;
    }

    /**
     * Replaces the adapter's items with a new collection, emitting pre-change and post-change
     * notifications to observers. Does not render; call updateRecyclerView() to apply to the DOM.
     *
     * @param {TItem[]} items - The new list of items to set.
     */
    public setItems(items: TItem[]): void {
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
    public syncFromSource(items: TItem[]): void {
        this.setItems(items);
    }

    /**
     * Iterates through all items and ensures each has a viewer. For new items, calls viewHolder()
     * to create the viewer, then binds via onViewHolder() and marks the item as initialized.
     *
     * @param {HTMLElement} parent - The container element in which item viewers are rendered.
     */
    public updateRecyclerView(parent: HTMLElement): void {
        for (let index = 0; index < this.itemCount(); index++) {
            const item = this.items[index];

            let viewer = item.view;
            if (!item.isInit) {
                viewer = this.viewHolder(parent, item);
                item.view = viewer;
            }

            this.onViewHolder(item, viewer, index);
            item.isInit = true;
        }
    }

    /**
     * Updates adapter data without performing any default actions.
     * Override in subclasses to implement custom data refresh logic.
     *
     * @param {TItem[]} items - The incoming data to apply to the adapter.
     */
    public updateData(items: TItem[]): void {
        void items;
    }
}