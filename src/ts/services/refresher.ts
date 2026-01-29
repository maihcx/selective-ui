import { Libs } from "../utils/libs";

/**
 * Refresher
 *
 * Small DOM utility responsible for synchronizing the rendered Select UI container size
 * with the bound native `<select>` element and its configured sizing constraints.
 *
 * ### Responsibility
 * - Read sizing configuration from the select's binder map (`Libs.getBinderMap(select).options`).
 * - Derive width/height from either:
 *   - explicit `options.width` / `options.height` when provided, or
 *   - the select element's current rendered size (`offsetWidth/offsetHeight`) with a computed-style fallback.
 * - Apply the resolved `width/height` plus `minWidth/minHeight` constraints to the view panel element.
 *
 * ### DOM side effects
 * - Mutates `view.style` (`width`, `height`, `minWidth`, `minHeight`) via `Object.assign`.
 *
 * ### No-op behavior
 * - If the select is not bound (missing binder map or options), this utility does nothing.
 */
export class Refresher {
    /**
     * Updates the view panel size to match the source `<select>` and configuration options.
     *
     * Resolution order:
     * 1) Start from `select.offsetWidth/offsetHeight`.
     * 2) If offsets are `0px` and computed styles are not `"auto"`, fall back to computed `width/height`.
     * 3) If `options.width/options.height` parse as positive integers, use those explicit values instead.
     * 4) Apply `minWidth/minHeight` constraints from options.
     *
     * Notes:
     * - `options.width/options.height` are treated as CSS strings, but are considered "enabled"
     *   only when `parseInt(..., 10) > 0`.
     *
     * @param select - Native `<select>` element used as the sizing reference and option source.
     * @param view - View panel element whose inline styles will be updated.
     */
    public static resizeBox(select: HTMLSelectElement, view: HTMLElement): void {
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

        Object.assign(view.style, { width, height, minWidth, minHeight });
    }
}