import { GroupModel } from "../models/group-model";
import { OptionModel } from "../models/option-model";
import { LifecycleState } from "../types/core/base/lifecycle.type";
import { MixedItem } from "../types/core/base/mixed-adapter.type";
import { ModelContract } from "../types/core/base/model.type";
import { RecyclerViewContract } from "../types/core/base/recyclerview.type";
import { ViewContract } from "../types/core/base/view.type";
import { SelectiveOptions } from "../types/utils/selective.type";
import { Adapter } from "./base/adapter";
import { Lifecycle } from "./base/lifecycle";

/**
 * Headless orchestrator for model creation/reconciliation and wiring of the view layer.
 *
 * ### Responsibilities
 * - Build and maintain an ordered list of models ({@link GroupModel} / {@link OptionModel})
 *   from raw `<optgroup>` / `<option>` elements.
 * - Own the {@link Adapter} and {@link RecyclerViewContract} instances and propagate updates/refreshes.
 * - Provide a small event pipeline surface by delegating to adapter pre-/post-change hooks.
 *
 * **Lifecycle (Strict FSM)**
 * - `NEW` → `INITIALIZED` (via constructor which calls `init()`).
 * - `MOUNTED` is entered automatically on the first `createModelResources()` when state is `INITIALIZED`.
 * - Subsequent calls to `refresh()`/`updateModel()` drive the `UPDATED` phase.
 * - `DESTROYED` releases resources; further calls become **no-ops** where specified.
 *
 * **Idempotency / No-ops**
 * - `createModelResources()` recreates the internal list deterministically for the given input.
 * - `notify()`/`refresh()` are **no-ops** if required handles are not initialized.
 * - `destroy()` is idempotent once the object is `DESTROYED`.
 *
 * **Relationships**
 * - Consumes raw DOM-derived inputs, produces {@link GroupModel}/{@link OptionModel}.
 * - Feeds the models into an {@link Adapter} which is set on a {@link RecyclerViewContract}.
 * - Does not touch DOM directly; DOM side-effects are handled by the recycler view/renderer.
 *
 * **Events / Hooks**
 * - Exposes `triggerChanging()` and `triggerChanged()` which delegate to adapter pipelines
 *   (`Adapter#changingProp`, `Adapter#changeProp`) for external observers.
 * - Uses `skipEvent()` to temporarily suppress adapter event propagation (internal batch updates).
 *
 * @template TModel extends ModelContract<any, any> - Concrete model type used by the adapter.
 * @template TAdapter extends Adapter<TModel, ViewContract<any>> - Concrete adapter that consumes the models.
 * @extends Lifecycle
 * @see {@link Adapter}
 * @see {@link RecyclerViewContract}
 * @see {@link GroupModel}
 * @see {@link OptionModel}
 * @see {@link Lifecycle}
 */
export class ModelManager<
    TModel extends ModelContract<any, any>,
    TAdapter extends Adapter<TModel, ViewContract<any>>
