import { StoredEntry, TimerKey, TimerOptions } from "../types/utils/callback-scheduler.type";

/**
 * CallbackScheduler
 *
 * Debounced multi-callback orchestrator with per-callback independent scheduling.
 *
 * ### Responsibility
 * - Registers multiple callbacks under named keys ({@link TimerKey}).
 * - Schedules each callback with its own debounce timer (independent delays per callback).
 * - Supports "run-once" semantics via `options.once`.
 * - Batches callback execution via {@link run}, passing a shared payload to all callbacks in a key group.
 *
 * ### Scheduling strategy
 * - **Per-callback debounce**: Each registered callback has its own timer (tracked by index).
 * - **Debounce reset**: Calling {@link run} again before a callback's timeout clears its previous timer.
 * - **Async-aware**: Callbacks may return `Promise`; execution waits for resolution before cleanup.
 *
 * ### Lifecycle
 * - **{@link on}**: Registers a callback under a key (appends to bucket in registration order).
 * - **{@link run}**: Schedules all non-removed callbacks under a key with independent timers.
 * - **{@link off}** / **{@link clear}**: Cancels active timers and removes callbacks.
 *
 * ### Index stability
 * - Callbacks are stored in a sparse array (via `Array<StoredEntry | undefined>`).
 * - "Once" callbacks become `undefined` after execution but **do not shift indices**.
 * - This preserves timer bookkeeping in {@link timerRunner}.
 *
 * ### Payload semantics
 * - `run(key)` → callbacks receive `null`
 * - `run(key, ...params)` → callbacks receive `params` as an array
 *
 * ### No-op / Idempotency
 * - {@link run} with no registered callbacks returns a resolved `Promise<void>`.
 * - {@link off} and {@link clear} are safe to call multiple times (clear timers only if present).
 *
 * @class
 */
export class CallbackScheduler {
    /**
     * Sparse array storage for callbacks, keyed by {@link TimerKey}.
     *
     * Structure:
     * - Each key maps to an ordered array of {@link StoredEntry} or `undefined`.
     * - `undefined` slots indicate "once" callbacks that have already executed.
     * - Indices are never removed to preserve timer bookkeeping stability.
     *
     * @private
     */
    private executeStored = new Map<TimerKey, Array<StoredEntry | undefined>>();

    /**
     * Per-callback timer registry.
     *
     * Structure:
     * - **Outer Map**: Groups timers by {@link TimerKey}.
     * - **Inner Map**: Maps callback index → active `setTimeout` handle.
     *
     * Notes:
     * - Each callback index has its own independent debounce timer.
     * - Timers are cleared and replaced on subsequent {@link run} calls.
     * - Cleaned up during {@link off} or after "once" callback execution.
     *
     * @private
     */
    private timerRunner = new Map<
        TimerKey,
        Map<number, ReturnType<typeof setTimeout>>
    >();

    /**
     * Registers a callback under a key with optional debounce and "once" semantics.
     *
     * Behavior:
     * - Callbacks are appended to the key's bucket in registration order.
     * - Each callback receives its own debounce timer (default: `50ms`).
     * - `options.once = true` removes the callback after its first execution (slot becomes `undefined`).
     *
     * Notes:
     * - Multiple callbacks under the same key execute independently with separate timers.
     * - Registration does **not** start any timers; call {@link run} to schedule execution.
     *
     * @public
     * @param {TimerKey} key - Group identifier for callbacks.
     * @param {(payload: any[] | null) => void} callback - Function to execute after debounce timeout.
     * @param {TimerOptions} [options={}] - Scheduling options (`debounce`, `once`).
     * @returns {void}
     */
    public on(
        key: TimerKey,
        callback: (payload: any[] | null) => void,
        options: TimerOptions = {}
    ): void {
        const timeout = options.debounce ?? 50;
        const once = options.once ?? false;

        if (!this.executeStored.has(key)) this.executeStored.set(key, []);
        const bucket = this.executeStored.get(key)!;

        bucket.push({ callback, timeout, once });
    }

