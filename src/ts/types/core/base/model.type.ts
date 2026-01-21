/**
 * Generic model contract for binding a target element and an optional view.
 *
 * @template TTarget - The type of the target element (e.g., DOM element, data object).
 * @template TView - The type of the view associated with the target (e.g., UI component).
 */
export interface ModelContract<TTarget, TView> {
    /**
     * The target element that this model is bound to.
     * Can be null if not yet initialized.
     */
    targetElement: TTarget | null;

    /**
     * The view associated with the target element.
     * Can be null if the view is not yet created.
     */
    view: TView | null;

    /**
     * The value represented by this model.
     * Can be any type depending on the implementation.
     */
    value: unknown;

    /**
     * The position or index of this model in a collection.
     */
    position: number;

    /**
     * Indicates whether the model has been initialized.
     */
    isInit: boolean;

    /**
     * Indicates whether the model has been vissibly.
     */
    visible?: boolean;
}