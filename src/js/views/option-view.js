
import { View } from "../core/base/view";
import { Libs } from "../utils/libs";

/**
 * @extends {View<OptionViewTags>}
 */
export class OptionView extends View {
    /** @type {OptionViewResult} */
    view;

    isMultiple = false;
    hasImage = false;
    optionConfig = null;

    /**
     * Renders the option view DOM structure (input, optional image, label),
     * sets ARIA attributes/IDs, mounts into parent, and applies initial config.
     */
    render() {
        const viewClass = ["selective-ui-option-view"];
        const opt_id = Libs.randomString(7);
        const inputID = `option_${opt_id}`;

        if (this.isMultiple) {
            viewClass.push("multiple");
        }

        if (this.hasImage) {
            viewClass.push("has-image");
            viewClass.push(`image-${this.optionConfig?.imagePosition}`);
        }

        const childStructure = {
            OptionInput: {
                tag: {
                    node: "input",
                    type: this.isMultiple ? "checkbox" : "radio",
                    classList: "allow-choice",
                    id: inputID
                }
            },
            ...(this.hasImage && {
                OptionImage: {
                tag: {
                    node: "img",
                    classList: "option-image",
                    style: {
                        width: this.optionConfig?.imageWidth || "60px",
                        height: this.optionConfig?.imageHeight || "60px",
                        borderRadius: this.optionConfig?.imageBorderRadius || "4px"
                    }
                }
                }
            }),
            OptionLabel: {
                tag: {
                node: "label",
                htmlFor: inputID,
                classList: [
                    `align-vertical-${this.optionConfig?.labelValign}`,
                    `align-horizontal-${this.optionConfig?.labelHalign}`
                ]
                },
                child: {
                    LabelContent: { tag: { node: "div" } }
                }
            }
        };

        this.view = Libs.mountView({
            OptionView: {
                tag: {
                    node: "div",
                    id: `seui-${opt_id}-option`,
                    classList: viewClass,
                    role: "option",
                    ariaSelected: "false",
                    tabIndex: "-1"
                },
                child: childStructure
            }
        });

        this.parent.appendChild(this.view.view);

        this.applyConfigToDOM();
    }

    /**
     * Refreshes the option view by reapplying configuration (classes, alignments, image styles).
     */
    update() {
        this.applyConfigToDOM();
    }

    /**
     * Applies current configuration to the DOM in a minimal, fast way:
     * - Set root/label classes in a single assignment (less DOM churn),
     * - Ensure input type matches selection mode,
     * - Create/remove image element only when needed, update its styles.
     */
    applyConfigToDOM() {
        const v = this.view;
        if (!v || !v.view) return;

        const root  = v.view;
        const input = v.tags?.OptionInput;
        const label = v.tags?.OptionLabel;
        const isMultiple   = !!this.isMultiple;
        const hasImage     = !!this.hasImage;
        const imagePos     = this.optionConfig?.imagePosition || 'right';
        const imageWidth   = this.optionConfig?.imageWidth      || '60px';
        const imageHeight  = this.optionConfig?.imageHeight     || '60px';
        const imageRadius  = this.optionConfig?.imageBorderRadius || '4px';
        const vAlign       = this.optionConfig?.labelValign     || 'center';
        const hAlign       = this.optionConfig?.labelHalign     || 'left';

        const rootClasses = ['selective-ui-option-view'];
        if (isMultiple) rootClasses.push('multiple');
        if (hasImage) {
            rootClasses.push('has-image', `image-${imagePos}`);
        }
        root.className = rootClasses.join(' ');

        if (input) {
            const desiredType = isMultiple ? 'checkbox' : 'radio';
            if (input.type !== desiredType) input.type = desiredType;
        }

        if (label) {
            label.className = `align-vertical-${vAlign} align-horizontal-${hAlign}`;
        }

        let image = v.tags?.OptionImage;
        if (hasImage) {
            if (!image) {
                image = document.createElement('img');
                image.className = 'option-image';
                if (label && label.parentElement) root.insertBefore(image, label);
                else root.appendChild(image);
                v.tags.OptionImage = image;
            }
            const style = image.style;
            style.width        = imageWidth;
            style.height       = imageHeight;
            style.borderRadius = imageRadius;
        } else if (image) {
            image.remove();
            v.tags.OptionImage = null;
        }
    }
}