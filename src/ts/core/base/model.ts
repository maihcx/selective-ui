import { ModelContract } from "src/ts/types/core/base/model.type";
import { ViewContract } from "src/ts/types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base model primitive that binds a domain object to a target DOM element and an optional View.
 *
 * This class is the **Model** part of the library's Model/View separation:
 * - The **Model** owns references to the authoritative DOM source (`targetElement`) and configuration (`options`).
 * - The **View** (if attached) owns rendering and DOM event wiring for the model.
 * - Higher-level infrastructure (e.g., Adapter / RecyclerView) orchestrates when models are created,
 *   bound to views, and updated.
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor calls {@link Lifecycle.init} immediately, transitioning `NEW → INITIALIZED`.
 * - This base model does not call `mount()` by itself; mounting is typically handled by the View layer.
 * - {@link updateTarget} triggers {@link Lifecycle.update}, which emits `onUpdate` lifecycle hooks in
 *   `MOUNTED/UPDATED` states (and is guarded otherwise).
 * - {@link destroy} transitions to `DESTROYED`, clears references, and destroys the associated view.
 *
 * ### Idempotency / No-ops
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 * - {@link updateTarget} is safe to call multiple times; consumers should treat repeated assignments
 *   as a no-op when the target does not change (this base class does not compare equality).
 *
 * ### Ownership & side effects
 * - This model **owns** its `view` reference and will call `view.destroy()` during {@link destroy}.
 * - The model itself does not mutate the DOM, except reading from `targetElement` (e.g., {@link value}).
 *   Any DOM side effects are expected to live in the View implementation.
 *
 * @template TTarget - The DOM element type this model is bound to (e.g., HTMLOptionElement).
 * @template TTags - Named element map used by the view (view-specific DOM handles).
 * @template TView - View implementation associated with this model.
 * @template TOptions - Configuration/options type carried by the model.
 *
 * @implements {ModelContract<TTarget, TView>}
 * @extends Lifecycle
 * @see {@link ViewContract}
 * @see {@link LifecycleState}
 */
export class Model<
    TTarget extends HTMLElement,
    TTags extends Record<string, HTMLElement>,
    TView extends ViewContract<TTags>,
    TOptions = unknown
> extends Lifecycle implements ModelContract<TTarget, TView> {

    /**
     * The currently bound target DOM element.
     *
     * This element typically represents the source-of-truth node in the host DOM (e.g., a native `<option>`).
     * May be replaced via {@link updateTarget} during reconciliation.
     */
    public targetElement: TTarget | null = null;

    /**
     * Configuration options supplied at construction time.
     * Stored as-is and intended to be consumed by subclasses and/or the view layer.
     */
    public options: TOptions;

    /**
     * View instance responsible for rendering this model.
     *
     * Ownership: this model will destroy the view on {@link destroy}.
     * The view may be attached/assigned by external orchestrators (Adapter/RecyclerView) after construction.
     */
    public view: TView | null = null;

    /**
     * Position index used by list infrastructure for ordering/tracking.
     * Semantics are library-specific (e.g., top-level index or adapter position).
     */
    public position = -1;

    /**
     * Indicates whether this model has completed its initial binding step.
     * Typically set by the adapter/view binding layer to prevent duplicate listener wiring.
     */
    public isInit = false;

    /**
     * Indicates whether this model has been removed/destroyed from the active dataset.
     * Set to `true` during {@link destroy}.
     */
    public isRemoved = false;

    /**
     * Returns the current "value" associated with the bound target element.
     *
     * Implementation note:
     * - Reads from the target element's `"value"` attribute via `getAttribute("value")`.
     * - Returns `null` when no target is bound or the attribute is not present.
     *
     * @returns {string | null | string[]} The value representation of the target element.
     */
    public get value(): string | null | string[] {
        return this.targetElement?.getAttribute("value") ?? null;
    }

    /**
     * Creates a new model instance and initializes lifecycle state.
     *
     * - Captures {@link options}.
     * - Optionally binds an initial {@link targetElement} and {@link view}.
     * - Calls {@link Lifecycle.init} immediately (`NEW → INITIALIZED`).
     *
     * @param {TOptions} options - Configuration options for the model.
     * @param {TTarget | null} [targetElement=null] - Optional DOM element to bind.
     * @param {TView | null} [view=null] - Optional view responsible for rendering this model.
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
     * Rebinds this model to a new target DOM element and marks the model as updated.
     *
     * Typical usage:
     * - Reconciliation when the underlying DOM node is replaced (e.g., `<option>` node recreated).
     * - Keeping model identity stable while swapping its backing DOM node.
     *
     * Side effects:
     * - Assigns {@link targetElement}.
     * - Calls {@link Lifecycle.update} (guarded by lifecycle state).
     *
     * @param {TTarget | null} targetElement - The new DOM element to associate with this model.
     * @returns {void}
     */
    public updateTarget(targetElement: TTarget | null): void {
        this.targetElement = targetElement;
        this.update();
    }

    /**
     * Destroys this model and releases owned resources.
     *
     * Behavior:
     * - Idempotent once lifecycle is {@link LifecycleState.DESTROYED}.
     * - Clears {@link targetElement}.
     * - Destroys the associated {@link view} (if present) and clears the reference.
     * - Marks {@link isRemoved} as `true`.
     * - Calls {@link Lifecycle.destroy} to transition to `DESTROYED` and clear hooks.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
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