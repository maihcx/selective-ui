
/**
 * Enumerates the finite lifecycle states used across core classes (e.g., View/Model).
 *
 * State flow (happy path):
 * NEW → INITIALIZED → MOUNTED → UPDATED → DESTROYED
 *
 * Notes:
 * - `UPDATED` may be emitted multiple times after mount, depending on implementation.
 * - `DESTROYED` is terminal; no further transitions should occur.
 */
export enum LifecycleState {
    /** The instance has been created but not initialized. */
    NEW = "new",

    /** Initialization logic has completed; ready to be mounted. */
    INITIALIZED = "initialized",

    /** The instance is mounted/attached to its environment (e.g., DOM). */
    MOUNTED = "mounted",

    /**
     * The instance has been updated at least once after being mounted.
     * Further updates typically keep the state at UPDATED.
     */
    UPDATED = "updated",

    /** Teardown has run; resources/hooks have been released. */
    DESTROYED = "destroyed",
}

/**
 * Optional callbacks for lifecycle events.
 *
 * Implementers can subscribe to these hooks either by:
 * - passing these functions to a contract that consumes `LifecycleHooks`, or
 * - using the `Lifecycle.on(hook, fn)` API at runtime.
 *
 * Each callback is executed without arguments and should be side-effect free
 * except for logic relevant to the lifecycle step.
 */
export interface LifecycleHooks {
    /** Invoked when transitioning from `NEW` → `INITIALIZED`. */
    onInit?(): void;

    /** Invoked when transitioning from `INITIALIZED` → `MOUNTED`. */
    onMount?(): void;

    /**
     * Invoked when transitioning to `UPDATED`.
     * May be emitted multiple times after the instance is mounted.
     */
    onUpdate?(): void;

    /** Invoked when transitioning to `DESTROYED`. Should be idempotent. */
    onDestroy?(): void;
}

export type LifecycleHookContext = {
    state: LifecycleState;
    prevState: LifecycleState;
};