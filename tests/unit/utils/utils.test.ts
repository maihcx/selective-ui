/**
 * Unit Tests for Utility Functions
 */
import { iEvents } from "../../../src/ts/utils/ievents";
import { Libs } from "../../../src/ts/utils/libs";

describe('Libs Utility Functions', () => {
    describe('jsCopyObject()', () => {
        test('should deep copy object', () => {
            const original = { a: 1, b: { c: 2 } };
            const copy = Libs.jsCopyObject(original);
            
            expect(copy).toEqual(original);
            expect(copy).not.toBe(original);
            expect(copy.b).not.toBe(original.b);
        });

        test('should deep copy array', () => {
            const original = [1, [2, 3], { a: 4 }];
            const copy = Libs.jsCopyObject(original);
            
            expect(copy).toEqual(original);
            expect(copy).not.toBe(original);
            expect(copy[1]).not.toBe(original[1]);
        });

        test('should return primitives as-is', () => {
            expect(Libs.jsCopyObject(123)).toBe(123);
            expect(Libs.jsCopyObject('test')).toBe('test');
            expect(Libs.jsCopyObject(null)).toBe(null);
        });
    });

    describe('randomString()', () => {
        test('should generate string of correct length', () => {
            expect(Libs.randomString(6).length).toBe(6);
            expect(Libs.randomString(10).length).toBe(10);
        });

        test('should generate different strings', () => {
            const str1 = Libs.randomString();
            const str2 = Libs.randomString();
            expect(str1).not.toBe(str2);
        });

        test('should contain only alphanumeric characters', () => {
            const str = Libs.randomString(20);
            expect(str).toMatch(/^[A-Za-z0-9]+$/);
        });
    });

    describe('getElements()', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div class="test-class"></div>
                <div class="test-class"></div>
                <div id="test-id"></div>
            `;
        });

        test('should return array from selector', () => {
            const elements = Libs.getElements('.test-class');
            expect(Array.isArray(elements)).toBe(true);
            expect(elements.length).toBe(2);
        });

        test('should return array from single element', () => {
            const div = document.querySelector('#test-id');
            const elements = Libs.getElements(div);
            expect(elements.length).toBe(1);
            expect(elements[0]).toBe(div);
        });

        test('should return empty array for null', () => {
            expect(Libs.getElements(null)).toEqual([]);
        });

        test('should handle NodeList', () => {
            const nodeList = document.querySelectorAll('.test-class');
            const elements = Libs.getElements(nodeList);
            expect(elements.length).toBe(2);
        });
    });

    describe('stripHtml()', () => {
        test('should remove all HTML tags', () => {
            const html = '<div>Hello <strong>World</strong></div>';
            expect(Libs.stripHtml(html)).toBe('Hello World');
        });

        test('should handle nested tags', () => {
            const html = '<div><p><span>Text</span></p></div>';
            expect(Libs.stripHtml(html)).toBe('Text');
        });

        test('should trim whitespace', () => {
            const html = '  <div>  Text  </div>  ';
            expect(Libs.stripHtml(html)).toBe('Text');
        });
    });

    describe('string2normalize()', () => {
        test('should remove Vietnamese diacritics', () => {
            expect(Libs.string2normalize('Tiếng Việt')).toBe('tieng viet');
            expect(Libs.string2normalize('ĂÂÊÔƠƯ')).toBe('aaeoou');
        });

        test('should convert to lowercase', () => {
            expect(Libs.string2normalize('HELLO')).toBe('hello');
        });

        test('should handle null', () => {
            expect(Libs.string2normalize(null)).toBe('');
        });
    });

    describe('string2Boolean()', () => {
        test('should convert truthy strings', () => {
            expect(Libs.string2Boolean('true')).toBe(true);
            expect(Libs.string2Boolean('1')).toBe(true);
            expect(Libs.string2Boolean('yes')).toBe(true);
            expect(Libs.string2Boolean('on')).toBe(true);
        });

        test('should convert falsy strings', () => {
            expect(Libs.string2Boolean('false')).toBe(false);
            expect(Libs.string2Boolean('0')).toBe(false);
            expect(Libs.string2Boolean('no')).toBe(false);
            expect(Libs.string2Boolean('off')).toBe(false);
        });

        test('should handle boolean input', () => {
            expect(Libs.string2Boolean(true)).toBe(true);
            expect(Libs.string2Boolean(false)).toBe(false);
        });

        test('should handle numbers', () => {
            expect(Libs.string2Boolean(1)).toBe(true);
            expect(Libs.string2Boolean(0)).toBe(false);
        });
    });

    describe('parseSelectToArray()', () => {
        test('should parse flat options', () => {
            const select = createSelect({
                options: [
                    { value: '1', text: 'Option 1' },
                    { value: '2', text: 'Option 2' }
                ]
            });

            const result = Libs.parseSelectToArray(select);
            expect(result.length).toBe(2);
            expect(result[0].tagName).toBe('OPTION');
        });

        test('should parse optgroups', () => {
            const select = createSelect({
                groups: [
                    {
                        label: 'Group 1',
                        options: [
                            { value: '1', text: 'Option 1' }
                        ]
                    }
                ]
            });

            const result = Libs.parseSelectToArray(select);
            expect(result[0].tagName).toBe('OPTGROUP');
            expect(result[1].tagName).toBe('OPTION');
            expect(result[1]["__parentGroup"]).toBe(result[0]);
        });
    });

    describe('any2px()', () => {
        test('should convert px to px', () => {
            expect(Libs.any2px('16px')).toBe('16px');
        });

        test('should convert rem to px', () => {
            const result = Libs.any2px('1rem');
            expect(result).toMatch(/^\d+px$/);
        });

        test('should convert vh to px', () => {
            const result = Libs.any2px('10vh');
            expect(result).toMatch(/^\d+(\.\d+)?px$/);
        });
    });
});

describe('iEvents Utility', () => {

    describe('buildEventToken()', () => {
        test('should create token with initial state', () => {
            const { token, callback } = iEvents.buildEventToken();
            
            expect(token.isContinue).toBe(true);
            expect(token.isCancel).toBe(false);
        });

        test('should stop propagation', () => {
            const { token, callback } = iEvents.buildEventToken();
            
            callback.stopPropagation();
            expect(token.isContinue).toBe(false);
        });

        test('should cancel event', () => {
            const { token, callback } = iEvents.buildEventToken();
            
            callback.cancel();
            expect(token.isCancel).toBe(true);
            expect(token.isContinue).toBe(false);
        });
    });

    describe('callEvent()', () => {
        test('should call handlers in order', () => {
            const order = [];
            const handler1 = jest.fn(() => order.push(1));
            const handler2 = jest.fn(() => order.push(2));

            iEvents.callEvent(null, handler1, handler2);

            expect(order).toEqual([1, 2]);
        });

        test('should stop on cancel', () => {
            const handler1 = jest.fn((cb) => cb.cancel());
            const handler2 = jest.fn();

            iEvents.callEvent(null, handler1, handler2);

            expect(handler1).toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
        });

        test('should pass parameters', () => {
            const handler = jest.fn();
            const params = ['test', 123];

            iEvents.callEvent(params, handler);

            expect(handler).toHaveBeenCalledWith(
                expect.anything(),
                'test',
                123
            );
        });
    });
});