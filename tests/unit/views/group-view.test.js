/**
 * Unit Tests for GroupView
 */

describe('GroupView', () => {
    const { GroupView } = require("../../../src/js/views/group-view");
    let parent;

    beforeEach(() => {
        parent = document.createElement('div');
        document.body.appendChild(parent);
    });

    describe('Rendering', () => {
        test('should render group structure', () => {
            const view = new GroupView(parent);
            view.render();
            
            const viewEl = view.getView();
            expect(viewEl.classList.contains('selective-ui-group')).toBe(true);
            expect(view.getTag('GroupHeader')).toBeInTheDocument();
            expect(view.getTag('GroupItems')).toBeInTheDocument();
        });

        test('should have proper ARIA attributes', () => {
            const view = new GroupView(parent);
            view.render();
            
            const viewEl = view.getView();
            expect(viewEl.getAttribute('role')).toBe('group');
            expect(viewEl.hasAttribute('aria-labelledby')).toBe(true);
        });
    });

    describe('Label Update', () => {
        test('should update header label', () => {
            const view = new GroupView(parent);
            view.render();
            
            view.updateLabel('New Label');
            
            const header = view.getTag('GroupHeader');
            expect(header.textContent).toBe('New Label');
        });
    });

    describe('Collapse State', () => {
        test('should set collapsed state', () => {
            const view = new GroupView(parent);
            view.render();
            
            view.setCollapsed(true);
            
            const viewEl = view.getView();
            expect(viewEl.classList.contains('collapsed')).toBe(true);
        });

        test('should update ARIA expanded attribute', () => {
            const view = new GroupView(parent);
            view.render();
            
            view.setCollapsed(true);
            const header = view.getTag('GroupHeader');
            expect(header.getAttribute('aria-expanded')).toBe('false');
            
            view.setCollapsed(false);
            expect(header.getAttribute('aria-expanded')).toBe('true');
        });
    });

    describe('Visibility', () => {
        test('should hide when no visible items', () => {
            const view = new GroupView(parent);
            view.render();
            
            view.getTag('GroupItems').innerHTML = '';
            view.updateVisibility();
            
            expect(view.getView().classList.contains('hide')).toBe(true);
        });

        test('should show when has visible items', () => {
            const view = new GroupView(parent);
            view.render();
            
            const item = document.createElement('div');
            view.getTag('GroupItems').appendChild(item);
            view.updateVisibility();
            
            expect(view.getView().classList.contains('hide')).toBe(false);
        });
    });

    describe('Items Container', () => {
        test('should return items container element', () => {
            const view = new GroupView(parent);
            view.render();
            
            const container = view.getItemsContainer();
            expect(container.classList.contains('selective-ui-group-items')).toBe(true);
        });
    });
});