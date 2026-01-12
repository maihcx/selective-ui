import { Libs } from "../utils/libs";

/**
 * @class
 */
export class Refresher {
    /**
     * Provides a utility to resize the Select UI view panel based on the bound <select> element
     * and configuration options. Applies explicit width/height if configured; otherwise uses the
     * select's current offset size. Ensures minimum width/height constraints are respected.
     *
     * @param {HTMLSelectElement} select - The native select element used to derive dimensions.
     * @param {HTMLElement} view - The view panel element whose styles will be updated.
     */
    static resizeBox(select: HTMLSelectElement, view: HTMLElement): void {
        const bindedMap = Libs.getBinderMap(select);
        if (!bindedMap?.options) return;

        const options = bindedMap.options;

        const minWidth = options.minWidth;
        const minHeight = options.minHeight;

        const cfgWidth = Number.parseInt(options.width, 10);
        const cfgHeight = Number.parseInt(options.height, 10);

        let width = `${select.offsetWidth}px`;
        let height = `${select.offsetHeight}px`;

        const cstyle = getComputedStyle(select);

        if (width === "0px" && cstyle.width !== "auto") width = cstyle.width;
        if (height === "0px" && cstyle.height !== "auto") height = cstyle.height;

        if (cfgWidth > 0) width = options.width;
        if (cfgHeight > 0) height = options.height;

        Libs.setStyle(view, { width, height, minWidth, minHeight });
    }
}