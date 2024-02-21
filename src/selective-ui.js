// version: 2.1.8
// author: Huynh Cong Xuan Mai
// release date: 17/02/2024
var selectiveUIStored;
! function(_plugin, e) {
    "object" == typeof exports && "undefined" != typeof module ? e(exports) : "function" == typeof define && define.amd ? define(["exports"], e) : e((_plugin = "undefined" != typeof globalThis ? globalThis : _plugin || self).window = _plugin.window || {})
}(this, (function(_plugin) {
    "use strict";
    
    function SelectiveUI(options) {
        let $this = {};
        if (selectiveUIStored) {
            return selectiveUIStored;
        }
        else {
            selectiveUIStored = $this;

            HTMLSelectElement.prototype.selectiveUI = function() {
                return $this.find(this);
            }
        }

        // init method
        $this.Init = function() {
            // merge configs
            $this.CONFIG = LIB.jsExtend($this.CONFIG, options);
            // bind event to document
            // LIB.bindEvents(document, {mousedown: $this.FORM.EVENT.CLICK_EVENT});
            if (!LIB.isMobile) {
                LIB.timerProcess.setExecute('delay_resizer', $this.FORM.EVENT.WINDOW_RESIZE, 100);
                LIB.bindEvents(window, {resize: function() {
                    $this.FORM.EVENT.WINDOW_RESIZE();
                    LIB.timerProcess.run('delay_resizer');
                }, scroll: $this.FORM.EVENT.WINDOW_RESIZE}, true);
            }
            // init
            $this.FORM.DATA.systemIncrement();

            LIB.timerProcess.setExecute('auto_mark_selects', $this.SYSTEM_METHOD.INIT);
            LIB.timerProcess.setExecute('auto_mark_options', $this.SYSTEM_METHOD.AUTO_MARK_OPTIONS);

            return $this;
        };

        // center libraries
        let LIB = {
            isNullOrEmpty(value) {
                return value == null || value === '' || value === 0 || (typeof value === 'string' && value.trim() === '');
            }, getElements(queryCommon){
                let queryItems = typeof queryCommon == 'string' ? document.querySelectorAll(queryCommon) : queryCommon;

                if (LIB.isNullOrEmpty(queryItems)) {
                    return false;
                }
                
                return (!queryItems.entries) ? [queryItems] : queryItems;
            }, getPathOfEvent(event){
                return event && event.composedPath && event.composedPath();
            }, jsExtend() {
                function ObjectMerge(current, updates) {
                    for (var key in updates) {
                        if (!current.hasOwnProperty(key) || typeof updates[key] !== 'object') current[key] = updates[key];
                        else ObjectMerge(current[key], updates[key]);
                    }
                    return current;
                }

                var current = {};
                for (var key in arguments) {
                    const updates = this.jsCopyObject(arguments[key]);
                    if (!LIB.isNullOrEmpty(updates)){
                        current = ObjectMerge(current, updates);
                    }
                }
                return current;
            }, jsCopyObject(obj) {
                if (obj === null || typeof obj !== 'object') {
                    return obj;
                }
            
                let copy = Array.isArray(obj) ? [] : {};
            
                for (let key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        copy[key] = LIB.jsCopyObject(obj[key]);
                    }
                }
            
                return copy;
            }, eventStored: {
                getEventNames() {
                    return Object.keys($this.FORM.event_controlers);
                }, getEvent(element) {
                    return $this.FORM.event_controlers[event_name].filter(({node}) => node === element);
                }, setEvent(element, event_name, handler, options = null) {
                    if (!(event_name in $this.FORM.event_controlers)) {
                        $this.FORM.event_controlers[event_name] = []
                    }

                    $this.FORM.event_controlers[event_name].push({node: element, handler: handler, options: options});
                }, removeEvent(element, event_name, private_handler = null) {
                    var events_removed = [];
                    if (private_handler == null || private_handler == false) {
                        if ($this.FORM.event_controlers[event_name]) {
                            events_removed = $this.FORM.event_controlers[event_name].filter(({node}) => node === element);
                            $this.FORM.event_controlers[event_name] = $this.FORM.event_controlers[event_name].filter(({node}) => node !== element);
                        }
                    }
                    else {
                        var index_delete = 0;
                        $this.FORM.event_controlers[event_name] && $this.FORM.event_controlers[event_name].filter(({node}) => node === element).forEach(({node, handler, options}) => {
                            // node.removeEventListener(event, handler, options)
                            if ($this.FORM.event_controlers[event_name] && private_handler === handler) {
                                events_removed.push($this.FORM.event_controlers[event_name][index_delete]);
                                $this.FORM.event_controlers[event_name].splice(index_delete, 1);
                                return false;
                            }
                            index_delete++;
                        });
                    }

                    if ($this.FORM.event_controlers[event_name] && $this.FORM.event_controlers[event_name].length == 0) {
                        delete $this.FORM.event_controlers[event_name];
                    }

                    return events_removed;
                }
            }, bindEvents(queryCommon, bindOption, options = null) {
                var queryItems = LIB.getElements(queryCommon),
                    bindEvents = Object.keys(bindOption);
                    
                if (queryItems){
                    if (queryItems.length > 0){
                        queryItems.forEach(item => {
                            bindEvents.forEach(event_name => {
                                const handler = bindOption[event_name];
                                LIB.eventStored.setEvent(item, event_name, handler, options);

                                item.addEventListener(event_name, handler, options);
                            });
                        });
                    }
                }
            }, unbindEvents(queryCommon, bindOption){
                var queryItems = LIB.getElements(queryCommon),
                    bindEvents = Object.keys(bindOption);
            
                if (queryItems && queryItems.length > 0){
                    queryItems.forEach(item => {
                        bindEvents.forEach(event_name => {
                            LIB.eventStored.removeEvent(item, event_name, bindOption[event_name]).forEach(function(event_data) {
                                if (bindOption[event_name] == undefined || (event_data.handler.name == bindOption[event_name].name && event_data.handler === bindOption[event_name])) {
                                    item.removeEventListener(event_name, event_data.handler, event_data.options);
                                }
                            });
                        });
                    });
                }
            }, unbindAllEvents(queryCommon){
                var queryItems = LIB.getElements(queryCommon);
                const SYSTEM_EVENT_STOREDS = LIB.eventStored.getEventNames();

                if (queryItems){
                    if (queryItems.length > 0){
                        queryItems.forEach(item => {
                            SYSTEM_EVENT_STOREDS.forEach(event_name => {
                                LIB.eventStored.removeEvent(item, event_name).forEach(event_data => {
                                    item.removeEventListener(event_name, event_data['handler']);
                                });
                            });
                        });
                    }
                }
            }, setStyle(queryCommon, styles, value = null) {
                const apply_styles = typeof styles === 'string' ? { [styles]: value } : { ...styles },
                      queryItems = LIB.getElements(queryCommon);

                if (queryItems && typeof queryItems == 'object'){
                    for (let i = 0; i < queryItems.length; i++){
                        const item = queryItems[i];
                        if (item) {
                            Object.assign(item.style, apply_styles);
                        }
                    }
                }
            }, eventTrigger(element, eventSTR) {
                const event = new Event(eventSTR);
                element.dispatchEvent(event);
            }, keyCreator: (length = 5) => {
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let result = Array(length).fill('').map(() => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
                return "SELECTIVE" + result;
            }, equalObjectWithElement(obj, element) {
                return obj.includes(element)
            }, getConfig(element, system_config) {
                const DATASET = element.dataset;
                let boolArgumentElement = {'disabled': 'disabled', 'multiple': 'multiple'},
                    valArgumentElement = {'offsetWidth': 'offsetWidth'},
                    local_config_1 = {},
                    local_config_2 = {},
                    local_config_3 = {}
                ;
                system_config = this.jsCopyObject(system_config);
                local_config_1 = this.jsCopyObject(system_config);

                for (let configKey in DATASET) {
                    if (typeof(system_config[configKey]) === typeof(true)) {
                        Object.defineProperty(local_config_1, configKey, {get: function() {
                            if (DATASET[configKey] === undefined || DATASET[configKey] === null) {
                                return LIB.str2bool(system_config[configKey]);
                            }
                            return LIB.str2bool(DATASET[configKey]);
                        }});
                    }
                    else {
                        Object.defineProperty(local_config_1, configKey, {get: function() {
                            if (DATASET[configKey] === undefined || DATASET[configKey] === null) {
                                return system_config[configKey];
                            }
                            return DATASET[configKey];
                        }});
                    }
                }

                local_config_2 = Object.create(local_config_1);
                for (let configDrawKey in boolArgumentElement) {
                    const configKey = boolArgumentElement[configDrawKey];

                    Object.defineProperty(local_config_2, configKey, {get: function() {
                        const configValue = !LIB.isNullOrEmpty(element[configKey]) && LIB.str2bool(element[configKey]);
                        if (configValue) {
                            return configValue;
                        }
                        return local_config_1[configKey];
                    }});
                }

                local_config_3 = Object.create(local_config_2);
                for (let configDrawKey in valArgumentElement) {
                    const configKey = valArgumentElement[configDrawKey];
                    Object.defineProperty(local_config_3, configKey, {get: function() {
                        const configValue = element[configDrawKey];
                        if (LIB.isNullOrEmpty(configValue) && configValue !== 0) {
                            return local_config_2[configKey];
                        }
                        return configValue;
                    }});
                }
                
                return local_config_3;
            }, getPos(element = document.documentElement) {
                // var pos = {};
                // pos.width = element.offsetWidth;
                // pos.height = element.offsetHeight;
                // pos.top = element.offsetTop;
                // pos.bottom = pos.width + pos.top;
                // pos.left = element.offsetLeft;
                // pos.right = pos.height + pos.left;
                // return pos;

                var pos = element.getBoundingClientRect();
                var computedStyle = window.getComputedStyle(element);

                pos.width = pos.width > 0 ? pos.width : parseFloat(computedStyle.width.replace('px'));
                pos.height = pos.height > 0 ? pos.height : parseFloat(computedStyle.height.replace('px'));
                return pos;

                // return element.getBoundingClientRect();
            }, nonAccentVietnamese(str) {
                str = str.toLowerCase();
                str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
                str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
                str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
                str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
                str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
                str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
                str = str.replace(/đ/g, "d");
                // Some system encode vietnamese combining accent as individual utf-8 characters
                str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // Huyền sắc hỏi ngã nặng 
                str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
                return str;
            }, str2bool(str) {
                return ['true', 'yes'].includes((str || '').toString().toLowerCase());
            }, XHRSendRequest(objData) {
                let xmlhttp = new XMLHttpRequest(),
                    dataSend = null,
                    isForm = objData.data.constructor === FormData
                ;
                xmlhttp.open(objData.method ?? 'GET', objData.url, objData.async ?? true);
                if (objData.contentType === undefined) {
                    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                }
                else if (typeof objData.contentType === 'string') {
                    xmlhttp.setRequestHeader('Content-type', objData.contentType);
                }
                if (objData.event) {
                    xmlhttp.onreadystatechange = function() {
                        xmlhttp.readyState == 4 && (
                            (xmlhttp.status == 200 && objData.event.done && objData.event.done({statusCode: xmlhttp.status, data: xmlhttp.response})) ||
                            (xmlhttp.status != 200 && objData.event.error && objData.event.error({statusCode: xmlhttp.status, statusText: xmlhttp.statusText, data: xmlhttp.response}))
                        )
                    }
                }
                if (objData.data) {
                    if (isForm) {
                        dataSend = objData.data
                    }
                    else {
                        dataSend = new URLSearchParams();
                        Object.keys(objData.data).forEach(key => {
                            let data_value = objData.data[key];
                            if (!!data_value && data_value.constructor === Object) {
                                dataSend.set(key, JSON.stringify(data_value));
                            }
                            else if (!!data_value && data_value.constructor === Array) {
                                dataSend.set(key, data_value.toString());
                            }
                            else {
                                dataSend.set(key, data_value);
                            }
                        });
                    }
                }
                xmlhttp.send(dataSend);
                return xmlhttp;
            }, text2node(text) {
                return document.createRange().createContextualFragment(text).childNodes;
            }, nodeCreator(data = {node: 'div', ...document.createElement('div')}) {
                let element_creation = document.createElement(data.node);
                return this.nodeCloner(element_creation, data, true);
            }, nodeCloner(node = document.documentElement, _nodeOption = null, systemNodeCreate = false) {
                const nodeOption = { ..._nodeOption };
                const element_creation = systemNodeCreate ? node : node.cloneNode(true);
            
                if (typeof nodeOption.classList === 'string') {
                    element_creation.classList.add(nodeOption.classList);
                } else if (Array.isArray(nodeOption.classList)) {
                    element_creation.classList.add(...nodeOption.classList);
                }
                delete nodeOption.classList;
            
                ['style', 'dataset'].forEach(property => {
                    Object.assign(element_creation[property], nodeOption[property]);
                    delete nodeOption[property];
                });
            
                if (nodeOption.event) {
                    Object.entries(nodeOption.event).forEach(([key, value]) => {
                        element_creation.addEventListener(key, value);
                    });
                    delete nodeOption.event;
                }
            
                Object.entries(nodeOption).forEach(([key, value]) => {
                    if (value === null) {
                        element_creation.removeAttribute(key);
                    } else {
                        element_creation[key] = value;
                    }
                });
            
                return element_creation;
            }, getOffset(el) {
                const rect = el.getBoundingClientRect();
                return {
                  left: rect.left + window.scrollX,
                  top: rect.top + window.scrollY
                };
            }, timerProcess: {
                executeStored: {}, 
                setExecute: function(keyExecute, execute, timeout = 50, once = false) {
                    this.executeStored[keyExecute] = {execute: execute, timeout: timeout, once: once};
                }, run: function(keyExecute) {
                    let execute = this.executeStored[keyExecute];
                    clearTimeout(this.timerRunner[keyExecute])
                    this.timerRunner[keyExecute] = setTimeout(() => {
                        execute && execute.execute();
                        execute.once && (delete this.executeStored[keyExecute]);
                    }, execute.timeout);
                }, timerRunner: {}
            }, getSizeType(value = '') {
                value = String(value);
                let full = value,
                    _1st = value.substring(value.length - 3, value.length),
                    _2nd = value.substring(value.length - 2, value.length),
                    _3nd = value.substring(value.length - 1, value.length);
                let sizeTypes = LIB.sizeTypes;
                if (sizeTypes[full]) return sizeTypes[full];
                else if (sizeTypes[_1st]) return sizeTypes[_1st];
                else if (sizeTypes[_2nd]) return sizeTypes[_2nd];
                else if (sizeTypes[_3nd]) return sizeTypes[_3nd];
                else return 0;
            }, sizeTypes: {
                unknow: 0,
                cm: 1,
                mm: 2,
                in: 3,
                px: 4,
                pt: 5,
                em: 6,
                rem: 7,
                lh: 8,
                vw: 9,
                vh: 10,
                '%': 11,
                auto: 12
            }, isNumeric(str) {
                if (typeof str != "string") return false // we only process strings!  
                return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
                       !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
            }, calc2px(value) {
                let element = LIB.nodeCreator({node: 'div', style: {minWidth: value, width: value, maxWidth: value, minHeight: value, height: value, maxHeight: value, opacity: 0}});
                document.body.appendChild(element);
                let pixelValue = element.offsetHeight;
                element.remove();
                return pixelValue+'px';
            }, replaceChildren(element, ...replace) {
                if (!element) return false;
                try {
                    element.replaceChildren(...replace);
                } catch (error) {
                    while (element.lastChild) {
                        element.lastChild.remove();
                    }
                    if (replace.length > 0) {
                        element.append(...replace);
                    }
                }
                return true;
            }, matchValidKey(key) {
                const validKeys = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz;=,-./`[\\]\'';
                return validKeys.includes(key) || key === ' ' || key === 'Enter' || key === 'Backspace';
            }, tagTranslate(str_tag) {
                return str_tag.replace(/&lt;`/g, '<').replace(/`&gt;/g, '>').replace(/<`/g, '<').replace(/`>/g, '>');
            }, stripHtml(html) {
               let tmp = document.createElement("DIV");
               tmp.innerHTML = html;
               let text_tmp = tmp.textContent || tmp.innerText || "";
               tmp.remove();
               return text_tmp.trim();
            }, isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        };
        $this.LIB = LIB;

        // system configs
        $this.CONFIG = {
            showPanel: true,
            panelstyle: 'top',
            multiple: false,
            width: '0px',
            minWidth: '50px',
            defaultWidth: '200px',
            offsetWidth: null,
            height: '220px',
            disabled: false,
            readonly: false,
            panelClass: 'selectiveUI-main-render',
            selectall: true,
            placeholder: 'Chọn giá trị',
            autoclose: false,
            autocloseSelectall: false,
            autoscroll: false,
            autofocus: true,
            searchable: true,
            cacheable: true,
            loadingfield: false,
            visible: true,
            skipError: false,
            textloading: 'Đang xử lý...',
            textnodata: 'Không có dữ liệu',
            textnotfound: 'Không tìm thấy',
            animationtime: 200, // milisecond
            delaysearchtime: 200 // milisecond
        };

        $this.FORM = {
            DATA: {
                keys: {},
                selectObject: {},
                selectObjectShowed: {},
                mutationObserver: null,
                eventHandle: {},
                eventStories: {},
                listKeysControl: ['Escape', 'ArrowUp', 'ArrowDown', 'Enter'],
                systemEventStories: {sys_on_load: {add: function(act, key) {
                    $this.FORM.DATA.systemEventStories.sys_on_load.data[key] = act;
                }, data: {}}},
                get is_initialization() {
                    return $this.FORM.DATA.local_is_initialization;
                }, set is_initialization(value) {
                    if (value.value != $this.FORM.DATA.local_is_initialization) {
                        $this.FORM.DATA.local_is_initialization = value.value;
                        if (value.value) {
                            $this.FORM.EVENT.SYSTEM_INITTIALIZED(value.value, value.key, $this.find(value.executionMark));
                        }
                    }
                },
                local_is_initialization: false,
                timer_stored: {
                    stick: 200,
                    sys_check_load: {
                        run: function(key, executionMark) {
                            $this.FORM.DATA.timer_stored.sys_check_load.time = setTimeout(() => {
                                $this.FORM.DATA.is_initialization = {value: true, key: key, executionMark: executionMark};
                            }, $this.FORM.DATA.timer_stored.stick);
                        }, time: null, reset: function() {
                            if ($this.FORM.DATA.timer_stored.sys_check_load.time != null) {
                                clearTimeout($this.FORM.DATA.timer_stored.sys_check_load.time);
                            }
                        }
                    }
                },
                systemIncrement: function(){
                    // add processor code to body
                    const MAIN_DIV = document.createElement('div');
                    MAIN_DIV.id = 'selective_ui_main';
                    document.body.appendChild(MAIN_DIV);

                    // listeners new option and select added //
                    $this.FORM.DATA.mutationObserver = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            if (mutation.attributeName != 'data-position' && mutation.attributeName != 'data-key' && mutation.attributeName != 'style' && mutation.attributeName != 'data-uishow') {
                                if (mutation.target.classList && !mutation.target.classList.contains('selectiveUI-selected-panel') && 
                                    !mutation.target.classList.contains('selectiveUI-placeholder') && 
                                    !mutation.target.classList.contains('selective-ui-layout')) {
                                    // added node
                                    if (mutation.addedNodes.length > 0) {
                                        mutation.addedNodes.forEach(nodeExcuted => {
                                            if (nodeExcuted.nodeName != 'SELECT' && nodeExcuted.nodeName != 'OPTION') {
                                                let find_select = function(element) {
                                                    if (element.childNodes) {
                                                        element.childNodes.forEach(child_element => {
                                                            find_select(child_element);
                                                            if (child_element.nodeName == 'SELECT') {
                                                                nodeExcuted = child_element;
                                                            }
                                                        });
                                                    }
                                                }
                                                find_select(nodeExcuted);
                                            }
                                            switch (nodeExcuted.nodeName) {
                                                case 'SELECT':
                                                    if (!nodeExcuted.classList.contains('selectiveUI-INIT')) {
                                                        LIB.timerProcess.run('auto_mark_selects');
                                                    }
                                                    break;
                                            
                                                case 'OPTION':
                                                    LIB.timerProcess.run('auto_mark_options');
                                                    break;
                                            }
                                        });
                                    }
                                    // removed node
                                    if (mutation.removedNodes.length > 0) {
                                        mutation.removedNodes.forEach(nodeExcuted => {
                                            switch (nodeExcuted.nodeName) {
                                                // case 'SELECT':
                                                //     break;
                                            
                                                case 'OPTION':
                                                    LIB.timerProcess.run('auto_mark_options');
                                                    break;
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    });
                    $this.FORM.DATA.mutationObserver.observe(document.documentElement, {
                        attributes: true,
                        characterData: true,
                        childList: true,
                        subtree: true,
                        attributeOldValue: true,
                        characterDataOldValue: true
                    });
                    // ==== //
                }, systemLayoutIncrement: function(executionMark){
                    // render style
                    const styleString = `${executionMark} {
                            border: 1px solid #ccc;
                            font-size: 14px;
                            color: #707070;
                            background: #fbfbfb;
                            padding: 5px;
                            outline: none;
                            border-radius: 4px;
                            min-width: ${$this.FORM.DATA.keys[executionMark].options.minWidth};
                            height: 30px;
                            align-items: center;
                            vertical-align: middle;
                            white-space: nowrap;
                            overflow: hidden;
                            scrollbar-width: none;
                            opacity: 0;
                        }
                        ${executionMark} {
                            cursor: text;
                            -webkit-appearance: none;
                        }
                        ${executionMark}:disabled,
                        ${executionMark}[data-read-only] {
                            cursor: not-allowed;
                        }
                        ${executionMark} option {
                            display: none;
                        }`
                    ;

                    const PANEL_REMOVE = document.getElementById('layout_' + $this.FORM.DATA.keys[executionMark].secretKey);
                    !LIB.isNullOrEmpty(PANEL_REMOVE) && PANEL_REMOVE.remove();

                    const DIV_LAYOUT = LIB.nodeCreator({node: 'div', classList: 'selective-ui-layout', id: 'layout_' + $this.FORM.DATA.keys[executionMark].secretKey}),
                            STYLE_LAYOUT = document.createElement('style');

                    STYLE_LAYOUT.appendChild(document.createTextNode(styleString));
                    DIV_LAYOUT.appendChild(STYLE_LAYOUT);
                    
                    let selective_ui_main = document.getElementById('selective_ui_main');
                    if (selective_ui_main) {
                        selective_ui_main.appendChild(DIV_LAYOUT);
                        $this.FORM.DATA.keys[executionMark].panelLayout = DIV_LAYOUT;
                    }
                }
            }, EVENT: {
                WINDOW_RESIZE: function(event) {
                    if (!(event && event.target && event.target.classList && event.target.classList.contains($this.CONFIG.panelClass))) {
                        for (let selectKey in $this.FORM.DATA.selectObject) {
                            $this.SYSTEM_METHOD.RESIZE_SELECT_PANEL($this.FORM.DATA.selectObject[selectKey]);
                        }
                    }
                }, BIND_OPTION_KEYPROCESS: function(selectObj, INSIDE_CONFIG) {
                    let obj_select = selectObj.selectPanel.panelControls,
                        SEARCH_INPUT = obj_select.searchBox,
                        OPTIONS_VIEW = obj_select.optionsView
                    ;
                    if (!OPTIONS_VIEW) return;
                    let optionItems = OPTIONS_VIEW.objOptions;

                    let itemFocusing = {
                            get item() {
                                let filterFocused = optionItems.filter(item => item.focused === true);
                                if (filterFocused.length > 0) {
                                    return filterFocused[0];
                                }
                                
                                let filterSelected = optionItems.filter(item => item.selected === true);
                                if (filterSelected.length > 0) {
                                    return filterSelected[0];
                                }

                                return null;
                            },
                            set item(drawItem) {
                                drawItem.focused = true;
                            }
                        }
                    ;
                    LIB.bindEvents(SEARCH_INPUT, {
                        keydown: function(event) {
                            if (!OPTIONS_VIEW.isItemVisibles && event.key != 'Escape') return false;
                            let current_item_focused = itemFocusing.item;

                            switch (event.key) {
                                // esc
                                case 'Escape':
                                    selectObj.controls.close();
                                    selectObj.overlay.placeholder.element.focus();
                                    break;
                                // arrow up
                                case 'ArrowUp':
                                    if (current_item_focused && current_item_focused.index > 0) {
                                        current_item_focused.prevOption().scrollIntoView().focused = true;
                                    }
                                    break;
                                // arrow down
                                case 'ArrowDown':
                                    if (current_item_focused) {
                                        current_item_focused.nextOption().scrollIntoView().focused = true;
                                    }
                                    else if (!current_item_focused) {
                                        optionItems.filter(item => item.visible === true)[0].scrollIntoView().focused = true;
                                    }
                                    break;
                                // key enter
                                case 'Enter':
                                    let optionFocused = itemFocusing.item;
                                    if (optionFocused) {
                                        optionFocused.selected = !optionFocused.selected;
                                        if (obj_select.select.multiple == true) {
                                            if (INSIDE_CONFIG.autoclose) {
                                                selectObj.controls.close();
                                                selectObj.overlay.placeholder.element.focus();
                                            }
                                        }
                                        else {
                                            selectObj.controls.close();
                                            selectObj.overlay.placeholder.element.focus();
                                        }
                                    }
                                    break;
                            }

                            if ($this.FORM.DATA.listKeysControl.indexOf(event.key) != -1) {
                                event.preventDefault();
                                event.stopPropagation();
                                return false;
                            }
                        }
                    })
                }, BIND_OPTION_MOUSER: function(selectObj, configs = undefined) {
                    let obj_select = selectObj.selectPanel.panelControls,
                        MAIN_PANEL = obj_select.panel, 
                        OPTIONS_VIEW = obj_select.optionsView
                    ;
                    if (!obj_select.optionsView) return;
                    let UI_OPTIONS = OPTIONS_VIEW.objOptions, isMouseAtive = false
                    
                    LIB.unbindEvents(MAIN_PANEL, {mousedown: null, click: null, mouseover: null, mousemove: null});
                    LIB.bindEvents(MAIN_PANEL, {
                        // option selector
                        mousedown: function(event) {
                            event.stopPropagation();
                        },
                        click: function(event) {
                            event.preventDefault();
                            event.stopPropagation();

                            let EVENT_PATH = LIB.getPathOfEvent(event)[0],
                                GROUP_ITEM = $this.SYSTEM_METHOD.DEEP_FIND(EVENT_PATH, {classList: 'group-item'}),
                                GROUP_OTHER = $this.SYSTEM_METHOD.DEEP_FIND(EVENT_PATH, {classList: 'group-other'}),
                                SELECT_ELEMENT = obj_select.select
                            ;

                            if (!GROUP_ITEM && !GROUP_OTHER) return false;
                            if (configs.readonly || configs.disabled) return false;
                            if (SELECT_ELEMENT.multiple) {
                                if (GROUP_ITEM) {
                                    if (GROUP_ITEM.classList.contains('empty-item') || GROUP_ITEM.classList.contains('selectiveUI-center-absolute') || GROUP_ITEM.classList.contains('group-item-searching')) return false;
                                    let UI_OPTION = UI_OPTIONS[GROUP_ITEM.dataset.index];
                                    UI_OPTION.selected = !UI_OPTION.selected;
                                    
                                    if (configs.autoclose) {
                                        selectObj.controls.close();
                                    }
                                }
                                else if (GROUP_OTHER) {
                                    let UI_OPTIONS_VISIBLE = UI_OPTIONS.filter(item => item.visible === true),
                                        flagSelected = (EVENT_PATH.dataset.action == 'selectall');

                                    if (EVENT_PATH.dataset.action) {
                                        UI_OPTIONS_VISIBLE.forEach(UI_OPTION_VISIBLE => {
                                            UI_OPTION_VISIBLE.selected = flagSelected;
                                        });
                                        if (configs.autocloseSelectall) {
                                            selectObj.controls.close();
                                        }
                                    }
                                }
                            }
                            else {
                                if (GROUP_ITEM && GROUP_ITEM.querySelector('input')) {
                                    if (SELECT_ELEMENT.value != GROUP_ITEM.querySelector('input').value) {
                                        UI_OPTIONS[GROUP_ITEM.dataset.index].selected = true;
                                    }
                                    selectObj.controls.close();
                                }
                            }
                        },
                        // mouse hover
                        mouseover: function(event) {
                            event.preventDefault();
                            event.stopPropagation();

                            if (isMouseAtive == false) return;
                            isMouseAtive = false;
                            
                            let EVENT_PATH = LIB.getPathOfEvent(event)[0],
                                GROUP_ITEM = $this.SYSTEM_METHOD.DEEP_FIND(EVENT_PATH, {classList: 'group-item'});
                            ;
                            if (GROUP_ITEM) {
                                let itemFocus = UI_OPTIONS[GROUP_ITEM.dataset.index];
                                itemFocus && (itemFocus.focused = true);
                            }
                        },
                        // mouse move
                        mousemove: function() {
                            isMouseAtive = true;
                        }
                    });
                }, BIND_OPTION_SEARCHER: function(selectObj, objFNC = {}) {
                    let obj_select = selectObj.selectPanel.panelControls,
                        SEARCH_INPUT = obj_select.searchBox, select_element = obj_select.select;
                    let timing_search = null;
                    let loaded = objFNC.loaded, 
                        loading = objFNC.loading, 
                        searched = objFNC.searched;
                    LIB.unbindEvents(SEARCH_INPUT, {mousedown: null, keyup: null, keydown: null});
                    LIB.bindEvents(SEARCH_INPUT, {
                        mousedown: function(event) {
                            event.stopPropagation();
                        },
                        keyup: async function(event){
                            if ($this.FORM.DATA.listKeysControl.indexOf(event.key) != -1) return true;
                            if (LIB.matchValidKey(event.key)) {
                                if (timing_search !== null) {
                                    clearTimeout(timing_search);        
                                }
                                const SEARCH_INPUT = this,
                                      WORKER = $this.SYSTEM_METHOD.AJAX_LOADER(SEARCH_INPUT.value, selectObj, loaded)
                                ;
                                if (WORKER.isDynamic) {
                                    selectObj.ajax.pageNum = 0;
                                    selectObj.ajax.pageTotalNum = 0;
                                    loading && loading();
                                    timing_search = setTimeout(function() {
                                        WORKER.commitWork();
                                    }, selectObj.configs.delaysearchtime);
                                } 
                                else {
                                    obj_select.optionsView.objOptions.forEach(optionControl => {
                                        optionControl.visible = (LIB.nonAccentVietnamese(optionControl.label).includes(LIB.nonAccentVietnamese(SEARCH_INPUT.value)));
                                    });
    
                                    let itemVisibled = obj_select.optionsView.objOptions.filter(item => item.visible === true);
                                    if (itemVisibled.length > 0 && itemVisibled.filter(item => item.focused === true).length == 0) {
                                        itemVisibled[0].focused = true;
                                    }
                                    searched && searched(obj_select.optionsView.objOptions.filter(item => item.visible === true).length > 0);
                                }
                            }
                        }, keydown: async function(event){
                            if (LIB.matchValidKey(event.key)) {
                                const WORKER = $this.SYSTEM_METHOD.AJAX_LOADER(SEARCH_INPUT.value, selectObj, loaded);
                                if (WORKER.isDynamic) {
                                    loading && loading();
                                }
                            }
                        }
                    });
                }, BIND_PANEL_SCROLLER: (selectObj) => {
                    let selectPanel = selectObj.selectPanel?.panel;
                    if (!selectPanel) return false;
                    LIB.unbindEvents(selectPanel, {scroll: null});
                    LIB.bindEvents(selectPanel, {scroll: (event) => {
                        let myAjax = selectObj.ajax;
                        if (myAjax.isDynamic && !myAjax.ajaxLoading && ((selectPanel.scrollTop + selectPanel.clientHeight) >= (selectPanel.scrollHeight - 20))) {
                            if (selectObj.configs.loadingfield) {
                                const optionGroupLoading = LIB.nodeCreator({node: 'div', classList: ['group-item', 'group-item-searching']});
                                optionGroupLoading.appendChild(LIB.nodeCreator({node: 'label', textContent: selectObj.configs.textloading}));
                                selectObj.selectPanel.panel.append(optionGroupLoading);
                            }

                            if (myAjax.pageTotalNum == 0 || myAjax.pageNum < myAjax.pageTotalNum) {
                                const SEARCH_INPUT = selectObj.selectPanel.panelControls.searchBox,
                                    WORKER = $this.SYSTEM_METHOD.AJAX_LOADER(SEARCH_INPUT.value, selectObj, function(isPagination, isPageReplace) {
                                        myAjax.pageNavigation(isPagination, isPageReplace);
                                    }, () => {
                                        document.querySelectorAll('.group-item-searching').forEach((e) => e.remove());
                                    })
                                ;
                                WORKER.isDynamic && WORKER.commitWork();
                            }
                            else {
                                document.querySelectorAll('.group-item-searching').forEach((e) => e.remove());
                            }
                        }
                    }});
                }, SYSTEM_INITTIALIZED: function(value, key, element) {
                    let action = $this.FORM.DATA.systemEventStories.sys_on_load.data[key];
                    action && action(value, element);
                    delete $this.FORM.DATA.systemEventStories.sys_on_load.data[key];
                }
            }, event_controlers: [],
        };

        // method Excution
        $this.SYSTEM_METHOD = {
            EXECUTER: function(styleMark, _options){
                if (LIB.isNullOrEmpty($this.FORM.DATA.keys[styleMark])){
                    $this.FORM.DATA.keys[styleMark] = {
                        options: LIB.jsExtend($this.CONFIG, _options),
                        executionMark: styleMark,
                        secretKey: LIB.keyCreator()
                    }
                }
                return $this.FORM.DATA.keys[styleMark];
            }, INIT: function(loop_act = undefined) {
                for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                    let mark = $this.FORM.DATA.keys[_OBJ_KEY].executionMark,
                        options = $this.FORM.DATA.keys[_OBJ_KEY].options;
                    $this.SYSTEM_METHOD.CREATE_SELECTS(mark, options, loop_act);
                }
            }, CREATE_SELECTS: function(query, stockConfigs, callback = null) {
                const ASYNC_ACTION = async function() {
                    let selectElements = LIB.getElements(query);
                    if (selectElements) {
                        selectElements.forEach(selectElement => {
                            if (selectElement.tagName === 'SELECT' && (!selectElement.dataset || LIB.isNullOrEmpty(selectElement.dataset.memKey))) {
                                let memKey = LIB.keyCreator(10),
                                    configs = LIB.getConfig(selectElement, stockConfigs),
                                    localSelectObj = $this.SYSTEM_METHOD.CREATE_SELECT_ITEM(selectElement, configs, memKey)
                                ;
                                selectElement.dataset.memKey = memKey;
                                localSelectObj.queryString = query;
                                $this.FORM.DATA.selectObject[memKey] = localSelectObj;

                                localSelectObj.overlay.event.on('mousedown', function(event) {
                                    if (configs.readonly || configs.disabled) return false;
                                    let EVENT_PATH = LIB.getPathOfEvent(event)[0];
                                    if (EVENT_PATH.classList.contains('selectiveUI-placeholder')) {
                                        localSelectObj.controls.open(event);
                                    }
                                    else if (EVENT_PATH.classList.contains('selectiveUI-deselect')) {
                                        let deselectValue = EVENT_PATH.dataset.unValue;

                                        selectElement.querySelector(`option[value="${deselectValue}"]`).selected = false;
                                        LIB.eventTrigger(selectElement, 'change');
                                    }
                                });
                                LIB.bindEvents(selectElement, {
                                    change: function() {
                                        localSelectObj.select.change();
                                    }
                                });
                            }
                        });
                    }
                    callback && callback();
                }
                ASYNC_ACTION();
            }, CREATE_SELECT_ITEM: function(selectElement = document.createElement('select'), configs, memKey, callback = null) {
                let resultObj = {};
                let selectObj = {
                    element: selectElement,
                    getOptions: function(isSelected = null) {
                        let query = '';
                        if (isSelected === true) query = ':checked';
                        else if (isSelected === false) query = ':not(:checked)';
                        return selectElement.querySelectorAll('option'+query);
                    }, change: () => {
                        resultObj.overlay.selectedPanel.refresh();
                        resultObj.overlay.placeholder.refresh();
                        $this.SYSTEM_METHOD.RESIZE_SELECT_PANEL(resultObj);

                    }, oldValue: ''
                };
                resultObj.select = selectObj;
                resultObj.overlay = $this.SYSTEM_METHOD.CREATE_SELECT_OVERLAY(resultObj, configs, memKey),
                resultObj.controls = $this.SYSTEM_METHOD.CREATE_SELECT_CONTROLS(resultObj, configs, memKey);
                resultObj.configs = configs;
                selectObj.oldValue = resultObj.controls.value;
                resultObj.key = memKey;

                resultObj.ajax = {
                    get action() {
                        return $this.FORM.DATA.eventStories[resultObj.key] ? $this.FORM.DATA.eventStories[resultObj.key]['dynamicAction'] : null
                    },
                    pageNum: 0,
                    pageTotalNum: 0,
                    ajaxLoading: false,
                    get isDynamic() {
                        return !!resultObj.ajax.action
                    }, pageNavigation: null, isPagination: false
                }
                
                resultObj.overlay.placeholder.element.addEventListener('keydown', function(event) {
                    if (event.key == 'Enter' && !configs.readonly && !configs.disabled) {
                        resultObj.overlay.placeholder.element.blur();
                        resultObj.controls.open(event);
                    }
                })
                
                resultObj.controls.visible = configs.visible;
                callback && callback();
                return resultObj;
            }, CREATE_SELECT_OVERLAY: function(selectObj, configs, memKey, callback = null) {
                let selectElement = selectObj.select.element,
                    selected_panel_classet = ['selectiveUI-MAIN'],
                    result = {};
                (configs.readonly || configs.disabled) && selected_panel_classet.push('readonly-disabled');

                const SELECT_FRAME = LIB.nodeCreator({node: 'div', classList: selected_panel_classet}),
                      SELECT_COMPUTED_STYLE = window.getComputedStyle(selectElement),
                      SELECT_RECT = LIB.getPos(selectElement),
                      SELECT_HEIGHT = LIB.isNullOrEmpty(SELECT_COMPUTED_STYLE.height) ? SELECT_RECT.height + 'px' : SELECT_COMPUTED_STYLE.height,
                      SELECT_OVERLAY = LIB.nodeCreator({node: 'div', classList: ['selectiveUI-placeholder', 'flex-box', 'align-center'], tabIndex: 0, dataset: {panelkey: memKey}, style: {width: '100%', maxWidth: '100%', height: SELECT_HEIGHT, left: '0px'}}),
                      SELECT_OVERLAY_CONTENT = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-placeholder-content', textContent: configs.placeholder}),
                      SELECT_OVERLAY_SYMBOL = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-placeholder-symbol'})
                ;

                // fix select
                if (configs.disabled) {
                    selectElement.disabled = true;
                    selectElement.dataset.disabled = true;
                }
                let WIDTH = LIB.isNullOrEmpty(SELECT_COMPUTED_STYLE.width) ? SELECT_RECT.width + 'px' : SELECT_COMPUTED_STYLE.width;
                if (LIB.getSizeType(configs.width) == LIB.sizeTypes.px && parseInt(configs.width, 10) > 0) {
                    WIDTH = configs.width;
                }
                else if (LIB.getSizeType(configs.width) != LIB.sizeTypes.px) {
                    WIDTH = configs.width;
                }
                if (LIB.getSizeType(WIDTH) == LIB.sizeTypes.auto) {
                    WIDTH = configs.offsetWidth + 'px';
                }
                if (LIB.getSizeType(configs.width) == LIB.sizeTypes.px && parseInt(WIDTH, 10) <= parseInt(configs.minWidth, 10)) WIDTH = configs.defaultWidth;
                LIB.setStyle(SELECT_FRAME, {width: WIDTH, maxWidth: WIDTH});
                selectElement.parentNode.insertBefore(SELECT_FRAME, selectElement);
                selectElement.classList.add('selectiveUI-INIT');
                SELECT_FRAME.appendChild(selectElement);
                result.panel = SELECT_FRAME;

                // make view overlay
                SELECT_OVERLAY.append(SELECT_OVERLAY_CONTENT, SELECT_OVERLAY_SYMBOL);
                if (configs.panelstyle == 'top') {
                    LIB.setStyle(SELECT_OVERLAY, {bottom: '0px', top: null});
                }
                else if (configs.panelstyle == 'bottom') {
                    LIB.setStyle(SELECT_OVERLAY, {top: '0px', bottom: null});
                }
                SELECT_FRAME.appendChild(SELECT_OVERLAY);
                result.placeholder = {
                    element: SELECT_OVERLAY,
                    get() {
                        return SELECT_OVERLAY_CONTENT.textContent;
                    }, set(value) {
                        value && (selectElement.dataset.placeholder = value);
                        this.refresh();
                    }, refresh() {
                        const OPTION_SELECTED = selectElement.options[selectElement.selectedIndex];
                        if (!LIB.isNullOrEmpty(OPTION_SELECTED) && !selectElement.multiple){
                            let viewMask = LIB.stripHtml(LIB.tagTranslate(OPTION_SELECTED.innerHTML));
                            ((OPTION_SELECTED.dataset) && (OPTION_SELECTED.dataset.mask)) && (viewMask = OPTION_SELECTED.dataset.mask);
                            SELECT_OVERLAY_CONTENT.innerHTML = viewMask;
                        }
                        else {
                            SELECT_OVERLAY_CONTENT.textContent = configs.placeholder;
                        }    
                    }
                };
                if (!selectElement.multiple) {
                    result.placeholder.refresh();
                    LIB.bindEvents(selectElement, {
                        change: function() {
                            result.placeholder.refresh();
                        }
                    });
                }

                // make parent overlay
                let selectedPanelProcess = {panel: null, refresh: function() {}};
                if (selectElement.multiple) {
                    let selectedPanel = LIB.nodeCreator({
                        node: 'div', classList: ['selectiveUI-selected-panel', 'selectiveUI-seleted-panel', 'flex-box'], 
                        id: memKey, style: {display: (configs.showPanel == false) ? 'none' : null}
                    });
                    
                    if (configs.panelstyle == 'top') {
                        SELECT_FRAME.insertBefore(selectedPanel, SELECT_OVERLAY);
                    }
                    else {
                        SELECT_FRAME.insertBefore(selectedPanel, SELECT_OVERLAY.nextSibling);
                    }

                    selectedPanelProcess = {
                        panel: selectedPanel,
                        refresh: function() {
                            let selectOptions = selectObj.select.getOptions(true),
                                optionsRendered = [];
                            selectOptions.forEach(selectOption => {
                                let viewMask = LIB.stripHtml(LIB.tagTranslate(selectOption.innerHTML));
                                ((selectOption.dataset) && (selectOption.dataset.mask)) && (viewMask = selectOption.dataset.mask);

                                const DIV_ELEMENT = LIB.nodeCreator({node: 'div', classList: ['selectiveUI-selected-item', 'flex-box', 'align-center']}),
                                      OPTION_MASK_TEXT = (selectOption.dataset?.mask) ? selectOption.dataset.mask : LIB.tagTranslate(selectOption.textContent),
                                      SPAN_VIEW_ELEMENT = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-textshow', innerHTML: viewMask}),
                                      SPAN_CLEAR_ELEMENT = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-deselect', dataset: {unValue: selectOption.value, memKey: memKey}})
                                ;

                                if (typeof mbeatifyUIStored == 'undefined') {
                                    SPAN_VIEW_ELEMENT.title = LIB.stripHtml(OPTION_MASK_TEXT);
                                }
                                else {
                                    SPAN_VIEW_ELEMENT.dataset.title = OPTION_MASK_TEXT;
                                    SPAN_VIEW_ELEMENT.classList.add('m-tooltip-box')
                                }

                                DIV_ELEMENT.append(SPAN_CLEAR_ELEMENT, SPAN_VIEW_ELEMENT);
                                optionsRendered.push(DIV_ELEMENT);
                            });
                            if (optionsRendered.length > 0) {
                                selectedPanel.classList.remove('no-display');
                            }
                            else {
                                selectedPanel.classList.add('no-display');
                            }
                            LIB.replaceChildren(selectedPanel, ...optionsRendered);
                        }
                    }
                    selectedPanelProcess.refresh();
                }
                result.selectedPanel = {
                    isSupport: selectElement.multiple, ...selectedPanelProcess
                }

                // create event
                let localEvent = {mousedown: []};
                result.event = {
                    on (eventType, action) {
                        localEvent[eventType].push(action)
                    }, off (eventType) {
                        localEvent[eventType] = [];
                    }
                }
                for (let keyQuery in localEvent) {
                    const actionArray = localEvent[keyQuery];
                    SELECT_FRAME.addEventListener(keyQuery, function(event) {
                        if (actionArray.length > 0) {
                            actionArray.forEach(action => {
                                action && action(event);
                            });
                        }
                    });
                }
                
                callback && callback();
                return result;
            }, CREATE_SELECT_CONTROLS: function(selectObj, configs, memKey) {
                selectObj.isPanelShowed = false;
                let selectElement = selectObj.select.element,
                    selectOverlay = selectObj.overlay,
                    parentOverlay = selectOverlay.panel,
                    overlayElement = selectOverlay.placeholder.element,
                    overlaySelectedPanel = selectOverlay.selectedPanel,
                    LIB = $this.LIB,
                    isPanelShowing = false
                ;

                Object.defineProperty(selectObj, 'isPanelShowing', {
                    get: function() {
                        return isPanelShowing;
                    }, set: function(value) {
                        isPanelShowing = value;
                        if (value || selectObj.isPanelShowed) {
                            overlayElement.classList.add('show');
                        }
                        else {
                            overlayElement.classList.remove('show');
                        }
                    }
                });

                let act_make_disable_ro_select = function(state) {
                    if (state) {
                        overlaySelectedPanel.isSupport && overlaySelectedPanel.panel.classList.add('readonly-disabled');
                        parentOverlay.classList.add('readonly-disabled');
                    }
                    else {
                        overlaySelectedPanel.isSupport && overlaySelectedPanel.panel.classList.remove('readonly-disabled');
                        parentOverlay.classList.remove('readonly-disabled');
                    }
                    }, activeEvent = true
                ;
                let result = {
                    isShowed: false,
                    renderKey: memKey,
                    get activeEvent() {
                        const booVal = activeEvent;
                        activeEvent = true;
                        return booVal;
                    }, set activeEvent(value) {
                        activeEvent = value;
                    }, open: function(event) {
                        if (configs.readonly || configs.disabled || result.isShowed) return false;
                        (!result.isShowed) && (result.isShowed = true);
                        selectObj.isPanelShowing = true;
                        $this.SYSTEM_METHOD.PANEL_RENDER(selectObj, configs);
                        // selectObj.isPanelShowed = true;
                        LIB.bindEvents(document, {mousedown: result.close}, {once: true});
                        // delay when close event activated
                        // selectObj.selectPanel.event.panelLoaded = function() {
                        // }
                        event && event.stopPropagation();
                    }, close: function(event) {
                        $this.SYSTEM_METHOD.PANEL_DESTROY(selectObj);
                        result.isShowed = false;
                        selectObj.isPanelShowed = false;
                        selectObj.isPanelShowing = false;
                        event && event.stopPropagation();
                    }, disabled: function(state) {
                        if (state === null || state === undefined) return configs.disabled;
                        if (selectElement.dataset.readonly == 'true' && !configs.skipError) {
                            console.error({message: 'Đối tượng đang có thuộc tính chỉ đọc: (data-read-only = true)', element: selectElement});
                        }
                        else {
                            selectElement.disabled = state;
                            act_make_disable_ro_select(state);
                        }
                        return configs.disabled;
                    }, readonly: function(state) {
                        if (state === null || state === undefined) return configs.readonly;
                        if (selectElement.disabled && !configs.skipError) {
                            console.error({message: 'Đối tượng đang có thuộc tính vô hiệu hoá: (disabled)', element: selectElement});
                        }
                        else {
                            state ? (selectElement.dataset.readonly = 'true') : (delete selectElement.dataset.readonly);
                            act_make_disable_ro_select(state);
                        }
                        return configs.readonly;
                    }, get value() {
                        var item_list = [];
                        selectObj.select.getOptions().forEach(optionElement => {
                            optionElement.selected && (item_list.push(optionElement.value));
                        });
                        
                        item_list.length == 0 && (item_list = '');
                        item_list.length == 1 && (item_list = item_list[0]);

                        return item_list;
                    }, set value(value) {
                        !Array.isArray(value) && (value = [value]);
                        if (configs.disabled == false && configs.readonly == false){
                            selectObj.select.oldValue = this.value;
                            selectObj.select.getOptions().forEach(optionElement => {
                                optionElement.selected = value.indexOf(optionElement.value) >= 0;
                            });
                            if (!configs.multiple){
                                selectElement.value = value[0];
                            }
                            if (this.activeEvent) {
                                selectObj.select.change();
                                LIB.eventTrigger(selectElement, 'change');
                            }
                            else {
                                selectObj.select.change();
                            }
                        }
                    }, get nsValue() {
                        var item_list = [];
                        selectObj.select.getOptions().forEach(optionElement => {
                            !optionElement.selected && (item_list.push(optionElement.value));
                        });
                        
                        item_list.length == 0 && (item_list = '');
                        item_list.length == 1 && (item_list = item_list[0]);

                        return item_list;
                    }, get valueText() {
                        var item_list = [];
                        selectObj.select.getOptions().forEach(optionElement => {
                            optionElement.selected && (item_list.push(optionElement.text));
                        });
                        
                        item_list.length == 0 && (item_list = '');
                        item_list.length == 1 && (item_list = item_list[0]);

                        return item_list;
                    }, get oldValue() {
                        return selectObj.select.oldValue;
                    }, valueDataset(strDataset) {
                        var item_list = [];
                        selectObj.select.getOptions().forEach(optionElement => {
                            optionElement.selected && (item_list.push(optionElement.dataset[strDataset]));
                        });
                        
                        item_list.length == 0 && (item_list = '');
                        item_list.length == 1 && (item_list = item_list[0]);

                        return item_list;
                    }, selectAll() {
                        if (!configs.disabled && !configs.readonly){
                            if (configs.multiple){
                                selectObj.select.getOptions().forEach(optionElement => {
                                    optionElement.selected = true;
                                });
                            }
                            LIB.eventTrigger(selectElement, 'change');
                        }
                    }, deSelectAll() {
                        if (!configs.disabled && !configs.readonly){
                            selectObj.select.getOptions().forEach(optionElement => {
                                optionElement.selected = false;
                                optionElement.removeAttribute('selected');
                            });
                            if (!configs.multiple){
                                selectElement.value = '';
                            }
                            LIB.eventTrigger(selectElement, 'change');
                        }
                    }, get placeholder() {
                        return selectObj.overlay.placeholder.get();
                    }, set placeholder(value) {
                        selectObj.overlay.placeholder.set(value);
                    }, get visible() {
                        return parentOverlay.classList.contains('no-display');
                    }, set visible(value) {
                        if (value) {
                            parentOverlay.classList.remove('no-display');
                        }
                        else {
                            parentOverlay.classList.add('no-display');
                        }
                    }
                };

                return result;
            }, PANEL_RENDER: function(selectObj, configs){
                let selectElement = selectObj.select.element,
                    selectOverlay = selectObj.overlay,
                    key = selectObj.key,
                    search_panel_cusstyle = (configs.panelstyle == 'top') ? {bottom: '0px', top: null} : (configs.panelstyle == 'bottom') ? {top: '0px', bottom: null} : {},
                    obj_select = {panel: null, select: selectElement, optionsView: null, searchBox: null},
                    panelMobileContent = null,
                    panelMobileOverlay = null,
                    PARENT_PANEL = selectOverlay.placeholder.element
                ;

                $this.SYSTEM_METHOD.PANELS_DESTROY(selectObj);

                let sizing = {
                    get sizeRect() {
                        return LIB.getPos(PARENT_PANEL);
                    }, get sizeRectOffset() {
                        return LIB.getOffset(PARENT_PANEL);
                    }
                }

                let selectPanel = obj_select.panel = LIB.nodeCreator({node: 'div', classList: [$this.CONFIG.panelClass, 'flex-box', 'align-stretch', 'column'], dataset: {key: key}, style: {left: sizing.sizeRect.left + 'px', right: sizing.sizeRect.right + 'px', width: sizing.sizeRect.width + 'px', opacity: 0}}),
                    searchOverlay = LIB.nodeCreator({node: 'div', classList: ['selectiveUI-search', 'flex-box', 'align-center'], dataset: {key: key}, style: {left: '0px', height: sizing.sizeRect.height + 'px', minHeight: sizing.sizeRect.height + 'px', ...search_panel_cusstyle}}),
                    searchInput = LIB.nodeCreator({node: 'input', type: 'text', id: key+'_SEARCH', classList: 'selectiveUI-search-input'}),
                    loadingView = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-center-absolute', textContent: configs.textloading}),
                    optionLoadingView = LIB.nodeCreator({node: 'div', classList: ['group-item', 'empty-item']}),
                    optionNullView = LIB.nodeCreator({node: 'div', classList: ['group-item', 'empty-item']}),
                    optionGroupLoading = LIB.nodeCreator({node: 'div', classList: ['group-item', 'group-item-searching']}),
                    optionGroupNoData = LIB.nodeCreator({node: 'div', classList: ['group-item', 'empty-item']})
                ;
                optionLoadingView.appendChild(loadingView);
                optionNullView.appendChild(LIB.nodeCloner(loadingView, {textContent: configs.textnotfound}));
                selectPanel.appendChild(optionLoadingView);
                optionGroupLoading.appendChild(LIB.nodeCreator({node: 'label', textContent: configs.textloading}));
                optionGroupNoData.appendChild(LIB.nodeCloner(loadingView, {textContent: configs.textnodata}));

                // search //
                searchOverlay.appendChild(searchInput);
                // ===== //

                LIB.timerProcess.setExecute('change_value_by_timer', function() {
                    LIB.eventTrigger(selectElement, 'change');
                });

                if (configs.multiple) {
                    selectPanel.classList.add('multiple');
                    searchInput.placeholder = configs.placeholder;
                }
                else {
                    selectPanel.classList.add('single');
                    let OPTION_SELECTED = selectElement.options[selectElement.selectedIndex];
                    if (OPTION_SELECTED) {
                        if (LIB.isNullOrEmpty(OPTION_SELECTED)) {
                            searchInput.placeholder = configs.placeholder;
                        }
                        else {
                            if (OPTION_SELECTED.dataset && OPTION_SELECTED.dataset.mask) {
                                searchInput.placeholder = OPTION_SELECTED.dataset.mask;
                            }
                            else {
                                searchInput.placeholder = LIB.stripHtml(LIB.tagTranslate(OPTION_SELECTED.innerHTML));
                            }
                        }
                    }
                }
                
                if (LIB.isMobile) {
                    selectPanel.classList.add('mobile');
                    panelMobileContent = LIB.nodeCreator({node: 'div', classList: ['selectiveUI-mobile-content-overlay', 'flex-box', 'column']});
                    panelMobileOverlay = LIB.nodeCreator({node: 'div', classList: ['selectiveUI-mobile-overlay', 'flex-box', 'align-center', 'justify-center']});
                    panelMobileOverlay.appendChild(panelMobileContent);
                    document.documentElement.appendChild(panelMobileOverlay);
                    document.body.classList.add('no-scroll');
                    panelMobileContent.append(searchOverlay, selectPanel);
                }
                else {
                    document.documentElement.appendChild(selectPanel);
                    selectElement.parentNode.insertBefore(searchOverlay, selectElement.nextSibling);
                }
                
                obj_select.searchBox = searchInput;

                // data result
                let panelLoadedStored = [];
                selectObj.selectPanel = {
                    panel: selectPanel,
                    panelMobileOverlay: panelMobileOverlay,
                    panelMobileContent: panelMobileContent,
                    panelControls: obj_select,
                    event: {
                        get panelLoaded() {
                            return panelLoadedStored;
                        },
                        set panelLoaded(action) {
                            panelLoadedStored.push(action);
                        }
                    }, get canScroll() {
                        return isScrollable;
                    }
                };
                
                // #region show animation
                // load one time so size need one time
                // check on image view type or not
                (selectElement.dataset.selectImage == 'true') ? selectPanel.classList.add('image') : selectPanel.classList.remove('image');
                // get max height
                // LIB.setStyle(selectPanel, {height: 'fit-content', overflow: 'hidden'});
                // console.log();
                let stockHeight = parseInt(LIB.calc2px(configs.height), 10),
                    maxHeightOfPanel = parseInt(selectPanel.offsetHeight, 10),
                    realHeight = stockHeight,
                    winHeight = window.innerHeight,
                    winWidth = window.innerWidth,
                    isScrollable = false,
                    optionLoading = false
                ;

                let oldHeight, oldHeightMobile, isPanelErsed = false;
                let animationPanel = selectPanel, bypassAction = function() {
                    selectObj.selectPanel.event.panelLoaded.forEach(action => {
                        action && action();
                    });

                    if (!obj_select.optionsView) return;
                    let first_focused_option = obj_select.optionsView.objOptions.filter(item => item.focused === true);
                    if (configs.autoscroll && first_focused_option.length > 0) {
                        first_focused_option[0].scrollIntoView({behavior: 'smooth'});
                    }
                }, panelAnimationResize = function() {
                    oldHeight = selectPanel.offsetHeight;

                    winHeight = window.innerHeight;
                    winWidth = window.innerWidth;
                    
                    if (LIB.isMobile) {
                        oldHeightMobile = panelMobileContent.offsetHeight;
                        LIB.setStyle(panelMobileContent, {maxHeight: 'fit-content'});
                    }
                    LIB.setStyle(selectPanel, {height: 'fit-content', overflow: 'hidden'});

                    maxHeightOfPanel = parseInt(selectPanel.offsetHeight, 10);
                    if (LIB.isMobile) {
                        LIB.setStyle(panelMobileContent, {maxHeight: oldHeightMobile + 'px'});
                    }

                    if (stockHeight > maxHeightOfPanel) {
                        isScrollable = false;
                        realHeight = maxHeightOfPanel;
                    }
                    else {
                        isScrollable = true;
                        realHeight = stockHeight;
                    }
                    // realHeight = realHeight < 40 ? 40 : realHeight;

                    LIB.setStyle(selectPanel, {transition: 'none', height: oldHeight + 'px', overflow: isScrollable ? 'auto' : 'hidden'});

                    if (selectObj.isPanelShowed) {
                        bypassAction();
                    }
                    else {
                        if (LIB.isMobile) {
                            LIB.setStyle(panelMobileContent, {transition: 'none', maxHeight: (realHeight + 72) + 'px', transform: `translate(calc(50% - 20px + ${sizing.sizeRect.left - (winWidth / 2)}px), calc(15px + ${sizing.sizeRect.top - (winHeight / 2)}px)) scale(${sizing.sizeRect.width / panelMobileContent.offsetWidth}, ${sizing.sizeRect.height / (realHeight + 72)})`});
                        }
                        else {
                            LIB.setStyle(selectPanel, {display: 'none'});
                        }
                    }

                    let endPosition = {};

                    if (!LIB.isMobile) {
                        if ((sizing.sizeRect.top + sizing.sizeRect.height + realHeight + 1) <= winHeight || (sizing.sizeRect.top - realHeight) < 0){ // top -> bottom
                            selectPanel.dataset.position = 'top';
                            endPosition = {top: (sizing.sizeRectOffset.top + sizing.sizeRect.height) + 'px', bottom: null};
                        }
                        else { // bottom -> top
                            selectPanel.dataset.position = 'bottom';
                            endPosition = {bottom: (winHeight - sizing.sizeRectOffset.top + 2) + 'px', top: null};
                            if (selectObj.isPanelShowed) {
                                endPosition = {top: (sizing.sizeRectOffset.top - realHeight - 4) + 'px', bottom: null};
                            }
                        }
                    }

                    if (!selectObj.isPanelShowed && !LIB.isMobile) {
                        LIB.setStyle(selectPanel, {display: null,  ...endPosition});
                    }

                    requestAnimationFrame(() => {
                        if (LIB.isMobile) {
                            if (selectObj.isPanelShowed) {
                                LIB.setStyle(panelMobileContent, {transition: `all ${configs.animationtime}ms`, maxHeight: (realHeight + 72) + 'px'});
                            }

                            LIB.setStyle(selectPanel, {transition: 'none', height: realHeight + 'px', overflow: isScrollable ? 'auto' : 'hidden', ...endPosition});
                        }
                        else {
                            LIB.setStyle(selectPanel, {transition: `all ${configs.animationtime}ms`, height: realHeight + 'px', overflow: isScrollable ? 'auto' : 'hidden', ...endPosition});
                        }
                    });

                    LIB.bindEvents(animationPanel, {
                        transitionend: function() {
                            bypassAction();
                        }
                    }, {once: true});
                }, optionLoad = function(dynamicLoading = false) {
                    let option_rendered = $this.SYSTEM_METHOD.OPTION_RENDER(selectObj, dynamicLoading);
                    obj_select.optionsView = option_rendered;
                    LIB.replaceChildren(selectPanel);
                    if (option_rendered.isItemVisibles) {
                        
                        // option_rendered.selected.length > 0 && (view_selected = option_rendered.selected[0]);
                        selectPanel.append(...option_rendered.options);
                    }
                    else {
                        if (dynamicLoading) {
                            selectPanel.append(optionLoadingView);
                        }
                        else {
                            selectPanel.append(optionGroupNoData);
                        }
                    }
                    panelAnimationResize();
                }, optionAdd = (isPagination = false, isPageReplace = true) => {
                    if (isPagination) {
                        let option_rendered = $this.SYSTEM_METHOD.OPTION_RENDER(selectObj, false);
                        if (option_rendered.isItemVisibles) {
                            selectPanel.append(...option_rendered.options)
                        }
                        else {
                            selectPanel.append(optionGroupNoData);
                        }
                    }
                }

                panelAnimationResize();

                if (LIB.isMobile) {
                    animationPanel = panelMobileContent;
                    LIB.setStyle(panelMobileContent, {transition: 'none', maxHeight: (realHeight + 72) + 'px'});
                    LIB.setStyle(selectPanel, {transition: 'none', height: realHeight + 'px', left: null, right: null, opacity: 1, transform: null, top: null, bottom: null});

                    requestAnimationFrame(() => {
                        LIB.setStyle(panelMobileOverlay, {opacity: 1});
                        LIB.setStyle(panelMobileContent, {transform: 'none', transition: `all ${configs.animationtime}ms`});
                    });
                }
                else{
                    requestAnimationFrame(() => {
                        LIB.setStyle(selectPanel, {transition: `all ${configs.animationtime}ms`, height: realHeight + 'px', left: sizing.sizeRect.left + 'px', right: sizing.sizeRect.right + 'px', opacity: 1, transform: null});
                    });
                }

                LIB.bindEvents(animationPanel, {
                    transitionend: function() {
                        selectObj.isPanelShowed = true;
                        selectObj.isPanelShowing = false;
                        $this.FORM.DATA.selectObjectShowed[selectObj.key] = selectObj;
                        LIB.setStyle(selectPanel, {overflow: isScrollable ? 'auto' : 'hidden', transition: 'none', zIndex: null});
                        $this.SYSTEM_METHOD.RESIZE_SELECT_PANEL(selectObj);
                        bypassAction();
                    }
                }, {once: true});
                // #endregion show animation

                // check some action on panel loaded
                if (!configs.searchable) {
                    searchInput.classList.add('no-action');
                }
                // event //
                selectObj.selectPanel.event.panelLoaded = function() {
                    $this.FORM.EVENT.BIND_OPTION_SEARCHER(selectObj, {
                        loaded: function() {
                            optionLoading = false;
                            optionLoad();
                        },
                        searched: function(hasItem) {
                            if (hasItem) {
                                if (isPanelErsed) {
                                    LIB.replaceChildren(selectPanel, ...obj_select.optionsView.options);
                                    isPanelErsed = false;
                                }
                            }
                            else if (!obj_select.optionsView.isEmpty) {
                                LIB.replaceChildren(selectPanel, optionNullView);
                                isPanelErsed = true;
                            }
                            panelAnimationResize()
                        }, loading: function() {
                            if (!optionLoading) {
                                optionLoading = true;
                                if (obj_select.optionsView.isEmpty) {
                                    if (configs.loadingfield) {
                                        LIB.replaceChildren(selectPanel, ...optionLoadingView);
                                        panelAnimationResize();
                                    }
                                }
                                else {
                                    if (configs.loadingfield) {
                                        selectPanel.prepend(optionGroupLoading);
                                    }
                                }
                            }
                        }
                    });
                    // , function() {
                    //     selectElement.replaceChildren();
                    //     optionLoad(true);
                    // }
                    $this.FORM.EVENT.BIND_OPTION_MOUSER(selectObj, configs);
                    $this.FORM.EVENT.BIND_OPTION_KEYPROCESS(selectObj, configs);
                    if (configs.searchable && configs.autofocus) {
                        searchInput.focus();
                    }
                }
                // ===== //

                // when using dynamic load or no
                selectObj.ajax.pageNavigation = optionAdd;
                if (selectElement.dataset.dynamicDataLoaded != 'true' || configs.cacheable == false) {
                    const WORKER = $this.SYSTEM_METHOD.AJAX_LOADER(searchInput.value, selectObj, function() {
                        optionLoad();
                        if (selectObj.ajax.isPagination) {
                            $this.FORM.EVENT.BIND_PANEL_SCROLLER(selectObj);
                        }
                    }, () => {
                        if (!selectObj.isPanelShowing && !selectObj.isPanelShowed) {
                            this.PANEL_DESTROY(selectObj);
                        }
                    });

                    delete selectElement.dataset.dynamicDataLoaded;
                    if (WORKER.isDynamic) {
                        optionLoad(configs.loadingfield);
                        LIB.bindEvents(animationPanel, {
                            transitionend: function() {
                                WORKER.commitWork();
                            }
                        }, {once: true});
                    }
                    else {
                        optionLoad();
                    }
                }
                else {
                    optionLoad();
                    if (selectObj.ajax.action && selectObj.ajax.isPagination) {
                        $this.FORM.EVENT.BIND_PANEL_SCROLLER(selectObj);
                    }
                }
            }, PANEL_DESTROY: function(selectObj, callback = null) {
                // if (!selectObj.selectPanel || !selectObj.isPanelShowed) {
                //     callback && callback();
                //     return false;
                // }
                let selectPanelObj = selectObj.selectPanel,
                    selectPanel = selectPanelObj?.panel,
                    selectPanelOverlayPlaceholder = selectObj.overlay.placeholder.element,
                    selectPanelMobile = selectPanelObj?.panelMobileOverlay,
                    selectElement = selectObj.select.element,
                    searchBox = selectPanelObj?.panelControls.searchBox,
                    searchBoxOverlay = searchBox?.parentElement,
                    canScroll = selectPanelObj?.canScroll
                ;
                if ((selectObj.ajax.isDynamic && (!searchBox || searchBox.value != '')) || (!selectObj.configs.cacheable && selectObj.ajax.isDynamic)) {
                    selectObj.ajax.pageNum = 0;
                    selectObj.ajax.pageTotalNum = 0;
                    let valueNow = selectObj.controls.value;
                    if (typeof valueNow == 'string') valueNow = [valueNow];
                    
                    selectElement.querySelectorAll('option').forEach((element) => {
                        if (valueNow.indexOf(element.value) == -1 && element.value != '') {
                            element.remove();
                        }
                    })

                    delete selectElement.dataset.dynamicDataLoaded;
                }
                if (selectPanel?.classList.contains('closing')){
                    callback && callback();
                }
                else if (selectPanel) {
                    LIB.unbindAllEvents(selectPanel);
                    document.body.classList.remove('no-scroll');
                    
                    if (selectPanelMobile) {
                        selectPanel = selectPanelMobile;
                        const winHeight = window.innerHeight,
                              winWidth = window.innerWidth,
                              sizeRect = LIB.getPos(selectPanelOverlayPlaceholder)
                        ;
                        let panelMobileContent = selectPanelMobile.childNodes[0];
                        LIB.setStyle(panelMobileContent, {transform: `translate(calc(50% - 20px + ${sizeRect.left - (winWidth / 2)}px), calc(15px + ${sizeRect.top - (winHeight / 2)}px)) scale(${sizeRect.width / panelMobileContent.offsetWidth}, ${sizeRect.height / panelMobileContent.offsetHeight})`});

                        // LIB.setStyle(panel_target.querySelector('.selectiveUI-mobile-content-overlay'), {overflow: 'hidden', transition: null, transform: 'scale(0.7)'});
                    }
                    LIB.setStyle(selectPanel, {overflow: canScroll ? 'auto' : 'hidden', transition: `all ${selectObj.configs.animationtime}ms`, opacity: 0});
                    
                    if (selectPanel) {
                        if (selectPanel.dataset.position == 'bottom') {
                            LIB.setStyle(selectPanel, {
                                bottom: (window.innerHeight - (selectPanel.offsetTop + selectPanel.offsetHeight)) + 'px', top: null
                            });
                        }
                    }

                    LIB.bindEvents(selectPanel, {
                        transitionend: function(){
                            if (callback){
                                callback();
                            }
                            delete $this.FORM.DATA.selectObjectShowed[selectObj.key];
                            selectPanel.remove();
                        }
                    }, {once: true});

                    // remove it when animate event not working
                    setTimeout(() => {
                        selectPanel.remove();
                    }, selectObj.configs.animationtime);
                        
                    delete selectPanel.dataset.key;
                    delete selectElement.dataset.uishow;
                    delete selectObj.selectPanel;
                    LIB.unbindAllEvents(searchBox);
                    
                    (searchBoxOverlay) && searchBoxOverlay.remove();

                    selectPanel.classList.add('closing');
                }
                else {
                    callback && callback();
                }
            }, OPTION_RENDER: function(selectObj, onLoading = false) {
                let select_element = selectObj.select.element,
                    key = selectObj.key,
                    configs = selectObj.configs,
                    result = {options: [], selected: [], isEmpty: false, objOptions: [], optionIndex: 0}, isMultiple = select_element.multiple, 
                    type = select_element.multiple ? 'checkbox' : 'radio',
                    focusHelper = null
                ;
                
                if (selectObj.ajax && selectObj.ajax.isDynamic && selectObj.ajax.pageNum > 1) {
                    result = selectObj.selectPanel?.panelControls.optionsView ?? result;
                    if (result.optionIndex > 0) {
                        result.optionIndex++;
                    }
                }
                if (select_element.length > 0) {
                    if (configs.multiple && configs.selectall == true && (!selectObj.ajax.isDynamic || selectObj.ajax.pageNum == 1 || !selectObj.ajax.isPagination)) {
                        let optionGroupOther = LIB.nodeCreator({node: 'div', classList: 'group-other'}),
                            optionSelectAll = LIB.nodeCreator({node: 'a', classList: ['selectiveUI-a-controls', 'dis-left'], textContent: 'Chọn tất cả', dataset: {action: 'selectall'}}),
                            optionDeSelectAll = LIB.nodeCreator({node: 'a', classList: ['selectiveUI-a-controls', 'dis-right'], textContent: 'Bỏ chọn', dataset: {action: 'deselectall'}})
                        ;
                        optionGroupOther.append(optionSelectAll, optionDeSelectAll);
                        result.options.push(optionGroupOther);
                    }
                    let is_image_tags = LIB.str2bool(select_element.dataset.selectImage);
                    for (let index = result.optionIndex; index < select_element.length; index++) {
                        const selectOptionElement = select_element[index];
                        
                        let optionGroup = LIB.nodeCreator({node: 'div', classList: 'group-item', dataset: {index: index}}),
                            optionItem = LIB.nodeCreator({node: 'input', type: type, value: selectOptionElement.value, id: `option_${key}_${index}`, name: `option_${key}`, autocomplete: 'off'}),
                            optionLabel = LIB.nodeCreator({node: 'label', classList: ['flex-box', 'align-center', 'width-100per'], htmlFor: optionItem.id}),
                            optionOverlay = LIB.nodeCreator({node: 'div', innerHTML: LIB.tagTranslate(selectOptionElement.innerHTML)}),
                            flagForeverNoDisplay = (selectOptionElement.classList && selectOptionElement.classList.contains('no-display'))
                        ;

                        if (selectOptionElement.dataset && !LIB.isNullOrEmpty(selectOptionElement.dataset.imgsrc)) {
                            if (!is_image_tags) {
                                is_image_tags = true;
                                select_element.dataset.selectImage = 'true';
                                selectObj.selectPanel.panel?.classList.add('image');
                            }

                            let optionImage = LIB.nodeCreator({node: 'img'});
                            optionImage.src = selectOptionElement.dataset.imgsrc;
                            optionGroup.appendChild(optionImage);
                            optionItem.classList.add('no-display');
                        }

                        if (flagForeverNoDisplay) {
                            optionGroup.classList.add('f-no-display')
                        }

                        optionLabel.append(optionOverlay);
                        optionGroup.append(optionItem, optionLabel);
                        
                        if (selectOptionElement.selected){
                            optionItem.checked = true;
                            optionGroup.classList.add('active');
                            result.selected.push(optionGroup);
                        }

                        result.options.push(optionGroup);

                        result.objOptions.push({index: index, item: optionGroup, option: optionItem,
                            get focused() {
                                return optionGroup.classList.contains('focus');
                            }, set focused(focusState) {
                                let itemsFocused = result.objOptions.filter(item => (item.focused === true && item !== this));
                                itemsFocused.forEach(itemFocused => {
                                    itemFocused.focused = false;
                                });
                                if (focusState) {
                                    optionGroup.classList.add('focus');
                                }
                                else {
                                    optionGroup.classList.remove('focus');
                                }
                            }, get selected() {
                                return selectOptionElement.selected;
                            }, set selected(selectState) {
                                if (selectState) {
                                    if (!isMultiple) {
                                        let itemsSelected = result.objOptions.filter(item => (item.selected === true && item !== this));
                                        itemsSelected.forEach(itemSelected => {
                                            itemSelected.selected = false;
                                        });
                                        select_element.value = selectOptionElement.value;
                                    }
                                    optionGroup.classList.add('active');
                                    selectOptionElement.setAttribute('selected', true);
                                }
                                else {
                                    optionGroup.classList.remove('active');
                                    selectOptionElement.removeAttribute('selected');
                                }
                                selectOptionElement.selected = optionItem.checked = selectState;
                                LIB.timerProcess.run('change_value_by_timer');
                            }, get visible() {
                                return !optionGroup.classList.contains('no-display') && !optionGroup.classList.contains('f-no-display');
                            }, set visible(visibleState) {
                                if (visibleState) {
                                    optionGroup.classList.remove('no-display');
                                }
                                else {
                                    optionGroup.classList.add('no-display');
                                }
                            }, get label() {
                                return optionLabel.textContent;
                            }, set label(labelValue) {
                                optionLabel.textContent = labelValue;
                                selectOptionElement.text = labelValue;
                            }, scrollIntoView: function(option = {}) {
                                if (!optionGroup.parentElement) return;
                                optionGroup.parentElement.scrollTo({top: (optionGroup.offsetTop + (optionGroup.offsetHeight>>1)) - (optionGroup.parentElement.offsetHeight>>1), ...option});
                                return this;
                            }, nextOption: function() {
                                let localThis = this,
                                    itemResult = result.objOptions.filter(item => (item.index > localThis.index && item.visible === true))[0];

                                !itemResult && (itemResult = localThis);

                                return itemResult;
                            }, prevOption: function() {
                                let localThis = this,
                                    itemResult = result.objOptions.filter(item => (item.index < localThis.index && item.visible === true));

                                if (itemResult.length > 0) {
                                    itemResult = itemResult[itemResult.length - 1];
                                }
                                else {
                                    itemResult = localThis;
                                }

                                return itemResult;
                            }
                        });
                        if (selectOptionElement.selected && !focusHelper){
                            focusHelper = result.objOptions[index];
                        }
                    }
                    if (onLoading && configs.loadingfield) {
                        let optionGroupLoading = LIB.nodeCreator({node: 'div', classList: ['group-item', 'group-item-searching']}),
                            optionLabelLoading = LIB.nodeCreator({node: 'label', textContent: configs.textloading})
                        ;
                        optionGroupLoading.appendChild(optionLabelLoading);
                        result.options.push(optionGroupLoading);
                    }
                    else {
                        onLoading = false;
                    }
                    result.optionIndex = select_element.length - 1;
                    if (configs.searchable) {
                        !focusHelper && (focusHelper = result.objOptions[0]);
                        focusHelper && (focusHelper.focused = true);
                    }
                }
                // empty panel
                else {
                    const EMPTY_VIEW = LIB.nodeCreator({node: 'span', classList: 'selectiveUI-center-absolute', textContent: onLoading ? configs.textloading : configs.textnodata}),
                          EMPTY_DIV = LIB.nodeCreator({node: 'div', classList: ['group-item', 'empty-item']})
                    ;

                    EMPTY_DIV.appendChild(EMPTY_VIEW);
                    result.options.push(EMPTY_DIV);
                    result.isEmpty = true;
                }
                if (typeof result.isItemVisibles == 'undefined') {
                    Object.defineProperty(result, 'isItemVisibles', {get: function() {
                        if (result.isEmpty) return false;
                        return result.objOptions.filter(item => (item.visible === true)).length > 0;
                    }});
                }
                return result;
            }, RESIZE_SELECT_PANEL: function(selectObj) {
                if (!selectObj.isPanelShowed || LIB.isMobile || selectObj.isPanelShowing) return false;
                
                const ASYNC_ACTION = async function() {
                    let selectOverlay = selectObj.overlay.placeholder.element,
                        selectPanel = selectObj.selectPanel.panel;

                    const OVERLAY_RECT = LIB.getPos(selectOverlay),
                          OVERLAY_RECT_OFFSET = LIB.getOffset(selectOverlay),
                          WINDOW_HEIGHT = window.innerHeight
                    ;

                    if (selectPanel.offsetHeight > 0) {
                        let stockPosition = selectPanel.dataset.position,
                            startPost = false;
                        if ((OVERLAY_RECT.top + OVERLAY_RECT.height + selectPanel.offsetHeight + 1) <= WINDOW_HEIGHT || (OVERLAY_RECT.top - selectPanel.offsetHeight) < 0) {
                            startPost = {top: (OVERLAY_RECT_OFFSET.top + OVERLAY_RECT.height) + 'px', bottom: null};
                            selectPanel.dataset.position = 'top';
                        }
                        else {
                            startPost = {top: (OVERLAY_RECT_OFFSET.top - selectPanel.offsetHeight - 4) + 'px', bottom: null};
                            selectPanel.dataset.position = 'bottom';
                        }
                        let modifiedPosition = selectPanel.dataset.position;
                        if (startPost) {
                            LIB.setStyle(selectPanel, startPost);
                        }

                        if (stockPosition != modifiedPosition) {
                            LIB.setStyle(selectPanel, {transition: `top ${selectObj.configs.animationtime}ms`, willChange: 'top'});

                            LIB.bindEvents(selectPanel, {
                                transitionend: function() {
                                    LIB.setStyle(selectPanel, {transition: 'none'});
                                }
                            }, {once: true})
                        }
    
                        LIB.setStyle(selectPanel, {left: OVERLAY_RECT_OFFSET.left + 'px', right: OVERLAY_RECT_OFFSET.right + 'px', width: OVERLAY_RECT.width + 'px'});
                    }
                }
                ASYNC_ACTION();
            }, AUTO_MARK_OPTIONS: function() {
                for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                    let query = $this.FORM.DATA.keys[_OBJ_KEY].executionMark;

                    let selectElements = LIB.getElements(query);
                    if (selectElements) {
                        selectElements.forEach(selectElement => {
                            if (selectElement.tagName === 'SELECT' && selectElement.dataset && !LIB.isNullOrEmpty(selectElement.dataset.memKey)) {
                                let memKey = selectElement.dataset.memKey,
                                    selectObj = $this.FORM.DATA.selectObject[memKey]
                                ;
                                selectObj.overlay.placeholder.refresh();
                                selectObj.overlay.selectedPanel.refresh();
                            }
                        });
                    }
                }
            }, AJAX_LOADER: function(ajaxRequestValue, selectObj, action = undefined, loaded = undefined) {
                let select_element = selectObj.select.element;
                return {
                    isDynamic: !!selectObj.ajax.action,
                    commitWork: function() {
                        if (this.isDynamic) {
                            if (selectObj.ajax.ajaxLoading) return;
                            selectObj.ajax.ajaxLoading = true;
                            let dynamicAction = $this.FORM.DATA.eventStories[selectObj.key]['dynamicAction'];
                            dynamicAction.async = true;
                            dynamicAction.data.search = ajaxRequestValue;
                            dynamicAction.data.page = selectObj.ajax.pageNum;
                            dynamicAction.data.selectedValue = $this.find(select_element).value;
                            dynamicAction.event = {done: function(obj) {
                                const data = JSON.parse(obj.data),
                                      dataType = data.datatype.toUpperCase(),
                                      selectPanel = selectObj.selectPanel?.panel
                                ;
                                let isPagination = false,
                                    isPageReplace = false
                                ;
                                let page = data.page,
                                    total_page = data.total_page
                                ;
                                if (page != undefined && total_page > 0) {
                                    page++;
                                    if (page > total_page) {
                                        selectObj.ajax.ajaxLoading = false;
                                        loaded && loaded();
                                        return;
                                    }
                                    selectObj.ajax.pageNum = page;
                                    selectObj.ajax.pageTotalNum = total_page;

                                    isPagination = page > 0,
                                    isPageReplace = page == 1
                                }

                                selectObj.ajax.isPagination = isPagination;
                                select_element.dataset.dynamicDataLoaded = 'true';
                                if (!isPagination) {
                                    LIB.replaceChildren(select_element);
                                }
                                
                                switch (dataType) {
                                    case 'HTML':
                                        if (data.html && data.html.length > 0) {
                                            LIB.replaceChildren(select_element, ...LIB.text2node(data.html.join('')));
                                        }
                                        break;
                                    case 'OBJECT':
                                        if (data.object && data.object.length > 0) {
                                            let option_tags = [];
                                            let is_image_tags = false;
                                            data.object.forEach(obj_element => {
                                                const OPTION_DATASET = obj_element.data ?? {};
                                                const OPTION_DATA = LIB.nodeCreator({node: 'option', value: obj_element.value, textContent: obj_element.text, dataset: OPTION_DATASET});
                                                if (obj_element.imgsrc) {
                                                    OPTION_DATA.dataset.imgsrc = obj_element.imgsrc;
                                                    is_image_tags = true;
                                                }
                                                if (LIB.str2bool(obj_element.selected)) {
                                                    OPTION_DATA.selected = true;
                                                }
                                                option_tags.push(OPTION_DATA);
                                            });
                                            if (is_image_tags) {
                                                select_element.dataset.selectImage = 'true';
                                                selectPanel?.classList.add('image');
                                            }
                                            else {
                                                delete select_element.dataset.selectImage;
                                                selectPanel?.classList.remove('image');
                                            }
                                            if (isPagination && !isPageReplace) {
                                                select_element.append(...option_tags)
                                            }
                                            else {
                                                LIB.replaceChildren(select_element, ...option_tags);
                                            }
                                        }
                                        break;
                                }
                                
                                selectObj.ajax.ajaxLoading = false;
                                (action) && action(isPagination, isPageReplace);
                                loaded && loaded();
                            }};
    
                            LIB.XHRSendRequest(dynamicAction);
                        }
                    }
                }
            }, DEEP_FIND: function(drawElement = document.createElement('div'), findOption) {
                // find by class
                if (!drawElement) return null;
                let isFindedClass = false;
                if (findOption.maxLevel == undefined) findOption.maxLevel = 3;
                if (findOption.maxLevel == 0) return null;
                if (findOption.classList) {
                    if (findOption.classList instanceof Object) {
                        if (findOption.classList.or) {
                            let isFindedORClass = false;
                            findOption.classList.or.forEach(compareClass => {
                                if (isFindedORClass) return;
                                if (drawElement.classList.contains(findOption.classList)) {
                                    isFindedORClass = true;
                                    return true;
                                }
                            });
                            isFindedClass = isFindedORClass;
                        }

                        if (findOption.classList.and) {
                            let isFindedANDClass = true;
                            findOption.classList.or.forEach(compareClass => {
                                if (!isFindedANDClass) return;
                                if (!drawElement.classList.contains(findOption.classList)) {
                                    isFindedANDClass = false;
                                    return true;
                                }
                            });
                            (isFindedANDClass) && (isFindedClass = true);
                        }

                        drawElement.classList.contains(findOption.classList);
                    }
                    else {
                        isFindedClass = drawElement.classList.contains(findOption.classList);
                    }
                }
                
                if (isFindedClass) {
                    return drawElement;
                }
                else {
                    findOption.maxLevel--;
                    return this.DEEP_FIND(drawElement.parentElement, findOption);
                }
            }, PANELS_DESTROY: function(obj) {
                for (let memKey in $this.FORM.DATA.selectObjectShowed) {
                    const selectObj = $this.FORM.DATA.selectObjectShowed[memKey];
                    if (selectObj === obj) continue;
                    selectObj.controls.close();
                }
            }, DESTROY_SELECT: function(selectObj) {
                // overlay clear
                let overlay = selectObj.overlay,
                    e_overlayPanel = overlay.panel,
                    e_overlayPlaceholder = overlay.placeholder.element,
                    e_selectedPanel = overlay.panel,
                    e_selectElement = selectObj.select.element,
                    memKey = selectObj.key
                ;
                LIB.unbindAllEvents(e_overlayPanel);
                LIB.unbindAllEvents(e_overlayPlaceholder);
                LIB.unbindAllEvents(e_selectedPanel);
                LIB.unbindAllEvents(e_selectElement);

                e_selectElement.classList.remove('selectiveUI-INIT');
                e_overlayPanel.parentElement.insertBefore(e_selectElement, e_overlayPanel);
                e_overlayPanel.remove();
                e_overlayPlaceholder.remove();
                e_selectedPanel.remove();

                delete $this.FORM.DATA.selectObject[memKey];
                delete e_selectElement.dataset.memKey;
            }
        };

        // bind select
        $this.bindSelector = function(queryCommon, configs = null) {
            if (!LIB.isNullOrEmpty(queryCommon) && typeof queryCommon == 'string'){
                // input data executor - ready to initialization
                $this.FORM.DATA.is_initialization = {value: false};
                const EXECUTED_COMMAND = $this.SYSTEM_METHOD.EXECUTER(queryCommon, configs),
                        TIME_LOAD_ACTION = function() {
                            $this.FORM.DATA.timer_stored.sys_check_load.reset();
                            $this.FORM.DATA.timer_stored.sys_check_load.run(EXECUTED_COMMAND.secretKey, EXECUTED_COMMAND.executionMark);
                        };

                $this.FORM.DATA.systemLayoutIncrement(EXECUTED_COMMAND.executionMark);
                
                if (configs && configs.event && configs.event.done) {
                    $this.FORM.DATA.systemEventStories.sys_on_load.add(configs.event.done, EXECUTED_COMMAND.secretKey);
                }

                $this.SYSTEM_METHOD.INIT(TIME_LOAD_ACTION);
            }
        };
        $this.bind = $this.bindSelector;

        // setup after initialization
        $this.find = function(queryCommon = Object.keys($this.FORM.DATA.keys).join(', ')) {
            var SELECT_ELEMENTS = LIB.getElements(queryCommon),
                PROCESS_THREAD =  {
                    setOptionHTML(value) {
                        if (!LIB.isNullOrEmpty(value)) {
                            return LOAD_CALLBACK(function(selectElement, selectObj) {
                                LIB.replaceChildren(selectElement, ...LIB.text2node(value));
                            });
                        }
                        return LOAD_CALLBACK();
                    }, setValue(value, activeEvent = false) {
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.activeEvent = activeEvent;
                            selectObj.controls.value = value;
                        });
                    }, get valueArray() {
                        let rawValue = this.value;
                        if (rawValue == '') {
                            rawValue = [];
                        }
                        if (!Array.isArray(rawValue)) rawValue = [rawValue];
                        return rawValue;
                    }, get value() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.value;
                    }, set value(value) {
                        LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.value = value;
                        });
                    }, get nsValue() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.nsValue;
                    }, get valueString() {
                        let rawValue = this.value;
                        if (Array.isArray(rawValue)) rawValue = rawValue.join(',');
                        return rawValue;
                    }, get valueText() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.valueText;
                    }, get oldValue() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.oldValue;
                    }, valueDataset: (value) => {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.valueDataset(value);
                    }, show: function() {
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.open();
                        });
                    }, selectAll: function() {
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.selectAll();
                        });
                    }, deselectAll: function() {
                        if (SELECT_ELEMENTS == false){
                            for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                                document.querySelectorAll($this.FORM.DATA.keys[_OBJ_KEY].executionMark).forEach(SELECT_ELEMENT => {
                                    $this.find(SELECT_ELEMENT).deselectAll();
                                })
                            }
                        }
                        else {
                            LOAD_CALLBACK(function(selectElement, selectObj) {
                                selectObj.controls.deSelectAll();
                            });
                        }
                        return PROCESS_THREAD;
                    }, change: function() {
                        return LOAD_CALLBACK(function(selectElement) {
                            LIB.eventTrigger(selectElement, 'change');
                        });
                    }, get disabled() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.disabled();
                    }, setDisabled(value) {
                        this.disabled = value;
                        return LOAD_CALLBACK();
                    }, set disabled(value){
                        LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.disabled(value);
                        });
                    }, get readonly(){
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.readonly();
                    }, set readonly(value) {
                        LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.readonly(value);
                        });
                    }, get placeholder() {
                        return $this.FORM.DATA.selectObject[SELECT_ELEMENTS[0].dataset.memKey].controls.placeholder;
                    }, set placeholder(value) {
                        LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.placeholder = value;
                        });
                    }, hideValues(value) {
                        !Array.isArray(value) && (value = [value]);
                        
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.select.getOptions().forEach(optionElement => {
                                if (value.indexOf(optionElement.value) >= 0) {
                                    optionElement.classList.add('no-display');
                                }
                                else {
                                    optionElement.classList && optionElement.classList.remove('no-display');
                                }
                            });
                        });
                    }, showValues(value) {
                        !Array.isArray(value) && (value = [value]);
                        
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.select.getOptions().forEach(optionElement => {
                                if (value.indexOf(optionElement.value) >= 0) {
                                    optionElement.classList && optionElement.classList.remove('no-display');
                                }
                            });
                        });
                    }, hideValuesDataset(values) {
                        let isHideAll = values.all == true;

                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.select.getOptions().forEach(optionElement => {
                                if (optionElement.dataset && values) {
                                    for (let searchKey in values) {
                                        if (isHideAll) {
                                            optionElement.classList.add('no-display');
                                        }
                                        else {
                                            let value = values[searchKey];
                                            !Array.isArray(value) && (value = [value]);
    
                                            if (value.indexOf(optionElement.dataset[searchKey]) >= 0) {
                                                optionElement.classList.add('no-display');
                                            }
                                            else {
                                                optionElement.classList && optionElement.classList.remove('no-display');
                                            }
                                        }
                                    }
                                }
                            });
                        });
                    }, showValuesDataset(values) {
                        let isShowAll = values.all == true;

                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.select.getOptions().forEach(optionElement => {
                                if (optionElement.dataset && values) {
                                    for (let searchKey in values) {
                                        if (isShowAll) {
                                            optionElement.classList.remove('no-display');
                                        }
                                        else {
                                            let value = values[searchKey];
                                            !Array.isArray(value) && (value = [value]);
                                            if (value.indexOf(optionElement.dataset[searchKey]) > -1) {
                                                optionElement.classList && optionElement.classList.remove('no-display');
                                            }
                                        }
                                    }
                                }
                            });
                        });
                    }, deselectNoDisplay(values) {
                        if (SELECT_ELEMENTS == false){
                            for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                                document.querySelectorAll($this.FORM.DATA.keys[_OBJ_KEY].executionMark).forEach(SELECT_ELEMENT => {
                                    $this.find(SELECT_ELEMENT).deselectAll();
                                })
                            }
                        }
                        else {
                            LOAD_CALLBACK(function(selectElement, selectObj) {
                                selectObj.select.getOptions().forEach(optionElement => {
                                    if (optionElement.classList && optionElement.classList.contains('no-display')) {
                                        optionElement.selected = false;
                                    }
                                });
                                LIB.eventTrigger(selectElement, 'change');
                                // selectObj.controls.deSelectAll();
                            });
                        }
                        return PROCESS_THREAD;
                    }, dynamicAction(obj) {
                        if (SELECT_ELEMENTS == false){
                            for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                                document.querySelectorAll($this.FORM.DATA.keys[_OBJ_KEY].executionMark).forEach(SELECT_ELEMENT => {
                                    $this.find(SELECT_ELEMENT).dynamicAction(obj);
                                })
                            }
                        }
                        else {
                            LOAD_CALLBACK(function(SELECT_ELEMENT) {
                                // if (SELECT_ELEMENT.disabled == false && (SELECT_ELEMENT.dataset.readonly == 'false' || LIB.isNullOrEmpty(SELECT_ELEMENT.dataset.readonly))){
                                    (LIB.isNullOrEmpty($this.FORM.DATA.eventStories[SELECT_ELEMENT.dataset.memKey])) && ($this.FORM.DATA.eventStories[SELECT_ELEMENT.dataset.memKey] = {});
                                    $this.FORM.DATA.eventStories[SELECT_ELEMENT.dataset.memKey]['dynamicAction'] = obj;
                                // }
                            });
                        }
                        return PROCESS_THREAD;
                    }, fetchDynamicAction() {
                        if (SELECT_ELEMENTS == false){
                            let excution_str = [];
                            for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                                excution_str.push($this.FORM.DATA.keys[_OBJ_KEY].executionMark);
                            }
                            SELECT_ELEMENTS = document.querySelectorAll(excution_str.join(', '));
                        }
                        return LOAD_CALLBACK(function(selectElement, selectObj) {

                            const WORKER = $this.SYSTEM_METHOD.AJAX_LOADER('', selectObj, function() {
                                LIB.timerProcess.run('auto_mark_options');
                            }, () => {
                                if (!selectObj.configs.cacheable || selectObj.ajax.isDynamic) {
                                    selectObj.ajax.pageNum = 0;
                                    selectObj.ajax.pageTotalNum = 0;
                                }
                            });
                            if (WORKER.isDynamic) {
                                WORKER.commitWork();
                            }
                        });
                    }, destroy() {
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            $this.SYSTEM_METHOD.DESTROY_SELECT(selectObj);
                        });
                    }, visible(value) {
                        return LOAD_CALLBACK(function(selectElement, selectObj) {
                            selectObj.controls.visible = value;
                        });
                    }, isExist() {
                        let flagExist = !1;
                        LOAD_CALLBACK(function(selectElement, selectObj) {
                            (selectElement && !flagExist) && (flagExist = !0);
                        });
                        return flagExist;
                    }
                }, LOAD_CALLBACK = function(callback) {
                    if (callback) {
                        SELECT_ELEMENTS.forEach(selectElement => {
                            let selectObj = $this.FORM.DATA.selectObject[selectElement.dataset.memKey];
                            selectObj && callback(selectElement, selectObj);
                        });
                    }
                    return PROCESS_THREAD;
                }
            ;
            PROCESS_THREAD.ajax = PROCESS_THREAD.dynamicAction;
            PROCESS_THREAD.loadAjax = PROCESS_THREAD.fetchDynamicAction;

            if (SELECT_ELEMENTS) {
                return PROCESS_THREAD;
            }
            else {
                return false;
            }
        };

        $this.destroy = async function(target) {
            const _await_promise = new Promise((resole, reject) => {
                for (var _OBJ_KEY in $this.FORM.DATA.keys) {
                    let excution = $this.FORM.DATA.keys[_OBJ_KEY].executionMark;
                    if (!LIB.isNullOrEmpty(target) && excution != target) {
                        continue;
                    }

                    document.querySelectorAll(excution+'.selectiveUI-INIT').forEach(selectElement => {
                        if (!selectElement.classList.contains('selectiveUI-INIT')) return true;

                        $this.SYSTEM_METHOD.DESTROY_SELECT($this.FORM.DATA.selectObject[selectElement.dataset.memKey])
                    });
                    delete $this.FORM.DATA.keys[_OBJ_KEY];
                }
                if (Object.keys($this.FORM.DATA.keys).length == 0) {
                    $this.FORM.DATA.mutationObserver.disconnect();
                    $this.FORM.DATA.keys = {};
                    document.getElementById('selective_ui_main')?.remove();
                    LIB.unbindEvents(document, {mousedown: $this.FORM.EVENT.CLICK_EVENT, scroll: $this.FORM.EVENT.WINDOW_RESIZE});
                    LIB.unbindEvents(window, {resize: $this.FORM.EVENT.WINDOW_RESIZE});
                    $this.FORM.DATA.is_initialization = {value: false};
                }
                resole();
            })
            await _await_promise;
        }

        return $this.Init();
    };

    _plugin.SelectiveUI = function(e = null) {
        return SelectiveUI(e);
    }
}));