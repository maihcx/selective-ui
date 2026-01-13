// guard.spec.ts
import { checkDuplicate, markLoaded } from '../../../src/ts/utils/guard';

describe('Global library guard (checkDuplicate / markLoaded)', () => {
    const LIB_NAME = 'TestLib';

    beforeEach(() => {
        delete (window as any)[LIB_NAME];

        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (window as any)[LIB_NAME];
    });

    describe('checkDuplicate()', () => {
        test('returns false when window is undefined', () => {
            const originalWindow = (global as any).window;
            delete (global as any).window;

            expect(checkDuplicate(LIB_NAME)).toBe(false);

            (global as any).window = originalWindow;
        });

        test('returns true and warns if library already loaded', () => {
            (window as any)[LIB_NAME] = {
                __loaded: true,
                __version: '1.0.0'
            };

            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(true);
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect((console.warn as jest.Mock).mock.calls[0][0]).toContain('Already loaded');
        });

        test('initializes loading placeholder if library not exists', () => {
            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(false);
            expect((window as any)[LIB_NAME]).toBeDefined();
            expect((window as any)[LIB_NAME].__loading).toBe(true);
        });

        test('sets __loading if library exists but not loaded', () => {
            (window as any)[LIB_NAME] = {};

            const result = checkDuplicate(LIB_NAME);

            expect(result).toBe(false);
            expect((window as any)[LIB_NAME].__loading).toBe(true);
        });
    });

    describe('markLoaded()', () => {
        test('does nothing when window is undefined', () => {
            const originalWindow = (global as any).window;
            delete (global as any).window;

            expect(() =>
                markLoaded(LIB_NAME, '1.2.3', {} as any)
            ).not.toThrow();

            (global as any).window = originalWindow;
        });

        test('marks library as loaded and merges API', () => {
            (window as any)[LIB_NAME] = { __loading: true };

            const api: Record<string, unknown> = {
                foo: jest.fn(),
                bar: 123
            };

            markLoaded(LIB_NAME, '1.2.3', api as any);

            expect((window as any)[LIB_NAME].__loaded).toBe(true);
            expect((window as any)[LIB_NAME].__loading).toBe(false);
            expect((window as any)[LIB_NAME].__version).toBe('1.2.3');
            expect((window as any)[LIB_NAME].foo).toBe(api.foo);
            expect((window as any)[LIB_NAME].bar).toBe(123);
        });

        test('freezes the global library object', () => {
            (window as any)[LIB_NAME] = {};

            markLoaded(LIB_NAME, '1.0.0', { a: 1 } as any);

            expect(Object.isFrozen((window as any)[LIB_NAME])).toBe(true);
        });

        test('logs successful load message', () => {
            (window as any)[LIB_NAME] = {};

            (console.log as jest.Mock).mockClear();

            markLoaded(LIB_NAME, '1.0.0', {} as any);

            expect(console.log).toHaveBeenCalledTimes(1);
            expect((console.log as jest.Mock).mock.calls[0][0]).toContain('loaded successfully');
        });
    });
});