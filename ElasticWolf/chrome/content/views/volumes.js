var ew_VolumeTreeView = {
    model: ['volumes','availabilityZones','instances','snapshots'],
    properties: ['status'],

    filter : function(list) {
        if (!list) return list;
        if ($("ew.volumes.norootdev").checked) {
          var newList = [];
          for (var i = 0; i < list.length; i++) {
              var volume = list[i];
              if (volume.device != '/dev/sda1') {
                  newList.push(volume);
              }
          }
          list = newList;
        }
        return TreeView.filter.call(this, list);
    },

    menuChanged : function() {
        var image = this.getSelected();
        document.getElementById("ew.volumes.contextmenu").disabled = (image == null);
        if (image == null) return;

        var fAssociated = image.status == "available" ? false : true;

        // If this is not a Windows Instance, Disable the following context menu items.
        document.getElementById("volumes.context.attach").disabled = fAssociated;
        document.getElementById("volumes.context.detach").disabled = !fAssociated;
        document.getElementById("volumes.context.forcedetach").disabled = !fAssociated;
    },

    createSnapshot : function () {
        var image = this.getSelected();
        if (image == null) return;
        var me = this;
        this.session.api.createSnapshot(image.id, function(snapId) { ew_SnapshotTreeView.refresh(); });
    },

    createVolume : function (snap) {
        var retVal = { ok: false, tag: '' };
        if (!snap) snap = null;
        window.openDialog("chrome://ew/content/dialogs/create_volume.xul",null,"chrome,centerscreen,modal,resizable",snap,ew_session,retVal);
        if (retVal.ok) {
            var me = this;
            this.session.api.createVolume(retVal.size,retVal.snapshotId,retVal.zone,function(id) {
                if (retVal.tag != '') {
                    ew_session.setTags(id, retVal.tag, function() { me.refresh() });
                } else {
                    me.refresh();
                }
            });
        }
        return retVal.ok;
    },

    deleteVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        var label = image.name ? (image.name + '@' + image.id) : image.id;
        if (!confirm("Delete volume " + label + "?")) return;
        var me = this;
        this.session.api.deleteVolume(image.id, function() {me.refresh()});
    },

    attachEBSVolume : function (volumeId, instId, device) {
        if (device == "windows_device") {
            device = this.determineWindowsDevice(instId);
        }
        var me = this;
        this.session.api.attachVolume(volumeId, instId, device, function() {me.refresh();});
    },

    attachVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        var retVal = {ok:null};
        while (true) {
            window.openDialog("chrome://ew/content/dialogs/create_attachment.xul",null,"chrome,centerscreen,modal,resizable",image,ew_session,retVal);
            if (retVal.ok) {
                // If this is a Windows instance, the device should be windows_device and the instance should be ready to use
                var instance = ew_session.model.find('instances', retVal.instanceId);
                if (instance) {
                    if (!ew_InstancesTreeView.isInstanceReadyToUse(instance)) {
                        continue;
                    }
                    if (isWindows(instance.platform)) {
                        retVal.device = "windows_device";
                    }
                    this.attachEBSVolume(retVal.volumeId, retVal.instanceId, retVal.device);
                }
            }
            break;
        }
    },

    determineWindowsDevice : function (instId) {
        // Need to walk through the list of Volumes If any volume is attached to this instance, that device id is removed from the list of possible device ids for this instance.
        var devList = this.getWindowsDeviceList();

        // Enumerate the volumes associated with the instId
        var volumes = ew_session.model.volumes;

        // If a volume is associated with this instance, mark the associated device as taken
        for (var i in volumes) {
            if (volumes[i].instanceId == instId) {
                devList[volumes[i].device] = 1;
            }
        }

        for (var device in devList) {
            if (devList[device] != 1) {
                return devList[device];
            }
        }
        return "";
    },

    detachVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        if (!confirm("Detach volume " + image.id + "?")) return;
        this.session.api.detachVolume(image.id, function() { me.refresh() });
    },

    forceDetachVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        if (!confirm("Force detach volume " + image.id + "?")) return;
        var me = this;
        this.session.api.forceDetachVolume(image.id, function() { me.refresh() });
    },

    isRefreshable: function() {
        // Walk the list of volumes to see whether there is a volume whose state needs to be refreshed
        for (var i in this.treeList) {
            var volume = this.treeList[i];
            if (volume.status == "creating" || volume.status == 'deleting' || volume.attachStatus == "attaching" || volume.attachStStatus == "detaching") {
                return true;
            }
        }
        return false;
    },

    getWindowsDeviceList: function()
    {
        var devlist = new Array();
        devlist["xvdg"] = "xvdg";
        devlist["xvdh"] = "xvdh";
        devlist["xvdi"] = "xvdi";
        devlist["xvdj"] = "xvdj";
        devlist["xvdk"] = "xvdk";
        devlist["xvdl"] = "xvdl";
        devlist["xvdm"] = "xvdm";
        devlist["xvdn"] = "xvdn";
        devlist["xvdo"] = "xvdo";
        devlist["xvdp"] = "xvdp";
        devlist["xvdf"] = "xvdf";
        devlist["xvde"] = "xvde";
        devlist["xvdd"] = "xvdd";
        devlist["xvdc"] = "xvdc";
        return devlist;
    },
};

ew_VolumeTreeView.__proto__ = TreeView;
