var ew_NetworkInterfacesTreeView = {
    model : [ "networkInterfaces", "vpcs", "subnets", "securityGroups", "instances" ],

    selectionChanged: function(event)
    {
        var eni = this.getSelected()
        if (eni == null) return
    },

    edit : function(event)
    {
        var eni = this.getSelected();
        if (eni == null) return;
        var rc = { ok: false, title: "Update ENI, press OK to update ENI attributes" };
        for (var p in eni) {
            rc[p] = eni[p];
        }
        window.openDialog("chrome://ew/content/dialogs/edit_eni.xul", null, "chrome,centerscreen,modal,resizable", ew_session, rc);
        if (rc.ok) {
            var me = this;
            if (eni.sourceDestCheck != rc.sourceDestCheck) {
                this.session.api.modifyNetworkInterfaceAttribute(eni.id, "SourceDestCheck", rc.SourceDestCheck, function() { me.refresh(); });
            }
            if (eni.descr != rc.descr) {
                this.session.api.modifyNetworkInterfaceAttribute(eni.id, "Description", rc.descr, function() { me.refresh(); });
            }
            if (eni.groups.toString() != rc.groups.toString()) {
                var attrs = [];
                for (var i in rc.groups) {
                    attrs.push(['SecurityGroupId.' + (i + 1), rc.groups[i]]);
                }
                this.session.api.modifyNetworkInterfaceAttributes(eni.id, attrs, function() { me.refresh(); });
            }
        }
    },

    createInterface : function()
    {
        var rc = { ok: false, title: "Create ENI" };
        openDialog('chrome://ew/content/dialogs/details_eni.xul',null,'chrome,centerscreen,modal,resizable', ew_session, rc);
        if (rc.ok) {
            var me = this;
            this.session.api.createNetworkInterface(rc.subnetId, rc.privateIpAddress, rc.descr, rc.groups, function() { me.refresh(); });
        }
    },

    deleteInterface : function()
    {
        var eni = this.getSelected();
        if (!eni || !confirm("Delete Network Interface " + eni.id + "?")) return;
        var me = this;
        this.session.api.deleteNetworkInterface(eni.id, function() { me.refresh(); });
    },

    attachInterface : function()
    {
        var eni = this.getSelected();
        if (!eni) {
            alert("Please, select ENI");
            return;
        }
        var rc = {ok:false};
        openDialog('chrome://ew/content/dialogs/attach_eni.xul',null,'chrome,centerscreen,modal,resizable', ew_session, eni, rc);
        if (rc.ok) {
            var me = this;
            this.session.api.attachNetworkInterface(eni.id, rc.instanceId, rc.deviceIndex, function() { me.refresh();});
        }
    },

    detachInterface : function(force) {
        var eni = this.getSelected();
        if (!eni) return;

        if (!eni.attachment) {
            alert("Interface is not attached");
            return;
        }

        var instance = ew_model.find('instances', eni.attachment.instanceId);
        if (!instance) {
            alert('Could not find attached instance');
            return;
        }
        if (force) {
            if (!confirm("Force detach interface " + eni.id + " (" + eni.descr + ") from " + instance.toString() +  "?")) return;
        } else {
            if (!confirm("Detach interface " + eni.id + " (" + eni.descr + ") from " + instance.toString() +  "?")) return;
        }
        var me = this;
        this.session.api.detachNetworkInterface(eni.attachment.id, force, function() { me.refresh(); });
    },

};
ew_NetworkInterfacesTreeView.__proto__ = TreeView;

