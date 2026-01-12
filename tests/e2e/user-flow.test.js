/**
 * End-to-End Tests for User Workflows
 * Simulates real user interactions
 */

describe('E2E User Flows', () => {
    const SelectiveUI = require("../../src/js/index");

    beforeEach(() => {
        // Clear document before each test
        document.body.innerHTML = '';
    });

    afterEach(() => {
        try {
            SelectiveUI.destroy();
        } catch (e) {
            // Ignore errors during cleanup
        }
    });

    describe('Basic User Selection Flow', () => {
        test('User opens dropdown, selects option, closes dropdown', async () => {
            const select = createSelect({
                id: 'user-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });

            SelectiveUI.bind('#user-select');
            await waitFor(100);

            const api = SelectiveUI.find('#user-select');
            expect(api).toBeTruthy();
            expect(api.isEmpty).toBe(false);
            
            // Test API có methods cần thiết
            expect(typeof api.open).toBe('function');
            expect(typeof api.setValue).toBe('function');

            const viewPanel = document.querySelector('.selective-ui-view');
            expect(viewPanel).toBeTruthy();

            viewPanel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await waitFor(250);

            const option = document.querySelectorAll('.selective-ui-option-view')[1];
            option.click();
            await waitFor(100);

            expect(api.value).toBe('2');
        });

        test('User searches and selects from filtered results', async () => {
            const select = createSelect({
                id: 'search-select',
                options: [
                    { value: '1', text: 'Apple' },
                    { value: '2', text: 'Banana' },
                    { value: '3', text: 'Cherry' }
                ]
            });

            SelectiveUI.bind('#search-select', { searchable: true });
            await waitFor(100);

            const api = SelectiveUI.find('#search-select');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            searchInput.value = 'ban';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            await waitFor(250);

            const visibleOptions = document.querySelectorAll('.selective-ui-option-view:not(.hide)');
            expect(visibleOptions.length).toBe(1);

            visibleOptions[0].click();
            await waitFor(100);

            expect(api.value).toBe('2');
        });
    });

    describe('Multiple Selection Flow', () => {
        test('User selects multiple options', async () => {
            const select = createSelect({
                id: 'multi-select',
                multiple: true,
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });

            SelectiveUI.bind('#multi-select');
            await waitFor(100);

            const api = SelectiveUI.find('#multi-select');

            api.open();
            await waitFor(250);

            const options = document.querySelectorAll('.selective-ui-option-view');
            options[0].click();
            await waitFor(150);
            options[1].click();
            await waitFor(150);

            expect(api.valueArray).toEqual(['1', '2']);

            const accessoryItems = document.querySelectorAll('.accessory-item');
            expect(accessoryItems.length).toBe(2);
        });

        test('User uses Select All button', async () => {
            const select = createSelect({
                id: 'selectall-select',
                multiple: true,
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });

            SelectiveUI.bind('#selectall-select');
            await waitFor(100);

            const api = SelectiveUI.find('#selectall-select');

            api.open();
            await waitFor(250);

            const selectAllBtn = document.querySelector('.selective-ui-option-handle-item');
            if (selectAllBtn) {
                selectAllBtn.click();
                await waitFor(100);

                expect(api.valueArray.length).toBe(3);
            }
        });

        test('User removes item from accessory box', async () => {
            const select = createSelect({
                id: 'remove-select',
                multiple: true,
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });

            SelectiveUI.bind('#remove-select');
            await waitFor(100);

            const api = SelectiveUI.find('#remove-select');

            api.setValue(['1', '2'], false);
            await waitFor(100);

            const removeBtn = document.querySelector('.accessory-item-button');
            if (removeBtn) {
                removeBtn.click();
                await waitFor(100);

                expect(api.valueArray.length).toBe(1);
            }
        });
    });

    describe('Keyboard Navigation Flow', () => {
        test('User navigates with arrow keys', async () => {
            const select = createSelect({
                id: 'keyboard-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });

            SelectiveUI.bind('#keyboard-select');
            await waitFor(100);

            const api = SelectiveUI.find('#keyboard-select');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');

            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'ArrowDown',
                bubbles: true 
            }));
            await waitFor(50);

            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'ArrowDown',
                bubbles: true 
            }));
            await waitFor(50);

            const highlighted = document.querySelector('.selective-ui-option-view.highlight');
            expect(highlighted).toBeTruthy();
        });

        test('User selects with Enter key', async () => {
            const select = createSelect({
                id: 'enter-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });

            SelectiveUI.bind('#enter-select');
            await waitFor(100);

            const api = SelectiveUI.find('#enter-select');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');

            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'ArrowDown',
                bubbles: true 
            }));
            await waitFor(150);

            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Enter',
                bubbles: true 
            }));
            await waitFor(200);

            expect(api.value).toBe('2');
        });

        test('User closes with Escape key', async () => {
            const select = createSelect({
                id: 'esc-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#esc-select');
            await waitFor(100);

            const api = SelectiveUI.find('#esc-select');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Escape',
                bubbles: true 
            }));
            await waitFor(250);

            const popup = document.querySelector('.selective-ui-popup');
            const isHidden = popup.style.display === 'none' || 
                           popup.classList.contains('hide');
            expect(isHidden).toBeTruthy();
        });
    });

    describe('Disabled State Flow', () => {
        test('User cannot interact when disabled', async () => {
            const select = createSelect({
                id: 'disabled-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#disabled-select');
            await waitFor(200);

            const api = SelectiveUI.find('#disabled-select');

            api.disabled = true;

            api.open();
            expect(api.isOpen).toBe(false);

            const oldValue = api.value;
            api.setValue('1', true);
            expect(api.value).toBe(oldValue);
        });
    });

    describe('Dynamic Options Flow', () => {
        test('Options update while dropdown is open', async () => {
            const select = createSelect({
                id: 'dynamic-select',
                options: [{ value: '1', text: 'Option 1' }]
            });

            SelectiveUI.bind('#dynamic-select');
            await waitFor(100);

            const api = SelectiveUI.find('#dynamic-select');

            api.open();
            await waitFor(250);

            const newOption = document.createElement('option');
            newOption.value = '2';
            newOption.text = 'Option 2';
            select.appendChild(newOption);

            select.dispatchEvent(new CustomEvent('options:changed'));
            await waitFor(100);

            const options = document.querySelectorAll('.selective-ui-option-view');
            expect(options.length).toBe(2);
        });
    });

    describe('Group Interaction Flow', () => {
        test('User collapses/expands group', async () => {
            const select = createSelect({
                id: 'group-select',
                groups: [
                    {
                        label: 'Group 1',
                        options: [
                            { value: '1', text: 'Option 1' },
                            { value: '2', text: 'Option 2' }
                        ]
                    }
                ]
            });

            SelectiveUI.bind('#group-select');
            await waitFor(100);

            const api = SelectiveUI.find('#group-select');

            api.open();
            await waitFor(250);

            const groupHeader = document.querySelector('.selective-ui-group-header');
            if (groupHeader) {
                groupHeader.click();
                await waitFor(100);

                const group = document.querySelector('.selective-ui-group');
                expect(group.classList.contains('collapsed')).toBe(true);
            }
        });
    });

    describe('Error Recovery Flow', () => {
        test('User recovers from empty search', async () => {
            const select = createSelect({
                id: 'recovery-select',
                options: [
                    { value: '1', text: 'Apple' },
                    { value: '2', text: 'Banana' }
                ]
            });

            SelectiveUI.bind('#recovery-select', { searchable: true });
            await waitFor(100);

            const api = SelectiveUI.find('#recovery-select');

            api.open();
            await waitFor(250);

            const searchInput = document.querySelector('.selective-ui-searchbox-input');
            searchInput.value = 'xyz';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            await waitFor(250);

            let emptyState = document.querySelector('.selective-ui-empty-state');
            expect(emptyState.classList.contains('hide')).toBe(false);

            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            await waitFor(250);

            const options = document.querySelectorAll('.selective-ui-option-view:not(.hide)');
            expect(options.length).toBe(2);
        });
    });

    describe('Form Submission Flow', () => {
        test('Selected values are submitted with form', async () => {
            const form = document.createElement('form');
            const select = createSelect({
                id: 'form-select',
                name: 'form-select',
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });
            form.appendChild(select);
            document.body.appendChild(form);

            SelectiveUI.bind('#form-select');
            await waitFor(100);

            const api = SelectiveUI.find('#form-select');

            api.setValue('2', false);
            await waitFor(100);

            const formData = new FormData(form);
            expect(formData.get('form-select')).toBe('2');
        });

        test('Multiple values are submitted correctly', async () => {
            const form = document.createElement('form');
            const select = createSelect({
                id: 'form-multi-select',
                name: 'form-multi-select[]',
                multiple: true,
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' },
                    { value: '3', text: 'Option 3' }
                ]
            });
            form.appendChild(select);
            document.body.appendChild(form);

            SelectiveUI.bind('#form-multi-select');
            await waitFor(100);

            const api = SelectiveUI.find('#form-multi-select');

            api.setValue(['1', '2'], false);
            await waitFor(200);

            const formData = new FormData(form);
            const values = formData.getAll('form-multi-select[]');
            expect(values).toEqual(['1', '2']);
        });
    });
});