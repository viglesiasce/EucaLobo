var ew_SnapshotTreeView = {
    model: ['snapshots', 'securityGroups', 'availabilityZones', 'volumes'],

    filter: function(list) {
        if (!list) return list;
        var type = $("ew.snapshots.type").value;
        if (type == "my_snapshots") {
            var groups = ew_model.get('securityGroups');
            if (groups) {
                owner = groups[0].ownerId;
                var nlist = [];
                for (var i = 0; i < list.length; i++) {
                    if (list[i].owner == owner) {
                        nlist.push(list[i]);
                    }
                }
                list = nlist;
            }
        }

        if ($("ew.snapshots.noami").checked) {
            var nlist = [];
            for (var i = 0; i < list.length; i++) {
                if (!(list[i].amiId || '').trim()) {
                    nlist.push(list[i]);
                }
            }
            list = nlist;
        }
        return TreeView.filter.call(this, list);
    },

    snapshotTypeChanged : function() {
        $(this.searchElement).value = "";
        this.invalidate();
    },

    deleteSnapshot : function () {
        var image = this.getSelected();
        if (image == null) return;
        var label = image.name ? (image.name + '@' + image.id) : image.id;
        if (!confirm("Delete snapshot " + label + "?"))  return;
        this.session.api.deleteSnapshot(image.id);
    },

    createVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        ew_VolumeTreeView.createVolume(image);
    },

    isRefreshable: function() {
        for (var i in this.treeList) {
            if (this.treeList[i].status != "completed") return true;
        }
        return false;
    },

    showRegisterImageFromSnapshotDialog : function() {
        var image = this.getSelected();
        if (image == null) return;
        var retVal = {ok:null,amiName:null,amiDescription:null};
        window.openDialog("chrome://ew/content/dialogs/create_snapshot_ami.xul", null, "chrome,centerscreen,modal,resizable", image.id, ew_session, retVal);
        if (retVal.ok) {
            var wrap = function(id) {
                alert("A new AMI is registered.\n\nThe AMI ID is: "+id);
            }
            this.session.api.registerImageFromSnapshot(image.id, retVal.amiName, retVal.amiDescription, retVal.architecture, retVal.kernelId, retVal.ramdiskId, retVal.deviceName, retVal.deleteOnTermination, wrap);
        }
    },

    viewPermissions: function()
    {
        var image = this.getSelected();
        if (image == null) return;
        this.session.api.describeSnapshotAttribute(this.image.id, function(list) {
           window.openDialog("chrome://ew/content/dialogs/manage_snapshot_permissions.xul", null, "chrome,centerscreen,modal,resizable", ew_session, image, list);
        });
    },

};

ew_SnapshotTreeView.__proto__ = TreeView;
