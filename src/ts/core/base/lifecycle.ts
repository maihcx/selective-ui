
import { LifecycleHookContext, LifecycleHooks, LifecycleState } from "src/ts/types/core/base/lifecycle.type";

type LifecycleHookName = keyof LifecycleHooks;

/**
 * Lightweight lifecycle manager that provides:
 * - A finite-state lifecycle machine (`NEW` → `INITIALIZED` → `MOUNTED` → `UPDATED` → `DESTROYED`)
 * - A simple hooks system to subscribe to lifecycle events (`onInit`, `onMount`, `onUpdate`, `onDestroy`)
 *
 * Classes in the core (e.g., Model/View) can extend this to standardize initialization,
 * mounting, updates, and teardown. Hooks are stored as in-memory callbacks and cleared on destroy.
 */
export class Lifecycle {
    /** Current lifecycle state */
    protected state: LifecycleState = LifecycleState.NEW;

    /**
     * Registered lifecycle hooks.
     *
     * Uses a Set per hook to:
     * - Avoid duplicate registrations
     * - Preserve insertion order for deterministic execution
     */
    private hooks: Map<LifecycleHookName, Set<(ctx: LifecycleHookContext) => void>> = new Map();

    /**
     * Constructs the lifecycle manager and pre-registers hook containers.
     * No hooks are executed during construction.
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
     * @param hook - The lifecycle hook name to listen to
     * @param fn - The callback to execute when the hook is emitted
     * @returns `this` for chaining
     */
    on(hook: LifecycleHookName, fn: (ctx: LifecycleHookContext) => void): this {
        this.hooks.get(hook)!.add(fn);
        return this;
    }

    /**
     * Unsubscribes a previously registered callback from a lifecycle hook.
     *
     * @param hook - The lifecycle hook name
     * @param fn - The callback to remove
     * @returns `this` for chaining
     */
    off(hook: LifecycleHookName, fn: (ctx: LifecycleHookContext) => void): this {
        this.hooks.get(hook)!.delete(fn);
        return this;
    }

    /**
     * Emits a lifecycle hook, executing all registered callbacks
     * in the order they were added.
     *
     * @param hook - The lifecycle hook to emit
     * @internal Prefer using the public lifecycle methods (`init/mount/update/destroy`)
     *           which call `emit` at the correct times.
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

    protected handleHookError(error: unknown, hook: LifecycleHookName): void {
        console.error(`[Lifecycle:${hook}]`, error);
    }

    /**
     * Transitions from `NEW` → `INITIALIZED` and emits `onInit`.
     *
     * Safe to call multiple times; subsequent calls are no-ops unless current state is `NEW`.
     */
    init(): void {
        if (this.state !== LifecycleState.NEW) return;

        const prev = this.state;
        this.state = LifecycleState.INITIALIZED;
        this.emit("onInit", prev);
    }

    /**
     * Transitions from `INITIALIZED` → `MOUNTED` and emits `onMount`.
     *
     * No-ops if current state is not `INITIALIZED` (guards against invalid order).
     */
    mount(): void {
        if (this.state !== LifecycleState.INITIALIZED) return;

        const prev = this.state;
        this.state = LifecycleState.MOUNTED;
        this.emit("onMount", prev);
    }

    /**
     * Transitions from `MOUNTED` → `UPDATED` and emits `onUpdate`.
     *
     * No-ops if not currently `MOUNTED`. Subsequent `update()` calls will keep the state
     * at `UPDATED` while still emitting `onUpdate`.
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
     * Transitions to `DESTROYED` and emits `onDestroy`, then clears all hooks.
     *
     * Idempotent: calling `destroy()` multiple times after destruction has no effect.
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
     */
    getState(): LifecycleState {
        return this.state;
    }

    /**
     * Checks if the lifecycle is in the specified state.
     *
     * @param state - The state to compare against
     * @returns True if the current state matches; otherwise false
     */
    is(state: LifecycleState): boolean {
        return this.state === state;
    }

    /**
     * Clears all registered lifecycle hooks.
     *
     * Called automatically during `destroy()`.
     */
    private clearHooks(): void {
        for (const set of this.hooks.values()) {
            set.clear();
        }
    }
}