
var ew_VpcsTreeView = {
    model: [ "vpcs", "subnets", "securityGroups", "routeTables", "networkAcls", "instances", "internetGateways", 'dhcpOptions', 'availabilityZones', 'vpnGateways', 'customerGateways', 'vpnConnections' ],

    menuChanged : function()
    {
        document.getElementById("ew.vpcs.contextmenu").disabled = (this.getSelected() == null);
    },

    selectionChanged: function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        var list = [];
        var tables = this.session.model.get('routeTables','vpcId', vpc.id);
        var igws = this.session.model.get('internetGateways','vpcId', vpc.id);
        var acls = this.session.model.get('networkAcls','vpcId', vpc.id);
        var enis = this.session.model.get('networkInterfaces','vpcId', vpc.id);
        var vgws = this.session.model.get('vpnGateways');
        var vpns = this.session.model.get('vpnConnections');
        var cgws = this.session.model.get('customerGateways');
        var subnets = this.session.model.get('subnets','vpcId', vpc.id);
        var instances = this.session.model.get('instances','vpcId', vpc.id);
        var groups = this.session.model.get('securityGroups','vpcId', vpc.id);

        if (subnets.length) {
            list.push({ name: "Subnets" })
            for (var i in subnets) {
                list.push({ name: "    " + subnets[i].toString() });
                var found = false;
                for (var j in tables) {
                    for (var k in tables[j].associations) {
                        if (tables[j].associations[k].subnetId == subnets[i].id) {
                            if (!found) {
                                found = true;
                                list.push({ name: "        Routes"})
                            }
                            for (n in tables[j].routes) {
                                list.push({ name: "            " + tables[j].routes[n].toString() });
                            }
                            break;
                        }
                    }
                }
                found = false;
                for (var j in acls) {
                    for (var k in acls[j].associations) {
                        if (acls[j].associations[k].subnetId == subnets[i].id) {
                            if (!found) {
                                found = true;
                                list.push({ name: "        Network ACLs"})
                            }
                            for (n in acls[j].rules) {
                                list.push({ name: "            " + acls[j].rules[n].toString() })
                            }
                            break;
                        }
                    }
                }
            }
        }
        this.listToInfo(igws, "Internet Gateways", list);
        this.listToInfo(instances, "Instances", list);
        this.listToInfo(groups, "Security Groups", list);
        this.listToInfo(enis, "Network Interfaces", list);

        if (vgws.length) {
            var found = false;
            for (var i in vgws) {
                for (var j in vgws[i].attachments) {
                    if (vgws[i].attachments[j].vpcId == vpc.id) {
                        if (!found) {
                            found = true;
                            list.push({ name: "VPN Gateways" })
                        }
                        list.push({ name: "    " + vgws[i].toString() })
                    }
                }
            }
        }

        if (vpns.length) {
            var found = false;
            for (var i in vpns) {
                for (var j in vgws) {
                    if (vgws[j].id != vpns[i].vgwId) continue;
                    for (var k in vgws[j].attachments) {
                        if (vgws[j].attachments[k].vpcId == vpc.id) {
                            if (!found) {
                                found = true;
                                list.push({ name: "VPN Connections" })
                            }
                            list.push({ name: "    " + vpns[i].toString() })
                        }
                    }
                }
            }
        }
        ew_VpcsInfoTreeView.display(list);
    },

    listToInfo: function(items, title, list)
    {
        if (items.length) {
            list.push({ name: title })
            for (var i in items) {
                list.push({ name: "    " + items[i].toString() });
            }
        }
    },

    createSubnet : function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        ew_SubnetsTreeView.createSubnet(vpc.id);
    },

    createVpc : function()
    {
        var me = this;
        var inputs = [ {label:"VPC",help:"Specify IP block for a VPC and optionally name for easy navigation in the system",type:"section"},
                       {label:'IP CIDR block:',required:1,help:"Example: 10.0.0.0/16"},
                       {label:'Tenancy',type:'menulist',list:["default","dedicated"]},
                       {label:'VPC Name:'},
                       {label:"Subnets",type:"section",help:"Optonally, create one or both subnets in the new VPC:"},
                       {label:'Public Subnet',help:"Example: 10.1.0.0/24"},
                       {label:'Private Subnet',help:"Example: 10.2.0.0/24"},
                       {label:'Availability Zone',type:'menulist',list: this.session.model.get('availabilityZones'),key:'name'},
                       {label:"VPN Connection",type:"section",help:"Optonally, create VPN connection to your VPC:"},
                       {label:'Customer Gateway IP'},
                       {label:'BGP ASN',value:65000},
                       ];

        var values = this.session.promptInput("Create VPC", inputs);
        if (values) {
            this.session.api.createVpc(values[1], values[2], function(vpcId) {
                if (values[3]) {
                    me.session.setTags(vpcId, "Name:" + values[3], function() { me.refresh() });
                } else {
                    me.refresh();
                }

                // Public subnet
                if (values[5]) {
                    me.session.api.createSubnet(vpcId, values[5], values[7], function(subnetId) {
                        me.session.api.createInternetGateway(function(igwId) {
                            me.session.api.attachInternetGateway(igwId, vpcId, function() {
                                me.session.api.createRouteTable(vpcId, function(tableId) {
                                    me.session.api.associateRouteTable(tableId, subnetId, function() {
                                        me.session.api.createRoute(tableId, "0.0.0.0/0", igwId, null, null, function() {
                                            ew_SubnetsTreeView.refresh(true);
                                        });
                                    });
                                });
                            });
                        });
                    });
                }

                // Private subnet
                if (values[6]) {
                    me.session.api.createSubnet(vpcId, values[6], values[7], function(id) {
                        ew_SubnetsTreeView.refresh(true);
                    });
                }

                // VPN
                if (values[9] && values[10]) {
                    me.session.api.createCustomerGateway("ipsec.1", values[9], values[10], function(cgwId) {
                        me.session.api.createVpnGateway("ipsec.1", values[7], function(vgwId) {
                            me.session.api.attachVpnGatewayToVpc(vgwId, vpcId, function() {
                                me.session.api.createVpnConnection("ipsec.1", cgwId, vgwId, function(vpnId) {
                                    me.session.model.refresh('vpnGateways', 'customerGateways', 'vpnConnections');
                                });
                            });
                        });
                    });
                }
            });
        }
    },

    deleteVpc : function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        var instances = this.session.model.get('instances','vpcId', vpc.id, 'state', 'running');
        if (instances.length) {
            alert("There is instance " + instances[0].toString() + " in this VPC");
            return;
        }

        if (!confirm("Delete " + vpc.toString() + ", make sure you deleted all Instances, Subnets, Securty Groups, Gateways, VPN Connections, Route Tables, Network ACLs?")) return;

        var me = this;
        this.session.api.deleteVpc(vpc.id, function() { me.refresh()});
    },

    setDhcpOptions : function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        var retVal = { ok : null, vpcId : vpc.id, dhcpOptionsId : null};
        window.openDialog("chrome://ew/content/dialogs/associate_dhcp_options.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            this.session.api.associateDhcpOptions(retVal.dhcpOptionsId, retVal.vpcId, function() { me.refresh() });
        }
    },

    attachToVpnGateway : function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        ew_VpnAttachmentTreeView.attachToVpc(vpc.id, null);
    },

    attachToInternetGateway : function()
    {
        var vpc = this.getSelected();
        if (vpc == null) return;

        ew_InternetGatewayTreeView.attachInternetGateway(vpc.id, null);
    },
};
ew_VpcsTreeView.__proto__ = TreeView;