    /**
     * Removes all callbacks and active timers associated with a key.
     *
     * Behavior:
     * - Clears all pending timers for the key (prevents stale executions).
     * - Deletes the key's callback bucket and timer registry.
     * - Idempotent: safe to call multiple times or on non-existent keys.
     *
     * @public
     * @param {TimerKey} key - Key whose callbacks and timers will be removed.
     * @returns {void}
     */
    public off(key: TimerKey): void {
        const runner = this.timerRunner.get(key);
        if (runner) {
            for (const t of runner.values()) clearTimeout(t);
            runner.clear();
            this.timerRunner.delete(key);
        }

        this.executeStored.delete(key);
    }

    /**
     * Schedules execution for all registered callbacks under a key.
     *
     * Scheduling rules:
     * - Each callback runs after its own debounce delay (independent timers per index).
     * - Calling `run()` again before a callback's timeout **clears and resets** that timer.
     * - Callbacks receive a shared payload derived from `params`.
     *
     * Payload semantics:
     * - `run(key)` → callbacks receive `null`
     * - `run(key, ...params)` → callbacks receive `params` as an array
     *
     * "Once" callbacks:
     * - After execution, entries with `once = true` are set to `undefined` (index preserved).
     * - Their timers are deleted from {@link timerRunner}.
     *
     * Async handling:
     * - If a callback returns a `Promise`, execution waits for resolution before cleanup.
     * - Errors are silently caught (empty `catch` block).
     *
     * Return value:
     * - Returns a `Promise<void>` that resolves when all scheduled callbacks complete.
     * - If no callbacks are registered, returns an immediately resolved `Promise<void>`.
     *
     * @public
     * @param {TimerKey} key - Key whose callbacks will be scheduled.
     * @param {...any[]} params - Parameters passed as a shared payload to all callbacks.
     * @returns {Promise<void>} Promise resolving when all callbacks finish execution.
     */
    public run<T extends Promise<void>>(key: TimerKey, ...params: any[]): T {
        const executes = this.executeStored.get(key);
        if (!executes || executes.length === 0) {
            return Promise.resolve() as T;
        }

        if (!this.timerRunner.has(key)) {
            this.timerRunner.set(key, new Map());
        }

        const runner = this.timerRunner.get(key)!;
        const tasks: Promise<void>[] = [];

        for (let i = 0; i < executes.length; i++) {
            const entry = executes[i];
            if (!entry) continue;

            const prev = runner.get(i);
            if (prev) clearTimeout(prev);

            const task = new Promise<void>((resolve) => {
                const timer = setTimeout(async () => {
                    try {
                        const resp = entry.callback(
                            params.length > 0 ? params : null
                        ) as any;

                        if (resp instanceof Promise) {
                            await resp;
                        }
                    } catch {} finally {
                        if (entry.once) {
                            executes[i] = undefined;

                            const current = runner.get(i);
                            if (current) clearTimeout(current);
                            runner.delete(i);
                        }

                        resolve();
                    }
                }, entry.timeout);

                runner.set(i, timer);
            });

            tasks.push(task);
        }

        return Promise.all(tasks).then(() => void 0) as T;
    }

    /**
     * Clears callbacks and timers for a specific key or all keys.
     *
     * Behavior:
     * - **With `key`**: Delegates to {@link off} (clears only that key).
     * - **Without `key`**: Clears all keys by iterating over a snapshot of {@link executeStored}.
     *
     * Notes:
     * - Uses a snapshot (`Array.from(...)`) to avoid mutation issues during iteration.
     * - Idempotent: safe to call multiple times.
     *
     * @public
     * @param {TimerKey} [key] - When provided, clears only that key; otherwise clears all keys.
     * @returns {void}
     */
    public clear(key?: TimerKey): void {
        if (key !== undefined) {
            this.off(key);
            return;
        }

        // Iterate over a snapshot of keys because `off()` mutates the maps.
        for (const k of Array.from(this.executeStored.keys())) {
            this.off(k);
        }
    }
}