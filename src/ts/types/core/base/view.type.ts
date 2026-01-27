
import { Lifecycle } from "src/ts/core/base/lifecycle";
import { MountViewResult } from "../../utils/libs.type";

/**
 * Contract definition for a UI View created via `mountView` or `mountNode`.
 *
 * A View encapsulates:
 * - The mounted DOM structure
 * - The root element
 * - A strongly-typed map of named child elements
 * - Lifecycle management hooks
 *
 * @template TTags - A map of tag names to their corresponding HTMLElement instances.
 * Example:
 * ```ts
 * {
 *   Root: HTMLDivElement;
 *   Button: HTMLButtonElement;
 * }
 * ```
 */
export interface ViewContract<TTags extends Record<string, HTMLElement>> extends Lifecycle {

    /**
     * The parent DOM element into which the view is mounted.
     *
     * This value is:
     * - `null` before the view is mounted
     * - Set once the view is attached to the DOM
     */
    parent: HTMLElement | null;

    /**
     * Internal representation of the mounted view returned by `mountView` or `mountNode`.
     *
     * Contains:
     * - The root element of the view
     * - A strongly-typed tag map for querying child elements
     *
     * Will be `null` if the view has not been mounted yet.
     */
    view: MountViewResult<TTags> | null;

    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * This is typically the top-level container element
     * created by `mountView` / `mountNode`.
     *
     * @returns The root HTMLElement of the view.
     * @throws {Error} If the view has not been mounted or initialized.
     */
    getView(): HTMLElement;
}