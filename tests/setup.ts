/**
 * Test Setup for Selective UI
 * Configures JSDOM environment and global utilities
 */

import '@testing-library/jest-dom';
import MutationObserver from 'mutation-observer'

class MockResizeObserver implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) { }

    disconnect(): void { }
    observe(): void { }
    unobserve(): void { }
}

class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(
        _callback: IntersectionObserverCallback,
        _options?: IntersectionObserverInit
    ) { }

    disconnect(): void { }
    observe(): void { }
    unobserve(): void { }
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

global.MutationObserver = MutationObserver;
global.ResizeObserver = MockResizeObserver;
global.IntersectionObserver = MockIntersectionObserver;

global.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    window.setTimeout(callback, 0);

global.cancelAnimationFrame = (id: number): void =>
    window.clearTimeout(id);

if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

document.documentElement.style.fontSize = '16px';

interface SelectOption {
    value: string;
    text: string;
    selected?: boolean;
    dataset?: Record<string, string>;
}

interface SelectGroup {
    label: string;
    options: SelectOption[];
}

interface CreateSelectOptions {
    id?: string;
    name?: string;
    multiple?: boolean;
    disabled?: boolean;
    dataset?: Record<string, string>;
    options?: SelectOption[];
    groups?: SelectGroup[];
}

global.createSelect = (
    options: CreateSelectOptions = {}
): HTMLSelectElement => {
    const select = document.createElement('select');

    if (options.id) select.id = options.id;
    if (options.name) select.name = options.name;
    if (options.multiple) select.multiple = true;
    if (options.disabled) select.disabled = true;

    if (options.dataset) {
        Object.keys(options.dataset).forEach(key => {
            select.dataset[key] = options.dataset![key];
        });
    }

    if (options.options) {
        options.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.text;
            if (opt.selected) option.selected = true;

            if (opt.dataset) {
                Object.keys(opt.dataset).forEach(key => {
                    option.dataset[key] = opt.dataset![key];
                });
            }

            select.appendChild(option);
        });
    }

    if (options.groups) {
        options.groups.forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;

            group.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.text = opt.text;
                if (opt.selected) option.selected = true;
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        });
    }

    document.body.appendChild(select);
    return select;
};

global.waitFor = (ms = 0): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

global.waitForCondition = async (
    condition: () => boolean,
    timeout = 1000
): Promise<void> => {
    const startTime = Date.now();

    while (!condition()) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for condition');
        }
        await (global).waitFor(10);
    }
};

afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllTimers();
});

(global).console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};