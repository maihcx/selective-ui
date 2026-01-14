import { SelectiveUIGlobal } from "../types/utils/selective.type";

/**
 * Internal shape stored under window[LIB_NAME].
 * Keeps metadata flags and allows merging any public API fields.
 */
export type GlobalLibNamespace = Record<string, unknown> & {
    version?: string;
};

declare global {
    interface Window {
        [key: string]: unknown;
    }
}

/**
 * Checks for a previously loaded global library instance by name.
 * initializes a loading placeholder on `window[name]` and returns false.
 *
 * @param {string} LIB_NAME - The global namespace key to check on `window`.
 * @returns {boolean} - True if a loaded instance already exists; false otherwise.
 */
export function checkDuplicate(LIB_NAME: string): boolean {
    if (typeof window === "undefined") return false;

    const existing = window[LIB_NAME] as GlobalLibNamespace | undefined;

    if (existing) {
        console.warn(
            `[${LIB_NAME}] Already loaded (v${existing.version}). ` +
            `Using existing instance. Please remove duplicate <script> tags.`
        );
        return true;
    }

    const base: GlobalLibNamespace = existing ?? {};
    window[LIB_NAME] = base;

    return false;
}

/**
 * Marks a global library namespace as fully loaded, sets version metadata,
 * merges its public API into `window[name]`, freezes the object to prevent
 * further mutation, and logs a success message.
 *
 * @param {string} name - The global namespace key on `window`.
 * @param {string} version - Semantic version string of the library.
 * @param {SelectiveUIGlobal} api - Public API surface to expose under `window[name]`.
 * @returns {void}
 */
export function markLoaded<TApi extends SelectiveUIGlobal>(
    name: string,
    version: string,
    api: TApi
): void {
    if (typeof window === "undefined") return;

    const ns = (window[name] ?? {}) as GlobalLibNamespace;

    ns.version = version;

    Object.assign(ns, api);

    Object.freeze(ns);
    window[name] = ns;

    console.log(`[${name}] v${version} loaded successfully`);
}