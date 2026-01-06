/**
 * Checks for a previously loaded global library instance by name.
 * If found (with `__loaded` flag), logs a warning and returns true; otherwise
 * initializes a loading placeholder on `window[name]` and returns false.
 *
 * @param {string} LIB_NAME - The global namespace key to check on `window`.
 * @returns {boolean} - True if a loaded instance already exists; false otherwise.
 */
export function checkDuplicate(LIB_NAME) {
    if (typeof window === "undefined") return false;
    
    if (window[LIB_NAME] && window[LIB_NAME].__loaded) {
        console.warn(
            `[${LIB_NAME}] Already loaded (v${window[LIB_NAME].__version}). ` +
            `Using existing instance. Please remove duplicate <script> tags.`
        );
        return true;
    }
    
    window[LIB_NAME] = window[LIB_NAME] || {};
    window[LIB_NAME].__loading = true;
    return false;
}

/**
 * Marks a global library namespace as fully loaded, sets version metadata,
 * merges its public API into `window[name]`, freezes the object to prevent
 * further mutation, and logs a success message.
 *
 * @param {string} name - The global namespace key on `window`.
 * @param {string} version - Semantic version string of the library.
 * @param {Object} api - Public API surface to expose under `window[name]`.
 * @returns {void}
 */
export function markLoaded(name, version, api) {
    if (typeof window === "undefined") return;
    
    window[name].__loaded = true;
    window[name].__loading = false;
    window[name].__version = version;
    
    Object.assign(window[name], api);
    
    Object.freeze(window[name]);
    
    console.log(`[${name}] v${version} loaded successfully`);
}