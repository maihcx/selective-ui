import { ModelContract } from "src/ts/types/core/base/model.type";
import { ViewContract } from "src/ts/types/core/base/view.type";

/**
 * @template TTarget
 * @template TTags
 * @template TView
 * @implements {ModelContract<TTarget, TView>}
 */
export class Model<
    TTarget extends HTMLElement,
    TTags extends Record<string, HTMLElement>,
    TView extends ViewContract<TTags>,
    TOptions = unknown
> implements ModelContract<TTarget, TView> {
    targetElement: TTarget | null = null;

    options: TOptions;

    view: TView | null = null;

    position = -1;

    isInit = false;

    /**
     * Returns the current value from the underlying target element's "value" attribute.
     * For single-select, this is typically a string; for multi-select, may be an array depending on usage.
     */
    get value(): string | null | string[] {
        return this.targetElement?.getAttribute("value") ?? null;
    }

    /**
     * Constructs a Model instance with configuration options and optional bindings to a target element and view.
     * Stores references for later updates and rendering.
     *
     * @param {TOptions} options - Configuration options for the model.
     * @param {TTarget|null} [targetElement=null] - The underlying element (e.g., <option> or group node).
     * @param {TView|null} [view=null] - The associated view responsible for rendering the model.
     */
    constructor(options: TOptions, targetElement: TTarget | null = null, view: TView | null = null) {
        this.options = options;
        this.targetElement = targetElement;
        this.view = view;
    }

    /**
     * Updates the bound target element reference and invokes the change hook.
     *
     * @param {TTarget|null} targetElement - The new target element to bind to the model.
     */
    update(targetElement: TTarget | null): void {
        this.targetElement = targetElement;
        this.onTargetChanged();
    }

    /**
     * Hook invoked whenever the target element changes.
     * Override in subclasses to react to attribute/content updates (e.g., text, disabled state).
     */
    onTargetChanged(): void { }
}