ew_VpcsInfoTreeView = {

    cycleHeader : function(col) {

    },
    sort : function() {

    },
};
ew_VpcsInfoTreeView.__proto__ = TreeView;

var ew_DhcpoptsTreeView = {
    model: "dhcpOptions",

    menuChanged : function() {
        var image = this.getSelected();
        document.getElementById("ew.dhcpopts.contextmenu").disabled = (image == null);
    },

    deleteDhcpOptions : function() {
        var opts = this.getSelected();
        if (opts == null) return;
        if (!confirm("Delete " + opts.toString() + "?")) return;
        var me = this;
        this.session.api.deleteDhcpOptions(opts.id, function() { me.refresh(); });
    },

    createDhcpOptions : function () {
        var retVal = {ok:null, opts:null}
        window.openDialog("chrome://ew/content/dialogs/create_dhcp_options.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            var wrap = function(id) {
                me.refresh();
                me.selectByImageId(id);
            }
            this.session.api.createDhcpOptions(retVal.opts, function() { me.refresh(); });
        }
    },
};

ew_DhcpoptsTreeView.__proto__ = TreeView;

var ew_SubnetsTreeView = {
    model: [ "subnets", "vpcs", "routeTables", "networkAcls", "internetGateways", "availabilityZones" ],

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
        this.session.api.deleteSubnet(subnet.id, function() { me.refresh(); });
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
            this.session.api.createSubnet(retVal.vpcid, retVal.cidr, retVal.az, function(id) {
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
        this.session.api.ReplaceNetworkAclAssociation(subnet.aclAssocId, acl.id, function() { ew_SubnetsTreeView.refresh() });
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
        this.session.api.associateRouteTable(routes[rc].id, subnet.id, function () { ew_SubnetsTreeView.refresh(); });
    },

    disassociateRoute: function()
    {
        var subnet = this.getSelected();
        if (!subnet) return;

        if (!confirm("Delete route association " + subnet.routeId + "?")) return;
        this.session.api.disassociateRouteTable(subnet.routeAssocId, function () { ew_SubnetsTreeView.refresh(); });

    },
};
ew_SubnetsTreeView.__proto__ = TreeView;

var ew_SubnetRoutesTreeView = {
};
ew_SubnetRoutesTreeView.__proto__ = TreeView;

var ew_SubnetAclRulesTreeView = {
};
ew_SubnetAclRulesTreeView.__proto__ = TreeView;

var ew_InternetGatewayTreeView = {
    model : ["internetGateways", "vpcs"],

    create : function()
    {
        var me = this;
        this.session.api.createInternetGateway(function(){me.refresh()});
    },

    destroy : function()
    {
        var igw = this.getSelected();
        if (igw == null) return;
        if (!ew_session.promptYesNo("Confirm", "Delete Internet Gateway " + igw.id + "?")) return;

        var me = this;
        this.session.api.deleteInternetGateway(igw.id, function() {me.refresh()});
    },

    attach: function(vpcid, igwid, selected)
    {
        var igw = this.getSelected()
        if (!igw) return
        this.attachInternetGateway(null, igw.id)
    },

    attachInternetGateway : function(vpcid, igwid)
    {
        var retVal = { ok : null, igwnew : 0, igwid : igwid, vpcid : vpcid }
        window.openDialog("chrome://ew/content/dialogs/attach_internet_gateway.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            if (retVal.igwnew) {
                this.session.api.createInternetGateway(function(id) {
                    this.session.api.attachInternetGateway(id, retVal.vpcid, function() {me.refresh()});
                });
            } else {
                this.session.api.attachInternetGateway(retVal.igwid, retVal.vpcid, function() {me.refresh()});
            }
        }
    },

    detach : function()
    {
        var igw = this.getSelected();
        if (igw == null) return;
        if (!ew_session.promptYesNo("Confirm", "Detach Internet Gateway " + igw.id + " from " + igw.vpcId + "?")) return;
        var me = this;
        this.session.api.detachInternetGateway(igw.id, igw.vpcId, function() {me.refresh()});
    },
};
ew_InternetGatewayTreeView.__proto__ = TreeView;
