var ew_NetworkAclsTreeView = {
    model : [ "networkAcls", "subnets", "vpcs" ],

    selectionChanged: function(event)
    {
        var acl = this.getSelected()
        if (acl == null) return

        ew_NetworkAclRulesTreeView.display(acl.rules);
        ew_NetworkAclAssociationsTreeView.display(acl.associations);
    },

    createACL : function()
    {
        var vpcs = ew_session.model.get('vpcs');
        if (!vpcs) {
            alert("No VPCs available, try later")
            return;
        }
        var rc = ew_session.promptList("Create Network ACL", "Select VPC", vpcs, ['id', 'cidr' ]);
        if (rc < 0) {
            return;
        }


        var me = this;
        this.session.api.createNetworkAcl(vpcs[rc].id, function() { me.refresh(); });

    },

    deleteACL : function()
    {
        var acl = this.getSelected();
        if (!acl || !confirm("Delete Network ACL " + acl.id + "?")) return;
        var me = this;
        this.session.api.deleteNetworkAcl(acl.id, function() { me.refresh(); });
    },

    associateACL : function()
    {
        var acl = this.getSelected();
        if (!acl) {
            alert("Please, select ACL");
            return;
        }
        var subnets = ew_session.model.get('subnets', 'vpcId', acl.vpcId);
        if (!subnets.length) {
            alert("No subnets available, try later")
            return;
        }
        var rc = ew_session.promptList("Associate with VPC Subnet", "Select subnet", subnets, [ "id", "cidr" ]);
        if (rc < 0) {
            return;
        }
        var assocId = ew_model.getNetworkAclAssociation(subnets[rc].id);
        if (!assocId) {
            alert("Could not find existing Subnet association");
            return
        }
        this.session.api.ReplaceNetworkAclAssociation(assocId, acl.id, function() { ew_NetworkAclsTreeView.refresh() });
    },
};
ew_NetworkAclsTreeView.__proto__ = TreeView;

var ew_NetworkAclAssociationsTreeView = {

};
ew_NetworkAclAssociationsTreeView.__proto__ = TreeView;

var ew_NetworkAclRulesTreeView = {

    createRule : function()
    {
        var acl = ew_NetworkAclsTreeView.getSelected();
        if (!acl) {
            alert("Please, select ACL");
            return;
        }
        var retVal = {ok:null};
        window.openDialog("chrome://ew/content/dialogs/create_networkaclentry.xul", null, "chrome,centerscreen,modal,resizable", acl, ew_session, retVal);
        if (retVal.ok) {
            debug(JSON.stringify(retVal))
            this.session.api.createNetworkAclEntry(acl.id, retVal.num, retVal.proto, retVal.action, retVal.egress, retVal.cidr, retVal.var1, retVal.var2, function() { ew_NetworkAclsTreeView.refresh() });
        }
    },

    deleteRule : function()
    {
        var item = this.getSelected();
        if (!item || !confirm("Delete ACL rule " + item.num + "?")) return;
        var acl = ew_NetworkAclsTreeView.getSelected();
        this.session.api.deleteNetworkAclEntry(acl.id, item.num, item.egress, function() { ew_NetworkAclsTreeView.refresh() });
    }

};
ew_NetworkAclRulesTreeView.__proto__ = TreeView;

