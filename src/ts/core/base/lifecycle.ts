import { LifecycleHookContext, LifecycleHooks, LifecycleState } from "src/ts/types/core/base/lifecycle.type";

type LifecycleHookName = keyof LifecycleHooks;

/**
 * Minimal lifecycle finite-state machine (FSM) with a lightweight hook system.
 *
 * ### Responsibility
 * - Provide a **strict**, **guarded** lifecycle FSM:
 *   `NEW → INITIALIZED → MOUNTED → UPDATED → DESTROYED`
 * - Provide an in-memory hook registry to observe lifecycle transitions:
 *   `onInit`, `onMount`, `onUpdate`, `onDestroy`
 *
 * This class is designed to be extended by core primitives (Model/View/Adapter/Controller)
 * so they share consistent lifecycle semantics without coupling to any rendering runtime.
 *
 * ### FSM & Idempotency
 * - `init()` is **idempotent**: only transitions `NEW → INITIALIZED`; otherwise **no-op**.
 * - `mount()` is **guarded**: only transitions `INITIALIZED → MOUNTED`; otherwise **no-op**.
 * - `update()` is **repeatable** once mounted: allowed in `MOUNTED` and `UPDATED`.
 *   It always emits `onUpdate` and keeps state at `UPDATED`.
 * - `destroy()` is **idempotent**: once `DESTROYED`, subsequent calls are **no-op**.
 *
 * ### Hook semantics
 * - Hooks are stored in a `Set` per hook name:
 *   - de-duplicates identical callback references,
 *   - preserves insertion order for deterministic execution.
 * - Hook callbacks receive a {@link LifecycleHookContext} containing:
 *   - `state` (current state after transition),
 *   - `prevState` (state prior to the transition).
 * - Hook exceptions are caught and forwarded to {@link handleHookError},
 *   preventing a single subscriber from breaking the lifecycle flow.
 *
 * ### Memory & teardown
 * - All registered hooks are cleared on `destroy()` via {@link clearHooks}.
 * - Post-destroy calls to lifecycle methods do not emit further hooks.
 *
 * @see {@link LifecycleState}
 * @see {@link LifecycleHooks}
 * @see {@link LifecycleHookContext}
 */
export class Lifecycle {
    /**
     * Current lifecycle state.
     *
     * Starts at {@link LifecycleState.NEW} and transitions through the FSM via
     * {@link init}, {@link mount}, {@link update}, {@link destroy}.
     */
    protected state: LifecycleState = LifecycleState.NEW;

    /**
     * Registered lifecycle hooks.
     *
     * Uses a Set per hook to:
     * - Avoid duplicate registrations
     * - Preserve insertion order for deterministic execution
     *
     * @remarks
     * This map is initialized with keys for all supported hooks in the constructor.
     * Callbacks are cleared on {@link destroy}.
     */
    private hooks: Map<LifecycleHookName, Set<(ctx: LifecycleHookContext) => void>> = new Map();

    /**
     * Constructs the lifecycle manager and pre-registers hook containers.
     *
     * No hooks are executed during construction; consumers must call
     * {@link init}, {@link mount}, {@link update}, or {@link destroy}.
     */
    constructor() {
        this.hooks.set("onInit", new Set());
        this.hooks.set("onMount", new Set());
        this.hooks.set("onUpdate", new Set());
        this.hooks.set("onDestroy", new Set());
    }

    /**
     * Subscribes a callback to a lifecycle hook.
     *
     * Hook callbacks are invoked in insertion order. Duplicate callback references are ignored
     * due to Set semantics.
     *
     * @param {LifecycleHookName} hook - Hook name to subscribe to.
     * @param {(ctx: LifecycleHookContext) => void} fn - Callback invoked when the hook is emitted.
     * @returns {this} The current instance (chainable).
     */
    on(hook: LifecycleHookName, fn: (ctx: LifecycleHookContext) => void): this {
        this.hooks.get(hook)!.add(fn);
        return this;
    }

    /**
     * Unsubscribes a previously registered callback from a lifecycle hook.
     *
     * Safe to call even if the callback was never registered (no-op).
     *
     * @param {LifecycleHookName} hook - Hook name to unsubscribe from.
     * @param {(ctx: LifecycleHookContext) => void} fn - Callback to remove.
     * @returns {this} The current instance (chainable).
     */
    off(hook: LifecycleHookName, fn: (ctx: LifecycleHookContext) => void): this {
        this.hooks.get(hook)!.delete(fn);
        return this;
    }

