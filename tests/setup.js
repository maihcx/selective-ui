/**
 * Test Setup for Selective UI
 * Configures JSDOM environment and global utilities
 */

import '@testing-library/jest-dom';

global.MutationObserver = class {
    constructor(callback) {
        this.callback = callback;
    }
    disconnect() {}
    observe() {}
};

global.ResizeObserver = class {
    constructor(callback) {
        this.callback = callback;
    }
    disconnect() {}
    observe() {}
    unobserve() {}
};

global.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

global.IntersectionObserver = class {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() {
        return [];
    }
};

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}
document.documentElement.style.fontSize = '16px';

global.createSelect = (options = {}) => {
    const select = document.createElement('select');
    
    if (options.id) select.id = options.id;
    if (options.name) select.name = options.name;
    if (options.multiple) select.multiple = true;
    if (options.disabled) select.disabled = true;
    
    if (options.dataset) {
        Object.keys(options.dataset).forEach(key => {
            select.dataset[key] = options.dataset[key];
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
                    option.dataset[key] = opt.dataset[key];
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

global.waitFor = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

global.waitForCondition = async (condition, timeout = 1000) => {
    const startTime = Date.now();
    while (!condition()) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for condition');
        }
        await waitFor(10);
    }
};

afterEach(() => {
    document.body.innerHTML = '';
    
    jest.clearAllTimers();
});

global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};