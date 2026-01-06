/**
 * Unit Tests for OptionModel
 */

describe('OptionModel', () => {
    const { OptionModel } = require("../../../src/js/models/option-model");
    let select, option;

    beforeEach(() => {
        select = createSelect({
            options: [
                { 
                    value: '1', 
                    text: 'Option 1',
                    dataset: { imgsrc: 'test.jpg' }
                },
                { value: '2', text: 'Option 2', selected: true }
            ]
        });
        option = select.options[0];
    });

    describe('Constructor & Properties', () => {
        test('should create instance with option element', () => {
            const model = new OptionModel({}, option);
            
            expect(model.targetElement).toBe(option);
            expect(model.value).toBe('1');
            expect(model.text).toBe('Option 1');
        });

        test('should get correct value', () => {
            const model = new OptionModel({}, option);
            expect(model.value).toBe('1');
        });

        test('should get selected state', () => {
            const model1 = new OptionModel({}, select.options[0]);
            const model2 = new OptionModel({}, select.options[1]);
            
            expect(model1.selected).toBe(false);
            expect(model2.selected).toBe(true);
        });
    });

    describe('Image Handling', () => {
        test('should detect image source from dataset', () => {
            const model = new OptionModel({}, option);
            
            expect(model.hasImage).toBe(true);
            expect(model.imageSrc).toBe('test.jpg');
        });

        test('should return empty string when no image', () => {
            const model = new OptionModel({}, select.options[1]);
            
            expect(model.hasImage).toBe(false);
            expect(model.imageSrc).toBe('');
        });
    });

    describe('Selection', () => {
        test('should set selected state', () => {
            const model = new OptionModel({}, option);
            
            model.selected = true;
            expect(model.selected).toBe(true);
            expect(option.selected).toBe(true);
        });

        test('should trigger onSelected callback', (done) => {
            const model = new OptionModel({}, option);
            
            model.onSelected((token, el, selected) => {
                expect(el).toBe(model);
                expect(selected).toBe(true);
                done();
            });
            
            model.selected = true;
        });

        test('should not trigger on selectedNonTrigger', () => {
            const model = new OptionModel({}, option);
            const callback = jest.fn();
            
            model.onSelected(callback);
            model.selectedNonTrigger = true;
            
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Visibility', () => {
        test('should set visibility', () => {
            const model = new OptionModel({}, option);
            const mockView = {
                getView: jest.fn(() => document.createElement('div'))
            };
            model.view = mockView;
            
            model.visible = false;
            expect(model.visible).toBe(false);
        });

        test('should trigger onVisibilityChanged', (done) => {
            const model = new OptionModel({}, option);
            const mockView = {
                getView: jest.fn(() => document.createElement('div'))
            };
            model.view = mockView;
            
            model.onVisibilityChanged((token, el, visible) => {
                expect(visible).toBe(false);
                done();
            });
            
            model.visible = false;
        });
    });

    describe('Highlight', () => {
        test('should set highlight state', () => {
            const model = new OptionModel({}, option);
            const div = document.createElement('div');
            const mockView = {
                getView: jest.fn(() => div)
            };
            model.view = mockView;
            
            model.highlighted = true;
            expect(model.highlighted).toBe(true);
            expect(div.classList.contains('highlight')).toBe(true);
        });

        test('should remove highlight', () => {
            const model = new OptionModel({}, option);
            const div = document.createElement('div');
            div.classList.add('highlight');
            const mockView = {
                getView: jest.fn(() => div)
            };
            model.view = mockView;
            
            model.highlighted = false;
            expect(div.classList.contains('highlight')).toBe(false);
        });
    });

    describe('Text Processing', () => {
        test('should return plain text when allowHtml is false', () => {
            const opt = document.createElement('option');
            opt.text = '<b>Bold</b> text';
            document.body.appendChild(opt);
            
            const model = new OptionModel({ allowHtml: false }, opt);
            expect(model.text).not.toContain('<b>');
        });

        test('should preserve HTML when allowHtml is true', () => {
            const opt = document.createElement('option');
            opt.text = '<b>Bold</b> text';
            document.body.appendChild(opt);
            
            const model = new OptionModel({ allowHtml: true }, opt);
            expect(model.text).toContain('<b>');
        });
    });
});