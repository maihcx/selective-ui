
/**
 * Configuration options for the virtualized recycler view.
 * Controls which element is used for scrolling, sizing heuristics, and how many
 * extra items are rendered outside the viewport to reduce popping.
 */
export type VirtualOptions = {
  /**
   * The scroll container element used to measure scroll position and viewport.
   * If omitted, the implementation may default to the nearest scrollable parent
   * or the window (depending on your mount strategy).
   */
  scrollEl?: HTMLElement;

  /**
   * Estimated height (in pixels) for a single item.
   * Used as a heuristic before real measurements are available (especially when
   * `dynamicHeights` is enabled) to compute the total scrollable size.
   */
  estimateItemHeight?: number;

  /**
   * Number of extra items to render above and below the visible range.
   * Higher values reduce blanking during fast scroll at the cost of more DOM work.
   */
  overscan?: number;

  /**
   * Enables measuring and caching actual item heights.
   * When `true`, the recycler view supports variable-height items instead of
   * assuming a fixed height for all items.
   */
  dynamicHeights?: boolean;

  /**
   * Enables adaptive estimation based on observed item measurements.
   * When `true`, `estimateItemHeight` may be refined over time to improve
   * scrollbar accuracy and reduce layout jumps.
   */
  adaptiveEstimate?: boolean;
};

/**
 * Tag map for the virtual recycler view DOM structure.
 * These nodes are typically produced by `mountNode` and used to
 * manipulate padding and host the rendered item elements.
 */
export type VirtualRecyclerViewTags = {
  /**
   * Top spacer element that simulates the height of items scrolled past.
   * Its height is adjusted to keep the visible items aligned with the scroll offset.
   */
  PadTop: HTMLDivElement;

  /**
   * Container that hosts the currently rendered (visible + overscan) item elements.
   * Items are inserted/updated within this element during virtualization.
   */
  ItemsHost: HTMLDivElement;

  /**
   * Bottom spacer element that simulates the height of items not yet rendered.
   * Its height is adjusted to represent remaining content below the visible range.
   */
  PadBottom: HTMLDivElement;
};