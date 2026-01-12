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
     * Retrieve a specific tagged element from the mounted view.
     *
     * @typeParam K - A key of TTags.
     * @param tag - The tag name to fetch (must exist in TTags).
     * @returns The HTMLElement instance associated with the tag.
     * @throws If the view is not initialized or the tag is missing.
     */
    getTag<K extends keyof TTags>(tag: K): TTags[K];

    /**
     * Get the entire tag map for the mounted view.
     *
     * @returns The map of tag names to DOM elements.
     * @throws If the view is not initialized.
     */
    getTags(): TTags;

    /**
     * Get the root HTMLElement for the mounted view.
     *
     * @returns The root element produced by mountView/mountNode.
     * @throws If the view is not initialized.
     */
    getView(): HTMLElement;
}