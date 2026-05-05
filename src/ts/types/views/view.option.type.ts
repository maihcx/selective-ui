import { MountViewResult } from "../utils/libs.type";

/**
 * Represents the DOM tags created when mounting an OptionView component.
 * These tags correspond to key elements of the option UI.
 */
export type OptionViewTags = {
    /** Root container for the option view */
    OptionView: HTMLDivElement;
    /** Input element (checkbox or radio) */
    OptionInput: HTMLInputElement;
    /** Label element for the option */
    OptionLabel: HTMLLabelElement;
    /** Container for label text content */
    LabelContent: HTMLDivElement;
    /** Image element for options with images */
    OptionImage: HTMLImageElement;
};

/**
 * Represents the result of mounting an OptionView.
 * Extends MountViewResult with a guaranteed root element (`view`).
 */
export type OptionViewResult = MountViewResult<OptionViewTags> & {
    /** The root element of the mounted option view */
    view: Element;
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
    /** Indicates if multiple selection is allowed */
    isMultiple: boolean;
    /** Indicates if the option includes an image */
    hasImage: boolean;
    /** Position of the image relative to the label */
    imagePosition: ImagePosition;
    /** Width of the image */
    imageWidth: string;
    /** Height of the image */
    imageHeight: string;
    /** Border radius for the image */
    imageBorderRadius: string;
    /** Vertical alignment of the label */
    labelValign: LabelValign;
    /** Horizontal alignment of the label */
    labelHalign: LabelHalign;
};

/**
 * Partial configuration patch for updating specific option properties.
 * Includes only image and label alignment-related properties.
 */
export type OptionConfigPatch = Partial<
    Pick<
        OptionConfig,
        | "imageWidth"
        | "imageHeight"
        | "imageBorderRadius"
        | "imagePosition"
        | "labelValign"
        | "labelHalign"
    >
>;
