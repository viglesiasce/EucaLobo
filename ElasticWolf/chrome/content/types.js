//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

// Base class for tree container
var TreeView = {
    name: '',
    model: '',
    tree: null,
    treeBox : null,
    treeList : new Array(),
    selection : null,
    visible: false,
    atomService: null,
    properties: [],
    refreshTimeout: 10000,
    refreshTimer: null,
    menuActive: false,
    searchElement: null,
    searchTimer: null,
    filterList: null,
    tagId: null,
    winDetails: null,
    tab: null,

    getName: function()
    {
        return this.name ? this.name : this.getModelName();
    },
    getModelName: function()
    {
        if (this.model instanceof Array) return this.model[0];
        return this.model;
    },
    getModel: function()
    {
        return this.model ? this.core.getModel(this.getModelName(this.model)) : null;
    },
    getData: function()
    {
        return this.treeList;
    },
    setData: function(list)
    {
        this.treeList = new Array();
        if (list) {
            this.treeList = this.treeList.concat(list);
        }
        this.treeBox.rowCountChanged(0, this.treeList.length);
        this.treeBox.invalidate();
        this.selection.clearSelection();
        this.invalidate();
    },
    getList: function()
    {
        var list = (this.model ? this.getModel() : this.getData()) || [];
        log(this.getName() + ' contains ' + list.length + ' records')
        return list || [];
    },
    get rowCount() {
        return this.treeList.length;
    },
    setTree : function(treeBox)
    {
        this.treeBox = treeBox;
    },
    isRefreshable: function()
    {
        return false;
    },
    isVisible: function()
    {
        return this.visible;
    },
    isEditable : function(idx, column)
    {
        return true;
    },
    isContainer : function(idx)
    {
        return false;
    },
    isSeparator : function(idx)
    {
        return false;
    },
    isSorted : function()
    {
        return false;
    },
    getSelected : function()
    {
        return !this.selection || this.selection.currentIndex == -1 ? null : this.treeList[this.selection.currentIndex];
    },
    setSelected : function(index)
    {
        this.selection.select(index);
    },
    getSelectedAll: function()
    {
        var list = new Array();
        for (var i in this.treeList) {
            if (this.selection.isSelected(i)) {
                list.push(this.treeList[i]);
            }
        }
        return list;
    },
    getImageSrc : function(idx, column)
    {
        return ""
    },
    getProgressMode : function(idx, column)
    {
    },
    getParentIndex: function(idx)
    {
        return -1;
    },
    getCellText : function(idx, column)
    {
        var name = column.id.split(".").pop();
        return idx >= this.rowCount ? "" : this.core.modelValue(name, this.treeList[idx][name]);
    },
    getCellValue : function(idx, column)
    {
        var name = column.id.split(".").pop();
        return idx >= this.rowCount ? "" : this.treeList[idx][name];
    },
    setCellValue: function (idx, column, val)
    {
        var name = column.id.split(".").pop();
        if (idx >= 0 && idx < this.rowCount) this.treeList[idx][name] = val;
    },
    modelChanged : function(name) {
        log('model changed ' + this.getName())
        if (this.visible || this.core.getModel(name) == null) {
            this.invalidate();
        }
    },
    hasNextSibling: function(idx, after)
    {
        return false;
    },
    canDrop: function(idx, orientation, data)
    {
        return true;
    },
    drop: function(idx, orientation, data)
    {
    },
    cycleCell : function(idx, column)
    {
    },
    performAction : function(action)
    {
    },
    performActionOnCell : function(action, idx, column)
    {
    },
    getRowProperties : function(idx, column, prop)
    {
    },
    getCellProperties : function(idx, column, prop)
    {
        var name = column.id.split(".").pop();
        if (idx < 0 || idx >= this.rowCount || this.properties.indexOf(name) == -1) return;
        var value = String(this.treeList[idx][name]).replace(/[ -.:]+/g,'_').toLowerCase();
        // Use CSS entry if exists:  treechildren::-moz-tree-cell(name_value) {}
        prop.AppendElement(this.getAtom(this.getName() + "_" + value));
    },
    getColumnProperties : function(column, element, prop)
    {
    },
    getLevel : function(idx)
    {
        return 0;
    },
    getAtom: function(name)
    {
        if (!this.atomService) {
            this.atomService = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
        }
        return this.atomService.getAtom(name);
    },
    cycleHeader : function(col)
    {
        var item = this.getSelected();
        var csd = col.element.getAttribute("sortDirection");
        var sortDirection = (csd == "ascending" || csd == "natural") ? "descending" : "ascending";
        for ( var i = 0; i < col.columns.count; i++) {
            col.columns.getColumnAt(i).element.setAttribute("sortDirection", "natural");
        }
        col.element.setAttribute("sortDirection", sortDirection);
        this.sort();
        this.treeBox.invalidate();
        if (item) this.select(item);
    },
    sort : function()
    {
        var item = this.getSelected();
        this.treeBox.invalidate();
        var sortField = null;
        var ascending = null;
        for (var i = 0; i < this.tree.columns.count; i++) {
            var col = this.tree.columns.getColumnAt(i);
            var direction = col.element.getAttribute("sortDirection");
            if (direction && direction != "natural") {
                ascending = (direction == "ascending");
                sortField = col.id.split(".").pop();
                break;
            }
        }
        if (!sortField) return;
        this.core.sortObjects(this.treeList, sortField, ascending);
        if (item) this.select(item);
    },
    remove: function(obj, columns)
    {
        var i = this.find(obj, columns)
        if (i >= 0) {
            this.treeList.splice(i, 1);
            this.treeBox.rowCountChanged(i + 1, -1);
        }
    },
    find: function(obj, columns)
    {
        if (obj) {
            if (!columns) columns = ['id', 'name', 'title'];
            for (var i in this.treeList) {
                for (var c in columns) {
                    var n = columns[c];
                    if (obj[n] && obj[n] != "" && this.treeList[i][n] == obj[n]) return i;
                }
            }
        }
        return -1;
    },
    select : function(obj, columns)
    {
        var i = this.find(obj, columns)
        if (i >= 0) {
            var old = this.selection.currentIndex;
            this.selection.select(i);
            this.treeBox.ensureRowIsVisible(i);
            // Make sure the event is fired if we select same item
            if (old == i) {
                this.selectionChanged();
            }
            return true;
        }
        return false;
    },
    selectAll: function(list)
    {
        if (!list) return;
        this.selection.selectEventsSuppressed = true;
        this.selection.clearSelection();
        for (var i in list) {
            var idx = this.find(list[i]);
            if (idx >= 0) {
                this.selection.toggleSelect(idx);
                this.treeBox.ensureRowIsVisible(idx);
            }
        }
        this.selection.selectEventsSuppressed = false;
    },
    refresh : function(force)
    {
        var name = this.getModelName(this.model)
        if (name) {
            this.core.refreshModel(name);
            this.refreshAll(force);
        } else {
            this.invalidate();
        }
    },
    refreshAll: function(force)
    {
        log('refreshAll' + (force ? "force" : "") + ' ' + this.model)
        if (this.model instanceof Array) {
            for (var i = 1; i < this.model.length; i++) {
                if (force || this.core.getModel(this.model[i]) == null) {
                    this.core.refreshModel(this.model[i]);
                }
            }
        }
    },
    startRefreshTimer : function()
    {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        var me = this;
        // Ignore refresh timer if we have popup active
        this.refreshTimer = setTimeout(function() { if (!me.menuActive) me.refresh() }, this.refreshTimeout);
        log('start timer ' + this.getName() + ' for ' + this.refreshTimeout + ' ms');
    },
    stopRefreshTimer : function()
    {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    },
    invalidate : function()
    {
        this.display(this.filter(this.getList()));
    },
    filter : function(list)
    {
        if (this.searchElement) {
            var nlist = new Array();
            var rx = new RegExp($(this.searchElement).value, "i");
            for (var i in list) {
                for (var j in list[i]) {
                    if (String(list[i][j]).match(rx)) {
                        nlist.push(list[i]);
                        break;
                    }
                }
            }
            list = nlist;
        }
        // Must be list of lists, each item is object with name: value: properties
        if (this.filterList) {
            var nlist = new Array();
            for (var i in list) {
                for (var j in this.filterList) {
                    if (this.filterList[j].value) {
                        var p = String(list[i][this.filterList[j].name]);
                        var rc = p.match(this.filterList[j].value);
                        if ((this.filterList[j].not && !rc) || (!this.filterList[j].not && rc)) {
                            nlist.push(list[i])
                        }
                    } else
                    if (this.filterList[j].hasOwnProperty('empty')) {
                        if ((this.filterList[j].empty && !list[i][this.filterList[j].name]) ||
                            (!this.filterList[j].empty && list[i][this.filterList[j].name])) {
                            nlist.push(list[i])
                        }
                    }
                }
            }
            list = nlist;
        }
        return list;
    },
    menuChanged: function()
    {
        this.menuActive = true;
    },
    menuHidden: function()
    {
        this.menuActive = false;
    },
    selectionChanged: function(event)
    {
    },
    filterChanged: function(event)
    {
        this.invalidate();
    },
    searchChanged : function(event)
    {
        if (!this.searchElement) return;
        this.core.setStrPrefs(this.searchElement, $(this.searchElement).value);

        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        var me = this;
        this.searchTimer = setTimeout(function() { me.invalidate(); }, 500);
    },
    display : function(list)
    {
        var sel = cloneObject(this.getSelected())
        this.treeBox.rowCountChanged(0, -this.treeList.length);
        this.treeList = new Array();
        if (list) {
            this.treeList = this.treeList.concat(list);
        }
        log(this.getName() + ' displays ' + this.treeList.length + ' records')
        this.treeBox.rowCountChanged(0, this.treeList.length);
        this.treeBox.invalidate();
        this.selection.clearSelection();
        // No need to sort or select if we are not visible but because we refer to the original model list,
        // multiple views may sort the same list at the same time
        if (this.isVisible()) {
            this.sort();
            if (this.isRefreshable()) {
                this.startRefreshTimer();
            } else {
                this.stopRefreshTimer();
            }
            if (!this.select(sel)) {
                this.selection.select(0);
            }
        }
    },
    activate: function()
    {
        this.visible = true;
        this.restorePreferences();
        // First time, refresh the model
        if (this.rowCount == 0 && this.model && this.getModel() == null) {
            this.refresh();
        }
    },
    deactivate: function()
    {
        this.visible = false;
        this.stopRefreshTimer();
        this.savePreferences();
    },
    tag: function(event, callback)
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var tag = this.core.promptForTag(item.tags);
        if (tag == null) return;
        // Replace tas in the object without reloading the whole list
        item.tags = this.core.parseTags(tag);
        this.core.processTags(item);
        this.core.setTags(item[this.tagId || "id"], item.tags, callback);
    },
    copyToClipboard : function(name)
    {
        var item = this.getSelected();
        if (item) {
            this.core.copyToClipboard(item[name]);
        }
    },
    clicked: function(event)
    {
        // Delay refresh if we are working with the list
        if (this.refreshTimer) {
            this.startRefreshTimer();
        }
        if (this.core.winDetails && event) {
            this.displayDetails();
        }
    },
    displayDetails : function(event)
    {
        var item = this.getSelected();
        if (item == null) return;
        var me = this;
        var rc = { core: this.core, item: item, title: className(item), }
        if (!this.core.win.details) {
            this.core.win.details = window.openDialog("chrome://ew/content/dialogs/details.xul", null, "chrome,centerscreen,modeless,resizable", rc);
        } else
        if (this.core.win.details.setup) {
            this.core.win.details.setup.call(this.core.win.details, rc);
        }
    },
    getInputItems: function()
    {
        if (!this.tab) return [];
        var panel = $(this.tab.name);
        if (!panel) return [];
        var toolbars = panel.getElementsByTagName('toolbar');
        var types = ['textbox' ,'checkbox', 'menulist', 'listbox'];
        var items = [];
        for (var t = 0; t < toolbars.length; t++) {
            for (var i in types) {
                var list = toolbars[t].getElementsByTagName(types[i]);
                for (var j = 0; j < list.length; j++) {
                    items.push({ id: list[j].id, type: types[i], value: list[j].value, checked: list[j].checked })
                }
            }
        }
        return items;
    },
    restorePreferences: function()
    {
        var items = this.getInputItems();
        for (var i in items) {
            switch (items[i].type) {
            case "checkbox":
                $(items[i].id).checked = this.core.getBoolPrefs(items[i].id, false);
                break;

            default:
                $(items[i].id).value = this.core.getStrPrefs(items[i].id);
            }
        }
    },
    savePreferences: function()
    {
        var items = this.getInputItems();
        for (var i in items) {
            switch (items[i].type) {
            case "checkbox":
                this.core.setBoolPrefs(items[i].id, items[i].checked);
                break;

            default:
                this.core.setStrPrefs(items[i].id, items[i].value);
            }
        }
    },
    focus: function()
    {
        if (this.tree) this.tree.focus();
    },
    init: function(tree, tab, core)
    {
        this.core = core;
        // Tree owner and tab object, tab with owner field refers to the primary tab object
        tree.view = this;
        this.tree = tree;
        this.tab = tab;

        // Search text box, one per attached toolbar, need to keep reference for fast access to text
        if (!this.searchElement) {
            // Try naming convertion by name or model name
            var search = $("ew." + this.getName() + ".search");
            if (search) this.searchElement = search.id;
        }
        // Wrapping handlers to preserve correct context for 'this'
        if (!tab.owner) {
            (function(v) { var me = v; tree.addEventListener('dblclick', function(e) { e.stopPropagation();me.displayDetails(e); }, false); }(this));
            (function(v) { var me = v; tree.addEventListener('select', function(e) { e.stopPropagation();me.selectionChanged(e); }, false); }(this));
            (function(v) { var me = v; tree.addEventListener('click', function(e) { e.stopPropagation();me.clicked(e); }, false); }(this));

            // Install hanlders for search textbox
            if (this.searchElement) {
                var textbox = $(this.searchElement);
                if (textbox) {
                    textbox.setAttribute("type", "autocomplete");
                    textbox.setAttribute("autocompletesearch", "form-history");
                    (function(v) { var me = v; textbox.addEventListener('keypress', function(e) { e.stopPropagation();me.searchChanged(e); }, false); }(this));
                } else {
                    debug('search textbox ' + this.searchElement + " not found")
                }
            }

            // Install handlers for menu popups
            var popup = $("ew." + this.getName() + ".contextmenu");
            if (popup) {
                (function(v) { var me = v; popup.addEventListener('popupshowing', function(e) { e.stopPropagation();me.menuChanged(e); }, false); }(this));
                (function(v) { var me = v; popup.addEventListener('popuphidden', function(e) { e.stopPropagation();me.menuHidden(e); }, false); }(this));
            }
        }
        // Register to receive model updates
        if (this.model) {
            this.core.registerInterest(this, this.model);
        }
    },
};

