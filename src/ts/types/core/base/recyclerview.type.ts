import { AdapterContract } from "./adapter.type";

/**
 * RecyclerView contract describing the public surface of a RecyclerView.
 *
 * @template TAdapter - A concrete adapter type that implements AdapterContract.
 */
export interface RecyclerViewContract<TAdapter extends AdapterContract<any>> {
    /**
     * The container element that hosts all item views.
     * Can be null until `setView` is called.
     */
    viewElement: HTMLElement | null;

    /**
     * The adapter instance responsible for providing and binding item views.
     * Can be null until `setAdapter` is called.
     */
    adapter: TAdapter | null;

    /**
     * Set or replace the container element used for rendering.
     *
     * @param viewElement - The root container element for the recycler view.
     */
    setView(viewElement: HTMLElement): void;

    /**
     * Attach an adapter and refresh the view accordingly.
     * Implementations typically call `render()` or reconcile the DOM.
     *
     * @param adapter - The adapter controlling items and view holders.
     */
    setAdapter(adapter: TAdapter): void;

    /**
     * Render all item views inside the container.
     * Should create view holders and bind items via the adapter.
     */
    render(): void;

    /**
     * Remove all rendered item views from the container.
     * Useful before a full re-render or when disposing.
     */
    clear(): void;

    /**
     * Refresh the rendered views to reflect current adapter data/state.
     * May perform diffing, partial updates, or full re-binding.
     * 
     * @param isUpdate - Indicates if this refresh is due to an update operation.
     */
    refresh(isUpdate: boolean): void;
}