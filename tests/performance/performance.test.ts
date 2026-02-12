/**
 * Performance Tests for Selective UI
 * Benchmarks key operations
 */

import * as SelectiveUI from '../../src/ts/index';

declare function waitFor(ms: number): Promise<void>;

describe('Performance Tests', () => {

    afterEach(() => {
        SelectiveUI.destroy();
    });

    describe('Initialization Performance', () => {
        test('should initialize 100 options in < 500ms', () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            createSelect({
                id: 'perf-select',
                options
            });

            const startTime = performance.now();
            SelectiveUI.bind('#perf-select');
            const endTime = performance.now();

            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500);
        });

        test('should initialize 1000 options in < 2000ms', () => {
            const options = Array.from({ length: 1000 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            createSelect({
                id: 'perf-large-select',
                options
            });

            const startTime = performance.now();
            SelectiveUI.bind('#perf-large-select');
            const endTime = performance.now();

            const duration = endTime - startTime;
            expect(duration).toBeLessThan(2000);
        });
    });

    describe('Search Performance', () => {
        test('should search 1000 items in < 200ms', async () => {
            const options = Array.from({ length: 1000 }, (_, i) => ({
                value: String(i + 1),
                text: `Item ${i + 1}`
            }));

            createSelect({
                id: 'search-perf',
                options
            });

            SelectiveUI.bind('#search-perf', { searchable: true });
            const api = SelectiveUI.find('#search-perf');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector(
                '.seui-searchbox-input'
            ) as HTMLInputElement;

            const startTime = performance.now();
            searchInput.value = '500';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            await waitFor(250);
            const endTime = performance.now();

            const duration = endTime - startTime - 250;
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Rendering Performance', () => {
        test('should render popup with 100 options in < 300ms', async () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            createSelect({
                id: 'render-perf',
                options
            });

            SelectiveUI.bind('#render-perf');
            const api = SelectiveUI.find('#render-perf');

            const startTime = performance.now();
            api.open();
            await waitFor(250);
            const endTime = performance.now();

            const duration = endTime - startTime - 250;
            expect(duration).toBeLessThan(300);
        });
    });

    describe('Memory Usage', () => {
        test('should not leak memory on destroy', () => {
            const perf = performance as unknown as {
                memory?: { usedJSHeapSize: number };
            };

            if (!perf.memory) {
                return;
            }

            const initialMemory = perf.memory.usedJSHeapSize;

            for (let i = 0; i < 50; i++) {
                createSelect({
                    id: `mem-test-${i}`,
                    options: [
                        { value: '1', text: 'Option 1' },
                        { value: '2', text: 'Option 2' }
                    ]
                });

                SelectiveUI.bind(`#mem-test-${i}`);
                SelectiveUI.destroy(`#mem-test-${i}`);
            }

            if ((global as any).gc) {
                (global as any).gc();
            }

            const finalMemory = perf.memory.usedJSHeapSize;
            const memoryDiff = finalMemory - initialMemory;

            expect(memoryDiff).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe('Selection Performance', () => {
        test('should handle rapid selection changes', () => {
            createSelect({
                id: 'rapid-select',
                multiple: true,
                options: Array.from({ length: 100 }, (_, i) => ({
                    value: String(i + 1),
                    text: `Option ${i + 1}`
                }))
            });

            SelectiveUI.bind('#rapid-select');
            const api = SelectiveUI.find('#rapid-select');

            const startTime = performance.now();

            for (let i = 0; i < 50; i++) {
                api.setValue([String(i + 1), String(i + 2)], false);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(500);
        });
    });

    describe('Keyboard Navigation Performance', () => {
        test('should handle rapid keyboard navigation', async () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            createSelect({
                id: 'nav-perf',
                options
            });

            SelectiveUI.bind('#nav-perf');
            const api = SelectiveUI.find('#nav-perf');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector(
                '.seui-searchbox-input'
            ) as HTMLInputElement;

            const startTime = performance.now();

            for (let i = 0; i < 50; i++) {
                searchInput.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'ArrowDown',
                        bubbles: true
                    })
                );
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(1000);
        });
    });

    describe('DOM Updates Performance', () => {
        test('should efficiently update visibility states', async () => {
            createSelect({
                id: 'visibility-perf',
                options: Array.from({ length: 200 }, (_, i) => ({
                    value: String(i + 1),
                    text: `Option ${i + 1}`
                }))
            });

            SelectiveUI.bind('#visibility-perf', { searchable: true });
            const api = SelectiveUI.find('#visibility-perf');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector(
                '.seui-searchbox-input'
            ) as HTMLInputElement;

            const startTime = performance.now();

            for (let i = 0; i < 10; i++) {
                searchInput.value = String(i);
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                await waitFor(50);
            }

            const endTime = performance.now();
            const duration = endTime - startTime - 500;

            expect(duration).toBeLessThan(300);
        });
    });

    describe('Scroll Performance', () => {
        test('should handle smooth scrolling with many options', async () => {
            createSelect({
                id: 'scroll-perf',
                options: Array.from({ length: 500 }, (_, i) => ({
                    value: String(i + 1),
                    text: `Option ${i + 1}`
                }))
            });

            SelectiveUI.bind('#scroll-perf');
            const api = SelectiveUI.find('#scroll-perf');

            api.open();
            await waitFor(250);

            const popup = document.querySelector(
                '.seui-popup'
            ) as HTMLElement;

            const startTime = performance.now();

            for (let i = 0; i < 20; i++) {
                popup.scrollTop = i * 100;
                popup.dispatchEvent(new Event('scroll'));
                await waitFor(10);
            }

            const endTime = performance.now();
            const duration = endTime - startTime - 200;

            expect(duration).toBeLessThan(500);
        });
    });
});