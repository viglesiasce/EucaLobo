
// Base class for tree container
var TreeView = {
    name: '',
    model: '',
    tree: null,
    treeBox : null,
    treeList : new Array(),
    selection : null,
    registered : false,
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
        return ew_model.getModel(this.getModelName(this.model));
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
        return this.model ? this.getModel() : this.getData();
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
        return idx >= this.rowCount ? "" : ew_model.modelValue(name, this.treeList[idx][name]);
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
    notifyModelChanged : function(interest) {
        log('notify model changed ' + this.model)
        this.invalidate();
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
        if (!this.atomService) {
            this.atomService = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
        }
        // Use CSS entry if exists:  treechildren::-moz-tree-cell(name_value) {}
        prop.AppendElement(this.atomService.getAtom(this.getName() + "_" + value));
    },
    getColumnProperties : function(column, element, prop)
    {
    },
    getLevel : function(idx)
    {
        return 0;
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

        var sortFunc = function(a, b) {
            var aVal = a[sortField] || "";
            var bVal = b[sortField] || "";
            var aF = parseFloat(aVal);
            if (!isNaN(aF) && aF.toString() == aVal) {
                aVal = aF;
                bVal = parseFloat(bVal);
            } else {
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
            }
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        };
        this.treeList.sort(sortFunc);
        if (item) this.select(item);
    },
    register : function()
    {
        if (!this.registered) {
            this.registered = true;
            ew_model.registerInterest(this, this.model);
        }
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
            ew_model.refresh(name);
            this.refreshAll(force);
        } else {
            this.invalidate();
        }
    },
    refreshAll: function(force)
    {
        log('refreshAll ' + (force ? "force" : "") + ' ' + this.model)
        if (this.model instanceof Array) {
            for (var i = 1; i < this.model.length; i++) {
                if (force || ew_model.getModel(this.model[i]) == null) {
                    ew_model.refresh(this.model[i]);
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
        log('start timer ' + this.model)
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
                        if (list[i][this.filterList[j].name] == this.filterList[j].value) {
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
        ew_session.setStrPrefs(this.searchElement, $(this.searchElement).value);

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
        var tag = ew_session.promptForTag(item.tags);
        if (tag == null) return;
        // Replace tas in the object without reloading the whole list
        ew_model.setTags(item, tag);
        ew_session.setTags(item[this.tagId || "id"], item.tags, callback);
    },
    copyToClipboard : function(name)
    {
        var item = this.getSelected();
        if (item) {
            ew_session.copyToClipboard(item[name]);
        }
    },
    clicked: function(event)
    {
        // Delay refresh if we are working with the list
        if (this.refreshTimer) {
            this.startRefreshTimer();
        }
        if (ew_session.winDetails && event) {
            this.displayDetails();
        }
    },
    displayDetails : function(event)
    {
        var item = this.getSelected();
        if (item == null) return;
        var me = this;
        var rc = { session: ew_session, item: item, title: className(item), }
        if (!ew_session.winDetails) {
            ew_session.winDetails = window.openDialog("chrome://ew/content/dialogs/details.xul", null, "chrome,centerscreen,modeless,resizable", rc);
        } else
        if (ew_session.winDetails.setup) {
            ew_session.winDetails.setup.call(ew_session.winDetails, rc);
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
                $(items[i].id).checked = ew_session.getBoolPrefs(items[i].id, false);
                break;

            default:
                $(items[i].id).value = ew_session.getStrPrefs(items[i].id);
            }
        }
    },
    savePreferences: function()
    {
        var items = this.getInputItems();
        for (var i in items) {
            switch (items[i].type) {
            case "checkbox":
                ew_session.setBoolPrefs(items[i].id, items[i].checked);
                break;

            default:
                ew_session.setStrPrefs(items[i].id, items[i].value);
            }
        }
    },
    init: function(tree, tab)
    {
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
    session: null,

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
            if (this.multiple) {
                var row = document.createElement('listitem');
                var cell = document.createElement('listcell');
                cell.setAttribute('type', 'checkbox');
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
                cell.setAttribute('label', this.toItem(this.listItems[i]));
                row.appendChild(cell);
                list.appendChild(row);
            } else {
                list.appendItem(this.toItem(this.listItems[i]), i);
                for (var j in this.checkedItems) {
                    if (this.listItems[i] == this.checkedItems[j]) {
                        list.selectedIndex = i;
                    }
                }
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
        return this.session.model.toString(obj, this.columns);
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
            debug(e)
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
        var data = "";
        try {
            data = this.read(this.open(path))
        }
        catch (e) {
            debug("toString:" + path + ": " + e)
        }
        return data
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
            debug(e)
            return false;
        }
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
            debug(e)
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
            if (recursive == null) {
                recursive = false;
            }
            dir.remove(recursive);
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
