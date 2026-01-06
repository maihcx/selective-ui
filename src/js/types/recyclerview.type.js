/**
 * @template TAdapter extends AdapterContract
 * @typedef {Object} RecyclerViewContract
 *
 * @property {HTMLElement | null} viewElement - The container element for the recycler view
 * @property {TAdapter | null} adapter - The adapter instance controlling the items
 * @property {(viewElement: HTMLElement) => void} setView - Set or change the container element
 * @property {(adapter: TAdapter) => void} setAdapter - Attach an adapter and refresh the view
 * @property {() => void} render - Render all item views inside the container
 * @property {() => void} clear - Clear all item views from the container
 * @property {() => void} refresh - Refresh item views from the container
 */