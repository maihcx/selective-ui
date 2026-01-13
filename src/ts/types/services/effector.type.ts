/**
 * Represents a size object used in effector calculations.
 * Typically includes width and height of an element.
 */
export interface SizeObject {
    width: number;  // Element width in pixels
    height: number; // Element height in pixels
}

/**
 * Represents dimensions returned by helper functions.
 * Includes scrollable height for overflow calculations.
 */
export interface DimensionObject {
    width: number;        // Element width in pixels
    height: number;       // Element height in pixels
    scrollHeight: number; // Total scrollable height of the element
}

/**
 * Public interface for the Effector utility.
 * Handles expand, collapse, resize, and animation states for UI elements.
 */
export interface EffectorInterface {
    /**
     * Set the target element for effector operations.
     * @param query - CSS selector string or HTMLElement instance.
     */
    setElement(query: string | HTMLElement): void;

    /** The current target element being manipulated. */
    element: HTMLElement;

    /**
     * Expand the element with animation and custom configuration.
     * @param object - Configuration options for expansion.
     * @returns EffectorInterface for method chaining.
     */
    expand(object: Record<string, unknown>): EffectorInterface;

    /**
     * Cancel any ongoing animation or effect.
     * @returns EffectorInterface for method chaining.
     */
    cancel(): EffectorInterface;

    /**
     * Collapse the element with animation and custom configuration.
     * @param object - Configuration options for collapsing.
     * @returns EffectorInterface for method chaining.
     */
    collapse(object: Record<string, unknown>): EffectorInterface;

    /**
     * Show Swipe animation
     * @param object - Configuration options for Show.
     * @returns EffectorInterface for method chaining.
     */
    showSwipeWidth(config: SwipeConfig): EffectorInterface;

    /**
     * hide Swipe animation
     * @param object - Configuration options for hide.
     * @returns EffectorInterface for method chaining.
     */
    hideSwipeWidth(config: SwipeConfig): EffectorInterface;

    /**
     * Resize the element with animation and custom configuration.
     * @param object - Configuration options for resizing.
     * @returns EffectorInterface for method chaining.
     */
    resize(object: Record<string, unknown>): EffectorInterface;

    /** Indicates whether an animation is currently in progress. */
    isAnimating: boolean;

    /**
     * Calculate dimensions of a hidden element by temporarily applying display styles.
     * @param display - CSS display value (e.g., "flex").
     * @returns DimensionObject containing width, height, and scrollHeight.
     */
    getHiddenDimensions(display: "flex"): DimensionObject;
}

/**
 * Configuration options for expanding an element.
 */
export type ExpandConfig = {
    duration?: number;           // Animation duration in milliseconds
    display?: string;            // CSS display property during expansion
    width: number;               // Target width in pixels
    left: number;                // Target left position
    top: number;                 // Target top position
    maxHeight: number;           // Maximum height allowed
    realHeight: number;          // Actual height of the content
    position?: "top" | "bottom"; // Positioning reference
    onComplete?: () => void;     // Callback after expansion completes
};

/**
 * Configuration options for collapsing an element.
 */
export type CollapseConfig = {
    duration?: number;           // Animation duration in milliseconds
    onComplete?: () => void;     // Callback after collapse completes
};

/**
 * Configuration options for swipe animations.
 */
export type SwipeConfig = {
    duration?: number;           // Animation duration in milliseconds
    display?: string;            // CSS display property during swipe
    onComplete?: () => void;     // Callback after swipe completes
};

/**
 * Configuration options for resizing an element.
 */
export type ResizeConfig = {
    duration?: number;           // Animation duration in milliseconds
    width: number;               // Target width in pixels
    left: number;                // Target left position
    top: number;                 // Target top position
    maxHeight: number;           // Maximum height allowed
    realHeight: number;          // Actual height of the content
    position?: "top" | "bottom"; // Positioning reference
    animate?: boolean;           // Whether to animate the resize
    onComplete?: () => void;     // Callback after resize completes
};