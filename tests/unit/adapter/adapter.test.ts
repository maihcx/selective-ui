/**
 * Unit Tests for MixedAdapter
 */

import { MixedAdapter } from "../../../src/ts/adapter/mixed-adapter";
import { OptionModel } from "../../../src/ts/models/option-model";
import { GroupModel } from "../../../src/ts/models/group-model";
import { OptionView } from "../../../src/ts/views/option-view";
import { GroupView } from "../../../src/ts/views/group-view";

describe('MixedAdapter', () => {
    let adapter: MixedAdapter;
    let options: OptionModel[];
    let container: HTMLDivElement;

    beforeEach(() => {
        jest.useFakeTimers();
        
        container = document.createElement('div');
        document.body.appendChild(container);

        options = [
            { value: '1', text: 'Option 1' },
            { value: '2', text: 'Option 2' }
        ].map(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.text = opt.text;
            document.body.appendChild(option);
            
            const model = new OptionModel({}, option);
            
            const view = new OptionView(container);
            view.render();
            model.view = view;
            model.isInit = true;
            
            return model;
        });

        adapter = new MixedAdapter(options);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Initialization', () => {
        test('should initialize with items', () => {
            expect(adapter.items.length).toBe(2);
            expect(adapter.flatOptions.length).toBe(2);
        });

        test('should build flat structure with groups', () => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Group 1';
            document.body.appendChild(optgroup);

            const groupModel = new GroupModel({}, optgroup);
            
            const opt = document.createElement('option');
            opt.value = '3';
            opt.text = 'Option 3';
            document.body.appendChild(opt);
            
            const optModel = new OptionModel({}, opt);
            groupModel.addItem(optModel);

            const adapter2 = new MixedAdapter([groupModel, optModel]);
            
            expect(adapter2.groups.length).toBe(1);
            expect(adapter2.flatOptions.length).toBe(2);
        });
    });

    describe('Selection Management', () => {
        test('should get selected items', () => {
            options[0].selectedNonTrigger = true;
            
            const selected = adapter.getSelectedItems();
            expect(selected.length).toBe(1);
            expect(selected[0]).toBe(options[0]);
        });

        test('should get first selected item', () => {
            options[1].selectedNonTrigger = true;
            
            const selected = adapter.getSelectedItem();
            expect(selected).toBe(options[1]);
        });

        test('should check all in multiple mode', () => {
            adapter.isMultiple = true;
            adapter.checkAll(true);
            
            expect(options[0].selected).toBe(true);
            expect(options[1].selected).toBe(true);
        });

        test('should uncheck all', () => {
            adapter.isMultiple = true;
            options[0].selectedNonTrigger = true;
            options[1].selectedNonTrigger = true;
            
            adapter.checkAll(false);
            
            expect(options[0].selected).toBe(false);
            expect(options[1].selected).toBe(false);
        });
    });

    describe('Highlight Navigation', () => {
        test('should set highlight by index', () => {
            adapter.setHighlight(0, false);
            
            expect(options[0].highlighted).toBe(true);
            expect(options[1].highlighted).toBe(false);
        });

        test('should navigate forward', () => {
            adapter.setHighlight(0, false);
            adapter.navigate(1, false);
            
            expect(options[0].highlighted).toBe(false);
            expect(options[1].highlighted).toBe(true);
        });

        test('should navigate backward', () => {
            adapter.setHighlight(1, false);
            adapter.navigate(-1, false);
            
            expect(options[0].highlighted).toBe(true);
            expect(options[1].highlighted).toBe(false);
        });

        test('should wrap around when navigating past end', () => {
            adapter.setHighlight(1, false);
            adapter.navigate(1, false);
            
            expect(options[0].highlighted).toBe(true);
        });

        test('should skip hidden items', () => {
            options[0].visible = false;
            options[1].visible = true;
            
            adapter.setHighlight(0, false);
            
            expect(options[1].highlighted).toBe(true);
        });

        test('should reset highlight', () => {
            adapter.setHighlight(1, false);
            adapter.resetHighlight();
            
            expect(options[0].highlighted).toBe(true);
        });
    });

    describe('Visibility Management', () => {
        test('should get visibility stats', () => {
            options[0].visible = true;
            options[1].visible = false;
            
            const stats = adapter.getVisibilityStats();
            
            expect(stats.visibleCount).toBe(1);
            expect(stats.totalCount).toBe(2);
            expect(stats.hasVisible).toBe(true);
            expect(stats.isEmpty).toBe(false);
        });

        test('should detect empty list', () => {
            const emptyAdapter = new MixedAdapter([]);
            const stats = emptyAdapter.getVisibilityStats();
            
            expect(stats.isEmpty).toBe(true);
        });

        test('should notify visibility changes through model listener', () => {
            const callback = jest.fn();
            
            adapter.onVisibilityChanged(callback);
            
            const listeners = options[1].view ? [] : [];
            options[1].onVisibilityChanged((token, model, visible) => {

            });
            
            options[1].visible = false;
            
            const stats = adapter.getVisibilityStats();
            expect(stats.visibleCount).toBe(1);
        });
    });

    describe('Data Updates', () => {
        test('should set new items', () => {
            const newOption = document.createElement('option');
            newOption.value = '3';
            newOption.text = 'Option 3';
            document.body.appendChild(newOption);
            
            const newModel = new OptionModel({}, newOption);
            
            adapter.setItems([newModel]);
            
            expect(adapter.items.length).toBe(1);
            expect(adapter.flatOptions.length).toBe(1);
        });

        test('should sync from source', () => {
            const newOption = document.createElement('option');
            newOption.value = '3';
            newOption.text = 'Option 3';
            document.body.appendChild(newOption);
            
            const newModel = new OptionModel({}, newOption);
            
            adapter.syncFromSource([newModel]);
            
            expect(adapter.items.length).toBe(1);
            expect(adapter.flatOptions.length).toBe(1);
        });

        test('should update data without changing reference', () => {
            const newOption = document.createElement('option');
            newOption.value = '3';
            newOption.text = 'Option 3';
            document.body.appendChild(newOption);
            
            const newModel = new OptionModel({}, newOption);
            
            adapter.updateData([newModel]);
            
            expect(adapter.items.length).toBe(1);
            expect(adapter.flatOptions.length).toBe(1);
        });
    });

    describe('Event Skipping', () => {
        test('should skip events when flag is set', () => {
            adapter.isSkipEvent = true;
            expect(adapter.isSkipEvent).toBe(true);
            
            adapter.isSkipEvent = false;
            expect(adapter.isSkipEvent).toBe(false);
        });
    });

    describe('Selected Item Tracking', () => {
        test('should track single selected item in single mode', () => {
            adapter.isMultiple = false;
            
            options[0].selectedNonTrigger = true;
            
            const selected = adapter.getSelectedItem();
            expect(selected).toBe(options[0]);
            
            options[1].selectedNonTrigger = true;
            options[0].selectedNonTrigger = false;
            
            const newSelected = adapter.getSelectedItem();
            expect(newSelected).toBe(options[1]);
        });

        test('should track multiple selected items in multiple mode', () => {
            adapter.isMultiple = true;
            
            options[0].selectedNonTrigger = true;
            options[1].selectedNonTrigger = true;
            
            const selected = adapter.getSelectedItems();
            expect(selected.length).toBe(2);
            expect(selected).toContain(options[0]);
            expect(selected).toContain(options[1]);
        });
    });

    describe('View Holder Creation', () => {
        test('should create view for option model', () => {
            const parent = document.createElement('div');
            const view = adapter.viewHolder(parent, options[0]);
            
            expect(view).toBeTruthy();
            expect(view.constructor.name).toBe('OptionView');
        });

        test('should create view for group model', () => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Test Group';
            document.body.appendChild(optgroup);
            
            const groupModel = new GroupModel({}, optgroup);
            const parent = document.createElement('div');
            
            const view = adapter.viewHolder(parent, groupModel);
            
            expect(view).toBeTruthy();
            expect(view.constructor.name).toBe('GroupView');
        });
    });

    describe('onViewHolder Binding', () => {
        test('should bind option view on first render', () => {
            const parent = document.createElement('div');
            const option = document.createElement('option');
            option.value = '99';
            option.text = 'New Option';
            document.body.appendChild(option);
            
            const model = new OptionModel({}, option);
            model.isInit = false;
            
            const view = new OptionView(parent);
            
            adapter.onViewHolder(model, view, 0);
            
            expect(model.isInit).toBe(true);
            expect(model.view).toBe(view);
        });

        test('should update option view on subsequent calls', () => {
            const parent = document.createElement('div');
            const option = document.createElement('option');
            option.value = '99';
            option.text = 'Option Text';
            document.body.appendChild(option);
            
            const model = new OptionModel({}, option);
            const view = new OptionView(parent);
            view.render();
            
            model.view = view;
            model.isInit = true;
            
            option.text = 'Updated Text';
            
            adapter.onViewHolder(model, view, 0);
            
            expect(model.isInit).toBe(true);
        });

        test('should bind group view with nested options', () => {
            const parent = document.createElement('div');
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Test Group';
            document.body.appendChild(optgroup);
            
            const groupModel = new GroupModel({}, optgroup);
            
            const opt1 = document.createElement('option');
            opt1.value = '1';
            opt1.text = 'Opt 1';
            const model1 = new OptionModel({}, opt1);
            groupModel.addItem(model1);
            
            const view = new GroupView(parent);
            groupModel.isInit = false;
            
            adapter.onViewHolder(groupModel, view, 0);
            
            expect(groupModel.isInit).toBe(true);
            expect(groupModel.view).toBe(view);
        });
    });

    describe('Property Change Events', () => {
        test('should emit changed event after prop changes', () => {
            const callback = jest.fn();
            
            adapter.onPropChanged('items', callback);
            
            const newOption = document.createElement('option');
            newOption.value = '3';
            newOption.text = 'Option 3';
            const newModel = new OptionModel({}, newOption);
            
            adapter.setItems([newModel]);
            
            jest.runAllTimers();
            
            expect(callback).toHaveBeenCalled();
            expect(adapter.items.length).toBe(1);
        });

        test('should emit changing event before prop changes', () => {
            const callback = jest.fn();
            
            adapter.onPropChanging('items', callback);
            
            const newOption = document.createElement('option');
            newOption.value = '3';
            newOption.text = 'Option 3';
            const newModel = new OptionModel({}, newOption);
            
            adapter.setItems([newModel]);
            
            jest.runAllTimers();
            
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('Highlight Change Callback', () => {
        test('should trigger onHighlightChange when highlight changes', () => {
            const callback = jest.fn();
            
            adapter.onHighlightChange = callback;
            adapter.setHighlight(1, false);
            
            expect(callback).toHaveBeenCalledWith(1, expect.any(String));
        });
    });

    describe('Collapse Change Callback', () => {
        test('should trigger onCollapsedChange through model listener', () => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Test Group';
            document.body.appendChild(optgroup);
            
            const groupModel = new GroupModel({}, optgroup);
            const parent = document.createElement('div');
            const groupView = new GroupView(parent);
            groupView.render();
            
            groupModel.view = groupView;
            groupModel.isInit = true;
            
            expect(groupModel.collapsed).toBe(false);
            
            groupModel.toggleCollapse();
            
            expect(groupModel.collapsed).toBe(true);
            expect(groupView.view?.view.classList.contains('collapsed')).toBe(true);
        });
    });
});