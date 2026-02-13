/**
 * @jest-environment jsdom
 *
 * Unit tests for SelectObserver (src/ts/services/select-observer.ts)
 *
 * Focus:
 * - connect() observes correct mutation config
 * - debounce (50ms): multiple mutations -> single onChanged
 * - disconnect() clears pending debounce + disconnects observer
 * - disconnect() idempotency
 */

import { SelectObserver } from "../../../src/ts/services/select-observer";

describe("SelectObserver", () => {
    let originalMutationObserver: typeof MutationObserver | undefined;

    // capture internals of our mocked MutationObserver
    let observeSpy: jest.Mock;
    let disconnectSpy: jest.Mock;
    let mutationCallback: ((mutations: MutationRecord[]) => void) | null;

    beforeEach(() => {
        jest.useFakeTimers();

        originalMutationObserver = global.MutationObserver;

        observeSpy = jest.fn();
        disconnectSpy = jest.fn();
        mutationCallback = null;

        // Mock MutationObserver to capture the callback passed to constructor
        global.MutationObserver = jest.fn(
            (cb: (mutations: MutationRecord[]) => void) => {
                mutationCallback = cb;
                return {
                    observe: observeSpy,
                    disconnect: disconnectSpy,
                    takeRecords: jest.fn(() => []),
                } as any;
            },
        ) as any;
    });

    afterEach(() => {
        global.MutationObserver =
            originalMutationObserver as typeof MutationObserver;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    function fireMutation(times = 1) {
        if (!mutationCallback)
            throw new Error("MutationObserver callback not captured");
        for (let i = 0; i < times; i++) {
            mutationCallback([] as any);
        }
    }

    test("connect() calls observer.observe with expected config", () => {
        const select = document.createElement("select");
        const so = new SelectObserver(select);

        so.connect();

        expect(observeSpy).toHaveBeenCalledTimes(1);
        expect(observeSpy).toHaveBeenCalledWith(select, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ["selected", "value", "disabled"],
        });
    });

    test("debounce: multiple mutations trigger onChanged once after 50ms", () => {
        const select = document.createElement("select");
        const so = new SelectObserver(select);

        const onChangedSpy = jest.spyOn(so, "onChanged");

        so.connect();

        // Fire multiple mutation signals quickly
        fireMutation(5);

        // before debounce delay, should not call onChanged
        jest.advanceTimersByTime(49);
        expect(onChangedSpy).not.toHaveBeenCalled();

        // at 50ms, should call once
        jest.advanceTimersByTime(1);
        expect(onChangedSpy).toHaveBeenCalledTimes(1);
        expect(onChangedSpy).toHaveBeenCalledWith(select);
    });

    test("debounce resets timer: rapid successive mutations still result in only one call", () => {
        const select = document.createElement("select");
        const so = new SelectObserver(select);

        const onChangedSpy = jest.spyOn(so, "onChanged");
        so.connect();

        // mutation at t=0 -> schedules call at t=50
        fireMutation(1);
        jest.advanceTimersByTime(30);

        // mutation at t=30 -> timer reset -> should now fire at t=80
        fireMutation(1);

        // reach old deadline t=50: still no call
        jest.advanceTimersByTime(20);
        expect(onChangedSpy).not.toHaveBeenCalled();

        // reach new deadline t=80: now call exactly once
        jest.advanceTimersByTime(30);
        expect(onChangedSpy).toHaveBeenCalledTimes(1);
    });

    test("disconnect() clears pending debounce timer and disconnects observer", () => {
        const select = document.createElement("select");
        const so = new SelectObserver(select);

        const onChangedSpy = jest.spyOn(so, "onChanged");

        so.connect();

        // schedule a debounced call
        fireMutation(1);

        // disconnect before timer fires
        so.disconnect();

        // timers run, but callback should not fire after disconnect cleared timer
        jest.runOnlyPendingTimers();

        expect(onChangedSpy).not.toHaveBeenCalled();
        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    test("disconnect() is idempotent (safe to call multiple times)", () => {
        const select = document.createElement("select");
        const so = new SelectObserver(select);

        so.connect();

        expect(() => so.disconnect()).not.toThrow();
        expect(() => so.disconnect()).not.toThrow();

        // disconnect() on the underlying observer can be called multiple times
        expect(disconnectSpy).toHaveBeenCalled();
    });
});