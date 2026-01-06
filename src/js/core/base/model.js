/**
 * @template TTarget
 * @template {Record<string, Element>} TTags
 * @template {ViewContract<TTags>} TView
 * @implements {ModelContract<TTarget, TView>}
 */
export class Model {
    /** @type {TTarget | null} */
    targetElement = null;

    options = null;

    /** @type {TView | null} */
    view = null;

    position = -1;

    isInit = false;

    /**
     * Returns the current value from the underlying target element's "value" attribute.
     * For single-select, this is typically a string; for multi-select, may be an array depending on usage.
     *
     * @type {String|String[]}
     */
    get value() {
        return /** @type {HTMLElement} */ (this.targetElement).getAttribute("value");
    }

    /**
     * Constructs a Model instance with configuration options and optional bindings to a target element and view.
     * Stores references for later updates and rendering.
     *
     * @param {object} options - Configuration options for the model.
     * @param {TTarget|null} [targetElement=null] - The underlying element (e.g., <option> or group node).
     * @param {TView|null} [view=null] - The associated view responsible for rendering the model.
     */
    constructor(options, targetElement = null, view = null) {
        this.options = options;
        this.targetElement = targetElement;
        this.view = view;
    }

    /**
     * Updates the bound target element reference and invokes the change hook.
     *
     * @param {TTarget|null} targetElement - The new target element to bind to the model.
     */
    update(targetElement) {
        this.targetElement = targetElement;
        this.onTargetChanged();
    }

    /**
     * Hook invoked whenever the target element changes.
     * Override in subclasses to react to attribute/content updates (e.g., text, disabled state).
     */
    onTargetChanged() { }
}
