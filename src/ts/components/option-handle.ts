import { DefaultConfig } from "../types/utils/istorage.type";
import { MountViewResult } from "../types/utils/libs.type";
import { iEvents } from "../utils/ievents";
import { Libs } from "../utils/libs";

/**
 * @class
 */
export class OptionHandle {
    nodeMounted: MountViewResult<any> | null = null;

    node: HTMLDivElement | null = null;

    options: DefaultConfig | null = null;

    private _ActionOnSelectAll: Array<(...args: unknown[]) => unknown> = [];

    private _ActionOnDeSelectAll: Array<(...args: unknown[]) => unknown> = [];

    /**
     * Represents an option handle component that provides "Select All" and "Deselect All" actions
     * for multiple-selection lists. Includes methods to show/hide the handle, refresh its visibility,
     * and register callbacks for select/deselect events.
     */
    constructor(options: DefaultConfig | null = null) {
        if (options) this.init(options);
    }

    /**
     * Initializes the option handle UI with "Select All" and "Deselect All" buttons,
     * wiring their click events to trigger registered callbacks.
     *
     * @param {object} options - Configuration object containing text labels and feature flags.
     */
    init(options: DefaultConfig): void {
        this.nodeMounted = Libs.mountNode({
            OptionHandle: {
                tag: { node: "div", classList: ["selective-ui-option-handle", "hide"] },
                child: {
                    SelectAll: {
                        tag: {
                            node: "a",
                            classList: "selective-ui-option-handle-item",
                            textContent: options.textSelectAll,
                            onclick: () => {
                                iEvents.callFunctions(this._ActionOnSelectAll);
                            },
                        },
                    },
                    DeSelectAll: {
                        tag: {
                            node: "a",
                            classList: "selective-ui-option-handle-item",
                            textContent: options.textDeselectAll,
                            onclick: () => {
                                iEvents.callFunctions(this._ActionOnDeSelectAll);
                            },
                        },
                    },
                },
            },
        }) as MountViewResult<any>;

        this.node = this.nodeMounted.view as HTMLDivElement;
        this.options = options;
    }

    /**
     * Determines whether the option handle should be available based on configuration.
     *
     * @returns {boolean} - True if multiple selection and select-all features are enabled.
     */
    available(): boolean {
        if (!this.options) return false;
        return Libs.string2Boolean(this.options.multiple) && Libs.string2Boolean(this.options.selectall);
    }

    /**
     * Refreshes the visibility of the option handle based on availability.
     * Shows the handle if available; hides it otherwise.
     */
    refresh(): void {
        if (!this.node) return;
        if (this.available()) this.show();
        else this.hide();
    }

    /**
     * Makes the option handle visible by removing the "hide" class.
     */
    show(): void {
        if (!this.node) return;
        this.node.classList.remove("hide");
    }

    /**
     * Hides the option handle by adding the "hide" class.
     */
    hide(): void {
        if (!this.node) return;
        this.node.classList.add("hide");
    }

    /**
     * Registers a callback to be executed when "Select All" is clicked.
     *
     * @param {Function|null} action - The function to call on select-all action.
     */
    OnSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") this._ActionOnSelectAll.push(action);
    }

    /**
     * Registers a callback to be executed when "Deselect All" is clicked.
     *
     * @param {Function|null} action - The function to call on deselect-all action.
     */
    OnDeSelectAll(action: ((...args: unknown[]) => unknown) | null = null): void {
        if (typeof action === "function") this._ActionOnDeSelectAll.push(action);
    }
}