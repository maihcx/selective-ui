
import { ModelContract } from "src/ts/types/core/base/model.type";
import { ViewContract } from "src/ts/types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base Model class that connects a target DOM element with its corresponding View.
 * Handles lifecycle, state, and synchronization between model, view, and DOM.
 *
 * @template TTarget - The HTML element this model is bound to
 * @template TTags - A map of named HTML elements used by the view
 * @template TView - The view implementation associated with this model
 * @template TOptions - Configuration options for the model
 *
 * @implements {ModelContract<TTarget, TView>}
 */
export class Model<
    TTarget extends HTMLElement,
    TTags extends Record<string, HTMLElement>,
    TView extends ViewContract<TTags>,
    TOptions = unknown
> extends Lifecycle implements ModelContract<TTarget, TView> {

    /** The underlying DOM element associated with this model */
    public targetElement: TTarget | null = null;

    /** Configuration options provided at construction time */
    public options: TOptions;

    /** View instance responsible for rendering this model */
    public view: TView | null = null;

    /** Position index of the model (used for ordering or tracking) */
    public position = -1;

    /** Indicates whether the model has been initialized */
    public isInit = false;

    /** Indicates whether the model has been destroyed/removed */
    public isRemoved = false;

    /**
     * Returns the current value of the bound target element.
     *
     * - For single-value elements, this is usually a string
     * - For multi-value elements, this may be an array depending on usage
     */
    public get value(): string | null | string[] {
        return this.targetElement?.getAttribute("value") ?? null;
    }

    /**
     * Creates a new Model instance.
     *
     * Initializes the model with configuration options and optionally binds
     * it to a target DOM element and a view.
     *
     * @param options - Configuration options for the model
     * @param targetElement - Optional DOM element to bind to this model
     * @param view - Optional view responsible for rendering the model
     */
    public constructor(
        options: TOptions,
        targetElement: TTarget | null = null,
        view: TView | null = null
    ) {
        super();
        this.options = options;
        this.targetElement = targetElement;
        this.view = view;

        this.init();
    }

    /**
     * Updates the bound target element and triggers the update lifecycle.
     *
     * @param targetElement - The new DOM element to associate with this model
     */
    public updateTarget(targetElement: TTarget | null): void {
        this.targetElement = targetElement;
        this.update();
    }

    /**
     * Hook executed when the model is updated.
     * Intended to be overridden by subclasses.
     */
    public onUpdate() { }

    /**
     * Destroys the model and releases all references.
     *
     * - Unbinds the target element
     * - Removes the associated view from the DOM
     * - Marks the model as removed
     * - Triggers lifecycle cleanup
     */
    public override destroy() {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.targetElement = null;
        this.view?.destroy();
        this.view = null;
        this.isRemoved = true;

        super.destroy();
    }
}