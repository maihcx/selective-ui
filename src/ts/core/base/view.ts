import { MountViewResult } from "src/ts/types/utils/libs.type";
import type { ViewContract } from "../../types/core/base/view.type";
import { Lifecycle } from "./lifecycle";
import { LifecycleState } from "src/ts/types/core/base/lifecycle.type";

/**
 * Base View class that anchors a mounted DOM structure into a parent container.
 *
 * Responsibilities:
 * - Hold a reference to the parent container (`parent`)
 * - Store the mounted structure (`view`) returned by a mounting helper
 * - Provide a safe getter for the root element (`getView()`)
 * - Participate in the standard lifecycle (`init` → `mount` → `update` → `destroy`)
 *
 * Typical usage:
 * - Subclasses set `this.view` inside `onMount()` using a mounting utility
 * - Then call `this.parent!.appendChild(this.view.view)`
 *
 * @template TTags - A map of tag names to their corresponding HTMLElement instances.
 * @implements {ViewContract<TTags>}
 */
export class View<TTags extends Record<string, HTMLElement>> extends Lifecycle implements ViewContract<TTags> {

    /** The parent DOM element into which this view is rendered. */
    public parent: HTMLElement | null = null;

    /**
     * Mounted result containing:
     * - `view`: the root element of this view
     * - `tags`: a strongly-typed map of child elements
     */
    public view: MountViewResult<TTags> | null = null;

    /**
     * Creates a View bound to the specified parent container.
     *
     * Note: Subclasses should assign `this.view` during `onMount()` before
     * attempting to access `getView()` or manipulate the root element.
     *
     * @param parent - The parent element into which this view will render.
     */
    public constructor(parent: HTMLElement) {
        super();
        this.parent = parent;
        this.init();
    }

    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * @returns The root element produced by the mounting helper.
     * @throws {Error} If the view has not been mounted or `this.view` is not set.
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
     * - Removes the root element from the DOM (if present)
     * - Clears references to `parent` and `view`
     * - Ends the lifecycle via `super.destroy()`
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