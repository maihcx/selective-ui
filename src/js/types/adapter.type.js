
/**
 * @template {ModelContract<any, any>} TItem
 * @typedef {Object} AdapterContract
 *
 * @property {TItem[]} items - List of items managed by the adapter.
 * @property {string} adapterKey - Unique key identifier for the adapter.
 *
 * @property {(items: TItem[]) => void} setItems - Replace or update the list of items.
 * @property {(items: TItem[]) => void} syncFromSource - Synchronize items from an external source.
 * @property {() => number} itemCount - Get the number of items.
 *
 * @property {(parent: HTMLElement, item: TItem) => any} viewHolder
 *           - Create a viewer for the given item inside the parent container.
 *
 * @property {(item: TItem, viewer: any, position: number) => void} onViewHolder
 *           - Bind an item to its viewer at the specified position (render if not initialized, otherwise update).
 *
 * @property {(propName: string, callback: Function) => void} onPropChanging
 *           - Register a pre-change callback for a property.
 * @property {(propName: string, callback: Function) => void} onPropChanged
 *           - Register a post-change callback for a property.
 * @property {(propName: string, ...params: any[]) => void} changeProp
 *           - Trigger the post-change pipeline for a property.
 * @property {(propName: string, ...params: any[]) => void} changingProp
 *           - Trigger the pre-change pipeline for a property.
 *
 * @property {(parent: HTMLElement) => void} updateRecyclerView
 *           - Ensure all items have viewers and bind them into the recycler container.
 *
 * @property {(items: TItem[]) => void} updateData
 *           - Update adapter data (override in subclasses for custom behavior).
 */