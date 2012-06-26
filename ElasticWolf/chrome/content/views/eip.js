var ew_ElasticIPTreeView = {
    model: [ "addresses", "instances", "networkInterfaces" ],
    tagId: "publicIp",

    menuChanged : function() {
        var eip = this.getSelected();
        document.getElementById("ew.addresses.contextmenu").disabled = (eip == null);
        if (eip == null) return;
        document.getElementById("addresses.context.disassociate").disabled = !eip.instanceId;
        document.getElementById("addresses.context.dns").disabled = !eip.instanceId;
    },

    allocateAddress : function() {
        var me = this;
        this.core.api.allocateAddress(this.core.isVpcMode(), function() { me.refresh() });
    },

    releaseAddress : function() {
        var eip = this.getSelected();
        if (eip == null) return;
        if (!this.core.promptYesNo("Confirm", "Release "+eip.publicIp+"?")) return;

        var me = this;
        this.core.api.releaseAddress(eip, function() { me.refresh() });
    },

    getUnassociatedInstances : function() {
        var instances = this.core.queryModel('instances', 'state', 'running');
        var unassociated = new Array();
        var eips = {};

        // Build the list of EIPs that are associated with an instance
        for (var i in this.treeList) {
            var eip = this.treeList[i];
            if (eip.instanceId == null || eip.instanceId.length == 0) {
                continue;
            }
            eips[eip.instanceId] = eip.publicIp;
        }

        for (var i in instances) {
            if (eips[instances[i].id]) {
                continue;
            }
            unassociated.push(instances[i]);
        }
        return unassociated;
    },

    associateAddress : function(eip) {
        // If an elastic IP hasn't been passed in to be persisted to EC2, create a mapping between the Address and Instance.
        if (eip == null) {
            eip = this.getSelected();
            if (eip == null) return;

            if (eip.instanceId != null && eip.instanceId != '') {
                var confirmed = confirm("Address "+eip.publicIp+" is already mapped to an instance, are you sure?");
                if (!confirmed)
                    return;
            }

            var list = this.getUnassociatedInstances();
            list = list.concat(this.core.queryModel('networkInterfaces'))

            var idx = this.core.promptList("Associate Elastic IP", "Which Instance/ENI would you like to associate "+ eip.publicIp +" with?", list, ['__class__', 'toString'], 550);
            if (idx < 0) return;
            // Determine what type we selected
            if (list[idx].imageId) {
                eip.instanceId = list[idx].id;
            } else {
                eip.eniId = list[idx].id;
            }
        }

        var me = this;
        this.core.api.associateAddress(eip, eip.instanceId, eip.eniId, function() { me.refresh() });
        return true;
    },

    disassociateAddress : function() {
        var eip = this.getSelected();
        if (eip == null) return;
        if (eip.instanceId == null || eip.instanceId == '') {
            alert("This EIP is not associated")
            return;
        }
        if (!confirm("Disassociate "+eip.publicIp+" and instance "+eip.instanceId+"?")) return;
        var me = this;
        this.core.api.disassociateAddress(eip, function() { me.refresh() });
    },

    copyPublicDnsToClipBoard : function(fieldName) {
        var eip = this.getSelected();
        if (!eip || !eip.instanceId) { return; }

        var instance = this.core.findModel('instances', eip.instanceId);
        if (instance) {
            this.core.copyToClipboard(instance.dnsName);
        }
    }

};

ew_ElasticIPTreeView.__proto__ = TreeView;
