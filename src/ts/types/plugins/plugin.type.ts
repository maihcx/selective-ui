import { SelectBox } from "../../components/selectbox";
import { AdapterContract } from "../core/base/adapter.type";
import { RecyclerViewContract } from "../core/base/recyclerview.type";
import { SelectiveActionApi, SelectiveOptions } from "../utils/selective.type";

/**
 * Runtime context passed to plugin hooks.
 */
export interface PluginContext {
    selectBox: SelectBox;
    options: SelectiveOptions;
    adapter: AdapterContract<any> | null;
    recycler: RecyclerViewContract<AdapterContract<any>> | null;
    viewTags: Record<string, HTMLElement | null>;
    actions: SelectiveActionApi | null;
}

/**
 * Plugin contract for extending Selective lifecycle behavior.
 */
export interface SelectivePlugin {
    /** Unique plugin identifier. */
    id: string;

    /** Initialization hook invoked during plugin setup. */
    init?(context?: PluginContext): void;

    /** Teardown hook invoked when plugin is destroyed. */
    destroy?(context?: PluginContext): void;

    /** Alias for destroy hook, invoked during global teardown. */
    onDestroy?(context?: PluginContext): void;

    /** Hook invoked when a SelectBox is bound. */
    onBind?(context?: PluginContext): void;

    /** Hook invoked when a SelectBox is opened. */
    onOpen?(context?: PluginContext): void;

    /** Hook invoked when a SelectBox is closed. */
    onClose?(context?: PluginContext): void;

    /** Hook invoked when selection changes. */
    onChange?(context?: PluginContext, ...args: unknown[]): void;
}
