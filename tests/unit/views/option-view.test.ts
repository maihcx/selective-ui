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
            view.render();
            
            const viewEl = view.getView();
            expect(viewEl).toBeInTheDocument();
            expect(viewEl.classList.contains('selective-ui-option-view')).toBe(true);
        });

        test('should render with checkbox for multiple', () => {
            const view = new OptionView(parent);
            view.isMultiple = true;
            view.render();
            
            const input = view.getTag('OptionInput');
            expect(input.type).toBe('checkbox');
        });

        test('should render with radio for single', () => {
            const view = new OptionView(parent);
            view.isMultiple = false;
            view.render();
            
            const input = view.getTag('OptionInput');
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
            view.render();
            
            expect(view.getView().classList.contains('has-image')).toBe(true);
            expect(view.getTag('OptionImage')).toBeTruthy();
        });
    });

    describe('Update', () => {
        test('should update view on config change', () => {
            const view = new OptionView(parent);
            view.render();
            
            view.isMultiple = true;
            view.update();
            
            const input = view.getTag('OptionInput');
            expect(input.type).toBe('checkbox');
        });

        test('should add/remove image element', () => {
            const view = new OptionView(parent);
            view.hasImage = false;
            view.render();
            
            expect(view.getTag('OptionImage')).toBeFalsy();
            
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

    describe('Label Alignment', () => {
        test('should apply horizontal alignment', () => {
            const view = new OptionView(parent);
            view.optionConfig = {
                labelHalign: 'center',
                labelValign: 'center'
            };
            view.render();
            
            const label = view.getTag('OptionLabel');
            expect(label.classList.contains('align-horizontal-center')).toBe(true);
        });

        test('should apply vertical alignment', () => {
            const view = new OptionView(parent);
            view.optionConfig = {
                labelValign: 'top',
                labelHalign: 'left'
            };
            view.render();
            
            const label = view.getTag('OptionLabel');
            expect(label.classList.contains('align-vertical-top')).toBe(true);
        });
    });
});