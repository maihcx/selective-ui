
/**
 * @template {Record<string, Element>} TTags
 * @implements {ViewContract<TTags>}
 */
export class View {
    /** @type {Element|null} */
    parent = null;

    /**
     * Initializes the view with a parent container element that will host its rendered content.
     *
     * @param {Element} parent - The parent element into which this view will render.
     */
    constructor(parent) {
        this.parent = parent;
    }

    /**
     * Renders the view into the parent container.
     * Override in subclasses to create DOM structure and mount tags.
     */
    render() {}
    
    /**
     * Updates the view to reflect model or state changes.
     * Override in subclasses to patch DOM nodes without full re-render.
     */
    update() {}

    /** @type {MountViewResult<TTags>} */
    view = null;

    /**
     * Returns the root HTMLElement of the mounted view.
     *
     * @returns {HTMLElement} - The root view element.
     */
    getView() {
        return this.view.view;
    }

    /**
     * Retrieves a single tagged element from the mounted view.
     *
     * @template {keyof TTags} K
     * @param {K} tag - The tag key corresponding to the desired element.
     * @returns {TTags[K]} - The element associated with the provided tag key.
     */
    getTag(tag) {
        return this.view.tags[tag];
    }

    /**
     * Retrieves the full tag map for the mounted view.
     *
     * @returns {TTags} - An object map of all tagged elements.
     */
    getTags() {
        return this.view.tags;
    }
}
