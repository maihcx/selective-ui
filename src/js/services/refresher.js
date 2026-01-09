import {Libs} from "../utils/libs.js";

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
    static resizeBox(select, view) {
        const 
            bindedMap = Libs.getBinderMap(select),
            options = bindedMap.options
        ;
        
        const 
            minWidth = options.minWidth,
            minHeight = options.minHeight,
            cfgWidth = parseInt(options.width, 10),
            cfgHeight = parseInt(options.height, 10)
        ;
        
        let width = `${select.offsetWidth}px`,
            height = `${select.offsetHeight}px`;
            
        const getCStyle = getComputedStyle(select);
        if (width == "0px" && getCStyle.width != "auto") {
            width = getCStyle.width;
        }
        if (height == "0px" && getCStyle.height != "auto") {
            height = getCStyle.height;
        }
        
        if (cfgWidth > 0) {
            width = options.width;
        }
        if (cfgHeight > 0) {
            height = options.height;
        }

        Libs.setStyle(view, {width, height, minWidth, minHeight});
    }
}