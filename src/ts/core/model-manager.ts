
import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { ModelContract } from "../types/core/base/model.type";
import { RecyclerViewContract } from "../types/core/base/recyclerview.type";
import { ViewContract } from "../types/core/base/view.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Adapter } from "./base/adapter";

/**
 * @template TModel
 * @template TAdapter
 */
export class ModelManager<
    TModel extends ModelContract<any, any>,
    TAdapter extends Adapter<TModel, ViewContract<any>>
> {
    private privModelList: Array<GroupModel | OptionModel> = [];

    private privAdapter!: new (...args: any[]) => TAdapter;

    private privAdapterHandle: TAdapter | null = null;

    private privRecyclerView!: new (...args: any[]) => RecyclerViewContract<TAdapter>;

    private privRecyclerViewHandle: RecyclerViewContract<TAdapter> | null = null;

    private options: SelectiveOptions = null;

    private oldPosition = 0;

    /**
     * Constructs a ModelManager with configuration options used by created models and components.
     *
     * @param {object} options - Configuration object passed to GroupModel/OptionModel and view infrastructure.
     */
    public constructor(options: SelectiveOptions) {
        this.options = options;
    }

    /**
     * Registers the adapter class to be used for rendering and managing models.
     *
     * @param {new TAdapter} adapter - The adapter constructor (class) to instantiate.
     */
    public setupAdapter(adapter: new (...args: any[]) => TAdapter): void {
        this.privAdapter = adapter;
    }

    /**
     * Registers the RecyclerView class responsible for hosting and updating item views.
     *
     * @param {new RecyclerViewContract<TAdapter>} recyclerView - The recycler view constructor.
     */
    public setupRecyclerView(recyclerView: new (...args: any[]) => RecyclerViewContract<TAdapter>): void {
        this.privRecyclerView = recyclerView;
    }

    /**
     * Builds model instances (GroupModel/OptionModel) from raw <optgroup>/<option> elements.
     * Preserves grouping relationships and returns the structured list.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - Parsed DOM elements from the source <select>.
     * @returns {Array<GroupModel|OptionModel>} - The ordered list of group and option models.
     */
    public createModelResources(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): Array<GroupModel | OptionModel> {
        this.privModelList = [];
        let currentGroup: GroupModel | null = null;

        modelData.forEach((data) => {
            if (data.tagName === "OPTGROUP") {
                currentGroup = new GroupModel(this.options, data as HTMLOptGroupElement);
                this.privModelList.push(currentGroup);
            } else if (data.tagName === "OPTION") {
                const optionEl = data as HTMLOptionElement;
                const optionModel = new OptionModel(this.options, optionEl);

                const parentGroup = optionEl["__parentGroup"] as HTMLOptGroupElement | undefined;

                if (parentGroup && currentGroup && parentGroup === currentGroup.targetElement) {
                    currentGroup.addItem(optionModel);
                    optionModel.group = currentGroup;
                } else {
                    this.privModelList.push(optionModel);
                    currentGroup = null;
                }
            }
        });

        return this.privModelList;
    }

    /**
     * Replaces the current model list with new data and syncs it into the adapter,
     * then refreshes the view to reflect changes.
     *
     * @param {Array<HTMLOptGroupElement|HTMLOptionElement>} modelData - New source elements to rebuild models from.
     */
    public async replace(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): Promise<void> {
        this.createModelResources(modelData);

        if (this.privAdapterHandle) {
            // Adapter expects TModel[], but this manager's list is GroupModel|OptionModel.
            await this.privAdapterHandle.syncFromSource(this.privModelList as unknown as TModel[]);
        }

        this.refresh(false);
    }

    /**
     * Requests a view refresh if an adapter has been initialized,
     * typically used after external updates to model data.
     */
    public notify(): void {
        if (!this.privAdapterHandle) return;
        this.refresh(false);
    }

    /**
     * Initializes adapter and recycler view instances, attaches them to a container element,
     * and applies optional configuration overrides for adapter and recyclerView.
     */
    
    public load<TExtra extends object = {}>(
        viewElement: HTMLElement,
        adapterOpt: Partial<TAdapter> = {},
        recyclerViewOpt: Partial<RecyclerViewContract<TAdapter>> & TExtra = {} as any
    ): void {

        this.privAdapterHandle = new this.privAdapter(this.privModelList as unknown as TModel[]);
        Object.assign(this.privAdapterHandle, adapterOpt);

        this.privRecyclerViewHandle = new this.privRecyclerView(viewElement);
        Object.assign(this.privRecyclerViewHandle, recyclerViewOpt);

        this.privRecyclerViewHandle.setAdapter(this.privAdapterHandle);
    }

    /**
     * Diffs existing models against new <optgroup>/<option> data to update in place:
     * reuses existing models when possible, updates positions and group membership,
     * removes stale views, and notifies adapter and listeners about updates.
     */
    public update(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): void {
        const oldModels = this.privModelList;
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
                        existingGroup.updateTarget(dataVset)
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
                    existingOption.updateTarget(dataVset);
                    existingOption.position = position;

                    const parentGroup = dataVset["__parentGroup"] as HTMLOptGroupElement | undefined;

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

                    const parentGroup = dataVset["__parentGroup"] as HTMLOptGroupElement | undefined;

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

        let isUpdate = true;
        if (this.oldPosition == 0) {
            isUpdate = false;
        }
        this.oldPosition = position;

        oldGroupMap.forEach((removedGroup) => {
            isUpdate = false;
            removedGroup.destroy();
        });

        oldOptionMap.forEach((removedOption) => {
            isUpdate = false;
            removedOption.destroy();
        });

        this.privModelList = newModels;

        if (this.privAdapterHandle) {
            this.privAdapterHandle.updateData(this.privModelList as unknown as TModel[]);
        }

        // this.onUpdated();
        this.refresh(isUpdate);
    }

    /**
     * Hook invoked after the manager completes an update or refresh cycle.
     * Override to run side effects (e.g., layout adjustments or analytics).
     */
    public onUpdated(): void { }

    /**
     * Instructs the adapter to temporarily skip event handling (e.g., during batch updates).
     *
     * @param {boolean} value - True to skip events; false to restore normal behavior.
     */
    public skipEvent(value: boolean): void {
        if (this.privAdapterHandle) this.privAdapterHandle.isSkipEvent = value;
    }

    /**
     * Re-renders the recycler view if present and invokes the post-refresh hook.
     * No-op if the recycler view is not initialized.
     * 
     * @param isUpdate - Indicates if this refresh is due to an update operation.
     */
    public refresh(isUpdate: boolean): void {
        if (!this.privRecyclerViewHandle) return;
        this.privRecyclerViewHandle.refresh(isUpdate);
        this.onUpdated();
    }

    /**
     * Returns handles to the current resources, including the model list,
     * adapter instance, and recycler view instance.
     */
    public getResources(): {
        modelList: Array<MixedItem>;
        adapter: TAdapter;
        recyclerView: RecyclerViewContract<TAdapter>;
    } {
        return {
            modelList: this.privModelList,
            adapter: this.privAdapterHandle,
            recyclerView: this.privRecyclerViewHandle,
        };
    }

    /**
     * Triggers the adapter's pre-change pipeline for a named event,
     * enabling observers to react before a change is applied.
     */
    public triggerChanging(event_name: string): Promise<void> {
        return this.privAdapterHandle?.changingProp(event_name);
    }

    /**
     * Triggers the adapter's post-change pipeline for a named event,
     * notifying observers after a change has been applied.
     */
    public triggerChanged(event_name: string): Promise<void> {
        return this.privAdapterHandle?.changeProp(event_name);
    }
}