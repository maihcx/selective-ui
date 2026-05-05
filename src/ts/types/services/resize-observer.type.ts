/**
 * Represents the measurements for each side of a box (padding, border, or margin).
 */
export interface BoxSides {
    /** Size of the top side in pixels */
    top: number;
    /** Size of the right side in pixels */
    right: number;
    /** Size of the bottom side in pixels */
    bottom: number;
    /** Size of the left side in pixels */
    left: number;
}

/**
 * Represents calculated metrics for an element, including size, position,
 * and box model properties (padding, border, margin).
 */
export interface ElementMetrics {
    /** Element width in pixels */
    width: number;
    /** Element height in pixels */
    height: number;
    /** Distance from the top of the parent/container */
    top: number;
    /** Distance from the left of the parent/container */
    left: number;
    /** Padding values for all sides */
    padding: BoxSides;
    /** Border thickness values for all sides */
    border: BoxSides;
    /** Margin values for all sides */
    margin: BoxSides;
}
