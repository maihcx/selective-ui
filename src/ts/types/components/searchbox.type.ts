import { PlaceHolder } from "src/ts/components/placeholder";
import { MountViewResult } from "../utils/libs.type";
import { Directive } from "src/ts/components/directive";
import { SearchBox } from "src/ts/components/searchbox";
import { Popup } from "src/ts/components/popup/popup";
import { EffectorInterface } from "../services/effector.type";
import { AccessoryBox } from "src/ts/components/accessorybox";
import { SearchController } from "src/ts/core/search-controller";
import { SelectObserver } from "src/ts/services/select-observer";
import { DatasetObserver } from "src/ts/services/dataset-observer";
import { OptionModel } from "src/ts/models/option-model";

/**
 * Represents the DOM elements used in the SearchBox component.
 */
export type SearchBoxTags = {
    SearchBox: HTMLDivElement;      // Container for the search box
    SearchInput: HTMLInputElement;  // Input field for search queries
};

/**
 * Defines the handler for search actions.
 * @param value - The search query string.
 * @param isTrigger - Indicates if the search was triggered programmatically.
 */
export type SearchHandler = (value: string, isTrigger: boolean) => void;

/**
 * Defines the handler for navigation actions.
 * @param direction - Navigation direction: 1 for next, -1 for previous.
 */
export type NavigateHandler = (direction: 1 | -1) => void;

/**
 * Represents the DOM elements used in the SelectBox component.
 */
export type SelectBoxTags = {
    ViewPanel: HTMLDivElement;  // Panel that displays selectable options
};

/**
 * Defines the runtime container for the SelectBox component.
 * Combines mounted view result with additional services and components.
 */
export type ContainerRuntime = MountViewResult<SelectBoxTags> & {
    placeholder: PlaceHolder;           // Placeholder manager
    directive: Directive;               // Directive handler for dynamic behavior
    searchbox: SearchBox;               // Search box component
    popup: Popup;                       // Popup component for dropdown
    effector: EffectorInterface;        // Effector for state management
    targetElement: HTMLSelectElement;   // Original select element
    accessorybox: AccessoryBox;         // Accessory box for extra UI elements
    searchController: SearchController; // Controller for search logic
    selectObserver: SelectObserver;     // Observer for selection changes
    datasetObserver: DatasetObserver;   // Observer for dataset updates
};

/**
 * Interface defining actions and properties for the SelectBox component.
 */
export interface SelectBoxAction {
    targetElement: HTMLSelectElement;     // Target Select element

    placeholder: string;           // Placeholder text
    oldValue: unknown;             // Previous value before change

    value: string | string[];      // Current selected value(s)
    valueArray: string[];          // Selected values as an array
    valueString: string;           // Selected values as a single string

    valueOptions: OptionModel[];   // Selected option models
    mask: string[];                // Masked values for filtering
    valueText: string | string[];  // Display text for selected values

    isOpen: boolean;               // Indicates if the dropdown is open

    disabled: boolean;             // Indicates if the component is disabled
    readonly: boolean;             // Indicates if the component is read-only
    visible: boolean;              // Indicates if the component is visible

    /**
     * Get parent of self
     * @param evtToken - Optional event token for tracking.
     */
    getParent(evtToken?: unknown): HTMLElement

    /**
     * Get dataset from selected options
     * @param evtToken - Optional event token for tracking.
     * @param strDataset - Property to find
     * @param isArray - Keep array or return once
     */
    valueDataset(evtToken?: unknown, strDataset?: string, isArray?: boolean): any[] | string

    /**
     * Select all available options.
     * @param evtToken - Optional event token for tracking.
     * @param trigger - Whether to trigger change events.
     */
    selectAll(evtToken?: unknown, trigger?: boolean): void;

    /**
     * Deselect all options.
     * @param evtToken - Optional event token for tracking.
     * @param trigger - Whether to trigger change events.
     */
    deSelectAll(evtToken?: unknown, trigger?: boolean): void;

    /**
     * Set a new value for the SelectBox.
     * @param evtToken - Optional event token for tracking.
     * @param value - The new value to set.
     * @param trigger - Whether to trigger change events.
     * @param force - Whether to force the update.
     */
    setValue(evtToken: unknown | null, value: unknown, trigger?: boolean, force?: boolean): void;

    /**
     * Load options for the SelectBox, typically from an AJAX source.
     * @param evtToken - Optional event token for tracking.
     */
    load(): void;

    /**
     * Open the dropdown.
     * @returns True if opened successfully.
     */
    open(): void;

    /**
     * Close the dropdown.
     * @returns True if closed successfully.
     */
    close(): void;

    /**
     * Toggle the dropdown state (open/close).
     */
    toggle(): void;

    /**
     * Trigger a change event.
     * @param evtToken - Optional event token for tracking.
     * @param canTrigger - Whether to trigger change events.
     */
    change(evtToken?: unknown, canTrigger?: boolean): void;

    /**
     * Refresh the mask used for filtering options.
     */
    refreshMask(): void;

    /**
     * Register an event handler.
     * @param evtToken - Event token for tracking.
     * @param evtName - Name of the event.
     * @param handle - Callback function for the event.
     */
    on(evtToken: unknown, evtName: string, handle: (...args: any[]) => any): void;

    /**
     * Perform an AJAX request.
     * @param evtToken - Event token for tracking.
     * @param obj - Data or configuration for the request.
     */
    ajax(evtToken: unknown, obj: unknown): void;

    /**
     * Trigger a AJAX request if it available.
     * @param evtToken - Event token for tracking.
     */
    loadAjax(evtToken: unknown, obj: unknown): void;
}