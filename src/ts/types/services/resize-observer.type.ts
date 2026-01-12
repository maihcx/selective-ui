/**
 * Represents the measurements for each side of a box (padding, border, or margin).
 */
export interface BoxSides {
    top: number;    // Size of the top side in pixels
    right: number;  // Size of the right side in pixels
    bottom: number; // Size of the bottom side in pixels
    left: number;   // Size of the left side in pixels
}

/**
 * Represents calculated metrics for an element, including size, position,
 * and box model properties (padding, border, margin).
 */
export interface ElementMetrics {
    width: number;       // Element width in pixels
    height: number;      // Element height in pixels
    top: number;         // Distance from the top of the parent/container
    left: number;        // Distance from the left of the parent/container
    padding: BoxSides;   // Padding values for all sides
    border: BoxSides;    // Border thickness values for all sides
    margin: BoxSides;    // Margin values for all sides
}