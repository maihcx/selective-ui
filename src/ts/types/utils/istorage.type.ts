import { AjaxConfig } from "../core/search-controller.type";
import { SelectiveOptions } from "./selective.type";

/**
 * Represents a collection of event handlers for different component lifecycle events.
 * Each event can have multiple callbacks.
 */
export type StorageEvents = {
    load?: Array<(...args: any[]) => void>;          // Triggered when data or component is loaded
    beforeShow?: Array<(...args: any[]) => void>;    // Triggered before the panel is shown
    show?: Array<(...args: any[]) => void>;          // Triggered when the panel is displayed
    beforeChange?: Array<(...args: any[]) => void>;  // Triggered before a value change occurs
    change?: Array<(...args: any[]) => void>;        // Triggered after a value change occurs
    beforeClose?: Array<(...args: any[]) => void>;   // Triggered before the panel is closed
    close?: Array<(...args: any[]) => void>;         // Triggered when the panel is closed
};

/**
 * Default configuration options for the select component.
 * Includes UI settings, behavior flags, and AJAX configuration.
 */
export interface DefaultConfig {
    showPanel?: boolean;             // Whether to show the panel initially
    accessoryStyle?: string;         // CSS style for accessory elements
    multiple?: boolean;              // Enable multiple selection
    minWidth?: string;               // Minimum width of the component
    width?: string;                  // Fixed width of the component
    offsetWidth?: number | null;     // Offset width for positioning
    minHeight?: string;              // Minimum height of the component
    height?: string;                 // Fixed height of the component
    panelHeight?: string;            // Height of the dropdown panel
    panelMinHeight?: string;         // Minimum height of the dropdown panel
    disabled?: boolean;              // Disable the component
    readonly?: boolean;              // Make the component read-only
    selectall?: boolean;             // Enable "Select All" functionality
    keepSelected?: boolean;          // Keep selected items after refresh
    placeholder?: string;            // Placeholder text
    altMask?: string;                // Alternative mask for display
    autoclose?: boolean;             // Close panel automatically after selection
    autoscroll?: boolean;            // Auto-scroll to selected item
    autofocus?: boolean;             // Focus on input automatically
    searchable?: boolean;            // Enable search functionality
    loadingfield?: boolean;          // Show loading indicator in the field
    visible?: boolean;               // Control visibility of the component
    skipError?: boolean;             // Skip error handling
    customDelimiter?: string;        // Custom delimiter for multiple values
    textLoading?: string;            // Text shown during loading
    textNoData?: string;             // Text shown when no data is available
    textNotFound?: string;           // Text shown when no search results are found
    textSelectAll?: string;          // Label for "Select All"
    textDeselectAll?: string;        // Label for "Deselect All"
    textAccessoryDeselect?: string;  // Label for accessory deselect button
    animationtime?: number;          // Animation duration in milliseconds
    delaysearchtime?: number;        // Delay before triggering search (ms)
    allowHtml?: boolean;             // Allow HTML in option labels
    maxSelected?: number;            // Maximum number of selections allowed
    labelHalign?: string;            // Horizontal alignment for labels
    labelValign?: string;            // Vertical alignment for labels
    imageMode?: boolean;             // Enable image display in options
    imageWidth?: string;             // Width for option images
    imageHeight?: string;            // Height for option images
    imageBorderRadius?: string;      // Border radius for option images
    imagePosition?: string;          // Position of images relative to text
    ajax?: AjaxConfig | null;        // AJAX configuration for dynamic data loading
    on?: StorageEvents;              // Event handlers for component lifecycle
}

/**
 * Represents a binding map for component initialization.
 * Includes options, container reference, and lifecycle actions.
 */
export type BinderMap = {
    options: SelectiveOptions;       // Component options
    container?: any;                 // Reference to the container element
    action?: Record<string, any>;    // Action handlers or methods
    self?: { deInit?: () => void } & Record<string, any>; // Self-reference with optional cleanup
};

/**
 * Represents metadata about a property in the component.
 */
export type PropertiesType = {
    type: "variable" | "get-set" | "func"; // Property type (variable, getter/setter, or function)
    name: string;                           // Property name
};