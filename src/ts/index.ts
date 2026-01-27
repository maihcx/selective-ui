/**
 * Entry module for SelectiveUI.
 *
 * This file exposes the public API surface of the library:
 * - version/name metadata
 * - DOM binding helpers (bind/find/rebind/destroy)
 * - effector factory for imperative effects
 *
 * Notes:
 * - CSS imports below are *side-effect imports* used by bundlers (Vite/Webpack/Rollup)
 *   to include component styles in the final bundle.
 */

/** Base/global styles for SelectiveUI. */
import "../css/index.css";

/** Component-level styles (imported for side-effects during bundling). */
import "../css/components/selectbox.css";
import "../css/components/placeholder.css";
import "../css/components/directive.css";
import "../css/components/popup/empty-state.css";
import "../css/components/popup/loading-state.css";
import "../css/views/group-view.css";
import "../css/components/popup/popup.css";
import "../css/components/searchbox.css";
import "../css/components/option-handle.css";
import "../css/views/option-view.css";
import "../css/components/accessorybox.css";

import { Selective } from "./utils/selective";
import { Effector } from "./services/effector";

import type {
    SelectiveActionApi,
    SelectiveOptions,
} from "./types/utils/selective.type";
import type { EffectorInterface } from "./types/services/effector.type";
import { Libs } from "./utils/libs";

declare const __LIB_VERSION__: string;
declare const __LIB_NAME__: string;

const SECLASS = new Selective();

/**
 * Current library version.
 *
 * Declared as `const` literal type to enable strict typing and easy tree-shaking.
 */
export const version = __LIB_VERSION__ as string;

/**
 * Library name identifier.
 *
 * Can be used for debugging, logging, telemetry, or exposing global namespace metadata.
 */
export const name = __LIB_NAME__ as string;

/**
 * Bind SelectiveUI behaviors to elements matched by a CSS selector.
 *
 * Typically used to initialize/select-enhance native `<select>` elements or custom containers.
 *
 * @param query - A CSS selector string used to find target elements in the DOM.
 * @param options - Optional configuration used during initialization.
 *
 * @example
 * bind(".my-select", { searchable: true });
 */
export function bind(query: string, options: SelectiveOptions = {}): void {
    SECLASS.bind(query, options);
}

/**
 * Find an existing SelectiveUI instance/actions API by selector.
 *
 * @param query - A CSS selector string previously used with `bind()` (or matching the same element).
 * @returns An action API that allows controlling the instance (open/close/setValue/etc).
 *
 * @remarks
 * The return type is casted to `SelectiveActionApi` for a stable public contract.
 */
export function find(query: string): SelectiveActionApi {
    return SECLASS.find(query) as SelectiveActionApi;
}

/**
 * Destroy SelectiveUI instance(s) and release related resources.
 *
 * @param query - A CSS selector string identifying which instance(s) to destroy.
 *               If `null`, destroys all instances managed by SelectiveUI.
 *
 * @example
 * destroy(".my-select");
 *
 * @example
 * // Destroy all instances
 * destroy();
 */
export function destroy(query: string | null = null): void {
    SECLASS.destroy(query);
}

/**
 * Rebind (reinitialize) SelectiveUI on the given selector.
 *
 * Useful when:
 * - The DOM has changed dynamically
 * - Options need to be reapplied
 * - You want a clean re-init without manual destroy + bind
 *
 * @param query - A CSS selector string used to locate target elements.
 * @param options - Optional configuration applied during re-initialization.
 */
export function rebind(query: string, options: SelectiveOptions = {}): void {
    SECLASS.rebind(query, options);
}

/**
 * Create an Effector instance for a given element.
 *
 * An effector provides imperative effect utilities bound to an element, such as animations,
 * positioning, UI transitions, or event-driven effects (depending on implementation).
 *
 * @param element - A CSS selector string or a direct HTMLElement reference.
 * @returns An `EffectorInterface` implementation bound to the given element.
 *
 * @example
 * const fx = effector("#popup");
 * fx.show();
 */
export function effector(element: string | HTMLElement): EffectorInterface {
    return Effector(element) as unknown as EffectorInterface;
}

let domInitialized = false;
function init(): void {
    if (domInitialized) return;
    domInitialized = true;

    document.addEventListener("mousedown", () => {
        const sels = Libs.getBindedCommand();
        if (sels.length > 0) {
            const actionApi = SECLASS.find(
                sels.join(", ")
            ) as SelectiveActionApi;
            if (!actionApi.isEmpty) actionApi.close();
        }
    });

    SECLASS.Observer();
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}