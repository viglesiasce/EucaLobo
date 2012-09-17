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
        return this.model ? this.core.getModel(this.getModelName()) : null;
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
    isEmpty: function()
    {
        return this.rowCount == 0;
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
        var name = this.getModelName()
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
            var args = [];
            for (var i = 1; i < this.model.length; i++) {
                if (force || this.core.getModel(this.model[i]) == null) {
                    args.push(this.model[i]);
                }
            }
            if (args.length) {
                debug('refreshAll: ' + args)
                this.core.refreshModel.apply(this.core, args);
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
        if (this.isEmpty() && this.model && this.getModel() == null) {
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

            case "menulist":
                var val = this.core.getStrPrefs(items[i].id, '#');
                if (val != '#') $(items[i].id).value = val;
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
var ListBox = {
    headers: [],
    name: 'list',
    title: null,
    columns: null,
    multiple: true,
    width: 400,
    rows: 10,
    items: [],
    checkedItems: [],
    checkedProperty: null,
    selectedIndex: -1,
    selectedItems: [],
    core: null,

    done: function()
    {
        var list = $(this.name);
        this.selectedIndex = list.selectedIndex;
        this.selectedItems = [];
        if (this.multiple) {
            for (var i = 0; i < this.items.length; i++) {
                var cell = $(this.name + '.check' + i);
                var checked = cell && cell.hasAttribute('checked', 'true') ? true : false;
                if (checked) {
                    this.selectedItems.push(this.items[i]);
                }
            }
        }
        return true;
    },

    init: function(params)
    {
        for (var p in params) {
            if (typeof params[p] == "undefined" || params[p] == null) continue;
            this[p] = params[p];
        }
        this.selectedIndex = -1;
        this.selectedItems = [];
        var list = $(this.name);
        if (!list) return;
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }
        list.width = this.width;
        list.setAttribute('rows', this.rows || 10);
        list.onclick = null;
        (function(v) { var me = v; list.addEventListener('click', function(e) { e.stopPropagation();me.selectionChanged(e); }, false); }(this));

        var head = document.createElement('listhead');
        head.setAttribute('flex', '1');
        list.appendChild(head);
        var cols = document.createElement('listcols');
        cols.setAttribute('flex', '1');
        list.appendChild(cols);

        if (this.headers && this.headers.length) {
            if (this.multiple) {
                var hdr = document.createElement('listheader');
                hdr.setAttribute('flex', '1');
                hdr.setAttribute('id', this.name + '.header0');
                hdr.setAttribute('label', this.headers[0]);
                head.appendChild(hdr);
                hdr = document.createElement('listheader');
                hdr.setAttribute('id', this.name + '.header1');
                hdr.setAttribute('flex', '2');
                hdr.setAttribute('label', this.headers.length>1 ? this.headers[1] : this.title);
                head.appendChild(hdr);
                var col = document.createElement('listcol');
                cols.appendChild(col);
                col = document.createElement('listcol');
                col.setAttribute('flex', '1');
                cols.appendChild(col);
            } else {
                var hdr = document.createElement('listheader');
                hdr.setAttribute('id', this.name + '.header1');
                hdr.setAttribute('flex', '2');
                hdr.setAttribute('label', this.headers[0]);
                head.appendChild(hdr);
                var col = document.createElement('listcol');
                col.setAttribute('flex', '2');
                cols.appendChild(col);
            }
        }

        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i] == null) continue;
            var val = this.toItem(this.items[i]);
            if (this.multiple) {
                var row = document.createElement('listitem');
                var cell = document.createElement('listcell');
                cell.setAttribute('type', 'checkbox');
                cell.setAttribute('crop', 'end');
                cell.setAttribute('id', this.name + '.check' + i);
                // Check if this item is already selected
                for (var j in this.checkedItems) {
                    if (this.items[i] == this.checkedItems[j]) {
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
                cell.setAttribute('crop', 'end');
                cell.setAttribute('label', val);
                row.setAttribute('tooltiptext', val);
                for (var j in this.checkedItems) {
                    if (this.items[i] == this.checkedItems[j]) {
                        list.selectedIndex = i;
                    }
                }
                row.appendChild(cell);
                list.appendChild(row);
            }
        }
    },

    selectionChanged: function()
    {
        if (this.multiple) {
            var list = $(this.name);
            if (list.currentIndex == -1) return;
            var cell = $(this.name + '.check' + list.currentIndex);
            if (!cell) return;
            var checked = !toBool(cell.getAttribute('checked'));
            cell.setAttribute('checked', checked);
            if (this.checkedProperty) {
                this.items[list.currentIndex][this.checkedProperty] = checked;
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
    exists : function(path)
    {
        try {
            var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
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
            var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
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
            var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
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
            var fStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
            var sStream = Components.classes["@mozilla.org/network/buffered-input-stream;1"].createInstance(Components.interfaces.nsIBufferedInputStream);
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
            var fStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
            var sStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
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
            var fStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
            var bStream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
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
            var fStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
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
            var uniConv = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
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
            var uniConv = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
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
// Desk Desktop directory (for example ~/Desktop on Linux, C:\Documents and Settings\username\Desktop on Windows)
// Progs User start menu programs directory (for example C:\Documents and Settings\username\Start Menu\Programs)

var DirIO = {
    slash : navigator.platform.toLowerCase().indexOf('win') > -1 ? '\\' : '/',

    get : function(type)
    {
        try {
            return Components.classes['@mozilla.org/file/directory_service;1'].createInstance(Components.interfaces.nsIProperties).get(type, Components.interfaces.nsIFile);
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
            var dirs = path.split(this.slash);
            if (dirs.length == 0) return 0
            if (isWindows(navigator.platform)) {
                path = dirs[0];
                i++;
            } else {
                path = ""
            }
            while (i < dirs.length) {
                path += this.slash + dirs[i];
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
                list.push(dirEntry.getNext().QueryInterface(Components.interfaces.nsILocalFile));
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
        return path.join(this.slash);
    },

    split : function(str, join)
    {
        var arr = str.split(/\/|\\/), i;
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            if (arr[i] == '') continue;
            str += arr[i] + ((i != arr.length - 1) ? join : '');
        }
        return str;
    },

    join : function(str, split)
    {
        var i, arr = str.split(split);
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            if (arr[i] == '') continue;
            str += arr[i] + ((i != arr.length - 1) ? this.slash : '');
        }
        return str;
    },

    fileName: function(path)
    {
        var arr = path.split(/\/|\\/);
        return arr.length ? arr[arr.length - 1] : "";
    },

    dirName: function(path)
    {
        var arr = path.split(/\/|\\/);
        return arr.slice(0, arr.length - 1).join(this.slash);
    },

    baseName: function(path)
    {
        return this.fileName(path).split(".")[0];
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

// Create new instance of the list box
function ListView(params)
{
    this.init(params);
}
ListView.prototype = ListBox;

// Heavily modified jsgraph library for charts using HTML5 Canvas, original author's message is below:
//
//   Copyright (c) 2010 Daniel 'Haribo' Evans
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
//   files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use,
//   copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
//   Software is furnished to do so, subject to the following conditions:
//   The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

function Point(x, y, color, label)
{
    this.x = typeof x == "string" ? parseInt(x) : x;
    this.y = typeof y == "string" ? parseFloat(y) : y;
    this.color = color;
    this.label = label;
}

function Series(name, color)
{
    this.name = name;
    this.color = color;
    this.points = new Array();
}

function Graph(title, element, type)
{
    this.options = { type : "line",
                     barOverlap : false,
                     barWidth : 1,
                     vstep : "auto",
                     vstart : "auto",
                     vfinish : "auto",
                     hstart : "auto",
                     hfinish : "auto",
                     title : "",
                     xlabel : "",
                     fillColor : "",
                     seriesColor: ["blue", "red", "green", "brown"],
                     canvasName : null,
                     leftSpace: 35,
                     rightSpace: 35,
                     textcol: "rgb(0,0,0)",
                     linecol: "rgb(240,240,240)",
                     keypos: "right",
                     barwidth: 1,
                     fontname: "sans-serif",
                     fontsize: 11 };



    this.options.title = title;
    this.options.canvasName = element;
    this.options.type = type;

    this.reset = function()
    {
        this.series = new Array();
        this.addSeries('');
    }

    this.addSeries = function(name, color)
    {
        this.lastSeries = new Series(name, color || this.options.seriesColor[this.series.length]);
        this.series[this.series.length] = this.lastSeries;
    }
    this.reset();

    this.addPoint = function(x, y, label)
    {
        this.lastSeries.points[this.lastSeries.points.length] = new Point(x, y, this.lastSeries.color, label);
    }

    this.vmin = function()
    {
        if (this.options.vstart != "auto" && !isNaN(this.options.vstart)) {
            return this.options.vstart;
        }
        var min = 1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].y < min) min = ser.points[m].y;
            }
        }
        if (this.options.type == "bar" && min > 0) {
            // Hack for bar charts, this could be handled much better.
            min = 0;
        }
        return min;
    }

    this.vmax = function()
    {
        if (this.options.vfinish != "auto" && !isNaN(this.options.vfinish)) {
            return this.options.vfinish;
        }
        var max = -1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].y > max) max = ser.points[m].y;
            }
        }
        return max;
    }

    this.min = function()
    {
        if (this.options.hstart != "auto" && !isNaN(this.options.hstart)) {
            return this.options.hstart;
        }
        var min = 1000000;
        for (var q = 0; q < this.series.length; q++) {
            var sers = this.series[q];
            for (var m = 0; m < sers.points.length; m++) {
                if (sers.points[m].x < min) min = sers.points[m].x;
            }
        }
        return min;
    }

    this.max = function()
    {
        if (this.options.hfinish != "auto" && !isNaN(this.options.hfinish)) {
            return this.options.hfinish;
        }
        var max = -1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].x > max) max = ser.points[m].x;
            }
        }
        return max;
    }

    this.range = function()
    {
        var min = this.min();
        var max = this.max();
        if (max - min == 0) return 1;
        return max - min;
    }

    this.vrange = function()
    {
        var min = this.vmin();
        var max = this.vmax();
        if (max - min == 0) return 1;
        return max - min;
    }

    this.draw = function()
    {
        var canvas = document.getElementById(this.options.canvasName);
        var ctx = canvas.getContext('2d');

        // Clear the canvas
        if (this.options.fillColor != "") {
            var origFil = ctx.fillStyle;
            ctx.fillStyle = this.options.fillColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = origFil;
        } else {
            canvas.width = canvas.width;
        }

        ctx.font = this.options.fontsize + "px " + this.options.fontname;
        ctx.textBaseline = "top";
        var hMin = this.min();
        var vMin = this.vmin();
        var vRange = this.vrange();
        var topSpace = this.options.fontsize * 1.5;
        var bottomSpace = (this.options.fontsize + 4) * (this.options.xlabel ? 2 : 1);
        var leftSpace = this.options.leftSpace;
        var rightSpace = this.options.rightSpace;

        if (this.options.keypos != '' && this.lastSeries.name != '') {
            ctx.textBaseline = "top";
            // Find the widest series name
            var widest = 1;
            for (var k = 0; k < this.series.length; k++) {
                if (ctx.measureText(this.series[k].name).width > widest) widest = ctx.measureText(this.series[k].name).width;
            }
            if (this.options.keypos == 'right') {
                rightSpace += widest + 22;
                ctx.strokeRect(canvas.width - rightSpace + 4, 18, widest + 20, ((this.series.length + 1) * 12) + 4);
                ctx.fillText("Key", canvas.width - rightSpace + 6, 20);
                for (var k = 0; k < this.series.length; k++) {
                    ctx.fillText(this.series[k].name, canvas.width - rightSpace + 18, 20 + (12 * (k + 1)));
                    ctx.save();
                    ctx.fillStyle = this.series[k].color;
                    ctx.fillRect(canvas.width - rightSpace + 8, 21 + (12 * (k + 1)), 8, 8);
                    ctx.restore();
                }
            }
        }

        // Adjust spacing from the left/right based on the labels abd values
        var tw = ctx.measureText((vMin + vRange).toFixed(2)).width;
        if (leftSpace <= tw) leftSpace = tw + 4;

        if (this.series[0].points.length) {
            var label = this.series[0].points[0].label;
            tw = ctx.measureText(label).width;
            if (leftSpace <= tw/2) leftSpace = tw/2 + 4;
            label = this.series[0].points[this.series[0].points.length - 1].label;
            tw = ctx.measureText(label).width;
            if (rightSpace <= tw/2) rightSpace = tw/2 + 4;
        }

        var width = canvas.width - leftSpace - rightSpace;
        var height = canvas.height - topSpace - bottomSpace;
        var vScale = height / this.vrange();
        var hScale = width / (this.range() + (this.options.type == "bar" ? 1 : 0));

        // Draw title & Labels
        ctx.textAlign = "center";
        ctx.fillStyle = this.options.textcol;
        ctx.fillText(this.options.title, canvas.width / 2, 2, canvas.width);
        ctx.textBaseline = "bottom";
        ctx.fillText(this.options.xlabel, canvas.width / 2, canvas.height - 2, canvas.width);
        ctx.textAlign = "left";

        if (this.options.vstep != "auto" && !isNaN(this.options.vstep)) {
            spacing = this.options.vstep;
        } else {
            spacing = vRange / this.options.fontsize * 2;
        }

        var pos = 0, count = 0;
        for (var i = vMin; i <= vMin + vRange; i += spacing) {
            var y = (canvas.height - bottomSpace) - (i) * vScale + (vMin * vScale);
            if (pos > 0 && pos - y < this.options.fontsize * 2) continue;
            pos = y;
            // Value label
            ctx.textBaseline = "bottom";
            ctx.textAlign = "right";
            ctx.fillStyle = this.options.textcol;
            ctx.fillText(i.toFixed(2), leftSpace - 2, y);
            ctx.fillStyle = this.options.linecol;
            // Horizontal lines
            if (i == vMin || i == vMin + vRange) continue;
            ctx.strokeStyle = "rgb(220,220,220)";
            ctx.beginPath();
            ctx.moveTo(leftSpace, y);
            ctx.lineTo(canvas.width - rightSpace, y);
            ctx.stroke();
            ctx.strokeStyle = "rgb(0,0,0)";
        }

        // Vertical lines with labels
        var pos = 0;
        for (var p = 0; p < this.series[0].points.length; p++) {
            var curr = this.series[0].points[p];
            if (!curr.label) continue;
            var y = canvas.height - bottomSpace;
            var x = hScale * (curr.x - hMin) + leftSpace;
            var tw = ctx.measureText(curr.label).width;
            if (pos > 0 && x - pos <= tw + this.options.fontsize + 4) continue;
            pos = x;
            // Time label
            ctx.textBaseline = "top";
            ctx.textAlign = "center";
            ctx.fillStyle = this.options.textcol;
            ctx.fillText(curr.label, x, y + 3);
            ctx.fillStyle = this.options.linecol;
            // Vertical line
            if (x <= leftSpace || x >= width) continue;
            ctx.strokeStyle = "rgb(220,220,220)";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, topSpace);
            ctx.stroke();
            ctx.strokeStyle = "rgb(0,0,0)";
        }

        for (var s = 0; s < this.series.length; s++) {
            var series = this.series[s];
            ctx.beginPath();
            for (var p = 0; p < series.points.length; p++) {
                var curr = series.points[p];
                // Move point into graph-space
                var height = canvas.height;
                var y = (canvas.height - bottomSpace) - (curr.y) * vScale + (vMin * vScale);
                var x = hScale * (curr.x - hMin) + leftSpace;
                count++;

                switch (this.options.type) {
                case "line":
                case "scatter":
                    if (this.options.type == "line") {
                        // Main line
                        ctx.lineTo(x, y);
                    }
                    // Draw anchor for this point
                    ctx.fillStyle = curr.color;
                    ctx.fillRect(x - 2, y - 2, 4, 4);
                    ctx.fillStyle = "rgb(0,0,0)";
                    break;

                case "bar":
                    ctx.fillStyle = curr.color;
                    var barwidth = hScale;
                    if (this.options.barWidth != null && this.options.barWidth <= 1) {
                        barwidth *= this.options.barWidth;
                    }
                    var baroffs = ((this.options.barWidth < 1) ? ((1 - this.options.barWidth) / 2) * hScale : 0);
                    barwidth /= (this.options.barOverlap ? 1 : this.series.length);
                    var seriesWidth = (!this.options.barOverlap ? barwidth : 0);
                    ctx.fillRect((x + baroffs) + seriesWidth * s, y, barwidth, (curr.y * vScale));
                    ctx.fillStyle = "rgb(0,0,0)";
                    break;
                }
            }
            ctx.stroke();
        }

        // Draw border of graph
        if (count) {
            ctx.strokeRect(leftSpace, topSpace, canvas.width - leftSpace - rightSpace, canvas.height - topSpace - bottomSpace);
        }
    }
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
    this.date = date ? new Date(date) : "";
    this.state = "";
    this.securityToken = "";

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
    this.expire = typeof expire == "string" ? new Date(expire) : "";
    this.userName = userName || "";
    this.userId = userId || "";
    this.arn = arn || "";

    this.toString = function() {
        return this.id + (this.state ? fieldSeparator + this.state : "");
    }
}
function Credential(name, accessKey, secretKey, url, securityToken, expire)
{
    this.name = name;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.url = typeof url == "string" ? url : "";
    this.securityToken = typeof securityToken == "string" ? securityToken : "";
    this.status = "";
    this.expire = expire instanceof Date || (typeof expire == "object" && expire.getTime) ? expire.getTime() : (!isNaN(parseInt(expire)) ? parseInt(expire) : 0);
    this.type = this.expire > 0 || this.securityToken != "" ? "Temporary" : "";
    this.expirationDate =  this.expire > 0 ? new Date(this.expire) : "";

    this.toString = function() {
        return this.accessKey + ";;" + this.secretKey + ";;" + this.url + ";;" + this.securityToken + ";;" + this.expire;
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

function Item(name, value)
{
    this.name = name
    this.value = value

    this.toString = function() {
        return this.name + fieldSeparator + this.value;
    }
}


function Tag(name, value, id, type, propagate)
{
    this.name = name || "";
    this.value = value || "";
    this.resourceId = id || "";
    this.resourceType = type || "";
    this.propagateAtLaunch = propagate || false;

    this.toString = function() {
        return this.name + ":" + (this.value.match(/[,:]+/) ? '"' + this.value + '"' : this.value);
    }
}

function Group(id, name, status, owner)
{
    this.id = id
    this.name = name
    this.owner = owner || ""
    this.status = status || "";
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

function Role(id, name, arn, path, assumePolicy, date)
{
    this.id = id
    this.name = name
    this.arn = arn
    this.path = path
    this.assumeRolePolicyDocument = assumePolicy
    this.date = date
    this.instanceProfiles = null;
    this.policies = null;

    this.toString = function() {
        return this.name
    }
}

function PrivateIpAddress(privateIp, primary, publicIp, assocId)
{
    this.privateIp = privateIp;
    this.publicIp = publicIp
    this.primary = toBool(primary)
    this.associationId = assocId || "";
    this.toString = function() {
        return this.privateIp + (this.publicIp ? "/" + this.publicIp : "") + fieldSeparator + (this.primary ? "Primary" : "Secondary")
    }
}

function NetworkInterface(id, status, descr, subnetId, vpcId, availabilityZone, macAddress, privateIpAddress, sourceDestCheck, groups, attachment, association, eips, tags)
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
    this.securityGroups = groups || [];
    this.attachment = attachment
    this.association = association
    this.privateIpAddresses = eips;
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
    this.deleteOnTermination = toBool(deleteOnTermination);

    this.toString = function() {
        return this.deviceIndex + fieldSeparator + this.status + fieldSeparator + this.id + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
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

function NetworkAclEntry(aclId, num, proto, action, egress, cidr, icmp, ports)
{
    this.aclId = aclId;
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
    this.description = description || "";
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

function Volume(id, type, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, deleteOnTermination, tags)
{
    this.id = id;
    this.type = type;
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
    this.deleteOnTermination = toBool(deleteOnTermination);
    this.tags = tags;
    ew_core.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") +
                this.id + fieldSeparator + this.type + fieldSeparator + this.device + fieldSeparator + this.status + fieldSeparator + this.size + "GB" +
               (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
               (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function VolumeStatusEvent(volumeId, status, availabilityZone, eventId, eventType, description, startTime, endTime, action, actionDescr)
{
    this.volumeId = volumeId;
    this.status = status;
    this.availabilityZone = availabilityZone;
    this.eventId = eventId;
    this.eventType = eventType;
    this.eventDescr = description;
    this.startTime = startTime;
    this.endTime = endTime;
    this.action = action;
    this.actionDescr = actionDescr;

    this.toString = function() {
        return this.volumeId + fieldSeparator + this.status + fieldSeparator + this.availabilityZone +
               (this.eventType ? fieldSeparator + this.eventType + fieldSeparator + this.eventDescr : "") +
               (this.action ? fieldSeparator + this.action + fieldSeparator + this.actionDescr : "");
    }
}

function BlockDeviceMapping(deviceName, virtualName, snapshotId, volumeSize, deleteOnTermination, noDevice)
{
    this.snapshotId = snapshotId;
    this.deviceName = deviceName;
    this.virtualName = virtualName;
    this.volumeSize = volumeSize
    this.deleteOnTermination = toBool(deleteOnTermination);
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

function InstanceProfile(id, name, arn, path, roles, date)
{
    this.id = id
    this.name = name
    this.arn = arn
    this.path = path
    this.roles = roles || [];
    this.date = date

    this.toString = function() {
        return this.name + (this.roles.length && this.name != this.roles[0].name ? "(" + this.roles[0].name + ")" : "")
    }
}

function InstanceBlockDeviceMapping(deviceName, volumeId, status, attachTime, deleteOnTermination)
{
    this.volumeId = volumeId;
    this.deviceName = deviceName;
    this.status = status;
    this.attachTime = attachTime;
    this.deleteOnTermination = toBool(deleteOnTermination);

    this.toString = function() {
        return this.deviceName + fieldSeparator + this.status + fieldSeparator + this.volumeId + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "");
    }
}

function InstanceNetworkInterface(id, status, descr, subnetId, vpcId, ownerId, privateIp, publicIp, dnsName, srcDstCheck, attachId, attachIndex, attachStatus, attachDelete, privateIps)
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
    this.attachmentId = attachId
    this.deviceIndex = attachIndex
    this.attachmentStatus = attachStatus
    this.deleteOnTermnation = toBool(attachDelete)
    this.privateIpAddresses = privateIps;

    this.toString = function() {
        return (this.descr ? this.descr + fieldSeparator : "") + this.status + fieldSeparator + 'eth' + this.deviceIndex + fieldSeparator +
                (this.privateIpAddresses.length ? this.privateIpAddresses : this.privateIp + (this.publicIp ? "/" + this.publicIp : ""));
    }
}

function Instance(reservationId, ownerId, requesterId, instanceId, imageId, state, productCodes, groups, dnsName, privateDnsName, privateIpAddress, vpcId, subnetId, keyName, reason,
                  amiLaunchIdx, instanceType, launchTime, availabilityZone, tenancy, monitoringEnabled, stateReason, platform, kernelId, ramdiskId, rootDeviceType, rootDeviceName,
                  virtualizationType, hypervisor, ipAddress, sourceDestCheck, architecture, instanceLifecycle, clientToken, spotId, role, ebsOptimized, volumes, enis, tags)
{
    this.id = instanceId;
    this.reservationId = reservationId;
    this.ownerId = ownerId;
    this.requesterId = requesterId;
    this.elasticIp = '';
    this.imageId = imageId;
    this.state = state;
    this.productCodes = productCodes;
    this.securityGroups = uniqueList(groups, 'id');
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
    this.monitoringEnabled = toBool(monitoringEnabled);
    this.stateReason = stateReason;
    this.platform = platform;
    this.kernelId = kernelId;
    this.ramdiskId = ramdiskId;
    this.rootDeviceType = rootDeviceType;
    this.rootDeviceName = rootDeviceName;
    this.virtualizationType = virtualizationType;
    this.hypervisor = hypervisor;
    this.ipAddress = ipAddress;
    this.sourceDestCheck = toBool(sourceDestCheck);
    this.architecture = architecture;
    this.instanceLifecycle = instanceLifecycle;
    this.clientToken = clientToken;
    this.spotInstanceRequestId = spotId;
    this.instanceProfile = role;
    this.ebsOptimized = ebsOptimized;
    this.volumes = volumes;
    this.networkInterfaces = enis;
    this.tags = tags;
    this.name = '';
    ew_core.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state + fieldSeparator + this.instanceType + (this.elasticIp ? fieldSeparator + this.elasticIp : "");
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

function InstanceStatusEvent(instanceId, availabilityZone, status, code, description, startTime, endTime)
{
    this.instanceId = instanceId;
    this.availabilityZone = availabilityZone;
    this.status = status;
    this.code = code;
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;

    this.toString = function() {
        return this.instanceId + (this.status ? fieldSeparator + this.status : "") + fieldSeparator + this.description + fieldSeparator + this.code + (this.startTime ? fieldSeparator + this.startTime : "");
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
    this.vpcId = vpcId || "";
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

function LoadBalancer(name, CreatedTime, DNSName, HostName, ZoneId, Instances, Listeners, HealthCheck, availabilityZones, appPolicies, lbPolicies, oPolicies, vpcId, scheme, subnets, srcGroup, groups)
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
    this.scheme = scheme
    this.SourceSecurityGroup = srcGroup;
    this.subnets = subnets
    this.securityGroups = groups

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

function Metric(name, namespace, dims)
{
    this.name = name
    this.namespace = namespace
    this.dimensions = dims || [];
    this.info = "";

    this.update = function () {
        if (this.dimensions.length == 1 && this.info == "") {
            this.info = ew_core.modelValue(this.dimensions[0].name, this.dimensions[0].value, true);
            if (this.info == this.dimensions) this.info = "";
        }
    }

    this.toString = function() {
        return this.name + fieldSeparator + this.namespace + (this.dimensions.length ? fieldSeparator + ew_core.modelValue(this.dimensions[0].name, this.dimensions[0].value, true) : "");
    }
}

function MetricAlarm(name, arn, descr, stateReason, stateReasonData, stateValue, stateTimestamp, namespace, period, unit, threshold, statistic, oper, metricName, evalPeriods, dimensions, enabled, actions, insufActions, okActions)
{
    this.name = name;
    this.arn = arn;
    this.descr = descr;
    this.stateReason = stateReason
    this.stateReasonData = stateReasonData
    this.stateValue = stateValue
    this.stateTimestamp = stateTimestamp;
    this.namespace = namespace
    this.period = period
    this.unit = unit
    this.threshold = threshold
    this.statistic = statistic
    this.comparisonOperator = oper
    this.metricName = metricName
    this.evaluationPeriods = evalPeriods
    this.dimensions = dimensions
    this.actionsEnabled = toBool(enabled)
    this.actions = actions
    this.insufficientDataActions = insufActions;
    this.okActions = okActions;

    this.toString = function() {
        return this.name + fieldSeparator + this.descr;
    }
}

function Datapoint(tm, unit, ave, sum, sample, max, min)
{
    this.timestamp = tm;
    this.unit = unit;
    this.average = ave;
    this.sum = sum;
    this.sampleCount = sample;
    this.maximum = max;
    this.minimum = min;
    this.value = parseFloat(parseFloat(this.average || this.sum || this.sampleCount || this.maximum || this.minimum || '0').toFixed(2));

    this.toString = function() {
        return this.timestamp + fieldSeparator + this.unit + fieldSeparator + this.value;
    }
}

function AlarmHistory(name, type, data, descr, date)
{
    this.name = name;
    this.type = type;
    this.data = data;
    this.descr = descr;
    this.date = date;

    this.toString = function() {
        return this.name + fieldSeparator + this.type + fieldSeparator + this.date + fieldSeparator + this.descr;
    }
}

function SpotPrice(type, az, date, descr, price)
{
    this.instanceType = type
    this.availabilityZone = az
    this.productDescription = descr
    this.date = date
    this.price = price

    this.toString = function() {
        return this.instanceType + fieldSeparator + this.price;
    }
}

function SpotInstanceRequest(id, type, state, price, product, image, instanceType, instanceId, date, az, msg, tags)
{
    this.id = id
    this.type = type
    this.state = state
    this.price = price
    this.productDescription = product
    this.imageId = image
    this.instanceType = instanceType
    this.instanceId = instanceId
    this.date = date
    this.availabilityZone = az
    this.faultMessage = msg
    this.tags = tags
    ew_core.processTags(this)

    this.toString = function() {
        return this.instanceType + fieldSeparator + this.product + fieldSeparator + this.price + fieldSeparator + this.type;
    }
}

function ExportTask(id, state, statusMsg, descr, instance, env, dfmt, cfmt, bucket, prefix)
{
    this.id = id;
    this.state = state
    this.statusMessage = statusMsg
    this.instanceId = instance
    this.targetEnvironment = env
    this.diskImageFormat = dfmt
    this.containerFormat = cfmt
    this.bucket = bucket
    this.prefix = prefix

    this.toString = function() {
        return this.id + fieldSeparator + this.state + fieldSeparator + this.descr + fieldSeparator + ew_core.modelValue('instanceId',this.instanceId) +
                         fieldSeparator + this.statusMessage + fieldSeparator + this.bucket + this.prefix;
    }
}


function ConversionTaskVolume(id, expire, state, statusMsg, vid, vsize, fmt, isize, url, cksum, desr, azone, bytes)
{
    this.id = id
    this.state = state
    this.statusMessage = statusMsg
    this.expire = expire
    this.volumeId = id
    this.volumeSize = vsize;
    this.imageSize = isize
    this.imageFormat = fmt
    this.imageUrl = url
    this.imageChecksum = cksum
    this.descr = descr
    this.availabilityZone = azone
    this.bytesConverted = bytes;

    this.toString = function() {
        return this.volumeId + fieldSeparator + this.bytesConverted + "/" + this.volumeSize + fieldSeparator + this.imageFormat + fieldSeparator + this.state;
    }
}

function ConversionTaskInstance(id, expire, state, statusMsg, instanceId, platform, descr, volumes)
{
    this.id = id
    this.state = state
    this.statusMessage = statusMsg
    this.expire = expire
    this.instanceId = instanceId
    this.platform = platform
    this.descr = descr
    this.volumes = volumes;
    this.volumeSize = this.volumes.length ? this.volumes[0].volumeSize : 0;
    this.bytesConverted = this.volumes.length ? this.volumes[0].bytesConverted : 0;

    this.toString = function() {
        return this.instanceId + fieldSeparator + this.state + fieldSeparator + this.platform + fieldSeparator + this.volumes;
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
    this.subscriptions = [];

    this.toString = function() {
        return this.name + (this.subscriptions.length ? fieldSeparator + this.subscriptions[0] : "");
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
        return this.Protocol + fieldSeparator + this.Endpoint;
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
    this.charsetName = charset
    this.latestRestorableTime = lrtime
    this.multiAZ = multiAZ
    this.preferredBackupWindow = bkwin
    this.preferredMaintenanceWindow = prefwin
    this.readReplicaDBInstanceIdentifiers = replicas
    this.readReplicaSourceDBInstanceIdentifier = srcreplica
    this.optionGroupName = optname
    this.optionGroupStatus = optstatus
    this.pendingModifiedValues = pendingMods
    this.subnetGroupName = subnetgrp
    this.securityGroups = sgroups
    this.parameterGroups = pgroups

    this.toString = function() {
        return this.name + fieldSeparator + this.id + fieldSeparator + this.engine + "/" + this.version;
    }
}

function DBsnapshot(id, dbid, type, status, username, ver, engine, port, storage, ctime, license, azone, stime)
{
    this.id = id;
    this.dbInstanceId = dbid
    this.type = type;
    this.status = status
    this.userName = username
    this.version = ver
    this.engine = engine
    this.port = port
    this.allocatedStorage = stopage
    this.createTime = ctime
    this.licenseModel = license
    this.availabilityZone = azone
    this.snapshotTime = stime

    this.toString = function() {
        return this.dbInstanceId + fieldSeparator + this.engine + "/" + this.version;
    }
}

function DBEvent(id, type, date, msg)
{
    this.id = id
    this.type = type
    this.date = date
    this.msg = msg

    this.toString = function() {
        return this.id + fieldSeparator + this.type
    }
}

function DBEngine(family, engine, version, descr, vdescr, chars)
{
    this.family = family;
    this.engine = engine;
    this.version = version;
    this.versionDescr = vdescr || "";
    this.descr = descr || "";
    this.charsets = chars || "";

    this.toString = function() {
        return this.engine + "/" + this.version + " " + this.versionDescr + " " + (this.descr ? "/" + this.descr : "");
    }
}

function DBOption(nme, descr, port, groups)
{
    this.name = name;
    this.descr = descr;
    this.port = port;
    this.groups = groups;

    this.toString = function() {
        return this.name + ", " + this.descr + ", " + this.groups;
    }
}

function DBSecurityGroup(name, descr, vpcId, groups, ranges)
{
    this.name = name;
    this.descr = descr;
    this.vpcId = vpcId;
    this.groups = groups;
    this.ipRanges = ranges;

    this.toString = function() {
        return this.name;
    }
}

function DBOptionGroup(name, engine, version, descr, opts)
{
    this.name = name
    this.engine = engine
    this.version = version
    this.descr = descr
    this.options = opts;

    this.toString = function() {
        return this.name + fieldSeparator + this.engine + "/" + this.version + " (" + this.options + ")";
    }
}

function DBParameterGroup(name, descr, family)
{
    this.name = name
    this.descr = descr
    this.family = family

    this.toString = function() {
        return this.name
    }
}

function DBParameter(name, value, type, descr, mver, mod, atype, amethod, values, src)
{
    this.name = name
    this.value = value
    this.descr = descr
    this.type = type
    this.minVersion = mver
    this.isModifiable = mod
    this.applyType = atype
    this.applyMethod = amethod
    this.allowedValues = values
    this.source = src

    this.toString = function() {
        return this.name + fieldSeparator + this.value + fieldSeparator + this.type
    }
}

function DBOrderableOption(dbclass, engine, ver, license, maz, replica, vpc, vpcmaz, vpcreplica, azones)
{
    this.instanceClass = dbclass
    this.engine = engine
    this.version = ver
    this.licenseModel = license
    this.multiAZCapable = maz
    this.readReplicaCapable = replica
    this.vpcCapable = vpc
    this.vpcMultiAZCapable = vpcmaz
    this.vpcReadReplicaCapable = vpcreplica
    this.availabilityZones = azones
    this.toString = function() {
        return this.instanceClass + fieldSeparator + this.engine + "/" + this.version + fieldSeparator +
                          (this.vpcCapable ? "VPC" : "") + " " +
                          (this.multiAZCapable ? "MultiAZ" : "") + " " +
                          (this.vpcMultiAZCapable ? "VPCMultiAZ" : "" ) + " " +
                          (this.readReplicaCapable ? " Replica" : "") + " " +
                          (this.vpcReadReplicaCapable ? " VPCReplica" : "") + fieldSeparator +
                          this.availabilityZones;
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

function AutoScalingInstance(group, healthStatus, availabilityZone, instanceId, launchConfigurationName, lifecycleState)
{
    this.group = group
    this.healthStatus = healthStatus
    this.availabilityZone = availabilityZone
    this.instanceId = instanceId
    this.launchConfigurationName = launchConfigurationName
    this.state = lifecycleState

    this.toString = function() {
        return ew_core.modelValue('instanceId', this.instanceId) + fieldSeparator + this.healthStatus + fieldSeparator + this.state;
    }
}

function AutoScalingGroup(name, arn, date, config, capacity, min, max, cooldown, status, healthType, healthGrace, vpczone, placement, elbs, azones, metrics, instances, suspended, tags)
{
    this.id = arn;
    this.name = name;
    this.date = date;
    this.launchConfiguration = config;
    this.capacity = capacity;
    this.minSize = min;
    this.maxSize = max;
    this.defaultCooldown = cooldown;
    this.status = status;
    this.healthCheckType = healthType;
    this.healthCheckGracePeriod = healthGrace;
    this.vpcZone = vpczone;
    this.placementGroup = placement;
    this.loadBalancers = elbs;
    this.availabilityZones = azones;
    this.metrics = metrics;
    this.instances = instances;
    this.suspendedProcesses = suspended;
    this.tags = tags;

    this.toString = function() {
        return this.name + fieldSeparator + this.capacity + fieldSeparator + this.healthCheckType;
    }
}

function LaunchConfiguration(name, arn, date, type, key, profile, image, kernel, ramdisk, userdata, spotprice, monitoring, groups, devices)
{
    this.id = arn;
    this.name = name;
    this.date = date;
    this.instanceType = type;
    this.keyName = key;
    this.profile = profile;
    this.imageId = image;
    this.kernelId = kernel;
    this.ramdiskId = ramdisk;
    this.userData = userdata;
    this.spotPrice = spotprice;
    this.monitoring = monitoring;
    this.groups = groups;
    this.devices = devices;

    this.toString = function() {
        return this.name + fieldSeparator + this.instanceType + fieldSeparator + ew_core.modelValue('imageId', this.imageId);
    }
}

function ScalingNotification(group, type, topic)
{
    this.group = group
    this.type = type
    this.topic = topic

    this.toString = function() {
        return this.type + fieldSeparator + this.group + fieldSeparator + this.topic;
    }
}


function ScalingPolicy(name, arn, group, atype, adjust, minadjust, cooldown, alarms)
{
    this.id = arn
    this.name = name
    this.group = group
    this.adjustmentType = atype
    this.scalingAdjustment = adjust
    this.minAdjustmentStep = minadjust
    this.cooldown = cooldown
    this.alarms = alarms

    this.toString = function () {
        return this.name + fieldSeparator + this.group + fieldSeparator + this.adjustmentType;
    }
}

function ScalingAction(name, arn, group, capacity, recurrence, start, end, min, max)
{
    this.id = arn
    this.name = name
    this.group = group
    this.capacity  = capacity
    this.recurrence = recurrence
    this.start = start
    this.end = end
    this.minSize = min
    this.maxSize = max

    this.toString = function() {
        return this.name + fieldSeparator + this.group + fieldSeparator + this.recurrence
    }
}

function AutoScalingActivity(id, group, descr, cause, details, status, statusMsg, progress, start, end)
{
    this.id = id
    this.group = group
    this.descr = descr
    this.cause = cause
    this.details = details
    this.status = status
    this.statusMsg = statusMsg
    this.progress = progress
    this.start = start
    this.end = end

    this.toString = function() {
        return this.group + fieldSeparator + this.status
    }
}

function PlacementGroup(name, strategy, state)
{
    this.name = name
    this.strategy = strategy
    this.state = state

    this.toString = function() {
        return this.name + fieldSeparator + this.strategy + fieldSeparator + this.state;
    }
}

