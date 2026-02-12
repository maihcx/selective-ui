import { Libs } from "../../utils/libs";
import type { ModelContract } from "../../types/core/base/model.type";
import type { AdapterContract } from "../../types/core/base/adapter.type";
import { ViewContract } from "src/ts/types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base Adapter that bridges **Models** to **Views** and exposes a small, scheduler-backed
 * property change pipeline for coordination with higher-level infrastructure.
 *
 * ### Responsibility
 * - Own and manage an ordered collection of items (`items`).
 * - Provide a **view factory** ({@link viewHolder}) and a **bind step** ({@link onViewHolder})
 *   used by recyclers to mount/update item views.
 * - Provide a **two-phase property pipeline**:
 *   - `changingProp(...)` / {@link onPropChanging} (pre-change)
 *   - `changeProp(...)` / {@link onPropChanged} (post-change)
 *   backed by {@link Libs.callbackScheduler} and namespaced via {@link adapterKey}.
 * - Cooperate with a recycler (e.g., `RecyclerView` / `VirtualRecyclerView`) by exposing
 *   {@link updateRecyclerView} and an optional {@link recyclerView} reference for
 *   virtualization helpers (e.g., `ensureRendered`).
 *
 * ### Relationships (Model ↔ View ↔ Recycler)
 * - **Model**: Items are expected to be models with `destroy()` and lifecycle flags.
 * - **View**: Each item may carry a `view` reference (typically created once).
 * - **Recycler**: A RecyclerView calls `viewHolder()` to create a view and then calls
 *   `onViewHolder()` to mount/update the view; {@link updateRecyclerView} implements a
 *   simple non-virtualized binding loop for this purpose.
 *
 * ### Lifecycle (Strict FSM, idempotency)
 * - Constructor calls {@link Lifecycle.init} (`NEW → INITIALIZED`).
 * - Binding semantics are typically idempotent at the item level:
 *   - `item.isInit === false` → initial render (`viewer.mount()`)
 *   - `item.isInit === true`  → incremental update (`viewer.update()`)
 * - {@link setItems} emits change pipelines and then calls {@link Lifecycle.update}.
 *
 * ### Event / Hook flow
 * The adapter does not emit DOM events directly; instead it provides a generic property
 * pipeline for observers (e.g., "items", "select", "visibility"):
 * 1) `changingProp(propName, ...)` schedules/executes pre-change callbacks
 * 2) caller mutates adapter/model state
 * 3) `changeProp(propName, ...)` schedules/executes post-change callbacks
 *
 * Keys are namespaced per instance:
 * - `${propName}ing_${adapterKey}` (pre-change)
 * - `${propName}_${adapterKey}` (post-change)
 *
 * ### Notes / invariants
 * - Items are expected to embed a `view` reference and an `isInit` flag to avoid double
 *   listener wiring in concrete view implementations.
 * - {@link viewHolder} should be overridden by subclasses to return a concrete viewer.
 *
 * @template TItem - Model type the adapter operates on.
 * Must implement {@link ModelContract} and carry `{ view: TViewer | null; isInit: boolean }`.
 * @template TViewer - View type associated with each item (implements {@link ViewContract}).
 *
 * @implements {AdapterContract<TItem>}
 * @extends Lifecycle
 * @see {@link Libs.callbackScheduler}
 * @see {@link ViewContract}
 * @see {@link ModelContract}
 */
export class Adapter<
    TItem extends ModelContract<any, any> & { view: TViewer | null; isInit: boolean },
    TViewer extends ViewContract<any>
