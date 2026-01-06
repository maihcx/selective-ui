import { DatasetObserver } from '../../../src/js/services/dataset-observer';

describe('DatasetObserver branch coverage', () => {
    let element;
    let mutationCallback;

    beforeEach(() => {
        jest.useFakeTimers();

        element = document.createElement('div');
        element.dataset.foo = 'bar';

        // MOCK MutationObserver
        global.MutationObserver = jest.fn(cb => {
            mutationCallback = cb;
            return {
                observe: jest.fn(),
                disconnect: jest.fn()
            };
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('does NOT call onChanged when no data-* attributes changed', () => {
        const observer = new DatasetObserver(element);
        observer.onChanged = jest.fn();

        mutationCallback([
            { type: 'attributes', attributeName: 'class' }
        ]);

        jest.advanceTimersByTime(100);

        expect(observer.onChanged).not.toHaveBeenCalled();
    });

    test('calls onChanged when data-* attribute changes', () => {
        const observer = new DatasetObserver(element);
        observer.onChanged = jest.fn();

        element.dataset.foo = 'baz';

        mutationCallback([
            { type: 'attributes', attributeName: 'data-foo' }
        ]);

        jest.advanceTimersByTime(60);

        expect(observer.onChanged).toHaveBeenCalledTimes(1);
        expect(observer.onChanged).toHaveBeenCalledWith(
            expect.objectContaining({ foo: 'baz' })
        );
    });
});