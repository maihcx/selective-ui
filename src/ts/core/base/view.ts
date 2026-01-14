import { MountViewResult } from "src/ts/types/utils/libs.type";
import type { ViewContract } from "../../types/core/base/view.type";

/**
 * @template TTags
 * @implements {ViewContract<TTags>}
 */
export class View<TTags extends Record<string, HTMLElement>> implements ViewContract<TTags> {
    parent: HTMLElement | null = null;

    view: MountViewResult<TTags> | null = null;

    /**
     * Initializes the view with a parent container element that will host its rendered content.
     *
     * @param {HTMLElement} parent - The parent element into which this view will render.
     */
    constructor(parent: HTMLElement) {
        this.parent = parent;
    }

    /**
     * Renders the view into the parent container.
     * Override in subclasses to create DOM structure and mount tags.
     */
    render(): void { }

    /**
     * Updates the view to reflect model or state changes.
     * Override in subclasses to patch DOM nodes without full re-render.
     */
    update(): void { }

    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * @returns {HTMLElement} - The root view element.
     */
    getView(): HTMLElement {
        if (!this.view?.view) throw new Error("View is not mounted. Did you forget to set this.view?");
        return this.view.view;
    }
}
