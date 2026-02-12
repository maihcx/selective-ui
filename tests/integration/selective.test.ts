/**
 * Integration Tests for Selective UI
 * Tests all workflow from bind to interaction
 */

import * as SelectiveUI from '../../src/ts/index';

declare function waitFor(ms: number): Promise<void>;

describe('Selective UI Integration', () => {

    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');

        const cssPath = path.resolve(__dirname, '../../dist/selective-ui.css');
        const css = fs.readFileSync(cssPath, 'utf-8');

        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    });

    afterEach(() => {
        SelectiveUI.destroy();
    });

    describe('Initialization', () => {
        test('should bind to select element', () => {
            const select = createSelect({
                id: 'test-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });

            SelectiveUI.bind('#test-select');

            const wrapper = select.parentElement as HTMLElement;
            expect(wrapper.classList.contains('seui-MAIN')).toBe(true);
        });

        test('should handle multiple selects', () => {
            createSelect({ id: 'select1', options: [{ value: '1', text: 'A' }] });
            createSelect({ id: 'select2', options: [{ value: '2', text: 'B' }] });

            SelectiveUI.bind('select');

            const wrappers = document.querySelectorAll('.seui-MAIN');
            expect(wrappers.length).toBe(2);
        });

        test('should merge custom options with defaults', () => {
            createSelect({
                id: 'test-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#test-select', {
                placeholder: 'Custom Placeholder',
                multiple: true
            });

            const api = SelectiveUI.find('#test-select');
            expect(api.placeholder).toBe('Custom Placeholder');
        });
    });

    describe('Single Selection', () => {
        let select!: HTMLSelectElement;

        beforeEach(() => {
            select = createSelect({
                id: 'single-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });
            SelectiveUI.bind('#single-select');
        });

        test('should select single option', () => {
            const api = SelectiveUI.find('#single-select');

            api.setValue('2', false);

            expect(api.value).toBe('2');
            expect(select.value).toBe('2');
        });

        test('should deselect previous when selecting new', () => {
            const api = SelectiveUI.find('#single-select');

            api.setValue('1', false);
            expect(api.value).toBe('1');

            api.setValue('2', false);
            expect(api.value).toBe('2');
        });
    });

    describe('Multiple Selection', () => {
        let select!: HTMLSelectElement;

        beforeEach(() => {
            select = createSelect({
                id: 'multi-select',
                multiple: true,
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });
            SelectiveUI.bind('#multi-select');
        });

        test('should select multiple options', () => {
            const api = SelectiveUI.find('#multi-select');

            api.setValue(['1', '2'], false);

            expect(api.valueArray).toEqual(['1', '2']);
            expect(select.selectedOptions.length).toBe(2);
        });

        test('should deselect all options', () => {
            const api = SelectiveUI.find('#multi-select');

            api.setValue(['1', '2'], false);
            api.deSelectAll(null, false);

            expect(api.valueArray).toEqual([]);
        });
    });

    describe('Popup Behavior', () => {
        beforeEach(() => {
            createSelect({
                id: 'popup-select',
                options: [{ value: '1', text: 'Option 1' }]
            });
            SelectiveUI.bind('#popup-select');
        });

        test('should open popup', async () => {
            const api = SelectiveUI.find('#popup-select');

            api.open();
            await waitFor(250);

            const popup = document.querySelector('.seui-popup') as HTMLElement;
            expect(popup).toBeVisible();
        });

        test('should close popup', async () => {
            const api = SelectiveUI.find('#popup-select');

            api.open();
            await waitFor(250);

            api.close();
            await waitFor(250);

            const popup = document.querySelector('.seui-popup') as HTMLElement;
            expect(popup).not.toBeVisible();
        });
    });

    describe('Destroy', () => {
        test('should restore original select', () => {
            const select = createSelect({
                id: 'restore-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#restore-select');
            SelectiveUI.destroy('#restore-select');

            expect(select.style.display).not.toBe('none');
        });
    });
});