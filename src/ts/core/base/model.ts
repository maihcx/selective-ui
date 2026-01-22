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
    public targetElement: TTarget | null = null;

    public options: TOptions;

    public view: TView | null = null;

    public position = -1;

    public isInit = false;

    public isRemoved = false;
    /**
     * Returns the current value from the underlying target element's "value" attribute.
     * For single-select, this is typically a string; for multi-select, may be an array depending on usage.
     */
    public get value(): string | null | string[] {
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
    public constructor(options: TOptions, targetElement: TTarget | null = null, view: TView | null = null) {
        this.options = options;
        this.targetElement = targetElement;
        this.view = view;
    }

    /**
     * Updates the bound target element reference and invokes the change hook.
     *
     * @param {TTarget|null} targetElement - The new target element to bind to the model.
     */
    public update(targetElement: TTarget | null): void {
        this.targetElement = targetElement;
        this.onTargetChanged();
    }

    /**
     * Cleans up references and invokes the removal hook when the model is no longer needed.
     */
    public remove() {
        this.targetElement = null;
        this.view?.getView()?.remove?.();
        this.view = null;
        this.isRemoved = true;
        this.onRemove();
    }

    /**
     * Hook invoked whenever the target element changes.
     * Override in subclasses to react to attribute/content updates (e.g., text, disabled state).
     */
    public onTargetChanged(): void { }

    /**
     * Hook invoked whenever the target element is removed.
     * Override in subclasses to react to removal of the element.
     */
    public onRemove(): void {}
}