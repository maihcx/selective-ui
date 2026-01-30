import type { ModelContract } from "../../types/core/base/model.type";
import type { AdapterContract } from "../../types/core/base/adapter.type";
import type { RecyclerViewContract } from "../../types/core/base/recyclerview.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * RecyclerView renders models provided by an Adapter into a container element.
 *
 * Responsibilities:
 * - Maintain a root container (`viewElement`) where item views are rendered
 * - Attach an Adapter and wire item-change lifecycle:
 *   - `onPropChanging('items')` → clear container before items change
 *   - `onPropChanged('items')` → re-render after items change
 * - Expose rendering utilities: `render()`, `clear()`, `refresh()`
 * - Participate in the standard lifecycle (`init` → `mount` → `update` → `destroy`)
 *
 * @template TItem - The model type handled by the adapter.
 * @template TAdapter - The adapter type that manages items and updates the view.
 *
 * @implements {RecyclerViewContract<TAdapter>}
 */
export class RecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> extends Lifecycle implements RecyclerViewContract<TAdapter> {

    /** Root container that hosts rendered item views. */
    public viewElement: HTMLDivElement | null = null;

    /** The adapter that manages models and updates the RecyclerView on changes. */
    public adapter: TAdapter | null = null;

    /**
     * Constructs a RecyclerView with an optional container element that will host rendered item views.
     *
     * @param {HTMLDivElement|null} [viewElement=null] - The root element where the adapter will render items.
     */
    constructor(viewElement: HTMLDivElement | null = null) {
        super();
        this.viewElement = viewElement;
        this.init();
    }

    /**
     * Attaches an adapter to the RecyclerView and wires item-change lifecycle:
     * - `onPropChanging('items')`: clears the container before items change
     * - `onPropChanged('items')`: re-renders after items change
     *
     * Then performs:
     * - `adapter.mount()` to initialize the adapter
     * - `this.mount()` to mark the RecyclerView as mounted
     * - An initial `render()` to sync the UI
     *
     * @param {TAdapter} adapter - The adapter managing models and their views.
     */
    public setAdapter(adapter: TAdapter): void {
        this.adapter = adapter;

        adapter.onPropChanging("items", () => {
            this.clear();
        });

        adapter.onPropChanged("items", () => {
            this.render();
        });

        adapter.mount();

        this.mount();
        this.render();
    }

    /**
     * Removes all child nodes from the rendering container, if present.
     * Typically used right before re-rendering or when items are about to change.
     */
    public clear(): void {
        if (!this.viewElement) return;
        this.viewElement.replaceChildren();
    }

    /**
     * Renders the current adapter contents into the container.
     * No-ops if either the adapter or the container is not set.
     * Emits the `update` lifecycle after delegating rendering to the adapter.
     */
    public render(): void {
        if (!this.adapter || !this.viewElement) return;
        this.adapter.updateRecyclerView(this.viewElement);
        this.update();
    }

    /**
     * Forces a re-render of the current adapter state into the container.
     * Useful when visual updates are required without changing the data.
     *
     * @param {boolean} isUpdate - Indicates if this refresh originates from an update operation.
     *                             (Reserved for future use; no impact on logic.)
     */
    public refresh(isUpdate: boolean): void {
        this.render();
    }

    /**
     * Destroys the RecyclerView, detaching from its adapter and container.
     *
     * - Delegates teardown to the adapter
     * - Clears strong references (adapter, viewElement)
     * - Ends the lifecycle
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }
        
        this.viewElement = null;
        this.adapter = null;

        super.destroy();
    }
}