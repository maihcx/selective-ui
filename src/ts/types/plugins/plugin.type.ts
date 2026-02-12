import { SelectBox } from "../../components/selectbox";
import { SelectBoxAction, SelectBoxTags } from "../components/searchbox.type";
import { AdapterContract } from "../core/base/adapter.type";
import { RecyclerViewContract } from "../core/base/recyclerview.type";
import { SelectiveOptions } from "../utils/selective.type";

/**
 * Runtime context passed to plugin hooks.
 */
export interface PluginContext<TTags extends Record<string, HTMLElement>> {
    selectBox: SelectBox;
    options: SelectiveOptions;
    adapter: AdapterContract<any> | null;
    recycler: RecyclerViewContract<AdapterContract<any>> | null;
    viewTags: TTags & { id: string };
    actions: SelectBoxAction;
}

/**
 * Plugin contract for extending Selective lifecycle behavior.
 */
export interface SelectivePlugin {
    /** Unique plugin identifier. */
    id: string;

    /** Initialization hook invoked during plugin setup. */
    init?(context?: PluginContext<SelectBoxTags>): void;

    /** Teardown hook invoked when plugin is destroyed. */
    destroy?(context?: PluginContext<SelectBoxTags>): void;

    /** Alias for destroy hook, invoked during global teardown. */
    onDestroy?(context?: PluginContext<SelectBoxTags>): void;

    /** Hook invoked when a SelectBox is bound. */
    onBind?(context?: PluginContext<SelectBoxTags>): void;

    /** Hook invoked when a SelectBox is opened. */
    onOpen?(context?: PluginContext<SelectBoxTags>): void;

    /** Hook invoked when a SelectBox is closed. */
    onClose?(context?: PluginContext<SelectBoxTags>): void;

    /** Hook invoked when selection changes. */
    onChange?(context?: PluginContext<SelectBoxTags>, ...args: unknown[]): void;
}
