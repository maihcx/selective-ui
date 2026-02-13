import { ElementAdditionObserver } from '../../../src/ts/services/ea-observer';

let mutationCallback;

beforeAll(() => {
    global.MutationObserver = jest.fn(
        (cb: (mutations: MutationRecord[]) => void) => {
            mutationCallback = cb;
            return {
                observe: jest.fn(),
                disconnect: jest.fn()
            } as unknown as MutationObserver;
        }
    ) as unknown as typeof MutationObserver;
});

describe('ElementAdditionObserver', () => {
    let observer;

    beforeEach(() => {
        document.body.innerHTML = '';
        observer = new ElementAdditionObserver();
        jest.clearAllMocks();
    });

    test('onDetect() registers callback', () => {
        const fn = jest.fn();
        observer.onDetect(fn);
        observer.connect('select');

        const el = document.createElement('select');

        mutationCallback([
            { addedNodes: [el] }
        ]);

        expect(fn).toHaveBeenCalledWith(el);
    });

    test('clearDetect() removes all callbacks', () => {
        const fn = jest.fn();
        observer.onDetect(fn);
        observer.clearDetect();
        observer.connect('select');

        const el = document.createElement('select');

        mutationCallback([
            { addedNodes: [el] }
        ]);

        expect(fn).not.toHaveBeenCalled();
    });

    test('detects direct added element with matching tag', () => {
        const fn = jest.fn();
        observer.onDetect(fn);
        observer.connect('select');

        const select = document.createElement('select');

        mutationCallback([
            { addedNodes: [select] }
        ]);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(select);
    });

    test('detects nested matching elements inside added subtree', () => {
        const fn = jest.fn();
        observer.onDetect(fn);
        observer.connect('select');

        const wrapper = document.createElement('div');
        const select = document.createElement('select');
        wrapper.appendChild(select);

        mutationCallback([
            { addedNodes: [wrapper] }
        ]);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(select);
    });

    test('ignores non-element nodes', () => {
        const fn = jest.fn();
        observer.onDetect(fn);
        observer.connect('select');

        const text = document.createTextNode('abc');

        mutationCallback([
            { addedNodes: [text] }
        ]);

        expect(fn).not.toHaveBeenCalled();
    });

    test('connect() does not create multiple observers', () => {
        observer.connect('select');
        observer.connect('select');

        expect(MutationObserver).toHaveBeenCalledTimes(1);
    });

    test('disconnect() disconnects observer when active', () => {
        observer.connect('select');

        const instance = (MutationObserver as jest.Mock).mock.results[0].value;
        observer.disconnect();

        expect(instance.disconnect).toHaveBeenCalledTimes(1);
    });
});