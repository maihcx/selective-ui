import { Libs } from "../../utils/libs";
import type { ModelContract } from "../../types/core/base/model.type";
import type { AdapterContract } from "../../types/core/base/adapter.type";
import { ViewContract } from "src/ts/types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base adapter that manages a list of model items and their corresponding views.
 *
 * Responsibilities:
 * - Hold and manage an item list (`items`)
 * - Create/bind item views (via `viewHolder()` and `onViewHolder()`)
 * - Expose a property-change event pipeline (`onPropChanging` / `onPropChanged`)
 * - Cooperate with a RecyclerView through `updateRecyclerView(parent)`
 * - Participate in the standard lifecycle (`init` → `mount` → `update` → `destroy`)
 *
 * Notes:
 * - Items are expected to embed a `view` reference and an `isInit` flag to track first render.
 * - Subclasses should override `viewHolder()` to return a concrete `TViewer`.
 *
 * @template TItem - Model type the adapter operates on. Must contain `{ view: TViewer | null; isInit: boolean }`.
 * @template TViewer - View type associated with each item (must implement `ViewContract`).
 *
 * @implements {AdapterContract<TItem>}
 */
export class Adapter<
    TItem extends ModelContract<any, any> & { view: TViewer | null; isInit: boolean },
    TViewer extends ViewContract<any>
> extends Lifecycle implements AdapterContract<TItem> {

    /** Current list of items managed by the adapter. */
    items: TItem[] = [];

    /** Unique key for this adapter instance (used to namespace callback pipelines). */
    adapterKey = Libs.randomString(12);

    /** When true, suppresses certain event emissions (reserved for external coordination). */
    isSkipEvent = false;
    
    /** Optional reference to the owning RecyclerView (if any). */
    recyclerView: any;

    /**
     * Initializes the adapter with an optional array of items and starts its lifecycle.
     * Subclasses may override the lifecycle hooks (e.g., `onInit`) for custom setup.
     *
     * @param {TItem[]} [items=[]] - Initial items to be managed by the adapter.
     */
    constructor(items: TItem[] = []) {
        super();
        this.items = items;
        this.init();
    }

    /**
     * Binds an item model to its viewer at a given position.
     *
     * Behavior:
     * - If the item has been initialized (`isInit = true`), calls `viewer.update()`
     * - Otherwise, calls `viewer.mount()` to perform the initial render
     *
     * Subclasses may override to customize bind logic (animations, diffing, etc.).
     *
     * @param {TItem} item - The model instance to bind to the view.
     * @param {TViewer|null} viewer - The view responsible for rendering the model.
     * @param {number} position - Index of the item within the adapter.
     */
    public onViewHolder(item: TItem, viewer: TViewer | null, position: number): void {
        void position;

        const v = viewer;
        if (item.isInit) {
            v?.update?.();
        } else {
            v?.mount?.();
        }
    }

    /**
     * Registers a **pre-change** callback for a property pipeline (e.g., `"items"`).
     *
     * Execution semantics:
     * - Scheduled with minimal debounce (0ms) by the global callback scheduler
     * - Runs **before** the property value is updated
     * - Can be used to clear UI or allocate resources
     *
     * @param {string} propName - Property name to observe (e.g., `"items"`).
     * @param {Function} callback - Function to execute before the property changes.
     */
    public onPropChanging(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}ing_${this.adapterKey}`, callback, { debounce: 0 });
    }

    /**
     * Registers a **post-change** callback for a property pipeline (e.g., `"items"`).
     *
     * Execution semantics:
     * - Scheduled with minimal debounce (0ms) by the global callback scheduler
     * - Runs **after** the property value is updated
     * - Can be used to re-render or refresh UI
     *
     * @param {string} propName - Property name to observe (e.g., `"items"`).
     * @param {Function} callback - Function to execute after the property changes.
     */
    public onPropChanged(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}_${this.adapterKey}`, callback, { debounce: 0 });
    }

    /**
     * Triggers the **post-change** pipeline for a given property.
     * Use this **after** mutating the adapter state.
     *
     * @param {string} propName - Property name to emit (e.g., `"items"`).
     * @param {...any} params - Parameters forwarded to the callbacks.
     * @returns {Promise<void>} - Resolves when all callbacks complete.
     */
    public changeProp(propName: string, ...params: unknown[]): Promise<void> {
        return Libs.callbackScheduler.run(`${propName}_${this.adapterKey}`, ...params) as Promise<void>;
    }

    /**
     * Triggers the **pre-change** pipeline for a given property.
     * Use this **before** mutating the adapter state.
     *
     * @param {string} propName - Property name to emit (e.g., `"items"`).
     * @param {...any} params - Parameters forwarded to the callbacks.
     * @returns {Promise<void>} - Resolves when all callbacks complete.
     */
    public changingProp(propName: string, ...params: unknown[]): Promise<void> {
        return Libs.callbackScheduler.run(`${propName}ing_${this.adapterKey}`, ...params) as Promise<void>;
    }

    /**
     * Factory method that creates a viewer instance for the given item,
     * attached to the specified parent container.
     *
     * Subclasses **must** override this to return a concrete viewer.
     *
     * @param {HTMLElement} parent - Container element that will host the viewer.
     * @param {TItem} item - The model for which the viewer is created.
     * @returns {TViewer|null} - The created viewer instance; `null` by default.
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
     * Replaces the adapter's items with a new collection.
     *
     * Event flow:
     * 1) Emit `changingProp('items')` (pre-change)
     * 2) Assign the new items array
     * 3) Emit `changeProp('items')` (post-change)
     * 4) Emit lifecycle `update()`
     *
     * Note: This does **not** directly render to the DOM.
     * Call `updateRecyclerView()` (typically via RecyclerView) to apply.
     *
     * @param {TItem[]} items - The new list of items to set.
     */
    public async setItems(items: TItem[]): Promise<void> {
        await this.changingProp("items", items);
        this.items = items;
        await this.changeProp("items", items);
        this.update();
    }

    /**
     * Synchronizes adapter items from an external source by delegating to `setItems()`.
     *
     * @param {TItem[]} items - The source list of items to synchronize.
     */
    public async syncFromSource(items: TItem[]): Promise<void> {
        await this.setItems(items);
    }

    /**
     * Ensures each item has a viewer, then binds it through `onViewHolder()`.
     *
     * Flow:
     * - Iterate items in order
     * - If an item is not initialized:
     *   - Create a viewer via `viewHolder(parent, item)` and assign to `item.view`
     * - Call `onViewHolder(item, viewer, index)` to mount/update accordingly
     * - Mark item as initialized (`isInit = true`)
     *
     * @param {HTMLElement} parent - The container in which item viewers are rendered.
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
     * Hook for updating adapter data without performing default actions.
     * Subclasses can override to implement custom refresh logic.
     *
     * @param {TItem[]} items - Incoming data to apply to the adapter.
     */
    public updateData(items: TItem[]): void {
        void items;
    }

    /**
     * Destroys the adapter and releases references.
     *
     * - Clears the RecyclerView reference (if any)
     * - Empties the item array
     * - (Subclasses may override to destroy item views if needed)
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.recyclerView = null;
        this.items.forEach(item => {
            item?.destroy?.();
        });
        this.items = [];
    }
}