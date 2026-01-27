/**
 * Unit Tests for OptionView
 */

import { OptionView } from "../../../src/ts/views/option-view";

describe('OptionView', () => {
    let parent;

    beforeEach(() => {
        parent = document.createElement('div');
        document.body.appendChild(parent);
    });

    describe('Rendering', () => {
        test('should render basic structure', () => {
            const view = new OptionView(parent);
            view.mount();
            
            const viewEl = view.getView();
            expect(viewEl).toBeInTheDocument();
            expect(viewEl.classList.contains('selective-ui-option-view')).toBe(true);
        });

        test('should render with checkbox for multiple', () => {
            const view = new OptionView(parent);
            view.isMultiple = true;
            view.mount();
            
            const input = view.view.tags.OptionInput;
            expect(input.type).toBe('checkbox');
        });

        test('should render with radio for single', () => {
            const view = new OptionView(parent);
            view.isMultiple = false;
            view.mount();
            
            const input = view.view.tags.OptionInput;
            expect(input.type).toBe('radio');
        });

        test('should render with image', () => {
            const view = new OptionView(parent);
            view.hasImage = true;
            view.optionConfig = {
                imageWidth: '50px',
                imageHeight: '50px',
                imageBorderRadius: '5px',
                imagePosition: 'left'
            };
            view.mount();
            
            expect(view.getView().classList.contains('has-image')).toBe(true);
            expect(view.view.tags.OptionImage).toBeTruthy();
        });
    });

    describe('Update', () => {
        test('should update view on config change', () => {
            const view = new OptionView(parent);
            view.mount();
            
            view.isMultiple = true;
            view.update();
            
            const input = view.view.tags.OptionInput;
            expect(input.type).toBe('checkbox');
        });

        test('should add/remove image element', () => {
            const view = new OptionView(parent);
            view.hasImage = false;
            view.mount();
            
            expect(view.view.tags.OptionImage).toBeFalsy();
            
            view.hasImage = true;
            view.optionConfig = {
                imageWidth: '50px',
                imageHeight: '50px'
            };
            view.update();
            
            // Sau update, image sẽ được thêm
            const viewEl = view.getView();
            expect(viewEl.querySelector('.option-image')).toBeTruthy();
        });
    });
});