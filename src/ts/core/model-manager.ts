
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { ModelContract } from "../types/core/base/model.type";
import { RecyclerViewContract } from "../types/core/base/recyclerview.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Adapter } from "./base/adapter";

/**
 * @template TModel
 * @template TAdapter
 */
export class ModelManager<
    TModel extends ModelContract<any, any>,
    TAdapter extends Adapter<TModel>
> {
    private _privModelList: Array<GroupModel | OptionModel> = [];

    private _privAdapter!: new (...args: any[]) => TAdapter;

    private _privAdapterHandle: TAdapter | null = null;

    private _privRecyclerView!: new (...args: any[]) => RecyclerViewContract<TAdapter>;

    private _privRecyclerViewHandle: RecyclerViewContract<TAdapter> | null = null;

    private _lastFingerprint: string | null = null;

    options: SelectiveOptions = null;

    /**
     * Constructs a ModelManager with configuration options used by created models and components.
     *
     * @param {object} options - Configuration object passed to GroupModel/OptionModel and view infrastructure.
     */
    constructor(options: SelectiveOptions) {
        this.options = options;
    }

    /**
     * Registers the adapter class to be used for rendering and managing models.
     *
     * @param {new TAdapter} adapter - The adapter constructor (class) to instantiate.
     */
    setupAdapter(adapter: new (...args: any[]) => TAdapter): void {
        this._privAdapter = adapter;
    }

    /**
     * Registers the RecyclerView class responsible for hosting and updating item views.
     *
     * @param {new RecyclerViewContract<TAdapter>} recyclerView - The recycler view constructor.
     */
    setupRecyclerView(recyclerView: new (...args: any[]) => RecyclerViewContract<TAdapter>): void {
        this._privRecyclerView = recyclerView;
    }

    /**
     * Checks whether the provided model data differs from the last recorded fingerprint.
     * Computes a new fingerprint and compares it to the previous one; if different,
     * updates the stored fingerprint and returns true, otherwise returns false.
     *
     * @param {Array<HTMLOptionElement|HTMLOptGroupElement>} modelData - The current model data (options/optgroups).
     * @returns {boolean} True if there are real changes; false otherwise.
     */
    hasRealChanges(modelData: Array<HTMLOptionElement | HTMLOptGroupElement>): boolean {
        const newFingerprint = this._createFingerprint(modelData);
        const hasChanges = newFingerprint !== this._lastFingerprint;

        if (hasChanges) this._lastFingerprint = newFingerprint;

        return hasChanges;
    }

    /**
     * Produces a stable string fingerprint for the given model data.
     * For <optgroup>, includes the label and a pipe-joined hash of its child options
     * (value:text:selected). For plain <option>, includes its value, text, and selected state.
     * The entire list is joined by '\n\n' to form the final fingerprint.
     *
     * @param {Array<HTMLOptionElement|HTMLOptGroupElement>} modelData - The current model data to fingerprint.
     * @returns {string} A deterministic fingerprint representing the structure and selection state.
     */
    private _createFingerprint(modelData: Array<HTMLOptionElement | HTMLOptGroupElement>): string {
        return modelData
            .map((item) => {
                if (item.tagName === "OPTGROUP") {
                    const group = item as HTMLOptGroupElement;
                    const optionsHash = Array.from(group.children)
                        .map((opt) => {
                            const o = opt as HTMLOptionElement;
                            return `${o.value}:${o.text}:${o.selected}`;
                        })
                        .join("\n");
                    return `G:${group.label}:${optionsHash}`;
                } else {
                    const oItem = item as HTMLOptionElement;
                    return `O:${oItem.value}:${oItem.text}:${oItem.selected}`;
                }
            })
            .join("\n\n");
    }

    /**
     * Builds model instances (GroupModel/OptionModel) from raw <optgroup>/<option> elements.
     * Preserves grouping relationships and returns the structured list.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - Parsed DOM elements from the source <select>.
     * @returns {Array<GroupModel|OptionModel>} - The ordered list of group and option models.
     */
    createModelResources(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): Array<GroupModel | OptionModel> {
        this._privModelList = [];
        let currentGroup: GroupModel | null = null;

        modelData.forEach((data) => {
            if (data.tagName === "OPTGROUP") {
                currentGroup = new GroupModel(this.options, data as HTMLOptGroupElement);
                this._privModelList.push(currentGroup);
            } else if (data.tagName === "OPTION") {
                const optionEl = data as HTMLOptionElement;
                const optionModel = new OptionModel(this.options, optionEl);

                const parentGroup = (optionEl as any)["__parentGroup"] as HTMLOptGroupElement | undefined;

                if (parentGroup && currentGroup && parentGroup === currentGroup.targetElement) {
                    currentGroup.addItem(optionModel);
                    optionModel.group = currentGroup;
                } else {
                    this._privModelList.push(optionModel);
                    currentGroup = null;
                }
            }
        });

        return this._privModelList;
    }

    /**
     * Replaces the current model list with new data and syncs it into the adapter,
     * then refreshes the view to reflect changes.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - New source elements to rebuild models from.
     */
    replace(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): void {
        this._lastFingerprint = null;
        this.createModelResources(modelData);

        if (this._privAdapterHandle) {
            // Adapter expects TModel[], but this manager's list is GroupModel|OptionModel.
            this._privAdapterHandle.syncFromSource(this._privModelList as unknown as TModel[]);
        }

        this.refresh();
    }

    /**
     * Requests a view refresh if an adapter has been initialized,
     * typically used after external updates to model data.
     */
    notify(): void {
        if (!this._privAdapterHandle) return;
        this.refresh();
    }

    /**
     * Initializes adapter and recycler view instances, attaches them to a container element,
     * and applies optional configuration overrides for adapter and recyclerView.
     */
    load(
        viewElement: HTMLElement,
        adapterOpt: Partial<TAdapter> = {},
        recyclerViewOpt: Partial<RecyclerViewContract<TAdapter>> = {}
    ): void {
        this._privAdapterHandle = new this._privAdapter(this._privModelList as unknown as TModel[]);
        Object.assign(this._privAdapterHandle, adapterOpt);

        this._privRecyclerViewHandle = new this._privRecyclerView(viewElement);
        this._privRecyclerViewHandle.setAdapter(this._privAdapterHandle);

        Object.assign(this._privRecyclerViewHandle, recyclerViewOpt);
    }

    /**
     * Diffs existing models against new <optgroup>/<option> data to update in place:
     * reuses existing models when possible, updates positions and group membership,
     * removes stale views, and notifies adapter and listeners about updates.
     */
    update(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): void {
        if (!this.hasRealChanges(modelData)) return;

        const oldModels = this._privModelList;
        const newModels: Array<GroupModel | OptionModel> = [];

        const oldGroupMap = new Map<string, GroupModel>();
        const oldOptionMap = new Map<string, OptionModel>();

        oldModels.forEach((model) => {
            if (model instanceof GroupModel) {
                oldGroupMap.set(model.label, model);
            } else if (model instanceof OptionModel) {
                const key = `${model.value}::${model.textContent}`;
                oldOptionMap.set(key, model);
            }
        });

        let currentGroup: GroupModel | null = null;
        let position = 0;

        modelData.forEach((data) => {
            if (data.tagName === "OPTGROUP") {
                const dataVset = data as HTMLOptGroupElement;
                const existingGroup = oldGroupMap.get(dataVset.label);

                if (existingGroup) {
                    // Label is used as key; keep original behavior.
                    const hasLabelChange = existingGroup.label !== dataVset.label;
                    if (hasLabelChange) {
                        existingGroup.update(dataVset)
                    }

                    existingGroup.position = position;
                    existingGroup.items = [];
                    currentGroup = existingGroup;

                    newModels.push(existingGroup);
                    oldGroupMap.delete(dataVset.label);
                } else {
                    currentGroup = new GroupModel(this.options, dataVset);
                    currentGroup.position = position;
                    newModels.push(currentGroup);
                }
                position++;
            } else if (data.tagName === "OPTION") {
                const dataVset = data as HTMLOptionElement;
                const key = `${dataVset.value}::${dataVset.text}`;

                const existingOption = oldOptionMap.get(key);

                if (existingOption) {
                    existingOption.update(dataVset);
                    existingOption.position = position;

                    const parentGroup = (dataVset as any)["__parentGroup"] as HTMLOptGroupElement | undefined;

                    if (parentGroup && currentGroup) {
                        currentGroup.addItem(existingOption);
                        existingOption.group = currentGroup;
                    } else {
                        existingOption.group = null;
                        newModels.push(existingOption);
                    }

                    oldOptionMap.delete(key);
                } else {
                    const newOption = new OptionModel(this.options, dataVset);
                    newOption.position = position;

                    const parentGroup = (dataVset as any)["__parentGroup"] as HTMLOptGroupElement | undefined;

                    if (parentGroup && currentGroup) {
                        currentGroup.addItem(newOption);
                        newOption.group = currentGroup;
                    } else {
                        newModels.push(newOption);
                    }
                }

                position++;
            }
        });

        oldGroupMap.forEach((removedGroup) => {
            removedGroup.view?.getView?.()?.remove?.();
        });

        oldOptionMap.forEach((removedOption) => {
            removedOption.view?.getView?.()?.remove?.();
        });

        this._privModelList = newModels;

        if (this._privAdapterHandle) {
            this._privAdapterHandle.updateData(this._privModelList as unknown as TModel[]);
        }

        this.onUpdated();
        this.refresh();
    }

    /**
     * Hook invoked after the manager completes an update or refresh cycle.
     * Override to run side effects (e.g., layout adjustments or analytics).
     */
    onUpdated(): void { }

    /**
     * Instructs the adapter to temporarily skip event handling (e.g., during batch updates).
     *
     * @param {boolean} value - True to skip events; false to restore normal behavior.
     */
    skipEvent(value: boolean): void {
        if (this._privAdapterHandle) (this._privAdapterHandle as any).isSkipEvent = value;
    }

    /**
     * Re-renders the recycler view if present and invokes the post-refresh hook.
     * No-op if the recycler view is not initialized.
     */
    refresh(): void {
        if (!this._privRecyclerViewHandle) return;
        this._privRecyclerViewHandle.refresh();
        this.onUpdated();
    }

    /**
     * Returns handles to the current resources, including the model list,
     * adapter instance, and recycler view instance.
     */
    getResources(): {
        modelList: Array<GroupModel | OptionModel>;
        adapter: TAdapter;
        recyclerView: RecyclerViewContract<TAdapter>;
    } {
        return {
            modelList: this._privModelList,
            adapter: this._privAdapterHandle,
            recyclerView: this._privRecyclerViewHandle,
        };
    }

    /**
     * Triggers the adapter's pre-change pipeline for a named event,
     * enabling observers to react before a change is applied.
     */
    triggerChanging(event_name: string): void {
        this._privAdapterHandle?.changingProp(event_name);
    }

    /**
     * Triggers the adapter's post-change pipeline for a named event,
     * notifying observers after a change has been applied.
     */
    triggerChanged(event_name: string): void {
        this._privAdapterHandle?.changeProp(event_name);
    }
}