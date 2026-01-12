import { MountViewResult } from "../utils/libs.type";

/**
 * Represents the DOM tags created when mounting an OptionView component.
 * These tags correspond to key elements of the option UI.
 */
export type OptionViewTags = {
    OptionView: HTMLDivElement;      // Root container for the option view
    OptionInput: HTMLInputElement;   // Input element (checkbox or radio)
    OptionLabel: HTMLLabelElement;   // Label element for the option
    LabelContent: HTMLDivElement;    // Container for label text content
    OptionImage: HTMLImageElement;   // Image element for options with images
};

/**
 * Represents the result of mounting an OptionView.
 * Extends MountViewResult with a guaranteed root element (`view`).
 */
export type OptionViewResult = MountViewResult<OptionViewTags> & {
    view: Element; // The root element of the mounted option view
};

/**
 * Possible positions for an image relative to the label.
 */
export type ImagePosition = "top" | "right" | "bottom" | "left";

/**
 * Vertical alignment options for the label.
 */
export type LabelValign = "top" | "center" | "bottom";

/**
 * Horizontal alignment options for the label.
 */
export type LabelHalign = "left" | "center" | "right";

/**
 * Configuration options for rendering an option.
 */
export type OptionConfig = {
    isMultiple: boolean;           // Indicates if multiple selection is allowed
    hasImage: boolean;             // Indicates if the option includes an image
    imagePosition: ImagePosition;  // Position of the image relative to the label
    imageWidth: string;            // Width of the image
    imageHeight: string;           // Height of the image
    imageBorderRadius: string;     // Border radius for the image
    labelValign: LabelValign;      // Vertical alignment of the label
    labelHalign: LabelHalign;      // Horizontal alignment of the label
};

/**
 * Partial configuration patch for updating specific option properties.
 * Includes only image and label alignment-related properties.
 */
export type OptionConfigPatch = Partial<Pick<OptionConfig,
    "imageWidth" | "imageHeight" | "imageBorderRadius" | "imagePosition" | "labelValign" | "labelHalign"
>>;