// Dynamic multicolumn listbox
var ew_ListBox = {
    header: [],
    name: null,
    columns: null,
    multiple: false,
    width: 400,
    listItems: [],
    checkedItems: [],
    selectedIndex: -1,
    selectedIndexes: [],
    selectedItems: [],
    core: null,

    done: function()
    {
        var list = $(this.name);
        this.selectedIndex = list.selectedIndex;
        if (this.multiple) {
            for (var i in this.listItems) {
                var cell = $(this.name + '.check' + i);
                if (cell && cell.hasAttribute('checked', 'true')) {
                    this.selectedIndexes.push(i);
                    this.selectedItems.push(this.listItems[i]);
                }
            }
        }
        return true;
    },

    init: function()
    {
        this.selectedIndex = -1;
        this.selectedIndexes = [];
        this.selectedItems = [];
        var list = $(this.name);
        list.width = this.width;
        for (var i in this.listItems) {
            if (this.listItems[i] == null) continue;
            var val = this.toItem(this.listItems[i]);
            if (this.multiple) {
                var row = document.createElement('listitem');
                var cell = document.createElement('listcell');
                cell.setAttribute('type', 'checkbox');
                cell.setAttribute('crop', 'end');
                cell.setAttribute('id', this.name + '.check' + i);
                // Check if this item is already selected
                for (var j in this.checkedItems) {
                    if (this.listItems[i] == this.checkedItems[j]) {
                        cell.setAttribute('checked', 'true');
                        break;
                    }
                }
                row.appendChild(cell);
                cell = document.createElement('listcell');
                cell.setAttribute('label', val);
                row.setAttribute('tooltiptext', val);
                row.appendChild(cell);
                list.appendChild(row);
            } else {
                var row = document.createElement('listitem');
                var cell = document.createElement('listcell');
                row.appendChild(cell);
                cell = document.createElement('listcell');
                cell.setAttribute('crop', 'end');
                cell.setAttribute('label', val);
                row.setAttribute('tooltiptext', val);
                for (var j in this.checkedItems) {
                    if (this.listItems[i] == this.checkedItems[j]) {
                        list.selectedIndex = i;
                    }
                }
                row.appendChild(cell);
                list.appendChild(row);
            }
        }
        for (var i in this.header) {
            var hdr = $(this.name + '.header' + i)
            if (hdr) hdr.setAttribute('label', this.header[i]);
        }
    },

    selectionChanged: function()
    {
        if (this.multiple) {
            var list = $(this.name);
            if (list.currentIndex == -1) return;
            var cell = $(this.name + '.check' + list.currentIndex);
            if (!cell) return;
            var checked = cell.getAttribute('checked');
            if (!checked || checked == "false") {
                cell.setAttribute('checked', 'true');
            } else {
                cell.setAttribute('checked','false');
            }
        }
    },

    // Convert object into plain text to be used by list box
    toItem: function(obj)
    {
        return this.core.toString(obj, this.columns);
    },
};

