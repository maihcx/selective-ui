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

import { Selective } from "./utils/selective";
import { checkDuplicate, markLoaded } from "./utils/guard";
import { Libs } from "./utils/libs";
import { Effector } from "./services/effector";
import { SelectiveActionApi, SelectiveOptions, SelectiveUIGlobal } from "./types/utils/selective.type";
import { EffectorInterface } from "./types/services/effector.type";

export const version = "1.1.2" as const;
export const name = "SelectiveUI" as const;

declare global {
    interface Window {
        SelectiveUI?: SelectiveUIGlobal;
    }
}

const alreadyLoaded: boolean = checkDuplicate(name);
const api: SelectiveUIGlobal = { bind, find, destroy, rebind, effector, version };

function getGlobal(): SelectiveUIGlobal | undefined {
    if (typeof window === "undefined") 
        return undefined;
    return window[name];
}

/**
 * Enhances all <select> elements matching the query with Selective UI.
 * If a prior global instance is already loaded, proxies the call to it; otherwise uses local Selective.bind.
 */
export function bind(query: string, options: SelectiveOptions = {}): void {
    const global = getGlobal();
    if (alreadyLoaded && global) 
        return global.bind(query, options);
    Selective.bind(query, options);
}

/**
 * Retrieves the dynamic action API for bound instances matching the query.
 * Proxies to an already-loaded global instance if present; otherwise uses local Selective.find.
 */
export function find(query: string): SelectiveActionApi {
    const global = getGlobal();
    if (alreadyLoaded && global) 
        return global.find(query);
    return Selective.find(query) as SelectiveActionApi;
}

/**
 * Destroys Selective instances associated with the given query.
 * Proxies to a global loaded instance if available; otherwise uses local Selective.destroy.
 */
export function destroy(query: string | null = null): void {
    const global = getGlobal();
    if (alreadyLoaded && global) 
        return global.destroy(query);
    Selective.destroy(query);
}

/**
 * Rebinds Selective for the given query by destroying existing instances and binding anew.
 * Proxies to a global loaded instance if available; otherwise uses local Selective.rebind.
 */
export function rebind(query: string, options: SelectiveOptions = {}): void {
    const global = getGlobal();
    if (alreadyLoaded && global) 
        return global.rebind(query, options);
    Selective.rebind(query, options);
}

/**
 * Returns an effector instance for a given element, enabling expand/collapse/resize animations.
 * Proxies to a global loaded instance if available; otherwise constructs a local Effector.
 */
export function effector(element: string | HTMLElement): EffectorInterface {
    const global = getGlobal();
    if (alreadyLoaded && global) 
        return global.effector(element);
    return Effector(element) as unknown as EffectorInterface;
}

if (!alreadyLoaded) {
    const api: SelectiveUIGlobal = { bind, find, destroy, rebind, effector, version };
    markLoaded(name, version, api);

    let domInitialized = false;

    function init(): void {
        if (domInitialized) return;
        domInitialized = true;

        document.addEventListener("mousedown", () => {
        const sels: string[] = Libs.getBindedCommand();
        if (sels.length > 0) {
            const actionApi = Selective.find(sels.join(", ")) as SelectiveActionApi;
            if (!actionApi.isEmpty) actionApi.close();
        }
        });

        Selective.Observer();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}
