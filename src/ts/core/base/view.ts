import { MountViewResult } from "src/ts/types/utils/libs.type";
import type { ViewContract } from "../../types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base View primitive that anchors a mounted DOM structure into a parent container.
 *
 * This class is the **View** part of the library's Model/View separation:
 * - A View is responsible for owning/manipulating DOM nodes and exposing typed handles (`tags`)
 *   for efficient updates.
 * - A View is typically created/managed by an Adapter/RecyclerView layer and assigned back to a Model.
 *
 * ### Responsibility
 * - Hold a reference to the host container (`parent`) where the view's root element is attached.
 * - Store the mounted structure (`view`) produced by a mount utility (root element + typed tag map).
 * - Provide a safe root accessor ({@link getView}) for downstream code (e.g., scrolling, a11y, styling).
 *
 * ### Lifecycle (Strict FSM)
 * - Constructor calls {@link Lifecycle.init} immediately (`NEW → INITIALIZED`).
 * - Mounting is performed by subclasses / infrastructure:
 *   - populate {@link view} (usually during a subclass mount hook),
 *   - append `view.view` to {@link parent},
 *   - then transition to `MOUNTED` via {@link Lifecycle.mount} (typically done by the base/framework).
 * - {@link destroy} transitions to `DESTROYED` and removes the root element from the DOM.
 *
 * ### Idempotency / No-ops
 * - {@link destroy} is idempotent once in {@link LifecycleState.DESTROYED}.
 * - {@link getView} throws if the view is not yet mounted (i.e., {@link view} is unset).
 *
 * ### DOM side effects / Ownership
 * - Owns the root element produced by the mount helper and removes it on {@link destroy}.
 * - Does not automatically append the root node; external orchestrators (Adapter/RecyclerView) control attachment.
 *
 * @template TTags - Map of tag names to their corresponding HTMLElement instances.
 * @implements {ViewContract<TTags>}
 * @extends Lifecycle
 * @see {@link MountViewResult}
 * @see {@link ViewContract}
 * @see {@link LifecycleState}
 */
export class View<TTags extends Record<string, HTMLElement>> extends Lifecycle implements ViewContract<TTags> {
    /**
     * Host container element into which this view's root element is rendered/attached.
     *
     * This reference is captured at construction time and cleared on {@link destroy}.
     */
    public parent: HTMLElement | null = null;

    /**
     * Mounted view result containing:
     * - `view`: the root element of this view
     * - `tags`: a strongly-typed map of child elements for fast access
     *
     * This is expected to be assigned by subclasses (or a mount helper) before {@link getView} is called.
     */
    public view: MountViewResult<TTags> | null = null;

    /**
     * Creates a View bound to the specified parent container and initializes lifecycle state.
     *
     * Notes:
     * - This base constructor **does not** perform DOM mounting or attachment.
     * - Subclasses typically assign {@link view} during their mount step, then append `view.view` to {@link parent}.
     *
     * @param {HTMLElement} parent - Host element into which this view will render.
     */
    public constructor(parent: HTMLElement) {
        super();
        this.parent = parent;
        this.init();
    }

    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * @returns {HTMLElement} The root element produced by the mounting helper.
     * @throws {Error} If {@link view} is not set or the view has not been mounted yet.
     */
    public getView(): HTMLElement {
        if (!this.view?.view) {
            throw new Error("View is not mounted. Did you forget to set this.view?");
        }
        return this.view.view;
    }

    /**
     * Destroys the view and releases DOM references.
     *
     * Behavior:
     * - Idempotent: returns early if already in {@link LifecycleState.DESTROYED}.
     * - Removes the root element from the DOM (if present).
     * - Clears references to {@link parent} and {@link view}.
     * - Completes teardown by calling {@link Lifecycle.destroy}.
     *
     * @returns {void}
     * @override
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.getView()?.remove?.();

        this.parent = null;
        this.view = null;

        super.destroy();
    }
}