var FileIO = {
    localfileCID : '@mozilla.org/file/local;1',
    localfileIID : Components.interfaces.nsILocalFile,
    finstreamCID : '@mozilla.org/network/file-input-stream;1',
    finstreamIID : Components.interfaces.nsIFileInputStream,
    foutstreamCID : '@mozilla.org/network/file-output-stream;1',
    foutstreamIID : Components.interfaces.nsIFileOutputStream,
    sinstreamCID : '@mozilla.org/scriptableinputstream;1',
    sinstreamIID : Components.interfaces.nsIScriptableInputStream,
    suniconvCID : '@mozilla.org/intl/scriptableunicodeconverter',
    suniconvIID : Components.interfaces.nsIScriptableUnicodeConverter,
    bufstreamCID: "@mozilla.org/network/buffered-input-stream;1",
    bufstreamIID: Components.interfaces.nsIBufferedInputStream,
    binstreamCID: "@mozilla.org/binaryinputstream;1",
    binstreamIID: Components.interfaces.nsIBinaryInputStream,

    exists : function(path)
    {
        try {
            var file = Components.classes[this.localfileCID].createInstance(this.localfileIID);
            file.initWithPath(path);
            return file.exists();
        }
        catch (e) {
            return false;
        }
    },

    remove : function(path)
    {
        try {
            var file = Components.classes[this.localfileCID].createInstance(this.localfileIID);
            file.initWithPath(path);
            return file.remove(false);
        }
        catch (e) {
            return false;
        }
    },

    open : function(path)
    {
        try {
            var file = Components.classes[this.localfileCID].createInstance(this.localfileIID);
            file.initWithPath(path);
            return file;
        }
        catch (e) {
            return false;
        }
    },

    streamOpen : function(file)
    {
        try {
            var fd = this.open(file);
            var fStream = Components.classes[this.finstreamCID].createInstance(this.finstreamIID);
            var sStream = Components.classes[this.bufstreamCID].createInstance(this.bufstreamIID);
            fStream.init(fd, 1, 0, false);
            sStream.init(fStream, 9000000);
            return [fStream, sStream, fd];
        }
        catch (e) {
            return null;
        }
    },

    streamClose: function(file)
    {
        try { if (file && file[0]) file[0].close(); } catch(e) {}
        try { if (file && file[1]) file[1].close(); } catch(e) {}
        try { if (file && file[3]) file[3].close(); } catch(e) {}
    },

    read : function(file, charset)
    {
        try {
            var data = new String();
            var fStream = Components.classes[this.finstreamCID].createInstance(this.finstreamIID);
            var sStream = Components.classes[this.sinstreamCID].createInstance(this.sinstreamIID);
            fStream.init(file, 1, 0, false);
            sStream.init(fStream);
            data += sStream.read(-1);
            sStream.close();
            fStream.close();
            if (charset) {
                data = this.toUnicode(charset, data);
            }
            return data;
        }
        catch (e) {
            debug("FileIO: read: " + e)
            return false;
        }
    },

    readBinary: function(file, base64)
    {
        try {
            var fStream = Components.classes[this.finstreamCID].createInstance(this.finstreamIID);
            var bStream = Components.classes[this.binstreamCID].createInstance(this.binstreamIID);
            fStream.init(file, 1, 0, false);
            bStream.setInputStream(fStream);
            var data = bStream.readByteArray(bStream.available());
            bStream.close();
            fStream.close();
            if (base64) {
                data = Base64.encode(data);
            }
            return data;
        }
        catch(e) {
            debug("FileIO: readBinary: " + e)
            return false;
        }
    },

    write : function(file, data, mode, charset)
    {
        try {
            var fStream = Components.classes[this.foutstreamCID].createInstance(this.foutstreamIID);
            if (charset) {
                data = this.fromUnicode(charset, data);
            }
            var flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
            if (mode == 'a') {
                flags = 0x02 | 0x10; // wronly | append
            }
            fStream.init(file, flags, 0600, 0);
            fStream.write(data, data.length);
            fStream.close();
            return true;
        }
        catch (e) {
            debug("FileIO: write: " + e)
            return false;
        }
    },

    create : function(file)
    {
        try {
            file.create(0x00, 0600);
            return true;
        }
        catch (e) {
            debug('Error:' + e);
            return false;
        }
    },

    createUnique: function(file)
    {
        try {
            file.createUnique(0x00, 0600);
            return true;
        }
        catch (e) {
            debug('Error:' + e);
            return false;
        }
    },

    unlink : function(file)
    {
        try {
            file.remove(false);
            return true;
        }
        catch (e) {
            return false;
        }
    },

    path : function(file)
    {
        try {
            return 'file:///' + file.path.replace(/\\/g, '\/').replace(/^\s*\/?/, '').replace(/\ /g, '%20');
        }
        catch (e) {
            return false;
        }
    },

    toUnicode : function(charset, data)
    {
        try {
            var uniConv = Components.classes[this.suniconvCID].createInstance(this.suniconvIID);
            uniConv.charset = charset;
            data = uniConv.ConvertToUnicode(data);
        }
        catch (e) {
        }
        return data;
    },

    toString : function(path)
    {
        if (!path) return "";
        try {
            return this.read(this.open(path))
        }
        catch (e) {
            debug("Error: toString:" + path + ": " + e)
            return "";
        }
    },

    fromUnicode : function(charset, data)
    {
        try {
            var uniConv = Components.classes[this.suniconvCID].createInstance(this.suniconvIID);
            uniConv.charset = charset;
            data = uniConv.ConvertFromUnicode(data);
        }
        catch (e) {
        }
        return data;
    },

}

