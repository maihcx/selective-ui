import { MountViewResult } from "../../utils/libs.type";

/**
 * Contract for a UI view created via `mountView`/`mountNode`.
 * Encapsulates the mounted view, its parent, and helper accessors.
 *
 * @template TTags - A map of tag names to their corresponding HTMLElement instances.
 *                   Example: `{ Root: HTMLDivElement, Button: HTMLButtonElement }`
 */
export interface ViewContract<TTags extends Record<string, HTMLElement>> {
    /**
     * The parent container into which the view is mounted.
     * Can be null before the view is attached.
     */
    parent: HTMLElement | null;

    /**
     * The result returned by mountView/mountNode, including the root element
     * and the tag map used to retrieve specific nodes.
     * Can be null if the view has not been mounted yet.
     */
    view: MountViewResult<TTags> | null;

    /**
     * Render or re-render the view.
     * Implementations typically (re)build DOM, bind events, and update state.
     */
    render(): void;

    /**
     * Update the view.
     * Implementations typically refresh displayed data without a full re-render.
     */
    update(): void;

    /**
     * Get the root HTMLElement for the mounted view.
     *
     * @returns The root element produced by mountView/mountNode.
     * @throws If the view is not initialized.
     */
    getView(): HTMLElement;
}