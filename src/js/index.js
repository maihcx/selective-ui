import "../css/index.css";
import "../css/components/selectbox.css";
import "../css/components/placeholder.css";
import "../css/components/directive.css";
import "../css/components/empty-state.css";
import "../css/components/loading-state.css";
import "../css/components/optgroup.css";
import "../css/components/popup.css";
import "../css/components/searchbox.css";
import "../css/components/option-handle.css";
import "../css/components/option.css";
import "../css/components/accessorybox.css";

import "./types/adapter.type";
import "./types/effector.type";
import "./types/ievents.type";
import "./types/libs.type";
import "./types/model.type";
import "./types/recyclerview.type";
import "./types/resize-observer.type";
import "./types/view.option.type";
import "./types/view.type";

import { Selective } from "./utils/selective";
import { checkDuplicate, markLoaded } from "./utils/guard";
import { Libs } from "./utils/libs";
import { Effector } from "./services/effector";

export const version = "1.0.5";
export const name = "SelectiveUI";

const alreadyLoaded = checkDuplicate(name);

/**
 * Enhances all <select> elements matching the query with Selective UI.
 * If a prior global instance is already loaded, proxies the call to it; otherwise uses local Selective.bind.
 *
 * @param {string} query - CSS selector for target <select> elements.
 * @param {object} [options={}] - Configuration overrides merged with defaults.
 */
export function bind(query, options = {}) {
    if (alreadyLoaded && typeof window !== "undefined" && window[name]) {
        return window[name].bind(query, options);
    }

    Selective.bind(query, options);
}

/**
 * Retrieves the dynamic action API for bound instances matching the query.
 * Proxies to an already-loaded global instance if present; otherwise uses local Selective.find.
 *
 * @param {string} query - CSS selector identifying bound instances.
 * @returns {{isEmpty:boolean} & Record<string, unknown>} - Action API; {isEmpty:true} if none found.
 */
export function find(query) {
    if (alreadyLoaded && typeof window !== "undefined" && window[name]) {
        return window[name].find(query);
    }

    return Selective.find(query);
}

/**
 * Destroys Selective instances associated with the given query.
 * Proxies to a global loaded instance if available; otherwise uses local Selective.destroy.
 *
 * @param {string} query - CSS selector identifying instances to tear down.
 * @returns {void}
 */
export function destroy(query) {
    if (alreadyLoaded && typeof window !== "undefined" && window[name]) {
        return window[name].destroy(query);
    }

    return Selective.destroy(query);
}

/**
 * Rebinds Selective for the given query by destroying existing instances and binding anew.
 * Proxies to a global loaded instance if available; otherwise uses local Selective.rebind.
 *
 * @param {string} query - CSS selector for target <select> elements.
 * @param {object} [options={}] - Configuration overrides for the new binding.
 * @returns {void}
 */
export function rebind(query, options = {}) {
    if (alreadyLoaded && typeof window !== "undefined" && window[name]) {
        return window[name].rebind(query, options);
    }

    return Selective.rebind(query, options);
}

/**
 * Returns an effector instance for a given element, enabling expand/collapse/resize animations.
 * Proxies to a global loaded instance if available; otherwise constructs a local Effector.
 *
 * @param {string|HTMLElement} element - CSS selector or element to control.
 * @returns {EffectorInterface} - The effector utility bound to the element.
 */
export function effector(element) {
    if (alreadyLoaded && typeof window !== "undefined" && window[name]) {
        return window[name].effector(element);
    }

    return Effector(element);
}

if (!alreadyLoaded) {
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;
        
        document.addEventListener("mousedown", () => {
            const sels = Libs.getBindedCommand();
            if (sels.length > 0) {
                const optanObj = Selective.find(sels.join(", "));
                if (!optanObj.isEmpty) {
                    optanObj.close();
                }
            }
        });

        Selective.Observer();
        
        markLoaded(name, version, { bind, find, destroy, rebind, effector, version });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}