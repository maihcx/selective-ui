
/**
 * Unit Tests for GroupView (additional tests)
 */

import { GroupView } from "../../../src/ts/views/group-view";

describe('GroupView (additional)', () => {
    let parent;

    beforeEach(() => {
        parent = document.createElement('div');
        document.body.appendChild(parent);
        jest.clearAllMocks();
    });

    describe('Rendering – parent append & roles', () => {
        test('should append root view to parent container', () => {
            const view = new GroupView(parent);
            view.render();

            const viewEl = view.getView();
            expect(parent.contains(viewEl)).toBe(true);
        });

        test('should set proper roles on header and items', () => {
            const view = new GroupView(parent);
            view.render();

            const header = view.view.tags.GroupHeader;
            const items = view.view.tags.GroupItems;

            expect(header.getAttribute('role')).toBe('presentation');
            expect(items.getAttribute('role')).toBe('group');
        });
    });

    describe('ARIA linkage', () => {
        test('root aria-labelledby should point to header id', () => {
            const view = new GroupView(parent);
            view.render();

            const root = view.getView();
            const header = view.view.tags.GroupHeader;

            const ariaLabelledBy = root.getAttribute('aria-labelledby');
            expect(ariaLabelledBy).toBe(header.id);
        });

        test('ids follow seui-*-group / seui-*-header pattern', () => {
            const view = new GroupView(parent);
            view.render();

            const root = view.getView();
            const header = view.view.tags.GroupHeader;

            expect(root.id).toMatch(/^seui-[A-Za-z0-9]+-group$/);
            expect(header.id).toMatch(/^seui-[A-Za-z0-9]+-header$/);

            // same random token part between root and header
            const rootToken = root.id.replace(/^seui-/, '').replace(/-group$/, '');
            const headerToken = header.id.replace(/^seui-/, '').replace(/-header$/, '');
            expect(rootToken).toBe(headerToken);
        });
    });

    describe('Update lifecycle', () => {
        test('update() should delegate to updateLabel()', () => {
            const view = new GroupView(parent);
            view.render();

            const spy = jest.spyOn(view, 'updateLabel');
            view.update();

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('updateLabel(null) should not change existing header text', () => {
            const view = new GroupView(parent);
            view.render();

            const header = view.view.tags.GroupHeader;
            header.textContent = 'Initial Label';

            view.updateLabel(null);

            expect(header.textContent).toBe('Initial Label');
        });
    });

    describe('Collapse State (toggle)', () => {
        test('setCollapsed(false) should remove "collapsed" class and set aria-expanded=true', () => {
            const view = new GroupView(parent);
            view.render();

            // Start collapsed then expand
            view.setCollapsed(true);
            expect(view.getView().classList.contains('collapsed')).toBe(true);

            view.setCollapsed(false);
            expect(view.getView().classList.contains('collapsed')).toBe(false);

            const header = view.view.tags.GroupHeader;
            expect(header.getAttribute('aria-expanded')).toBe('true');
        });
    });

    describe('Visibility (mixed children)', () => {
        test('should show when at least one child is visible among hidden children', () => {
            const view = new GroupView(parent);
            view.render();

            const items = view.view.tags.GroupItems;

            const hiddenChild = document.createElement('div');
            hiddenChild.classList.add('hide');

            const visibleChild = document.createElement('div'); // no 'hide' class

            items.appendChild(hiddenChild);
            items.appendChild(visibleChild);

            view.updateVisibility();

            expect(view.getView().classList.contains('hide')).toBe(false);
        });

        test('should hide when all children are hidden (multiple)', () => {
            const view = new GroupView(parent);
            view.render();

            const items = view.view.tags.GroupItems;

            const hidden1 = document.createElement('div');
            hidden1.classList.add('hide');
            const hidden2 = document.createElement('div');
            hidden2.classList.add('hide');

            items.appendChild(hidden1);
            items.appendChild(hidden2);

            view.updateVisibility();

            expect(view.getView().classList.contains('hide')).toBe(true);
        });
    });

    describe('Items Container – identity & type', () => {
        test('getItemsContainer() should return the same element as GroupItems tag', () => {
            const view = new GroupView(parent);
            view.render();

            const containerEl = view.getItemsContainer();
            const tagEl = view.view.tags.GroupItems;

            expect(containerEl).toBe(tagEl);
        });

        test('items container should be an HTMLDivElement', () => {
            const view = new GroupView(parent);
            view.render();

            const containerEl = view.getItemsContainer();
            expect(containerEl).toBeInstanceOf(HTMLDivElement);
        });
    });
});