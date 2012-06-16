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
        ew_session.controller.cancelBundleTask(selected.id, function() { me.refresh() });
    },

    registerBundledImage : function (bucket, prefix) {
        var manifestPath = bucket + "/" + prefix + ".manifest.xml";
        var region = ew_session.controller.getS3BucketLocation(bucket);
        ew_session.controller.registerImageInRegion(manifestPath, region, function() {
            ew_model.refresh('images');
            ew_session.selectTab('ew.tabs.image');
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
ew_BundleTasksTreeView.register();