> extends Lifecycle implements AdapterContract<TItem> {
    /**
     * Current list of items managed by the adapter.
     *
     * Ordering is significant and is used as the index space passed to recyclers and bind calls.
     */
    items: TItem[] = [];

    /**
     * Unique key for this adapter instance.
     * Used to namespace scheduler pipelines to avoid cross-instance collisions.
     */
    adapterKey = Libs.randomString(12);

    /**
     * When true, consumers (typically view event handlers) may suppress certain actions.
     * This flag is intentionally generic and is coordinated by higher-level components.
     */
    isSkipEvent = false;

    /**
     * Optional reference to the owning RecyclerView (if any).
     *
     * This is commonly assigned by the recycler after {@link setAdapter} so the adapter and
     * item-layer logic can call back into virtualization helpers when needed.
     */
    recyclerView: any;

    /**
     * Creates an adapter with an optional initial item list and initializes its lifecycle.
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
     * Default behavior:
     * - If `item.isInit === true`, calls `viewer.update()` (incremental update)
     * - Otherwise calls `viewer.mount()` (first mount)
     *
     * This method is invoked by recyclers as part of their binding loop and may be overridden
     * by subclasses to implement custom diffing, animations, or richer binding behavior.
     *
     * @param {TItem} item - The model instance to bind.
     * @param {TViewer | null} viewer - The view responsible for rendering the model (may be null).
     * @param {number} position - Index of the item within the adapter item list.
     * @returns {void}
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
     * Registers a **pre-change** callback for a property pipeline.
     *
     * Execution semantics:
     * - Registered under `${propName}ing_${adapterKey}`.
     * - Scheduled via {@link Libs.callbackScheduler} with `{ debounce: 0 }`.
     * - Intended to run **before** a state mutation (e.g., before replacing `items`).
     *
     * @param {string} propName - Logical property name (e.g., `"items"`, `"select"`).
     * @param {(...args: unknown[]) => void} callback - Callback executed during the pre-change phase.
     * @returns {void}
     * @see {@link changingProp}
     */
    public onPropChanging(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}ing_${this.adapterKey}`, callback, { debounce: 0 });
    }

    /**
     * Registers a **post-change** callback for a property pipeline.
     *
     * Execution semantics:
     * - Registered under `${propName}_${adapterKey}`.
     * - Scheduled via {@link Libs.callbackScheduler} with `{ debounce: 0 }`.
     * - Intended to run **after** a state mutation (e.g., after replacing `items`).
     *
     * @param {string} propName - Logical property name (e.g., `"items"`, `"selected"`).
     * @param {(...args: unknown[]) => void} callback - Callback executed during the post-change phase.
     * @returns {void}
     * @see {@link changeProp}
     */
    public onPropChanged(propName: string, callback: (...args: unknown[]) => void): void {
        Libs.callbackScheduler.on(`${propName}_${this.adapterKey}`, callback, { debounce: 0 });
    }

    /**
     * Triggers the **post-change** pipeline for a given property.
     *
     * Intended usage:
     * - Call **after** mutating adapter/model state to notify observers.
     *
     * @param {string} propName - Logical property name to emit.
     * @param {...unknown} params - Parameters forwarded to subscribers.
     * @returns {Promise<void>} Resolves when scheduled callbacks complete.
     */
    public changeProp(propName: string, ...params: unknown[]): Promise<void> {
        return Libs.callbackScheduler.run(`${propName}_${this.adapterKey}`, ...params);
    }

    /**
     * Triggers the **pre-change** pipeline for a given property.
     *
     * Intended usage:
     * - Call **before** mutating adapter/model state to allow observers to prepare.
     *
     * @param {string} propName - Logical property name to emit.
     * @param {...unknown} params - Parameters forwarded to subscribers.
     * @returns {Promise<void>} Resolves when scheduled callbacks complete.
     */
    public changingProp(propName: string, ...params: unknown[]): Promise<void> {
        return Libs.callbackScheduler.run(`${propName}ing_${this.adapterKey}`, ...params);
    }

    /**
     * Factory method that creates a viewer instance for a given item in a parent container.
     *
     * Subclasses **must** override this to return a concrete viewer implementation.
     *
     * @param {HTMLElement} parent - Container element that will host the viewer.
     * @param {TItem} item - The model for which the viewer is created.
     * @returns {TViewer | null} The created viewer instance; `null` by default.
     */
    public viewHolder(parent: HTMLElement, item: TItem): TViewer | null {
        void parent;
        void item;
        return null;
    }

    /**
     * Returns the number of items currently managed by the adapter.
     *
     * @returns {number} Current item count.
     */
    public itemCount(): number {
        return this.items.length;
    }

    /**
     * Replaces the adapter's items with a new collection and emits change pipelines.
     *
     * Flow:
     * 1) `changingProp("items", items)` (pre-change)
     * 2) assign `this.items = items`
     * 3) `changeProp("items", items)` (post-change)
     * 4) {@link Lifecycle.update} to signal an update cycle
     *
     * Note:
     * - This method does not render to the DOM by itself. Rendering is performed by the recycler
     *   via {@link updateRecyclerView} or a virtualized mount loop.
     *
     * @param {TItem[]} items - The new list of items.
     * @returns {Promise<void>}
     */
    public async setItems(items: TItem[]): Promise<void> {
        await this.changingProp("items", items);
        this.items = items;
        await this.changeProp("items", items);
        this.update();
    }

    /**
     * Synchronizes adapter items from an external source by delegating to {@link setItems}.
     *
     * @param {TItem[]} items - The source list of items to synchronize.
     * @returns {Promise<void>}
     */
    public async syncFromSource(items: TItem[]): Promise<void> {
        await this.setItems(items);
    }

    /**
     * Ensures each item has a viewer and binds it via {@link onViewHolder}.
     *
     * This is a simple, non-virtualized binding loop that:
     * - iterates items in order,
     * - creates a viewer for first-time items (`item.isInit === false`),
     * - calls {@link onViewHolder} to mount/update,
     * - marks `item.isInit = true`.
     *
     * Typical usage:
     * - Called by a RecyclerView implementation to (re)bind all items into a container.
     *
     * @param {HTMLElement} parent - Container in which item viewers are rendered.
     * @returns {void}
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
     * Hook for applying incoming data without using the default change pipeline.
     *
     * This is intentionally a no-op in the base adapter. Subclasses can override to:
     * - update internal derived structures,
     * - refresh caches,
     * - perform silent updates that should not notify observers.
     *
     * @param {TItem[]} items - Incoming data to apply.
     * @returns {void}
     */
    public updateData(items: TItem[]): void {
        void items;
    }

    /**
     * Destroys the adapter and releases references.
     *
     * Behavior:
     * - Returns early if already in {@link LifecycleState.DESTROYED}.
     * - Clears {@link recyclerView} reference.
     * - Calls `destroy()` on each item if available.
     * - Clears the `items` array.
     *
     * @remarks
     * This implementation does not explicitly clear scheduler pipelines registered via
     * {@link onPropChanging}/{@link onPropChanged}. If the scheduler retains them by key,
     * the adapter's {@link adapterKey} namespacing helps avoid collisions, but teardown
     * responsibility may belong to the scheduler implementation.
     *
     * @returns {void}
     * @override
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