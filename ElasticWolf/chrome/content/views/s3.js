var ew_S3BucketsTreeView = {
    model : "s3Buckets",
    path: [],
    folder: '',

    keyName: function(name)
    {
        return name.replace(/[ \/\\'":]+/g, '');
    },

    display : function(list)
    {
        var idx = -1;
        var path = this.path.join("/");
        var nlist = [];
        for (var i in list) {
            var n = (this.path[0] + "/" + list[i].name).replace(/[ \/]+$/, '');
            var p = n.split("/");
            // Next level only
            if (!this.path.length || n.indexOf(path) == 0 && p.length == this.path.length + 1) {
                list[i].label = p[p.length - 1] + (list[i].name[list[i].name.length - 1] == "/" ? "/" : "")
                nlist.push(list[i])
                // Select given item
                if (list[i].name == this.folder) {
                    idx = nlist.length - 1;
                }
            }
        }
        TreeView.display.call(this, nlist);
        if (idx >= 0) this.setSelected(idx);
        $("ew.s3.path").value = path;

        this.folder = '';
    },

    show: function()
    {
        if (!this.path.length) {
            ew_S3BucketsTreeView.display(ew_model.get('s3Buckets'));
        } else {
            var item = ew_model.getS3Bucket(this.path[0])
            if (item.keys.length) {
                ew_S3BucketsTreeView.display(item.keys);
            } else {
                ew_session.controller.listS3BucketKeys(item.name, null, function(obj) {
                    if (item.name == obj.name) {
                        ew_S3BucketsTreeView.display(obj.keys);
                    }
                })
            }
        }
    },

    displayDetails: function(event)
    {
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        // Folder or bucket
        if (!this.path.length || item.label[item.label.length - 1] == "/") {
            this.path.push(item.name);
            this.show();
        }
    },

    refresh: function()
    {
        this.path = [];
        TreeView.refresh.call(this);
    },

    back: function(event)
    {
        this.folder = this.path.pop();
        this.show();
    },

    setStatus: function(file, p)
    {
        file = DirIO.fileName(file);
        document.getElementById("ew.s3.status").value = file + ": " + (p >= 0 && p <= 100 ? Math.round(p) : 100) + "%";
    },

    create: function() {
        var me = this;
        var retVal = { ok : null, name: null, region : null, params: {}, type: this.path.length ? "Folder" : "Bucket" }
        window.openDialog("chrome://ew/content/dialogs/create_s3bucket.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {

            if (!this.path.length) {
                ew_session.controller.createS3Bucket(retVal.name, retVal.region, retVal.params, function() { me.refresh(true); });
            } else {
                ew_model.getS3Bucket(this.path[0]).keys = []
                ew_session.controller.createS3BucketKey(this.path[0], this.path.slice(1).join('/') + retVal.name, retVal.params, null, function() { me.show(); });
            }
        }
    },

    remove: function() {
        var me = this;
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete " + item.name + "?")) return;

        if (!item.bucket) {
            ew_session.controller.deleteS3Bucket(item.name, {}, function() { me.refresh(true); });
        } else {
            ew_model.getS3Bucket(item.bucket).keys = [];
            ew_session.controller.deleteS3BucketKey(item.bucket, item.name, {}, function() { me.show(); });
        }
    },

    download: function() {
        var me = this;
        var item = this.getSelected()
        if (item == null) return

        var file = ew_session.promptForFile("Save to file", true, DirIO.fileName(item.name))
        if (file) {
            ew_session.controller.getS3BucketKey(item.bucket, item.name, "", {}, file,
                    function(f) { meSetStatus(f, 100); },
                    function(f, p) { me.setStatus(f, p); } )
        }
    },

    upload: function() {
        var me = this;
        if (!this.path.length) return;
        var item = ew_model.getS3Bucket(this.path[0])
        item.keys = []
        var file = ew_session.promptForFile("Upload file")
        if (file) {
            var f = FileIO.open(file)
            var name = this.keyName(f.leafName)
            ew_session.controller.uploadS3BucketFile(item.name, this.path.slice(1).join('/') + name, "", {}, file,
                    function(fn) { me.show(); },
                    function(fn, p) { me.setStatus(fn, p); });
        }
    },

    edit: function() {
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        if (item.size > 1024*1024) {
            alert(item.name + " is too big");
            return;
        }

        ew_session.controller.readS3BucketKey(item.bucket, item.name, "", {}, function(t) {
            var rc = { file: item.name, text: t, save: false };
            window.openDialog("chrome://ew/content/dialogs/edit_s3.xul", null, "chrome,centerscreen,modal,resizable", rc);
            if (rc.save) {
                ew_session.controller.putS3BucketKey(item.bucket, me.path.slice(1).join('/') + item.name, "", {}, rc.text, function() {
                    me.show();
                });
            }
        });
    },

    create: function() {
        var me = this;
        if (!this.path.length) return;
        var item = ew_model.getS3Bucket(this.path[0])
        var file = prompt("File name:")
        if (file) {
            var name = this.path.slice(1).join('/') + this.keyName(file)
            var rc = { file: name, text: "", save: false };
            window.openDialog("chrome://ew/content/dialogs/edit_s3.xul", null, "chrome,centerscreen,modal,resizable", rc);
            if (rc.save) {
                ew_session.controller.putS3BucketKey(item.name, name, "", {}, rc.text, function() {
                    me.show();
                });
            }
        }
    },

    manageAcls: function() {
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        var retVal = { ok : null, content: null };

        function wrap() {
            window.openDialog("chrome://ew/content/dialogs/manage_s3acl.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal, item);
            if (retVal.ok) {
                if (item.bucket) {
                    ew_session.controller.setS3BucketKeyAcl(item.bucket, item.name, retVal.content, function() { me.selectionChanged(); })
                } else {
                    ew_session.controller.setS3BucketAcl(item.name, retVal.content, function() { me.selectionChanged(); })
                }
            }
        }

        if (!item.acls) {
            if (!this.path.length) {
                ew_session.controller.getS3BucketAcl(item.name, wrap)
            } else {
                ew_session.controller.getS3BucketKeyAcl(item.bucket, item.name, wrap)
            }
        }
    },

    manageWebsite: function() {
        var me = this;
        var item = this.getSelected()
        if (this.path.length) return;
        if (item == null) return
        var retVal = { bucket: item.name, ok: 0, enable: 0 };

        ew_session.controller.getS3BucketWebsite(item.name, function(obj) {
            window.openDialog("chrome://ew/content/dialogs/manage_s3website.xul", null, "chrome,centerscreen,modal,resizable", retVal, obj);
            if (retVal.ok) {
                if (retVal.enable) {
                    ew_session.controller.setS3BucketWebsite(item.name, obj.indexSuffix, obj.errorKey, function() { me.selectionChanged(); })
                } else {
                    ew_session.controller.deleteS3BucketWebsite(item.name, function() { me.selectionChanged(); })
                }
            }
        });
    },

};
ew_S3BucketsTreeView.__proto__ = TreeView;
ew_S3BucketsTreeView.register();

