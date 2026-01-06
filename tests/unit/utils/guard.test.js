import { checkDuplicate, markLoaded } from '../../../src/js/utils/guard'; 

describe('Global library guard (checkDuplicate / markLoaded)', () => {
    const LIB_NAME = 'TestLib';

    beforeEach(() => {
        // Reset global namespace
        delete window[LIB_NAME];

        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete window[LIB_NAME];
    });

    describe('checkDuplicate()', () => {
        test('returns false when window is undefined', () => {
            const originalWindow = global.window;
            delete global.window;

            expect(checkDuplicate(LIB_NAME)).toBe(false);

            global.window = originalWindow;
        });

        test('returns true and warns if library already loaded', () => {
            window[LIB_NAME] = {
                __loaded: true,
                __version: '1.0.0'
            };

            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(true);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn.mock.calls[0][0]).toContain('Already loaded');
        });

        test('initializes loading placeholder if library not exists', () => {
            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(false);
            expect(window[LIB_NAME]).toBeDefined();
            expect(window[LIB_NAME].__loading).toBe(true);
        });

        test('sets __loading if library exists but not loaded', () => {
            window[LIB_NAME] = {};

            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(false);
            expect(window[LIB_NAME].__loading).toBe(true);
        });
    });

    describe('markLoaded()', () => {
        test('does nothing when window is undefined', () => {
            const originalWindow = global.window;
            delete global.window;

            expect(() =>
                markLoaded(LIB_NAME, '1.2.3', {})
            ).not.toThrow();

            global.window = originalWindow;
        });

        test('marks library as loaded and merges API', () => {
            window[LIB_NAME] = { __loading: true };

            const api = {
                foo: jest.fn(),
                bar: 123
            };

            markLoaded(LIB_NAME, '1.2.3', api);

            expect(window[LIB_NAME].__loaded).toBe(true);
            expect(window[LIB_NAME].__loading).toBe(false);
            expect(window[LIB_NAME].__version).toBe('1.2.3');
            expect(window[LIB_NAME].foo).toBe(api.foo);
            expect(window[LIB_NAME].bar).toBe(123);
        });

        test('freezes the global library object', () => {
            window[LIB_NAME] = {};

            markLoaded(LIB_NAME, '1.0.0', { a: 1 });

            expect(Object.isFrozen(window[LIB_NAME])).toBe(true);
        });

        test('logs successful load message', () => {
            window[LIB_NAME] = {};

            console.log.mockClear();

            markLoaded(LIB_NAME, '1.0.0', {});

            expect(console.log).toHaveBeenCalledTimes(1);
            expect(console.log.mock.calls[0][0]).toContain('loaded successfully');
        });
    });
});
