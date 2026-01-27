import { Lifecycle } from "src/ts/core/base/lifecycle";
import type { ModelContract } from "./model.type";

/**
 * Adapter contract for binding model items to the DOM using a "view holder" pattern.
 *
 * @template TItem - A model type that implements ModelContract.
 */
export interface AdapterContract<TItem extends ModelContract<any, any>> extends Lifecycle {
    /**
     * List of items managed by the adapter.
     * These items are rendered or updated in the associated container.
     */
    items: TItem[];

    /**
     * Unique identifier for the adapter instance.
     * Useful for distinguishing multiple adapters in the same context.
     */
    adapterKey: string;

    /**
     * Reference to the associated RecyclerView instance.
     *
     * Acts as the rendering host and lifecycle coordinator for this adapter.
     * The adapter uses this reference to:
     * - Access recycler-level configuration and state
     * - Request layout, rebind, or invalidation operations
     * - Coordinate virtual scrolling, recycling, or view reuse strategies
     *
     * The concrete type is intentionally left open to avoid tight coupling
     * between the adapter contract and a specific RecyclerView implementation.
     */
    recyclerView: any;

    /**
     * Replace the current list of items with a new list.
     * Implementations should also trigger a re-render when appropriate.
     *
     * @param items - The new list of items to set.
     */
    setItems(items: TItem[]): void;

    /**
     * Synchronize items with an external data source (e.g., server, cache).
     * Can include normalization, merging, or diffing logic.
     *
     * @param items - Items retrieved from the external source.
     */
    syncFromSource(items: TItem[]): void;

    /**
     * Get the total number of items currently managed by the adapter.
     *
     * @returns The count of items.
     */
    itemCount(): number;

    /**
     * Create a view holder (viewer) for a specific item and insert it into the parent container.
     * The viewer type is adapter-specific (e.g., a DOM node, a framework component instance).
     *
     * @param parent - The container element where the viewer should be created/attached.
     * @param item - The item for which the viewer is being created.
     * @returns An adapter-specific viewer instance.
     */
    viewHolder(parent: HTMLElement, item: TItem): unknown;

    /**
     * Bind an item to its viewer at a given position.
     * Should render the viewer if not initialized, or update it if it already exists.
     *
     * @param item - The item to bind.
     * @param viewer - The previously created viewer instance.
     * @param position - The index of the item in the list.
     */
    onViewHolder(item: TItem, viewer: unknown, position: number): void;

    /**
     * Register a pre-change callback for a given property.
     * Called before the property value changes (e.g., for validation or side-effects).
     *
     * @param propName - The name of the property being changed.
     * @param callback - The handler invoked with change context/args.
     */
    onPropChanging(propName: string, callback: (...args: unknown[]) => void): void;

    /**
     * Register a post-change callback for a given property.
     * Called after the property value has changed (e.g., for re-render or notifications).
     *
     * @param propName - The name of the property that changed.
     * @param callback - The handler invoked with change context/args.
     */
    onPropChanged(propName: string, callback: (...args: unknown[]) => void): void;

    /**
     * Trigger the post-change pipeline for a property.
     * Typically used internally after a property update completes.
     *
     * @param propName - The property name to trigger.
     * @param params - Optional parameters passed to callbacks.
     */
    changeProp(propName: string, ...params: unknown[]): void;

    /**
     * Trigger the pre-change pipeline for a property.
     * Typically used internally before a property update occurs.
     *
     * @param propName - The property name to trigger.
     * @param params - Optional parameters passed to callbacks.
     */
    changingProp(propName: string, ...params: unknown[]): void;

    /**
     * Ensure all items have corresponding viewers and (re)bind them into the recycler container.
     * Use this to reconcile the DOM with the current adapter state.
     *
     * @param parent - The container element that holds item viewers.
     */
    updateRecyclerView(parent: HTMLElement): void;

    /**
     * Update adapter data. Override in subclasses to customize transformation,
     * sorting, filtering, or diffing behavior before rendering.
     *
     * @param items - The incoming items to process/update.
     */
    updateData(items: TItem[]): void;
}