    /**
     * Emits a lifecycle hook by executing all registered callbacks for that hook.
     *
     * Execution model:
     * - Callbacks run in insertion order.
     * - Errors thrown by callbacks are caught and forwarded to {@link handleHookError}.
     *
     * @param {LifecycleHookName} hook - The hook to emit.
     * @param {LifecycleState} prevState - The state prior to the transition.
     * @returns {void}
     *
     * @internal
     * Prefer invoking the public lifecycle methods ({@link init}, {@link mount}, {@link update}, {@link destroy})
     * which call `emit()` at the correct time and enforce FSM guards.
     */
    protected emit(hook: LifecycleHookName, prevState: LifecycleState): void {
        const ctx: LifecycleHookContext = {
            state: this.state,
            prevState,
        };

        for (const fn of this.hooks.get(hook)!) {
            try {
                fn(ctx);
            } catch (err) {
                this.handleHookError(err, hook);
            }
        }
    }

    /**
     * Handles errors thrown by lifecycle hook callbacks.
     *
     * Default behavior logs to `console.error` with a hook-scoped prefix.
     * Subclasses may override to integrate with application logging/telemetry.
     *
     * @param {unknown} error - Error thrown by a hook callback.
     * @param {LifecycleHookName} hook - Hook name during which the error occurred.
     * @returns {void}
     * @protected
     */
    protected handleHookError(error: unknown, hook: LifecycleHookName): void {
        console.error(`[Lifecycle:${hook}]`, error);
    }

    /**
     * Transitions `NEW → INITIALIZED` and emits `onInit`.
     *
     * Idempotent: **no-op** unless current state is {@link LifecycleState.NEW}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onInit}
     */
    init(): void {
        if (this.state !== LifecycleState.NEW) return;

        const prev = this.state;
        this.state = LifecycleState.INITIALIZED;
        this.emit("onInit", prev);
    }

    /**
     * Transitions `INITIALIZED → MOUNTED` and emits `onMount`.
     *
     * Guarded: **no-op** unless current state is {@link LifecycleState.INITIALIZED}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onMount}
     */
    mount(): void {
        if (this.state !== LifecycleState.INITIALIZED) return;

        const prev = this.state;
        this.state = LifecycleState.MOUNTED;
        this.emit("onMount", prev);
    }

    /**
     * Emits `onUpdate` and transitions to/keeps state `UPDATED`.
     *
     * Allowed states:
     * - `MOUNTED` → `UPDATED`
     * - `UPDATED` → `UPDATED` (repeatable updates still emit)
     *
     * Guarded: **no-op** unless current state is `MOUNTED` or `UPDATED`.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onUpdate}
     */
    update(): void {
        if (
            this.state !== LifecycleState.MOUNTED &&
            this.state !== LifecycleState.UPDATED
        ) {
            return;
        }

        const prev = this.state;
        this.state = LifecycleState.UPDATED;
        this.emit("onUpdate", prev);
    }

    /**
     * Transitions to `DESTROYED`, emits `onDestroy`, then clears all hook registrations.
     *
     * Idempotent: **no-op** if already {@link LifecycleState.DESTROYED}.
     *
     * @returns {void}
     * @see {@link LifecycleHooks.onDestroy}
     */
    destroy(): void {
        if (this.state === LifecycleState.DESTROYED) return;

        const prev = this.state;
        this.state = LifecycleState.DESTROYED;
        this.emit("onDestroy", prev);
        this.clearHooks();
    }

    /**
     * Returns the current lifecycle state.
     *
     * @returns {LifecycleState} Current FSM state.
     */
    getState(): LifecycleState {
        return this.state;
    }

    /**
     * Checks whether the lifecycle is in the specified state.
     *
     * @param {LifecycleState} state - State to compare against.
     * @returns {boolean} `true` if current state matches; otherwise `false`.
     */
    is(state: LifecycleState): boolean {
        return this.state === state;
    }

    /**
     * Clears all registered lifecycle hooks.
     *
     * Called automatically during {@link destroy}. After clearing, the hook containers remain
     * allocated (map keys persist) but contain no subscribers.
     *
     * @returns {void}
     * @private
     */
    private clearHooks(): void {
        for (const set of this.hooks.values()) {
            set.clear();
        }
    }
}