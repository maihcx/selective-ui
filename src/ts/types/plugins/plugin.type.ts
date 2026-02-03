import type { SelectBox } from "../../components/selectbox";
import type { SelectBoxAction, SelectBoxTags } from "../components/searchbox.type";
import type { AdapterContract } from "../core/base/adapter.type";
import type { RecyclerViewContract } from "../core/base/recyclerview.type";
import type { SelectiveOptions } from "../utils/selective.type";
import type { MixedItem } from "../core/base/mixed-adapter.type";

/**
 * Context object passed to Selective plugins.
 *
 * Provides access to core Selective runtime resources for integrations/extensions.
 */
export interface PluginContext {
    selectBox: SelectBox;
    options: SelectiveOptions;
    adapter?: AdapterContract<any> | null;
    recycler?: RecyclerViewContract<AdapterContract<any>> | null;
    viewTags?: SelectBoxTags | null;
    actions?: SelectBoxAction | null;
    [key: string]: unknown;
}

/**
 * Selective plugin contract.
 *
 * Plugins can hook into Selective lifecycle moments and UI events.
 */
export interface SelectivePlugin {
    id: string;
    init?(ctx: PluginContext): void;
    destroy?(): void;
    onBind?(ctx: PluginContext): void;
    onDestroy?(ctx: PluginContext): void;
    onOpen?(ctx: PluginContext): void;
    onClose?(ctx: PluginContext): void;
    onChange?(value: unknown, models: Array<MixedItem>, adapter: AdapterContract<any> | null, ctx: PluginContext): void;
}
