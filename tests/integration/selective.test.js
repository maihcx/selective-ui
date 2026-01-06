/**
 * Integration Tests for Selective UI
 * Tests all workflow from bind to interaction
 */

describe('Selective UI Integration', () => {
    let SelectiveUI;
    
    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');
        
        // Load CSS
        const cssPath = path.resolve(__dirname, '../../dist/selective-ui.css');
        const css = fs.readFileSync(cssPath, 'utf-8');
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        
        // Load JS
        SelectiveUI = require("../../src/js/index.js");
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
            
            const wrapper = select.parentElement;
            expect(wrapper.classList.contains('selective-ui-MAIN')).toBe(true);
        });

        test('should handle multiple selects', () => {
            createSelect({ id: 'select1', options: [{ value: '1', text: 'A' }] });
            createSelect({ id: 'select2', options: [{ value: '2', text: 'B' }] });

            SelectiveUI.bind('select');
            
            const wrappers = document.querySelectorAll('.selective-ui-MAIN');
            expect(wrappers.length).toBe(2);
        });

        test('should merge custom options with defaults', () => {
            const select = createSelect({
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
        let select;

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

        test('should select single option', async () => {
            const api = SelectiveUI.find('#single-select');
            
            api.setValue('2', false);
            
            expect(api.value).toBe('2');
            expect(select.value).toBe('2');
        });

        test('should deselect previous when selecting new', async () => {
            const api = SelectiveUI.find('#single-select');
            
            api.setValue('1', false);
            expect(api.value).toBe('1');
            
            api.setValue('2', false);
            expect(api.value).toBe('2');
        });

        test('should update placeholder with selected text', async () => {
            const api = SelectiveUI.find('#single-select');
            
            api.setValue('2', false);
            await waitFor(100);
            
            const placeholder = document.querySelector('.selective-ui-placeholder');
            expect(placeholder.textContent).toContain('Option 2');
        });
    });

    describe('Multiple Selection', () => {
        let select;

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

        test('should select all options', () => {
            const api = SelectiveUI.find('#multi-select');
            
            api.selectAll(null, false);
            
            expect(api.valueArray.length).toBe(3);
        });

        test('should deselect all options', () => {
            const api = SelectiveUI.find('#multi-select');
            
            api.setValue(['1', '2'], false);
            api.deSelectAll(null, false);
            
            expect(api.valueArray).toEqual([]);
        });

        test('should respect maxSelected limit', () => {
            const select2 = createSelect({
                id: 'limited-select',
                multiple: true,
                dataset: { maxSelected: '2' },
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });

            SelectiveUI.bind('#limited-select', { maxSelected: 2 });
            const api = SelectiveUI.find('#limited-select');
            
            api.setValue(['1', '2', '3'], false);
            
            // Chỉ 2 options đầu được chọn
            expect(api.valueArray.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Popup Behavior', () => {
        let select;

        beforeEach(() => {
            select = createSelect({
                id: 'popup-select',
                options: [{ value: '1', text: 'Option 1' }]
            });
            SelectiveUI.bind('#popup-select');
        });

        test('should open popup', async () => {
            const api = SelectiveUI.find('#popup-select');
            
            api.open();
            await waitFor(250);
            
            const popup = document.querySelector('.selective-ui-popup');
            expect(popup).toBeVisible();
        });

        test('should close popup', async () => {
            const api = SelectiveUI.find('#popup-select');
            
            api.open();
            await waitFor(250);
            
            api.close();
            await waitFor(250);
            
            const popup = document.querySelector('.selective-ui-popup');
            expect(popup).not.toBeVisible();
        });

        test('should toggle popup', async () => {
            const api = SelectiveUI.find('#popup-select');
            
            api.toggle();
            await waitFor(250);
            let popup = document.querySelector('.selective-ui-popup');
            expect(popup).toBeVisible();
            
            api.toggle();
            await waitFor(250);
            expect(popup).not.toBeVisible();
        });

        test('should focus search input when opened', async () => {
            const api = SelectiveUI.find('#popup-select');
            
            api.open();
            await waitFor(250);
            
            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            expect(document.activeElement).toBe(searchInput);
        });
    });

    describe('Search Functionality', () => {
        let select;

        beforeEach(() => {
            select = createSelect({
                id: 'search-select',
                options: [
                    { value: '1', text: 'Apple' },
                    { value: '2', text: 'Banana' },
                    { value: '3', text: 'Cherry' }
                ]
            });
            SelectiveUI.bind('#search-select', { searchable: true });
        });

        test('should filter options on search', async () => {
            const api = SelectiveUI.find('#search-select');
            api.open();
            await waitFor(250);
            
            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            searchInput.value = 'ban';
            searchInput.dispatchEvent(new Event('input'));
            
            await waitFor(250);
            
            const visibleOptions = document.querySelectorAll('.selective-ui-option-view:not(.hide)');
            expect(visibleOptions.length).toBe(1);
            expect(visibleOptions[0].textContent).toContain('Banana');
        });

        test('should show empty state when no results', async () => {
            const api = SelectiveUI.find('#search-select');
            api.open();
            await waitFor(250);
            
            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            searchInput.value = 'xyz';
            searchInput.dispatchEvent(new Event('input'));
            
            await waitFor(250);
            
            const emptyState = document.querySelector('.selective-ui-empty-state');
            expect(emptyState).toBeVisible();
        });

        test('should clear search on close', async () => {
            const api = SelectiveUI.find('#search-select');
            api.open();
            await waitFor(250);
            
            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            searchInput.value = 'test';
            
            api.close();
            await waitFor(250);
            
            expect(searchInput.value).toBe('');
        });
    });

    describe('Event Callbacks', () => {
        test('should trigger onChange event', (done) => {
            const select = createSelect({
                id: 'event-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#event-select', {
                on: {
                    change: (callback, api) => {
                        expect(api.value).toBe('1');
                        done();
                    }
                }
            });

            const api = SelectiveUI.find('#event-select');
            api.setValue('1', true);
        });

        test('should trigger beforeChange and allow cancel', () => {
            const select = createSelect({
                id: 'cancel-select',
                options: [
                    { value: '1', text: 'Option 1', selected: true },
                    { value: '2', text: 'Option 2' }
                ]
            });

            const onChange = jest.fn();

            SelectiveUI.bind('#cancel-select', {
                on: {
                    beforeChange: (callback) => {
                        callback.cancel(); // Cancel change
                    },
                    change: onChange
                }
            });

            const api = SelectiveUI.find('#cancel-select');
            api.setValue('2', true);

            expect(onChange).not.toHaveBeenCalled();
            expect(api.value).not.toBe('2');
        });

        test('should trigger onLoad after initialization', (done) => {
            const select = createSelect({
                id: 'load-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#load-select', {
                on: {
                    load: (callback, api) => {
                        expect(api).toBeDefined();
                        done();
                    }
                }
            });
        });
    });

    describe('State Management', () => {
        test('should enable/disable', () => {
            const select = createSelect({
                id: 'state-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#state-select');
            const api = SelectiveUI.find('#state-select');
            
            api.disabled = true;
            expect(api.disabled).toBe(true);
            expect(select.dataset.disabled).toBe('true');
            
            api.disabled = false;
            expect(api.disabled).toBe(false);
        });

        test('should set readonly', () => {
            const select = createSelect({
                id: 'readonly-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#readonly-select');
            const api = SelectiveUI.find('#readonly-select');
            
            api.readonly = true;
            expect(api.readonly).toBe(true);
        });

        test('should hide/show', () => {
            const select = createSelect({
                id: 'visible-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#visible-select');
            const api = SelectiveUI.find('#visible-select');
            
            api.visible = false;
            const wrapper = document.querySelector('.selective-ui-MAIN');
            expect(wrapper.classList.contains('invisible')).toBe(true);
        });
    });

    describe('Dynamic Options', () => {
        test('should update when options change', async () => {
            const select = createSelect({
                id: 'dynamic-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#dynamic-select');
            await waitFor(50);

            const api = SelectiveUI.find('#dynamic-select');
            api.open();
            await waitFor(50);

            const newOption = document.createElement('option');
            newOption.value = '2';
            newOption.text = 'Option 2';
            select.appendChild(newOption);

            select.dispatchEvent(new CustomEvent('options:changed'));

            if (typeof api.refreshOptionsView === 'function') {
                api.refreshOptionsView();
            }

            await waitFor(100);

            const optionViews = document.querySelectorAll('.selective-ui-option-view');
            expect(optionViews.length).toBe(2);
        });
    });

    describe('Destroy', () => {
        test('should destroy single instance', () => {
            const select = createSelect({
                id: 'destroy-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#destroy-select');
            SelectiveUI.destroy('#destroy-select');
            
            const wrapper = document.querySelector('.selective-ui-MAIN');
            expect(wrapper).not.toBeInTheDocument();
        });

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