// Directory service get properties
// ProfD profile directory
// DefProfRt user (for example /root/.mozilla)
// UChrm %profile%/chrome
// DefRt %installation%/defaults
// PrfDef %installation%/defaults/pref
// ProfDefNoLoc %installation%/defaults/profile
// APlugns %installation%/plugins
// AChrom %installation%/chrome
// ComsD %installation%/components
// CurProcD installation (usually)
// Home OS root (for example /root)
// TmpD OS tmp (for example /tmp)
// ProfLD Local Settings on windows; where the network cache and fastload files are stored
// resource:app application directory in a XULRunner app
// Desk Desktop directory (for example ~/Desktop on Linux, C:\Documents and
// Settings\username\Desktop on Windows)
// Progs User start menu programs directory (for example C:\Documents and
// Settings\username\Start Menu\Programs)

var DirIO = {
    sep : navigator.platform.toLowerCase().indexOf('win') > -1 ? '\\' : '/',
    dirservCID : '@mozilla.org/file/directory_service;1',
    propsIID : Components.interfaces.nsIProperties,
    fileIID : Components.interfaces.nsIFile,

    get : function(type)
    {
        try {
            return Components.classes[this.dirservCID].createInstance(this.propsIID).get(type, this.fileIID);
        }
        catch (e) {
            return false;
        }
    },

    open : function(path)
    {
        return FileIO.open(path);
    },

    create : function(dir, mode)
    {
        try {
            dir.create(0x01, 0600);
            return true;
        }
        catch (e) {
            debug('Error:' + e);
            return false;
        }
    },

    remove : function(path, recursive)
    {
        return this.unlink(this.open(path), recursive);
    },

    mkpath: function(path)
    {
        try {
            var i = 0
            var dirs = path.split(this.sep);
            if (dirs.length == 0) return 0
            if (isWindows(navigator.platform)) {
                path = dirs[0];
                i++;
            } else {
                path = ""
            }
            while (i < dirs.length) {
                path += this.sep + dirs[i];
                if (!FileIO.exists(path) && !DirIO.create(FileIO.open(path))) {
                    return false
                }
                i++;
            }
            return true;
        }
        catch (e) {
            debug('Error:' + e);
            return false;
        }
    },

    read : function(dir, recursive)
    {
        var list = new Array();
        try {
            if (dir.isDirectory()) {
                if (recursive == null) {
                    recursive = false;
                }
                var files = dir.directoryEntries;
                list = this._read(files, recursive);
            }
        }
        catch (e) {
        }
        return list;
    },

    _read : function(dirEntry, recursive)
    {
        var list = new Array();
        try {
            while (dirEntry.hasMoreElements()) {
                list.push(dirEntry.getNext().QueryInterface(FileIO.localfileIID));
            }
            if (recursive) {
                var list2 = new Array();
                for ( var i = 0; i < list.length; ++i) {
                    if (list[i].isDirectory()) {
                        files = list[i].directoryEntries;
                        list2 = this._read(files, recursive);
                    }
                }
                for (i = 0; i < list2.length; ++i) {
                    list.push(list2[i]);
                }
            }
        }
        catch (e) {
        }
        return list;
    },

    unlink : function(dir, recursive)
    {
        try {
            dir.remove(recursive ? true : false);
            return true;
        }
        catch (e) {
            return false;
        }
    },

    path : function(dir)
    {
        return FileIO.path(dir);
    },

    makepath: function()
    {
        var path = [];
        for (var i = 0; i < arguments.length; i++) {
            if (arguments[i] != "") path.push(arguments[i]);
        }
        return path.join(this.sep);
    },

    split : function(str, join)
    {
        var arr = str.split(/\/|\\/), i;
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            str += arr[i] + ((i != arr.length - 1) ? join : '');
        }
        return str;
    },

    join : function(str, split)
    {
        var arr = str.split(split), i;
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            str += arr[i] + ((i != arr.length - 1) ? this.sep : '');
        }
        return str;
    },

    fileName: function(path)
    {
        var arr = path.split(/\/|\\/)
        return arr.length ? arr[arr.length - 1] : ""
    },
}

