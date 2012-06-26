var ew_BundleTasksTreeView = {
    model: 'bundleTasks',
    searchElement: 'ew.bundleTasks.search',

    menuChanged  : function (event) {
        var task = this.getSelected();
        if (task == null) return;

        var fDisabled = (task.state == "complete" || task.state == "failed");

        // If the task has been completed or has failed, disable the
        // following context menu items.
        document.getElementById("bundleTasks.context.cancel").disabled = fDisabled;

        // If the task hasn't completed, you can't register a new AMI
        fDisabled = (task.state != "complete");
        document.getElementById("bundleTasks.context.register").disabled = fDisabled;
    },

    isRefreshable : function() {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "complete" || this.treeList[i].state == "failed") return true;
        }
        return false;
    },

    cancelBundleTask: function () {
        var selected = this.getSelectedBundle();
        if (selected == null) return;

        if (!confirm("Cancel bundle task:  " + selected.id + "?")) return;
        var me = this;
        this.core.api.cancelBundleTask(selected.id, function() { me.refresh() });
    },

    registerBundledImage : function (bucket, prefix)
    {
        var me = this;
        var manifestPath = bucket + "/" + prefix + ".manifest.xml";
        var region = this.core.api.getS3BucketLocation(bucket);
        this.core.api.registerImageInRegion(manifestPath, region, function() {
            me.core.modelRefresh('images');
            me.core.selectTab('ew.tabs.image');
        });
    },

    registerNewImage : function () {
        var selected = this.getSelected();
        if (selected == null) return;

        // Ensure that bundling has run to completion
        if (selected.state != "complete") {
            alert('Please wait for the Bundling State to be "complete" before Registering');
            return;
        }
        this.registerBundledImage(selected.s3bucket, selected.s3prefix);
    },
};
ew_BundleTasksTreeView.__proto__ = TreeView;
