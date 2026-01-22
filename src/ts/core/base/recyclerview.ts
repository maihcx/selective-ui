import type { ModelContract } from "../../types/core/base/model.type";
import type { AdapterContract } from "../../types/core/base/adapter.type";
import type { RecyclerViewContract } from "../../types/core/base/recyclerview.type";

/**
 * @template TItem
 * @template TAdapter
 * @implements {RecyclerViewContract<TAdapter>}
 */
export class RecyclerView<
    TItem extends ModelContract<any, any>,
    TAdapter extends AdapterContract<TItem>
> implements RecyclerViewContract<TAdapter> {
    public viewElement: HTMLDivElement | null = null;

    public adapter: TAdapter | null = null;

    /**
     * Constructs a RecyclerView with an optional container element that will host rendered item views.
     *
     * @param {HTMLDivElement|null} [viewElement=null] - The root element where the adapter will render items.
     */
    constructor(viewElement: HTMLDivElement | null = null) {
        this.viewElement = viewElement;
    }

    /**
     * Sets or updates the container element used to render the adapter's item views.
     *
     * @param {HTMLDivElement} viewElement - The root element for rendering.
     */
    public setView(viewElement: HTMLDivElement): void {
        this.viewElement = viewElement;
    }

    /**
     * Attaches an adapter to the RecyclerView and wires item-change lifecycle:
     * - onPropChanging("items"): clears the container before items change,
     * - onPropChanged("items"): re-renders after items change,
     * then performs an initial render.
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

        this.render();
    }

    /**
     * Removes all child nodes from the rendering container, if present.
     * Used prior to re-rendering or when items are changing.
     */
    public clear(): void {
        if (!this.viewElement) return;
        this.viewElement.replaceChildren();
    }

    /**
     * Renders the current adapter contents into the container.
     * No-ops if either the adapter or the container is not set.
     */
    public render(): void {
        if (!this.adapter || !this.viewElement) return;
        this.adapter.updateRecyclerView(this.viewElement);
    }

    /**
     * Forces a re-render of the current adapter state into the container.
     * Useful when visual updates are required without changing the data.
     * 
     * @param isUpdate - Indicates if this refresh is due to an update operation.
     */
    public refresh(isUpdate: boolean): void {
        this.render();
    }
}