import { TimerKey, TimerOptions } from "../types/utils/callback-scheduler.type";

/**
 * Internal representation of a scheduled callback.
 *
 * - `timeout`: delay in milliseconds before executing the callback.
 * - `once`: when true, the callback is removed after its first execution.
 * - `callback`: receives a single payload argument:
 *    - `any[]` when `run()` is called with parameters
 *    - `null` when `run()` is called without parameters
 */
type StoredEntry = {
    callback: (payload: any[] | null) => void;
    timeout: number;
    once: boolean;
};

export class CallbackScheduler {
    /**
     * Stores callbacks by key in registration order.
     *
     * Notes:
     * - Entries may become `undefined` after execution when `once` is enabled.
     *   This preserves indices so timer bookkeeping remains stable.
     */
    private executeStored = new Map<TimerKey, Array<StoredEntry | undefined>>();

    /**
     * Per-key timer registry.
     *
     * - Outer Map: groups timers by `TimerKey`
     * - Inner Map: maps callback index -> active timeout handle
     *
     * Each callback index has its own debounce timer, allowing independent scheduling.
     */
    private timerRunner = new Map<
        TimerKey,
        Map<number, ReturnType<typeof setTimeout>>
    >();

    /**
     * Registers a callback under a key.
     *
     * @param key - Group identifier for callbacks.
     * @param callback - Function to execute after the debounce timeout.
     * @param options - Scheduling options.
     * @returns The index of the registered callback within its key bucket.
     *
     * Behavior:
     * - Callbacks are stored in registration order.
     * - `options.debounce` is treated as a per-callback delay (milliseconds).
     * - `options.once` removes the entry after its first execution (index is preserved).
     */
    on(
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
     * Removes all callbacks associated with a key and clears any active timers.
     *
     * @param key - Key whose callbacks and timers will be removed.
     */
    off(key: TimerKey): void {
        const runner = this.timerRunner.get(key);
        if (runner) {
            for (const t of runner.values()) clearTimeout(t);
            runner.clear();
            this.timerRunner.delete(key);
        }

        this.executeStored.delete(key);
    }

    /**
     * Schedules execution for all callbacks registered under a key.
     *
     * @param key - Key whose callbacks will be scheduled.
     * @param params - Parameters collected and passed as a single payload.
     *
     * Payload rules:
     * - If `run(key)` is called without params, callbacks receive `null`.
     * - If `run(key, ...params)` is called with params, callbacks receive `params` as an array.
     *
     * Debounce rules:
     * - Each callback has its own timer (by index).
     * - Calling `run()` again before the timeout clears the previous timer for that callback.
     *
     * Once rules:
     * - If an entry has `once = true`, it is removed after execution by setting its slot to `undefined`.
     *   (The list is not spliced to preserve indices.)
     */
    run(key: TimerKey, ...params: any[]): void {
        const executes = this.executeStored.get(key);
        if (!executes) return;

        if (!this.timerRunner.has(key)) this.timerRunner.set(key, new Map());
        const runner = this.timerRunner.get(key)!;

        for (let i = 0; i < executes.length; i++) {
            const entry = executes[i];
            if (!entry) continue;

            const prev = runner.get(i);
            if (prev) clearTimeout(prev);

            const timer = setTimeout(() => {
                entry.callback(params.length > 0 ? params : null);

                if (entry.once) {
                    // Preserve index stability by leaving an empty slot.
                    executes[i] = undefined;

                    // Cleanup the timer handle for this index.
                    const current = runner.get(i);
                    if (current) clearTimeout(current);
                    runner.delete(i);
                }
            }, entry.timeout);

            runner.set(i, timer);
        }
    }

    /**
     * Clears callbacks and timers.
     *
     * @param key - When provided, clears only that key; otherwise clears all keys.
     */
    clear(key?: TimerKey): void {
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
