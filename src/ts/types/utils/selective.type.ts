import { EffectorInterface } from "../services/effector.type";
import { DefaultConfig } from "./istorage.type";
import type { SelectivePlugin } from "../plugins/plugin.type";

/**
 * Represents configuration options for the Selective component.
 * Extends DefaultConfig with additional internal identifiers.
 */
export type SelectiveOptions = DefaultConfig & {
    SEID?: string;        // Unique Selective Element ID
    SEID_LIST?: string;   // ID for the list container
    SEID_HOLDER?: string; // ID for the holder element
};

/**
 * Represents the dynamic action API returned by `find()`.
 * Includes a flag for empty state and allows additional dynamic properties.
 */
export type SelectiveActionApi = { isEmpty: boolean } & Record<string, any>;

/**
 * Public global API exposed via `window.SelectiveUI`.
 * Provides methods for binding, finding, destroying, and rebinding Selective components.
 */
export interface SelectiveUIGlobal {
    /**
     * Bind a Selective component to a DOM element.
     * @param query - CSS selector string for the target element.
     * @param options - Optional configuration for the component.
     */
    bind(query: string, options?: SelectiveOptions): void;

    /**
     * Find a previously bound Selective component.
     * @param query - CSS selector string for the target element.
     * @returns The dynamic action API for the component.
     */
    find(query: string): SelectiveActionApi;

    /**
     * Destroy a previously bound Selective component.
     * @param query - CSS selector string for the target element.
     */
    destroy(query: string): void;

    /**
     * Rebind a Selective component with new options.
     * @param query - CSS selector string for the target element.
     * @param options - Optional new configuration for the component.
     */
    rebind(query: string, options?: SelectiveOptions): void;

    /**
     * Get an Effector instance for handling animations and transitions.
     * @param element - CSS selector or HTMLElement to apply effects on.
     * @returns EffectorInterface instance.
     */
    effector(element: string | HTMLElement): EffectorInterface;

    /**
     * Register a Selective plugin implementation.
     * @param plugin - Plugin instance to register.
     */
    registerPlugin(plugin: SelectivePlugin): void;

    /**
     * Unregister a Selective plugin implementation by id.
     * @param id - Plugin id to remove.
     */
    unregisterPlugin(id: string): void;

    /**
     * Current version of the library.
     */
    version: string;

    /**
     * Current version of the library.
     */
    name: string;
}
