/**
 * Performance Tests for Selective UI
 * Benchmarks key operations
 */

describe('Performance Tests', () => {
    const SelectiveUI = require("../../src/js/index.js");

    afterEach(() => {
        SelectiveUI.destroy();
    });

    describe('Initialization Performance', () => {
        test('should initialize 100 options in < 500ms', () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            const select = createSelect({
                id: 'perf-select',
                options
            });

            const startTime = performance.now();
            SelectiveUI.bind('#perf-select');
            const endTime = performance.now();

            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500);

            console.log(`✓ Initialized 100 options in ${duration.toFixed(2)}ms`);
        });

        test('should initialize 1000 options in < 2000ms', () => {
            const options = Array.from({ length: 1000 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            const select = createSelect({
                id: 'perf-large-select',
                options
            });

            const startTime = performance.now();
            SelectiveUI.bind('#perf-large-select');
            const endTime = performance.now();

            const duration = endTime - startTime;
            expect(duration).toBeLessThan(2000);

            console.log(`✓ Initialized 1000 options in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Search Performance', () => {
        test('should search 1000 items in < 200ms', async () => {
            const options = Array.from({ length: 1000 }, (_, i) => ({
                value: String(i + 1),
                text: `Item ${i + 1}`
            }));

            const select = createSelect({
                id: 'search-perf',
                options
            });

            SelectiveUI.bind('#search-perf', { searchable: true });
            const api = SelectiveUI.find('#search-perf');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');

            const startTime = performance.now();
            searchInput.value = '500';
            searchInput.dispatchEvent(new Event('input'));
            await waitFor(250);
            const endTime = performance.now();

            const duration = endTime - startTime - 250;
            expect(duration).toBeLessThan(200);

            console.log(`✓ Searched 1000 items in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Rendering Performance', () => {
        test('should render popup with 100 options in < 300ms', async () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            const select = createSelect({
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

            console.log(`✓ Rendered 100 options in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Memory Usage', () => {
        test('should not leak memory on destroy', () => {
            if (typeof performance.memory === 'undefined') {
                console.log('⚠ Memory measurement not available in this environment');
                return;
            }

            const initialMemory = performance.memory.usedJSHeapSize;

            for (let i = 0; i < 50; i++) {
                const select = createSelect({
                    id: `mem-test-${i}`,
                    options: [
                        { value: '1', text: 'Option 1' },
                        { value: '2', text: 'Option 2' }
                    ]
                });

                SelectiveUI.bind(`#mem-test-${i}`);
                SelectiveUI.destroy(`#mem-test-${i}`);
            }

            if (global.gc) {
                global.gc();
            }

            const finalMemory = performance.memory.usedJSHeapSize;
            const memoryDiff = finalMemory - initialMemory;

            expect(memoryDiff).toBeLessThan(5 * 1024 * 1024);

            console.log(`✓ Memory diff after 50 create/destroy cycles: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
        });
    });

    describe('Selection Performance', () => {
        test('should handle rapid selection changes', async () => {
            const select = createSelect({
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
                const values = [String(i + 1), String(i + 2)];
                api.setValue(values, false);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(500);

            console.log(`✓ 50 rapid selections in ${duration.toFixed(2)}ms (${(duration/50).toFixed(2)}ms avg)`);
        });
    });

    describe('Keyboard Navigation Performance', () => {
        test('should handle rapid keyboard navigation', async () => {
            const options = Array.from({ length: 100 }, (_, i) => ({
                value: String(i + 1),
                text: `Option ${i + 1}`
            }));

            const select = createSelect({
                id: 'nav-perf',
                options
            });

            SelectiveUI.bind('#nav-perf');
            const api = SelectiveUI.find('#nav-perf');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');

            const startTime = performance.now();

            // Simulate keyboard navigation (không dùng waitFor trong loop)
            for (let i = 0; i < 50; i++) {
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                    key: 'ArrowDown',
                    bubbles: true 
                }));
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Tăng threshold vì keyboard events khá chậm trong JSDOM
            expect(duration).toBeLessThan(1000);

            console.log(`✓ 50 keyboard navigations in ${duration.toFixed(2)}ms`);
        });
    });

    describe('DOM Updates Performance', () => {
        test('should efficiently update visibility states', async () => {
            const select = createSelect({
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

            const searchInput = document.querySelector('.selective-ui-searchbox-input');

            const startTime = performance.now();

            for (let i = 0; i < 10; i++) {
                searchInput.value = String(i);
                searchInput.dispatchEvent(new Event('input'));
                await waitFor(50);
            }

            const endTime = performance.now();
            const duration = endTime - startTime - 500;

            expect(duration).toBeLessThan(300);

            console.log(`✓ 10 visibility updates on 200 items in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Scroll Performance', () => {
        test('should handle smooth scrolling with many options', async () => {
            const select = createSelect({
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

            const popup = document.querySelector('.selective-ui-popup');

            const startTime = performance.now();

            for (let i = 0; i < 20; i++) {
                popup.scrollTop = i * 100;
                popup.dispatchEvent(new Event('scroll'));
                await waitFor(10);
            }

            const endTime = performance.now();
            const duration = endTime - startTime - 200;

            expect(duration).toBeLessThan(500);

            console.log(`✓ 20 scroll events with 500 options in ${duration.toFixed(2)}ms`);
        });
    });
});