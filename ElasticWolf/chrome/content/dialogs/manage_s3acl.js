var ew_S3Acl = {
    list: [],
    treeBox : null,
    selection : null,
    setTree : function(treeBox) { this.treeBox = treeBox; },
    isEditable : function(idx, column) { return true; },
    isContainer : function(idx) { return false; },
    isSeparator : function(idx) { return false; },
    isSorted : function() { return false; },
    getImageSrc : function(idx, column) { return "" },
    getProgressMode : function(idx, column) {},
    selectionChanged : function() {},
    cycleCell : function(idx, column) {},
    performAction : function(action) {},
    performActionOnCell : function(action, index, column) {},
    getRowProperties : function(idx, column, prop) {},
    getCellProperties : function(idx, column, prop) {},
    getColumnProperties : function(column, element, prop) {},
    cycleHeader : function(col) {},
    getLevel : function(idx) { return 0; },
    rowCount : function() { return this.list.length; },
    getSelected : function() { return this.selection.currentIndex == -1 ? null : this.list[this.selection.currentIndex]; },
    getCellText : function(idx, column) { return idx >= this.rowCount() ? "" : this.list[idx][column.id]; },
    getCellValue : function(idx, column) { return idx >= this.rowCount() ? "" : this.list[idx][column.id]; },
    setCellValue: function (idx, column, val) { if (idx >= 0 && idx < this.rowCount()) this.list[idx][column.id] = val; },

    grant: function(obj, perm) {
        var content = '<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="' + obj.type + '">';
        switch (obj.type) {
        case 'CanonicalUser':
            content += '<ID>' + obj.id + '</ID>';
            break;

        case 'AmazonCustomerByEmail':
            content += '<EmailAddress>' + obj.id + '</EmailAddress>';
            break;

        case 'Group':
            content += '<URI>' + obj.id + '<URI>';
            break;
        }
        return content + '</Grantee><Permission>' + perm + '</Permission></Grant>';
    },

    apply: function() {
        var content = '<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>' +  this.item.owner  + '</ID></Owner><AccessControlList>';
        for (var i in this.list) {
            if (this.list[i].read) content += this.grant(this.list[i], "READ");
            if (this.list[i].write) content += this.grant(this.list[i], "WRITE");
            if (this.list[i].read_acp) content += this.grant(this.list[i], "READ_ACP");
            if (this.list[i].write_acp) content += this.grant(this.list[i], "WRITE_ACP");
            if (this.list[i].full_control) content += this.grant(this.list[i], "FULL_CONTROL");
        }
        content += '</AccessControlList></AccessControlPolicy>';
        debug(content)
        this.retVal.content = content;
        this.retVal.ok = true;
        return true;
    },

    find: function(id) {
        for (var i in this.list) {
            if (this.list[i].id == id) return this.list[i];
        }
        return null;
    },

    init: function() {
        this.core = window.arguments[0];
        this.retVal = window.arguments[1];
        this.item = window.arguments[2];

        document.getElementById("ew.path").value = (this.item.bucket || "") + "/" + this.item.name;
        document.getElementById("ew.tree").view = this

        this.list.push({ id: "http://acs.amazonaws.com/groups/global/AllUsers", name: "Everyone", type: "Group", read: false, write: false, read_acp: false, write_acp: false, full_control: false } );
        this.list.push({ id: "http://acs.amazonaws.com/groups/global/AuthenticatedUsers", name: "Authenticated", type: "Group",  read: false, write: false, read_acp: false, write_acp: false, full_control: false } );
        this.list.push({ id: "http://acs.amazonaws.com/groups/s3/LogDelivery", name: "LogDelivery", type: "Group",  read: false, write: false, read_acp: false, write_acp: false, full_control: false } );

        for (var i in this.item.acls) {
            var a = this.item.acls[i]
            var u = this.find(a.id)
            if (!u) {
                u = { id: a.id, name: a.name, type: "CanonicalUser", read: false, write: false, read_acp: false, write_acp: false, full_control: false };
                this.list.push(u)
            }
            u[a.permission.toLowerCase()] = true;
        }
        this.treeBox.rowCountChanged(0, this.list.length);
    },

    addUser: function(type) {
        var user = prompt("Please specify user " + type + ":");
        if (!user) return;
        switch (type) {
        case "email":
            this.list.push({ id: user, name: user, type: "AmazonCustomerByEmail", read: false, write: false, read_acp: false, write_acp: false, full_control: false });
            break;

        default:
            this.list.push({ id: user, name: user, type: "CanonicalUser", read: false, write: false, read_acp: false, write_acp: false, full_control: false });
        }
        this.treeBox.rowCountChanged(this.list.length - 1, 1);
    },

    removeUser: function() {
        var idx = this.selection.currentIndex;
        if (idx < 0) return;
        this.list.splice(idx, 1);
        this.treeBox.rowCountChanged(idx, -1);
    },
};