// Base64 encode / decode http://www.webtoolkit.info/javascript-base64.html
var Base64 = {
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    encode : function(input)
    {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var chr1g, chr2g, chr3g;
        var i = 0;

        if (typeof input === 'string') {
            input = toByteArray(input);
        }

        while (i < input.length) {
            // Initialize all variables to 0
            chr1 = chr2 = chr3 = 0;
            chr1g = chr2g = chr3g = true;

            if (i < input.length)
                chr1 = input[i++];
            else chr1g = false;

            if (i < input.length)
                chr2 = input[i++];
            else chr2g = false;

            if (i < input.length)
                chr3 = input[i++];
            else chr3g = false;

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (!chr2g) {
                enc3 = enc4 = 64;
            } else
            if (!chr3g) {
                enc4 = 64;
            }
            output = output + this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) + this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
        }

        return output;
    },

    // public method for decoding
    decode : function(input)
    {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            chr1 = chr2 = chr3 = 0;
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            if (i < input.length) enc2 = this._keyStr.indexOf(input.charAt(i++));
            if (i < input.length) enc3 = this._keyStr.indexOf(input.charAt(i++));
            if (i < input.length) enc4 = this._keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | ((enc2 & 0x30) >> 4);
            chr2 = ((enc2 & 15) << 4) | ((enc3 & 0x3c) >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode : function(string)
    {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for ( var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else
                if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                } else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }

        }
        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode : function(utftext)
    {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while (i < utftext.length) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else
                if ((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i + 1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                } else {
                    c2 = utftext.charCodeAt(i + 1);
                    c3 = utftext.charCodeAt(i + 2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }

        }
        return string;
    },
}


function Endpoint(name, url)
{
    this.url = url || "";
    if (!name) {
        this.name = this.url.replace(/(https?:\/\/|ec2|amazonaws|com|\.)/g, "")
    } else {
        this.name = name;
    }

    this.toString = function() {
        return this.name;
    }
}

function Certificate(id, user, body)
{
    this.id = id
    this.userName = user
    this.body = body
    this.toString = function() {
        return this.id;
    }
}

function ServerCertificate(id, name, arn, path, date, body)
{
    this.id = id;
    this.name = name;
    this.arn = arn;
    this.path = path;
    this.date = date || "";
    this.body = body || "";

    this.toString = function() {
        return this.name;
    }
}

function KeyPair(name, fingerprint, material)
{
    this.name = name;
    this.fingerprint = fingerprint;
    this.material = material;
    this.toString = function() {
        return this.name;
    }
}

function AccessKey(id, secret, status, user, date)
{
    this.id = id;
    this.status = status;
    this.userName = user || "";
    this.secret = secret || "";
    this.date = date || "";
    this.state = "";

    this.toString = function() {
        return this.id + (this.state ? fieldSeparator + this.state : "");
    }
}

function TempAccessKey(id, secret, securityToken, expire, userName, userId, arn)
{
    this.id = id;
    this.status = "Temporary";
    this.secret = secret || "";
    this.state = "";
    this.securityToken = typeof securityToken == "string" ? securityToken : "";
    this.expire = expire || "";
    this.userName = userName || "";
    this.userId = userId || "";
    this.arn = arn || "";

    if (typeof this.expire == "string") {
        this.expire = new Date();
        this.expire.setISO8601(expire);
    }

    this.toString = function() {
        return this.id + (this.state ? fieldSeparator + this.state : "");
    }
}

function PolicyTypeDescription(name, descr, attributes)
{
    this.name = name;
    this.descr = descr;
    this.attributes = attributes;

    this.toString = function() {
        return this.name;
    }
}

function PolicyTypeAttributeDescription(name, type, cardinality, descr, dflt)
{
    this.name = name;
    this.type = type;
    this.defaultValue = dflt || "";
    this.cardinality = cardinality;
    this.descr = descr || "";

    this.toString = function() {
        return this.name
    }
}

function Credential(name, accessKey, secretKey, url, securityToken)
{
    this.name = name;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.url = typeof url == "string" ? url : "";
    this.securityToken = typeof securityToken == "string" ? securityToken : "";
    this.status = "";

    this.toString = function() {
        return this.accessKey + ";;" + this.secretKey + ";;" + this.url + ";;" + this.securityToken;
    }
}

function User(id, name, path, arn)
{
    this.id = id
    this.name = name;
    this.path = path;
    this.arn = arn;
    this.groups = null;
    this.policies = null;
    this.accessKeys = null;
    this.mfaDevices = null;
    this.loginProfileDate = null;
    // arn:aws:iam::123456:user/name
    this.accountId = arn ? arn.split(":")[4] : "";

    this.toString = function() {
        return this.name + (this.groups && this.groups.length ? fieldSeparator + this.groups : "");
    }
}

function UserGroup(id, name, path, arn)
{
    this.id = id
    this.name = name
    this.path = path
    this.arn = arn
    this.users = null;
    this.policies = null;

    this.toString = function() {
        return this.name;
    }
}

function MFADevice(id, date, user)
{
    this.id = id
    this.date = date
    this.userName = user || "";
    // arn:aws:iam::123456:mfa/name
    this.name = this.id.indexOf('arn:aws') == 0 ? this.id.split(/[:\/]+/).pop() : this.id;

    this.toString = function() {
        return this.name
    }
}

function S3Bucket(name, mtime, owner)
{
    this.name = name
    this.mtime = mtime
    this.owner = owner
    this.region = ""
    this.acls = null
    this.keys = []
    this.indexSuffix = "";
    this.errorKey = "";
    this.toString = function() {
        return this.name;
    }
}

function S3BucketAcl(id, type, name, permission)
{
    this.id = id
    this.type = type
    this.name = name
    this.permission = permission
    this.toString = function() {
       return (this.name ? this.name : this.id ? this.id : "ALL") + "=" + this.permission;
    }
}

function S3BucketKey(bucket, name, type, size, mtime, owner, etag)
{
    this.bucket = bucket
    this.name = name
    this.type = type
    this.size = size
    this.mtime = mtime
    this.etag = etag
    this.owner = owner
    this.toString = function() {
        return this.bucket + "/" + this.name;
    }
}

function Queue(url)
{
    this.url = url;
    this.name = url.split("/").pop();

    this.toString = function() {
        return this.name
    }
}

function Tag(name, value, id)
{
    this.name = name || "";
    this.value = value || "";
    this.resourceId = id || "";
    this.toString = function() {
        return this.name + ":" + (this.value.match(/[,:]+/) ? '"' + this.value + '"' : this.value);
    }
}

function Group(id, name)
{
    this.id = id
    this.name = name
    this.toString = function() {
        return this.name + fieldSeparator + this.id;
    }
}

function ProductCode(code, type)
{
    this.productCode = code
    this.type = type
    this.toString = function() {
        return this.productCode + fieldSeparator + this.type;
    }
}

function NetworkInterface(id, status, descr, subnetId, vpcId, availabilityZone, macAddress, privateIpAddress, sourceDestCheck, groups, attachment, association, tags)
{
    this.id = id
    this.status = status
    this.descr = descr || "";
    this.subnetId = subnetId
    this.vpcId = vpcId
    this.availabilityZone = availabilityZone
    this.macAddress = macAddress
    this.privateIpAddress = privateIpAddress
    this.sourceDestCheck = sourceDestCheck
    this.groups = groups || [];
    this.attachment = attachment
    this.association = association
    this.tags = tags
    ew_core.processTags(this, "descr")

    this.toString = function() {
        return this.privateIpAddress + fieldSeparator + this.status + fieldSeparator + this.id + fieldSeparator +  this.descr +
               " (" + ew_core.modelValue("subnetId", this.subnetId) + ")";
    }
}

function NetworkInterfaceAttachment(id, instanceId, instanceOwnerId, deviceIndex, status, attachTime, deleteOnTermination)
{
    this.id = id;
    this.instanceId = instanceId;
    this.instanceOwnerId = instanceOwnerId;
    this.deviceIndex = deviceIndex;
    this.status = status;
    this.attachTime = attachTime;
    this.deleteOnTermination = deleteOnTermination;

    this.toString = function() {
        return this.deviceIndex + fieldSeparator + this.status + fieldSeparator + this.id +
               (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function NetworkInterfaceAssociation(id, publicIp, ipOwnerId, instanceId, attachmentId)
{
    this.id = id;
    this.publicIp = publicIp
    this.ipOwnerId = ipOwnerId
    this.instanceId = instanceId
    this.attachmentId = attachmentId
    this.toString = function() {
        return this.publicIp + fieldSeparator + this.id +
               (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function NetworkAclAssociation(id, acl, subnet)
{
    this.id = id
    this.aclId = acl
    this.subnetId = subnet
    this.toString = function() {
        return this.id + fieldSeparator + ew_core.modelValue("subnetId", this.subnetId);
    }
}

function NetworkAclEntry(num, proto, action, egress, cidr, icmp, ports)
{
    this.id = num == 32767 ? "*" : num;
    this.num = num
    this.proto = proto
    this.action = action
    this.egress = egress
    this.cidr = cidr
    this.icmp = icmp ? icmp : []
    this.ports = ports ? ports : []
    this.toString = function() {
        return this.id + fieldSeparator + this.proto + fieldSeparator + this.action + fieldSeparator + (this.egress ? "Egress" + fieldSeparator : "") + this.cidr;
    }
}

function NetworkAcl(id, vpcId, dflt, rules, assocs, tags)
{
    this.id = id
    this.vpcId = vpcId
    this.dflt = dflt
    this.rules = rules
    this.associations = assocs
    this.tags = tags
    ew_core.processTags(this);

    this.toString = function() {
        return this.id + fieldSeparator + (dflt ? "default" : "") + " (" + ew_core.modelValue("vpcId", this.vpcId) + ")";
    }
}

function AMI(id, name, description, location, state, status, arch, platform, aki, ari, rootDeviceType, rootDeviceName, owner, ownerAlias, snapshotId, volumes, virtType, hypervisor, productCodes, tags)
{
    this.id = id;
    this.location = location;
    this.state = state;
    this.owner = owner;
    this.status = status;
    this.arch = arch;
    this.platform = platform;
    this.tags = tags;
    this.aki = aki;
    this.ari = ari;
    this.rootDeviceType = rootDeviceType;
    this.rootDeviceName = rootDeviceName;
    this.ownerAlias = ownerAlias;
    this.name = name;
    this.description = description;
    this.snapshotId = snapshotId;
    this.volumes = volumes;
    this.virtualizationType = virtType;
    this.hypervisor = hypervisor;
    this.productCodes = productCodes;
    ew_core.processTags(this)

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state + fieldSeparator + this.status + fieldSeparator + this.rootDeviceType;
    }
}

function Snapshot(id, volumeId, status, startTime, progress, volumeSize, description, owner, ownerAlias, tags)
{
    this.id = id;
    this.volumeId = volumeId;
    this.status = status;
    this.startTime = startTime.strftime('%Y-%m-%d %H:%M:%S');
    this.progress = progress;
    this.description = description;
    this.volumeSize = volumeSize;
    this.owner = owner;
    this.ownerAlias = ownerAlias;
    this.tags = tags;
    ew_core.processTags(this);

    this.toString = function() {
        return (this.description ? this.description + fieldSeparator : this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator +
               (this.status != "completed" ? this.status + fieldSeparator : "") +
               (this.progress != "100%" ? this.progress : this.volumeSize + "GB");
    }
}

function Volume(id, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, tags)
{
    this.id = id;
    this.size = size;
    this.snapshotId = snapshotId;
    this.availabilityZone = zone;
    this.status = status;
    this.createTime = createTime.strftime('%Y-%m-%d %H:%M:%S');
    this.instanceId = instanceId;
    this.device = device;
    this.attachStatus = attachStatus;
    if (attachStatus != "") {
        this.attachTime = attachTime.strftime('%Y-%m-%d %H:%M:%S');
    }
    this.tags = tags;
    ew_core.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.device + fieldSeparator + this.status + fieldSeparator + this.size + "GB" +
               (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function VolumeStatusEvent(volumeId, availabilityZone, eventId, eventType, description, startTime, endTime)
{
    this.volumeId = volumeId;
    this.availabilityZone = availabilityZone;
    this.eventId = eventId;
    this.eventType = eventType;
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;

    this.toString = function() {
        return this.volumeId + fieldSeparator + this.description;
    }
}

function BlockDeviceMapping(deviceName, virtualName, snapshotId, volumeSize, deleteOnTermination, noDevice)
{
    this.snapshotId = snapshotId;
    this.deviceName = deviceName;
    this.virtualName = virtualName;
    this.volumeSize = volumeSize
    this.deleteOnTermination = deleteOnTermination;
    this.noDevice = noDevice;

    this.toString = function() {
        return this.deviceName +
               (this.virtualName ? fieldSeparator + this.virtualName : "") +
               (this.volumeSize ? fieldSeparator + this.volumeSize + "GB" : "") +
               (this.snapshotId ? fieldSeparator + this.snapshotId : "") +
               (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
               (this.noDevice ? fieldSeparator + "noDevice" : "");
    }
}

function InstanceBlockDeviceMapping(deviceName, volumeId, status, attachTime, deleteOnTermination)
{
    this.volumeId = volumeId;
    this.deviceName = deviceName;
    this.status = status;
    this.attachTime = attachTime;
    this.deleteOnTermination = deleteOnTermination;

    this.toString = function() {
        return this.deviceName + fieldSeparator + this.status + fieldSeparator + this.volumeId + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "");
    }
}

function InstanceNetworkInterface(id, status, descr, subnetId, vpcId, ownerId, privateIp, publicIp, dnsName, srcDstCheck)
{
    this.id = id
    this.status = status
    this.descr = descr || "";
    this.subnetId = subnetId
    this.vpcId = vpcId
    this.ownerId = ownerId
    this.privateIp = privateIp
    this.publicIp = publicIp
    this.sourceDestCheck = srcDstCheck
    this.dnsName = dnsName

    this.toString = function() {
        return this.privateIp + fieldSeparator + this.publicIp + fieldSeparator + this.status + fieldSeparator + this.id + fieldSeparator +  this.descr +
               " (" + ew_core.modelValue("subnetId", this.subnetId) + ")";
    }
}

function Instance(reservationId, ownerId, requesterId, instanceId, imageId, state, productCodes, groups, dnsName, privateDnsName, privateIpAddress, vpcId, subnetId, keyName, reason,
                  amiLaunchIdx, instanceType, launchTime, availabilityZone, tenancy, monitoringStatus, stateReason, platform, kernelId, ramdiskId, rootDeviceType, rootDeviceName,
                  virtualizationType, hypervisor, ipAddress, sourceDestCheck, architecture, instanceLifecycle, clientToken, spotId, volumes, enis, tags)
{
    this.id = instanceId;
    this.reservationId = reservationId;
    this.ownerId = ownerId;
    this.requesterId = requesterId;
    this.elasticIp = '';
    this.imageId = imageId;
    this.state = state;
    this.productCodes = productCodes;
    this.groups = uniqueList(groups, 'id');
    this.dnsName = dnsName;
    this.privateDnsName = privateDnsName;
    this.privateIpAddress = privateIpAddress;
    this.vpcId = vpcId;
    this.subnetId = subnetId;
    this.keyName = keyName;
    this.reason = reason;
    this.amiLaunchIdx = amiLaunchIdx;
    this.instanceType = instanceType;
    this.launchTime = launchTime;
    this.availabilityZone = availabilityZone;
    this.tenancy = tenancy;
    this.monitoringStatus = monitoringStatus;
    this.stateReason = stateReason;
    this.platform = platform;
    this.kernelId = kernelId;
    this.ramdiskId = ramdiskId;
    this.rootDeviceType = rootDeviceType;
    this.rootDeviceName = rootDeviceName;
    this.virtualizationType = virtualizationType;
    this.hypervisor = hypervisor;
    this.ipAddress = ipAddress;
    this.sourceDestCheck = sourceDestCheck;
    this.architecture = architecture;
    this.instanceLifecycle = instanceLifecycle;
    this.clientToken = clientToken;
    this.spotInstanceRequestId = spotId;
    this.volumes = volumes;
    this.enis = enis;
    this.tags = tags;
    this.name = '';
    ew_core.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state;
    }

    this.validate = function() {
        if (!this.ipAddress && this.dnsName) {
            var parts = this.dnsName.split('-');
            this.ipAddress = parts[1] + "." + parts[2] + "." + parts[3] + "." + parseInt(parts[4]);
        }
        if (this.elasticIp == '') {
            var eip = ew_core.queryModel('addresses', 'instanceId', this.id);
            this.elasticIp = eip && eip.length ? eip[0].publicIp : '';
        }
    }
}

function InstanceStatusEvent(instanceId, availabilityZone, code, description, startTime, endTime)
{
    this.instanceId = instanceId;
    this.availabilityZone = availabilityZone;
    this.code = code;
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;

    this.toString = function() {
        return this.instanceId + fieldSeparator + this.description;
    }
}

function SecurityGroup(id, ownerId, name, description, vpcId, permissions, tags)
{
    this.id = id
    this.ownerId = ownerId;
    this.name = name;
    this.description = description;
    this.vpcId = vpcId;
    this.permissions = permissions;
    this.tags = tags
    ew_core.processTags(this)
    this.toString = function() {
        return this.name + fieldSeparator + this.id + (this.vpcId ? " (" + ew_core.modelValue("vpcId", this.vpcId) + ")" : "");
    }
}

function Permission(type, protocol, fromPort, toPort, srcGroup, cidrIp)
{
    this.type = type
    this.protocol = protocol;
    this.fromPort = fromPort;
    this.toPort = toPort;
    this.srcGroup = srcGroup;
    if (srcGroup) {
        this.srcGroup.toString = function() {
            return ew_core.modelValue('groupId', srcGroup.id);
        }
    }
    this.cidrIp = cidrIp;
    this.toString = function() {
        return this.type + fieldSeparator + this.protocol + fieldSeparator + this.fromPort + ":" + this.toPort + fieldSeparator + (this.cidrIp ? this.cidrIp : this.srcGroup ? this.srcGroup.toString() : "");
    }
}

function Route(tableId, cidr, state, gatewayId, eniId, instanceId, instanceOwner)
{
    this.tableId = tableId
    this.cidr = cidr
    this.gatewayId = gatewayId
    this.instanceId = instanceId
    this.instanceOwnerId = instanceOwner
    this.networkInterfaceId = eniId
    this.state = state;
    this.toString = function() {
        return this.cidr + fieldSeparator + ew_core.modelValue("gatewayId", this.gatewayId);
    }
}

function RouteAssociation(id, tableId, subnetId)
{
    this.id = id
    this.tableId = tableId || ""
    this.subnetId = subnetId || ""
    this.toString = function() {
        return this.id;
    }
}

function RouteTable(id, vpcId, main, routes, associations, tags)
{
    this.id = id
    this.vpcId = vpcId
    this.routes = routes || [];
    this.associations = associations || [];
    this.main = main;
    this.tags = tags
    ew_core.processTags(this);

    this.toString = function() {
        var str = (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + ew_core.modelValue("vpcId", this.vpcId);
        if (this.routes && this.routes.length > 0) {
            str += " ("
            for (var i in this.routes) {
                str += (i > 0 ? ", " : "") + this.routes[i].cidr + "/" + this.routes[i].gatewayId;
            }
            str += ")"
        }
        return str;
    }
}

function AvailabilityZone(name, state, msg)
{
    this.id = name;
    this.name = name;
    this.state = state;
    this.message = msg || "";

    this.toString = function() {
        return this.name + fieldSeparator + this.state;
    }
}

function EIP(publicIp, instanceid, allocId, assocId, domain, tags)
{
    this.publicIp = publicIp;
    this.instanceId = instanceid;
    this.allocationId = allocId || "";
    this.associationId = assocId || "";
    this.domain = domain || "";
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        return this.publicIp + (this.instanceId ?  " (" + ew_core.modelValue('instanceId', this.instanceId) + ")" : "");
    }
}

function BundleTask(id, instanceId, state, startTime, updateTime, s3bucket, s3prefix, errorMsg)
{
    this.id = id;
    this.instanceId = instanceId;
    this.state = state;
    this.startTime = startTime.strftime('%Y-%m-%d %H:%M:%S');
    this.updateTime = updateTime.strftime('%Y-%m-%d %H:%M:%S');
    this.s3bucket = s3bucket;
    this.s3prefix = s3prefix;
    this.errorMsg = errorMsg;

    this.toString = function() {
        return this.id
    }
}

function RecurringCharge(frequency, amount)
{
    this.frequency = frequency
    this.amount = amount

    this.toString = function() {
        return this.frequency + fieldSeparator + this.amount
    }
}

function LeaseOffering(id, type, az, duration, fPrice, uPrice, rPrices, desc, offering, tenancy)
{
    this.id = id;
    this.instanceType = type;
    this.azone = az;
    this.duration = duration;
    this.fixedPrice = fPrice;
    this.usagePrice = uPrice;
    this.recurringCharges = rPrices;
    this.productDescription = desc;
    this.offeringType = offering;
    this.tenancy = tenancy;

    this.toString = function() {
        return this.id
    }
}

function ReservedInstance(id, type, az, start, duration, fPrice, uPrice, rPrices, count, desc, state, tenancy)
{
    this.id = id;
    this.instanceType = type;
    this.azone = az;
    this.startTime = start;
    this.start = start.strftime('%Y-%m-%d %H:%M:%S');
    this.duration = duration;
    this.fixedPrice = fPrice;
    this.usagePrice = uPrice;
    this.recurringCharges = rPrices;
    this.count = count;
    this.productDescription = desc;
    this.state = state;
    this.tenancy = tenancy

    this.toString = function() {
        return this.instanceType  + fieldSeparator + this.fixedPrice + fieldSeparator +  this.recurringCharges + fieldSeparator + this.id;
    }
}

function Vpc(id, cidr, state, dhcpOptionsId, tenancy, tags)
{
    this.id = id;
    this.cidr = cidr;
    this.state = state;
    this.dhcpOptionsId = dhcpOptionsId;
    this.tags = tags;
    this.instanceTenancy = tenancy;
    ew_core.processTags(this)

    this.toString = function() {
        return this.cidr + fieldSeparator + (this.name ? this.name + fieldSeparator : "") + this.id;
    }
}

function Subnet(id, vpcId, cidr, state, availableIp, availabilityZone, tags)
{
    this.id = id;
    this.vpcId = vpcId;
    this.cidr = cidr;
    this.state = state;
    this.availableIp = availableIp;
    this.availabilityZone = availabilityZone;
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        return this.cidr + fieldSeparator + (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.availableIp + fieldSeparator + this.availabilityZone;
    }
}

function DhcpOptions(id, options, tags)
{
    this.id = id;
    this.options = options;
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        return this.options + fieldSeparator + this.id;
    }
}

function VpnConnection(id, vgwId, cgwId, type, state, config, tags)
{
    this.id = id;
    this.vgwId = vgwId;
    this.cgwId = cgwId;
    this.type = type;
    this.state = state;
    this.config = config;
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state + fieldSeparator +
               ew_core.modelValue("vgwId", this.vgwId) + fieldSeparator + ew_core.modelValue('cgwId', this.cgwId);
    }
}

function InternetGateway(id, vpcId, tags)
{
    this.id = id
    this.vpcId = vpcId;
    this.tags = tags
    ew_core.processTags(this)

    this.toString = function() {
        return this.id + fieldSeparator + ew_core.modelValue("vpcId", this.vpcId);
    }
}

function VpnGateway(id, availabilityZone, state, type, attachments, tags)
{
    this.id = id;
    this.availabilityZone = availabilityZone;
    this.state = state;
    this.type = type;
    this.attachments = attachments || [];
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        var text = (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state
        for (var i in this.attachments) {
            text += ", " + this.attachments[i].toString();
        }
        return text;
    }
}

function VpnGatewayAttachment(vpcId, vgwId, state)
{
    this.vpcId = vpcId;
    this.vgwId = vgwId;
    this.state = state;
    this.toString = function() {
        return this.state + fieldSeparator + ew_core.modelValue("vpcId", this.vpcId);
    }
}

function CustomerGateway(id, ipAddress, bgpAsn, state, type, tags)
{
    this.id = id;
    this.ipAddress = ipAddress;
    this.bgpAsn = bgpAsn;
    this.state = state;
    this.type = type;
    this.tags = tags;
    ew_core.processTags(this)

    this.toString = function() {
        return this.ipAddress + fieldSeparator + this.bgpAsn + (this.name ? fieldSeparator + this.name : "");
    }
}

function LoadBalancer(name, CreatedTime, DNSName, HostName, ZoneId, Instances, Listeners, HealthCheck, availabilityZones, appPolicies, lbPolicies, oPolicies, vpcId, subnets, srcGroup, groups)
{
    this.name = name;
    this.CreatedTime = CreatedTime;
    this.DNSName = DNSName;
    this.CanonicalHostedHostName = HostName;
    this.CanonicalHostedZoneId = ZoneId;
    this.Instances = Instances;
    this.Listeners = Listeners;
    this.HealthCheck = HealthCheck;
    this.zones = availabilityZones;
    this.appStickinessPolicies = appPolicies;
    this.lbStickinessPolicies = lbPolicies;
    this.otherPolicies = oPolicies;
    this.vpcId = vpcId
    this.SourceSecurityGroup = srcGroup;
    this.subnets = subnets
    this.groups = groups

    this.toString = function() {
        return this.name;
    }
}

function LoadBalancerListener(protocol, port, instanceProtocol, instancePort, policies)
{
    this.Protocol = protocol;
    this.Port = port;
    this.InstanceProtocol = instanceProtocol;
    this.InstancePort = instancePort;
    this.policies = policies || [];

    this.toString = function() {
        return this.Protocol + ":" + this.Port + "->" + this.InstancePort + (this.policies.length ? fieldSeparator + policies : "");
    }
}

function LoadBalancerPolicy(name, cookie, period)
{
    this.name = name;
    this.cookieName = cookie || "";
    this.expirationPeriod = period || "";

    this.toString = function() {
        return this.name + fieldSeparator + (this.cookieName || this.expirationPeriod || "");
    }
}

function LoadBalancerHealthCheck(Target, Interval, Timeout, HealthyThreshold, UnhealthyThreshold)
{
    this.Target = Target;
    this.Interval = Interval;
    this.Timeout = Timeout;
    this.HealthyThreshold = HealthyThreshold;
    this.UnhealthyThreshold = UnhealthyThreshold;

    this.toString = function() {
        return this.Target + fieldSeparator + this.Interval + "/" + this.Timeout + fieldSeparator + this.HealthyThreshold + "/" + this.UnhealthyThreshold;
    }
}

function InstanceHealth(Description, State, InstanceId, ReasonCode)
{
    this.Description = Description;
    this.State = State;
    this.InstanceId = InstanceId;
    this.ReasonCode = ReasonCode;
    this.toString = function() {
        return this.Description + fieldSeparator + this.State + fieldSeparator + ew_core.modelValue("instanceId", this.InstanceId);
    }
}

function MetricAlarm(name, arn, descr, stateReason, stateReasonData, stateValue, namespace, period, threshold, statistic, oper, metricName, evalPeriods, dimensions, actions)
{
    this.name = name;
    this.arn = arn;
    this.descr = descr;
    this.stateReason = stateReason
    this.stateReasonData = stateReasonData
    this.stateValue = stateValue
    this.namespace = namespace
    this.period = period
    this.threshold = threshold
    this.statistic = statistic
    this.oper = oper
    this.metricName = metricName
    this.evaluationPeriods = evalPeriods
    this.dimensions = dimensions
    this.actions = actions

    this.toString = function() {
        return this.name + fieldSeparator + this.descr;
    }
}

function Message(id, body, handle, url)
{
    this.id = id;
    this.body = body || "";
    this.handle = handle;
    this.url = url || "";
    this.size = this.body.length;
    this.subject = this.body.substr(0, 32);

    this.toString = function() {
        return this.id;
    }
}

function Topic(arn)
{
    this.id = arn || "";
    this.name = this.id.split(/[:\/]/).pop();

    this.toString = function() {
        return this.name;
    }
}

function Subscription(TopicArn,SubscriptionArn,Protocol,Endpoint,Owner)
{
    this.id = SubscriptionArn
    this.TopicArn = TopicArn
    this.topic = this.TopicArn.split(/[:\/]+/).pop()
    this.Protocol = Protocol
    this.Endpoint = Endpoint
    this.Owner = Owner

    this.toString = function() {
        return this.Protocol + fieldSepararor + this.Endpoint;
    }
}

function DBInstance(id, name, engine, version, host, port, user, dbclass, status, azone, space, created, license, upgrade, brperiod, charset,
                    lrtime, multiAZ, bkwin, prefwin, replicas, srcreplica, optname, optstatus, pendingMods, subnetgrp, sgroups, pgroups)
{
    this.id = id
    this.name = name
    this.engine = engine
    this.version = version
    this.host = host
    this.port = port
    this.masterUsername = user
    this.instanceClass = dbclass
    this.status = status
    this.availabilityZone = azone
    this.allocatedStorage = space
    this.instanceCreateTime = created
    this.licenseModel = license
    this.autoMinorVersionUpgrade = upgrade
    this.backupRetentionPeriod = brperiod
    this.charSet = charset
    this.latestRestorableTime = lrtime
    this.multiAZ = multiAZ
    this.preferredBackupWindow = bkwin
    this.preferredMaintenanceWindow = prefwin
    this.readReplicaDBInstanceIdentifiers = replicas
    this.readReplicaSourceDBInstanceIdentifier = srcreplica
    this.optionGroupName = optname
    this.optionGroupStatus = optstatus
    this.pendingModifiedValues = pendingMods
    this.subnetGroup = subnetgrp
    this.securityGroups = sgroups
    this.parametersGroups = pgroups

    this.toString = function() {
        return this.name + fieldSeparator + this.id + fieldSeparator + this.engine + "/" + this.version;
    }
}

function DBSubnet(id, availabilityZone, status)
{
    this.id = id
    this.availabilityZone = AvailabilityZone
    this.status = status

    this.toString = function() {
        return this.id + fieldSeparator + this.availabilityZone + fieldSeparator + this.status
    }
}

function DBSubnetGroup(name, descr, status, vpcId, subnets)
{
    this.name = name
    this.descr = descr
    this.status = status
    this.vpcId = vpcId
    this.subnets = subnets

    this.toString = function() {
        return this.name + fieldSeparator + this.descr + fieldSeparator + this.status + fieldSeparator + ew_core.modelValue('vpcId', this.vpcId) + fieldSeparator + this.subnets;
    }
}

function HostedZone(id, name, ref, count, comment)
{
    this.id = id
    this.name = name
    this.reference = ref
    this.count = count
    this.comment = comment

    this.toString = function() {
        return this.name + fieldSeparator + this.count;
    }
}

function HostedRecord(name, type, ttl, values, zone, dns, setid, weight, region)
{
    this.name = name
    this.type = type
    this.ttl = ttl || "";
    this.values = values || [];
    this.hostedZoneId = zone || "";
    this.dnsName = dns || "";
    this.setId = setid || "";
    this.weight = weight || "";
    this.region = region || "";

    this.toString = function() {
        return this.name + fieldSeparator + this.type + fieldSeparator + this.values;
    }
}
