/**
 * @class
 */
export class iStorage {
    defaultConfig = {
        showPanel: true,
        accessoryStyle: "top",
        multiple: false,
        minWidth: "50px",
        width: "0px",
        offsetWidth: null,
        minHeight: "30px",
        height: "30px",
        panelHeight: "220px",
        panelMinHeight: "100px",
        disabled: false,
        readonly: false,
        selectall: true,
        keepSelected: true,
        placeholder: "Select value",
        altMask: "",
        autoclose: false,
        autoscroll: true,
        autofocus: true,
        searchable: true,
        loadingfield: true,
        visible: true,
        skipError: false,
        customDelimiter: ",",
        textLoading: "Processing...",
        textNoData: "No data available",
        textNotFound: "Not found",
        textSelectAll: "Select all",
        textDeselectAll: "Deselect all",
        textAccessoryDeselect: "Deselect: ",
        animationtime: 200, // milisecond
        delaysearchtime: 200, // milisecond
        allowHtml: true,
        maxSelected: 0,
        labelHalign: "left",
        labelValign: "center",
        imageMode: false,
        imageWidth: "60px",
        imageHeight: "60px",
        imageBorderRadius: "4px",
        imagePosition: "right",
        ajax: null,
        on: {
            load: [],
            beforeShow: [],
            show: [],
            beforeChange: [],
            change: [],
            beforeClose: [],
            close: []
        }
    };
    bindedMap = new Map;
    unbindedMap = new Map;
    bindedCommand = [];
}