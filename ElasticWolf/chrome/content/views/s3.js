//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_S3BucketsTreeView = {
    model : "s3Buckets",
    path: [],
    folder: '',

    keyName: function(name)
    {
        return name.replace(/[ \/\\'":]+/g, '');
    },

    isFolder: function(item)
    {
        return !this.path.length || item.label[item.label.length - 1] == "/";
    },

    toParams: function(val)
    {
        var params = {}
        switch (val) {
        case "Private":
            params["x-amz-acl"] = "private";
            break;
        case "Public Read":
            params["x-amz-acl"] = "public-read";
            break;
        case "Public Read-Write":
            params["x-amz-acl"] = "public-read-write";
            break;
        case "Authenticated Read":
            params["x-amz-acl"] = "authenticated-read";
            break;
        case "Owner Read":
            params["x-amz-acl"] = "bucket-owner-read";
            break;
        case "Owner Full Control":
            params["x-amz-acl"] = "bucket-owner-full-control";
            break;
        }
        return params;
    },

    displayDetails: function(event)
    {
        var item = this.getSelected()
        if (!item) return
        // Folder or bucket
        if (this.isFolder(item)) {
            this.path.push(item.folder);
            this.show();
            return;
        }
        // Try to show this file in popup
        this.showFile();
    },


    displayInfo : function()
    {
        var item = this.getSelected()
        if (!item) return
        if (!this.path.length) {
            this.core.api.getS3BucketLocation(item.name);
        }
        if (!this.isFolder(item)) {
            item.url = 'http://' + item.bucket + '.s3-website-' + this.core.api.region + '.amazonaws.com/' + item.name;
        }
        TreeView.displayDetails.call(this);
    },

    display : function(list)
    {
        var idx = -1;
        var path = this.path.join("/") + "/";
        var nlist = [];
        var labels = {};
        for (var i in list) {
            if (!this.path.length) {
                list[i].folder = list[i].label = list[i].name;
                nlist.push(list[i]);
            } else {
                var n = this.path[0] + "/" + list[i].name;
                var p = n.split("/");
                if (n <= path || n.indexOf(path) != 0) continue;
                list[i].folder = list[i].label = p.slice(this.path.length, this.path.length + 1).join("/");
                if (p.length > this.path.length + 1) list[i].label += "/";
                // Skip subfolders
                if (labels[list[i].label]) continue;
                labels[list[i].label] = 1;
                nlist.push(list[i]);
            }
            // Select given item
            if (list[i].label == this.folder) {
                idx = nlist.length - 1;
            }
        }
        TreeView.display.call(this, nlist);
        if (idx >= 0) this.setSelected(idx);
        $("ew.s3Buckets.path").value = path;
        this.folder = '';
    },

    show: function()
    {
        var me = this;
        if (!this.path.length) {
            this.display(this.core.queryModel('s3Buckets'));
        } else {
            var item = this.core.getS3Bucket(this.path[0])
            if (!item) return;
            if (item.keys && item.keys.length) {
                this.display(item.keys);
            } else {
                this.core.api.listS3BucketKeys(item.name, null, {
                    success: function(obj) {
                        // By the time we got the whole list a user may click on back or another sub folder so we have to be sure we still want on this level
                        if (item.name != obj.name) return;
                        me.display(obj.keys);
                    },
                    error: function() {
                        // error, access denied or something else but we have to roll back
                        me.back();
                    }
                });
            }
        }
    },

    refresh: function()
    {
        if (!this.path.length) {
            TreeView.refresh.call(this);
        } else {
            var item = this.core.getS3Bucket(this.path[0]);
            if (!item) return;
            item.keys = null;
            this.show();
        }
    },

    selectionChanged: function()
    {
    },

    menuChanged: function()
    {
        var item = this.getSelected()
        $("ew.s3Buckets.back").disabled = !this.path.length;
        $("ew.s3Buckets.edit").disabled = !this.path.length || !item || !item.bucket || item.size > 1024*1024;
        $("ew.s3Buckets.createFile").disabled = !this.path.length;
        $("ew.s3Buckets.upload").disabled = !this.path.length;
        $("ew.s3Buckets.download").disabled = !item || this.isFolder(item);
        $("ew.s3Buckets.proto").disabled = !item || !this.isFolder(item);
        $("ew.s3Buckets.browser").disabled = !item || this.isFolder(item);
    },

    back: function(event)
    {
        this.folder = this.path.pop();
        this.show();
    },

    setStatus: function(file, p)
    {
        file = DirIO.fileName(file);
        document.getElementById("ew.s3Buckets.status").value = file + ": " + (p >= 0 && p <= 100 ? Math.round(p) : 100) + "%";
    },

    create: function() {
        var me = this;
        var inputs = [ {label: this.path.length ? "Folder Name" : "Bucket Name",required:1},
                       {label:"ACL",type:"menulist",list:[{name:"Private",id:"private"},
                                                          {name:"Public Read",id:"public-read"},
                                                          {name:"Public Read Write",id:"public-read-write"},
                                                          {name:"Authenticated Read",id:"authenticated-read"},
                                                          {name:"Bucket Owner Read",id:"bucket-owner-read"},
                                                          {name:"Bucket Owner Full Control",id:"bucket-owner-full-control"}],required:1}, ]
        if (!this.path.length) {
            inputs.push({label:"Region",type:"menulist",list:this.core.getS3Regions(),key:'region'});
        }

        var values = this.core.promptInput("Create S3 " + this.path.length ? "Folder" : "Bucket", inputs);
        if (!values) return;
        var params = {};
        if (values[1]) params["x-amz-acl"] = values[1];
        if (!this.path.length) {
            this.core.api.createS3Bucket(values[0], values[2], params, function() { me.refresh(true); });
        } else {
            this.core.getS3Bucket(this.path[0]).keys = []
            this.core.api.createS3BucketKey(this.path[0], this.path.slice(1).join('/') + '/' + values[0] + '/', params, null, function() { me.show(); });
        }
    },

    remove: function()
    {
        var me = this;
        var items = this.getSelectedAll();
        if (!items.length) return;
        if (!confirm("Delete " + items.length + " items?")) return;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var last = i == items.length - 1;
            if (!item.bucket) {
                this.core.api.deleteS3Bucket(item.name, {}, last ? function() { me.refresh(true); } : function() {});
            } else {
                this.core.getS3Bucket(item.bucket).keys = [];
                this.core.api.deleteS3BucketKey(item.bucket, item.name, {}, last ? function() { me.show(); } : function() {});
            }
        }
    },

    download: function(ask)
    {
        var me = this;
        var item = null;

        // Specify full S3 path from where to download
        if (ask) {
            var values = this.core.promptInput("Download from S3", [{label:"S3 Bucket Name:",required:1}, {label:"S3 File Name:",required:1}]);
            if (!values) return;
            item = { bucket: values[0], name: values[1] };
        } else {
            item = this.getSelected()
            if (this.isFolder(item)) return;
        }
        if (!item) return;

        var file = this.core.promptForFile("Save to file", true, DirIO.fileName(item.name))
        if (file) {
            this.core.api.getS3BucketKey(item.bucket, item.name, "", {}, file,
                    function(f) { me.setStatus(f, 100); },
                    function(f, p) { me.setStatus(f, p); } )
        }
    },

    downloadUrl: function()
    {
        var me = this;
        item = this.getSelected()
        if (!item || this.isFolder(item) || !item.url) return;
        this.core.displayUrl(item.url);
    },

    upload: function(ask)
    {
        var me = this;
        var path = this.path.slice(1).join('/');

        // If we do not see any buckets in the list, ask for the bucket name
        if (ask) {
            var values = this.core.promptInput("Upload to S3", [{label:"S3 Bucket Name:",required:1}, {label:"S3 Folder Name:"}]);
            if (!values) return;
            var item = { name: values[0] };
            path = values[1] || "";
        } else {
            if (!this.path.length) return;
            var item = this.core.getS3Bucket(this.path[0])
        }

        var values = me.core.promptInput('Upload file', [{label:"File Name",type:"file",size:50,required:1},
                                                         {label:"Permisions",type:"radio",list:["Private","Public Read","Public Read-Write","Authenticated Read","Owner Read","Owner Full Control"]},
                                                         ]);
        if (!values) return;
        item.keys = []
        var f = FileIO.open(values[0])
        var name = this.keyName(f.leafName)
        this.core.api.uploadS3BucketFile(item.name, path + '/' + name, "", this.toParams(values[1]), values[0],
                function(fn) { me.show(); },
                function(fn, p) { me.setStatus(fn, p); });
    },

    showFile: function()
    {
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        if (this.isFolder(item)) return
        var type = this.core.getMimeType(item.name);
        if (type.indexOf("image") > -1) {
            var file = DirIO.get("TmpD").path + "/" + DirIO.fileName(item.name);
            this.core.api.getS3BucketKey(item.bucket, item.name, "", {}, file,
                function(f) {
                     me.setStatus(f, 100);
                     try { if (me.win) me.win.close(); } catch(e) { debug(e) }
                     me.win = me.core.promptInput(item.bucket + "/" + item.name, [ {type:"image",value:"file://" + file,width:"100%",height:"100%",nobox:1,scale:1} ], true);
                },
                function(f, p) { me.setStatus(f, p); } )
        }

        if (type.indexOf("text") > -1) {
            this.edit();
        }
    },

    edit: function()
    {
        var me = this;
        var item = this.getSelected()
        if (this.isFolder(item)) return
        if (item.size > 1024*1024) {
            alert(item.name + " is too big");
            return;
        }
        // Read current ACLs
        if (!this.path.length) {
            this.core.api.getS3BucketAcl(item.name);
        } else {
            this.core.api.getS3BucketKeyAcl(item.bucket, item.name);
        }

        this.core.api.readS3BucketKey(item.bucket, item.name, "", {}, function(t) {
            var values = me.core.promptInput('Edit ' + item.name, [{multiline:true,rows:25,cols:60,value:t,flex:1,scale:1}]);
            if (!values) return;
            me.core.api.putS3BucketKey(item.bucket, item.name, "", {}, values[0], function() {
                item.size = values[0].length;
                me.show();
                debug(item.acls);
                // Apply same ACLs
                me.core.api.updateS3Acl(item);
            });
        });
    },

    createFile: function()
    {
        var me = this;
        if (!this.path.length) return;
        var item = this.core.getS3Bucket(this.path[0])
        item.keys = []
        var values = me.core.promptInput('Create file', [{label:"File Name",type:"name",required:1},
                                                         {label:"Text",multiline:true,rows:25,cols:60,flex:1,scale:1,required:1},
                                                         {label:"Permisions",type:"radio",list:["Private","Public Read","Public Read-Write","Authenticated Read","Owner Read","Owner Full Control"]},
                                                         ]);
        if (!values) return;
        var name = this.path.slice(1).join('/') + '/' + this.keyName(values[0])
        me.core.api.putS3BucketKey(item.name, name, "", this.toParams(values[2]), values[1], function() {
            me.show();
        });
    },

    managePolicy: function()
    {
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        var name = !this.path.length ? item.name : item.bucket;
        var policy = this.core.api.getS3BucketPolicy(name);
        var values = me.core.promptInput('Bucket Policy', [ {label:"Bucket",type:"label",value:name},
                                                            {label:"Policy",value:policy || "",multiline:true,rows:15,cols:60}]);
        if (!values) return;
        this.core.api.setS3BucketPolicy(item.name, values[1]);
    },

    manageAcls: function()
    {
        var me = this;
        var item = this.getSelected();
        if (item == null) return
        var retVal = { ok : null, content: null };

        function wrap() {
            window.openDialog("chrome://ew/content/dialogs/manage_s3acl.xul", null, "chrome,centerscreen,modal,resizable", me.core, retVal, item);
            if (retVal.ok) {
                if (item.bucket) {
                    me.core.api.setS3BucketKeyAcl(item.bucket, item.name, retVal.content, function() { me.selectionChanged(); })
                } else {
                    me.core.api.setS3BucketAcl(item.name, retVal.content, function() { me.selectionChanged(); })
                }
            }
        }

        if (!this.path.length) {
            this.core.api.getS3BucketAcl(item.name, wrap)
        } else {
            this.core.api.getS3BucketKeyAcl(item.bucket, item.name, wrap)
        }
    },

    manageWebsite: function()
    {
        if (this.path.length) return;
        var me = this;
        var item = this.getSelected()
        if (item == null) return
        this.core.api.getS3BucketWebsite(item.name, function(obj) {
            var values = me.core.promptInput('Website', [ {label:"Website Enabled",type:"checkbox",value:obj.indexSuffix && obj.indexSuffix != '' ? true  :false},
                                                          {label:"Index Document Suffix",value:obj.indexSuffix || ""},
                                                          {label:"Error Document Key",value:obj.errorKey || ""}]);
            if (!values) return;
            if (values[0]) {
                me.core.api.setS3BucketWebsite(item.name, values[1], values[2], function() { me.selectionChanged(); })
            } else {
                me.core.api.deleteS3BucketWebsite(item.name, function() { me.selectionChanged(); })
            }
        });
    },

    setProto: function()
    {
        var item = this.getSelected()
        if (!item || !this.isFolder(item)) return;
        var proto = this.core.getS3Protocol(this.core.api.region, item.name);
        if (!confirm('Use ' + (proto == 'http://' ? 'HTTPS' : '"HTTP') + ' for access to bucket ' + item.name + '?')) return;
        this.core.setS3Protocol(this.core.api.region, item.name, proto == 'http://' ? 'https://' : '');
    },

};

