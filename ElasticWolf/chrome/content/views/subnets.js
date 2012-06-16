var ew_SubnetsTreeView = {
    model: [ "subnets", "vpcs", "routeTables", "networkAcls", "availabilityZones" ],

    menuChanged : function()
    {
        $("ew.subnets.contextmenu").disabled = (this.getSelected() == null);
    },

    deleteSubnet : function()
    {
        var subnet = this.getSelected();
        if (subnet == null) return;

        var instances = ew_model.get('instances', 'subnetId', subnet.id, 'state', 'running');
        if (instances.length) {
            alert("There is instance " + instances[0].toString() + " in this subnet");
            return false
        }

        if (!confirm("Delete " + subnet.toString() + "?")) return;

        var me = this;
        ew_session.controller.deleteSubnet(subnet.id, function() { me.refresh(); });
    },

    createSubnet : function(vpc)
    {
        var retVal = { ok : null, cidr : null, vpcid : vpc, az : null, tag: '' };
        window.openDialog("chrome://ew/content/dialogs/create_subnet.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);

        if (retVal.ok) {
            var me = this;
            function wrap() {
                me.refresh();
                if (confirm('If this subnet will be a "public" subnet (one where instances can communicate to or from the Internet), please attach / create Internet Gateway.\nDo you want to do it now?')) {
                    ew_InternetGatewayTreeView.attachInternetGateway(retVal.vpcid, null);
                }
            }
            ew_session.controller.createSubnet(retVal.vpcid, retVal.cidr, retVal.az, function(response) {
                var id = getNodeValue(response.xmlDoc, "subnetId");
                if (retVal.tag != '' && id) {
                    ew_session.setTags(id, retVal.tag, wrap);
                } else {
                    wrap();
                }
            });
        }
    },

    selectionChanged: function(event)
    {
        var subnet = this.getSelected();
        if (subnet == null) return;
        ew_SubnetRoutesTreeView.display(subnet.routes);
        ew_SubnetAclRulesTreeView.display(subnet.rules);
        ew_RouteTablesTreeView.select({ id: subnet.tableId });
        ew_NetworkAclsTreeView.select({ id: subnet.aclId });
        ew_NetworkAclAssociationsTreeView.select({ subnetId: subnet.id }, ['subnetId'])
        ew_RouteAssociationsTreeView.select({ subnetId: subnet.id }, ['subnetId'])
    },

    display: function(list)
    {
        var tables = ew_model.get('routeTables');
        var acls = ew_model.get('networkAcls');
        for (var k in list) {
            if (tables) {
                for (var i in tables) {
                    for (var j in tables[i].associations) {
                        if (tables[i].associations[j].subnetId == list[k].id) {
                            list[k].routes = tables[i].routes;
                            list[k].tableId = tables[i].id;
                            list[k].routeAssocId = tables[i].associations[j].id;
                            break;
                        }
                    }
                }
            }

            if (acls) {
                for (var i in acls) {
                    for (var j in acls[i].associations) {
                        if (acls[i].associations[j].subnetId == list[k].id) {
                            list[k].rules = acls[i].rules;
                            list[k].aclId = acls[i].id;
                            list[k].aclAssocId = acls[i].associations[j];
                            break;
                        }
                    }
                }
            }
        }
        TreeView.display.call(this, list);
    },

    associateACL : function()
    {
        var subnet = this.getSelected();
        if (!subnet) return;

        var acls = ew_model.get('networkAcls', 'vpcId', subnet.vpcId);
        if (!acls.length) {
            alert("No ACLs available, try later")
            return;
        }
        var rc = ew_session.promptList("Replace Network ACL", "Select ACL", acls, [ "id", "vpcId" ]);
        if (rc < 0) {
            return;
        }
        ew_session.controller.ReplaceNetworkAclAssociation(subnet.aclAssocId, acl.id, function() { ew_SubnetsTreeView.refresh() });
    },

    associateRoute : function()
    {
        var subnet = this.getSelected();
        if (!subnet) return;

        var routes = ew_session.model.get('routeTables');
        if (!routes) {
            alert("No route tables available, try later")
            return;
        }
        var rc = ew_session.promptList("Associate Route Table", "Select route table", routes, [ "id", "vpcId" ]);
        if (rc < 0) {
            return;
        }
        ew_session.controller.associateRouteTable(routes[rc].id, subnet.id, function () { ew_SubnetsTreeView.refresh(); });
    },

    disassociateRoute: function()
    {
        var subnet = this.getSelected();
        if (!subnet) return;

        if (!confirm("Delete route association " + subnet.routeId + "?")) return;
        ew_session.controller.disassociateRouteTable(subnet.routeAssocId, function () { ew_SubnetsTreeView.refresh(); });

    },
};
ew_SubnetsTreeView.__proto__ = TreeView;
ew_SubnetsTreeView.register();

var ew_SubnetRoutesTreeView = {
};
ew_SubnetRoutesTreeView.__proto__ = TreeView;

var ew_SubnetAclRulesTreeView = {
};
ew_SubnetAclRulesTreeView.__proto__ = TreeView;