> extends Lifecycle {
    private privModelList: Array<MixedItem> = [];

    private privAdapter!: new (...args: any[]) => TAdapter;

    private privAdapterHandle: TAdapter | null = null;

    private privRecyclerView!: new (...args: any[]) => RecyclerViewContract<TAdapter>;

    private privRecyclerViewHandle: RecyclerViewContract<TAdapter> | null = null;

    private options: SelectiveOptions = null;

    private oldPosition = 0;

    /**
     * Constructs a ModelManager with configuration options used by created models and components.
     * Transitions lifecycle `NEW → INITIALIZED` via {@link Lifecycle.init}.
     *
     * @param {SelectiveOptions} options - Configuration object passed to {@link GroupModel}/{@link OptionModel}
     * and to view infrastructure through adapter/recycler.
     */
    public constructor(options: SelectiveOptions) {
        super();
        this.options = options;
        this.init();
    }

    /**
     * Registers the adapter class to be used for rendering and managing models.
     * Must be called before {@link load}.
     *
     * @param {new (...args: any[]) => TAdapter} adapter - The adapter constructor (class) to instantiate.
     * @returns {void}
     */
    public setupAdapter(adapter: new (...args: any[]) => TAdapter): void {
        this.privAdapter = adapter;
    }

    /**
     * Registers the RecyclerView class responsible for hosting and updating item views.
     * Must be called before {@link load}.
     *
     * @param {new (...args: any[]) => RecyclerViewContract<TAdapter>} recyclerView - The recycler view constructor.
     * @returns {void}
     */
    public setupRecyclerView(recyclerView: new (...args: any[]) => RecyclerViewContract<TAdapter>): void {
        this.privRecyclerView = recyclerView;
    }

    /**
     * Builds model instances ({@link GroupModel}/{@link OptionModel}) from raw `<optgroup>`/`<option>` elements.
     * Preserves grouping relationships and returns the structured list.
     *
     * **Behavior**
     * - When called while state is `INITIALIZED`, this method performs a one-time `mount()` (auto-mount).
     * - Uses a simple in-order traversal; the current group is the last seen `<optgroup>`.
     * - For options, the parent is inferred via `__parentGroup` identity when available.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - Parsed DOM elements from the source `<select>`.
     * @returns {Array<GroupModel | OptionModel>} The ordered list of group and option models.
     */
    public createModelResources(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): Array<GroupModel | OptionModel> {
        if (this.is(LifecycleState.INITIALIZED)) {
            this.mount();
        }

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
     * **Notes**
     * - If the adapter is not yet initialized, syncing is skipped (safe no-op).
     * - After sync, calls {@link refresh} with `isUpdate = false`.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - New source elements to rebuild models from.
     * @returns {Promise<void>} Resolves when the adapter (if any) completes syncing.
     * @see Adapter#syncFromSource
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
     * **No-op** if the adapter is absent.
     *
     * @returns {void}
     */
    public notify(): void {
        if (!this.privAdapterHandle) return;
        this.refresh(false);
    }

    /**
     * Initializes adapter and recycler view instances, attaches them to a container element,
     * and applies optional configuration overrides for adapter and recyclerView (via `Object.assign`).
     *
     * **Requirements**
     * - Call {@link setupAdapter} and {@link setupRecyclerView} beforehand to provide constructors.
     * - The current `privModelList` becomes the initial dataset for the adapter.
     *
     * **Side effects**
     * - Sets the adapter on the recycler via `recycler.setAdapter(adapter)`.
     *
     * @template TExtra extends object
     * @param {HTMLElement} viewElement - Host element for the recycler view.
     * @param {Partial<TAdapter>} [adapterOpt={}] - Shallow overrides applied to the adapter instance.
     * @param {Partial<RecyclerViewContract<TAdapter>> & TExtra} [recyclerViewOpt={}] - Shallow overrides applied to the recycler instance.
     * @returns {void}
     * @see RecyclerViewContract#setAdapter
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
     * Diffs existing models against new `<optgroup>`/`<option>` data to update in place:
     * reuses existing models when possible, updates positions and group membership,
     * removes stale views, and notifies adapter and listeners about updates.
     *
     * **Diffing strategy**
     * - Groups are keyed by `label`.
     * - Options are keyed by `${value}::${text}`.
     * - Removed groups/options are destroyed.
     * - Per-item `position` is recomputed sequentially.
     *
     * **Refresh semantics**
     * - Computes `isUpdate`: `false` on the first run and when removals occur; `true` otherwise.
     * - Calls `adapter.updateData()` and then {@link refresh} with the computed flag.
     *
     * @param {Array<HTMLOptGroupElement | HTMLOptionElement>} modelData - Source elements to reconcile against.
     * @returns {void}
     * @see Adapter#updateData
     */
    public updateModel(modelData: Array<HTMLOptGroupElement | HTMLOptionElement>): void {
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

        this.refresh(isUpdate);
    }

    /**
     * Instructs the adapter to temporarily skip event handling (e.g., during batch updates).
     *
     * @param {boolean} value - `true` to skip events; `false` to restore normal behavior.
     * @returns {void}
     */
    public skipEvent(value: boolean): void {
        if (this.privAdapterHandle) this.privAdapterHandle.isSkipEvent = value;
    }

    /**
     * Re-renders the recycler view if present and invokes the lifecycle update hook.
     * **No-op** if the recycler view is not initialized.
     *
     * @param {boolean} isUpdate - Indicates if this refresh follows an "update" operation (vs. full replace).
     * @returns {void}
     * @see Lifecycle#update
     */
    public refresh(isUpdate: boolean): void {
        if (!this.privRecyclerViewHandle) return;
        this.privRecyclerViewHandle.refresh(isUpdate);
        this.update();
    }

    /**
     * Releases adapter and recycler resources and clears all references.
     * Transitions to `DESTROYED`; subsequent calls are idempotent.
     *
     * **Important**
     * - Assumes handles were created via {@link load}; calling `destroy()` before `load()` may depend
     *   on the underlying implementations' null-tolerance.
     *
     * @returns {void}
     */
    public override destroy(): void {
        if (this.is(LifecycleState.DESTROYED)) {
            return;
        }

        this.privAdapterHandle.destroy();
        this.privRecyclerViewHandle.destroy();

        this.privModelList = [];
        this.privAdapter = null;
        this.privAdapterHandle = null;
        this.privRecyclerView = null;
        this.privRecyclerViewHandle = null;
        this.options = null;
        this.oldPosition = 0;

        super.destroy();
    }

    /**
     * Returns handles to the current resources, including the model list,
     * adapter instance, and recycler view instance.
     *
     * **Note**: The returned `adapter`/`recyclerView` may be `null` at runtime if {@link load} has not been called.
     *
     * @returns {{ modelList: Array<MixedItem>; adapter: TAdapter; recyclerView: RecyclerViewContract<TAdapter>; }}
     * The current resource references.
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
     *
     * **Delegates** to {@link Adapter.changingProp}.
     *
     * @param {string} event_name - Logical event name (consumer-defined).
     * @returns {Promise<void> | undefined} The adapter's promise, or `undefined` if the adapter is not initialized.
     * @fires changing
     */
    public triggerChanging(event_name: string): Promise<void> {
        return this.privAdapterHandle?.changingProp(event_name);
    }

    /**
     * Triggers the adapter's post-change pipeline for a named event,
     * notifying observers after a change has been applied.
     *
     * **Delegates** to {@link Adapter.changeProp}.
     *
     * @param {string} event_name - Logical event name (consumer-defined).
     * @returns {Promise<void> | undefined} The adapter's promise, or `undefined` if the adapter is not initialized.
     * @fires changed
     */
    public triggerChanged(event_name: string): Promise<void> {
        return this.privAdapterHandle?.changeProp(event_name);
    }
}