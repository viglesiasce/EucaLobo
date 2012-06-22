var ew_RouteTablesTreeView = {
    model : [ "routeTables", "vpcs", "subnets" ],

    selectionChanged : function()
    {
        var table = this.getSelected()
        if (table == null) return

        ew_RoutesTreeView.display(table.routes);
        ew_RouteAssociationsTreeView.display(table.associations);
    },

    createTable : function()
    {
        var vpcs = ew_session.model.get('vpcs');
        if (!vpcs) {
            alert("No VPCs available, try later")
            return;
        }
        var rc = ew_session.promptList("Create Route Table", "Select VPC", vpcs, [ 'id', 'cidr' ]);
        if (rc < 0) {
            return;
        }

        var me = this;
        this.session.api.createRouteTable(vpcs[rc].id, function() { me.refresh() });

    },

    deleteSelected : function()
    {
        var table = this.getSelected();
        if (!table || !confirm("Delete route table " + table.id + "?")) return;
        var me = this;
        this.session.api.deleteRouteTable(table.id, function() { me.refresh() });
    },
};
ew_RouteTablesTreeView.__proto__ = TreeView;

var ew_RoutesTreeView = {

    createRoute : function()
    {
        var table = ew_RouteTablesTreeView.getSelected();
        if (!table) return;
        var gws = ew_session.model.get('internetGateways', 'vpcId', table.vpcId);
        var instances = ew_session.model.get('instances', 'vpcId', table.vpcId);
        var enis = ew_session.model.get('networkInterfaces', 'vpcId', table.vpcId);

        var retVal = { ok: false, title: table.toString(), gws : gws, instances: instances, enis: enis }
        window.openDialog("chrome://ew/content/dialogs/create_route.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            this.session.api.createRoute(table.id, retVal.cidr, retVal.gatewayId, retVal.instanceId, retVal.networkInterfaceId, function() { ew_RouteTablesTreeView.refresh(true); });
        }
    },

    deleteRoute : function()
    {
        var item = this.getSelected();
        if (!item || !confirm("Delete route  " + item.cidr + "?")) return;
        this.session.api.deleteRoute(item.tableId, item.cidr, function() {ew_RouteTablesTreeView.refresh(true); });
    },
};
ew_RoutesTreeView.__proto__ = TreeView;

var ew_RouteAssociationsTreeView = {

    createAssociation : function()
    {
        var table = ew_RouteTablesTreeView.getSelected();
        if (!table) {
            alert("Please, select route table");
            return;
        }
        var subnets = ew_session.model.get('subnets');
        if (!subnets) {
            alert("No subnets available, try later")
            return;
        }
        var rc = ew_session.promptList("Create Route", "Select subnet", subnets, [ "id", "cidr" ]);
        if (rc < 0) {
            return;
        }
        this.session.api.associateRouteTable(table.id, subnets[rc].id, function() { ew_RouteTablesTreeView.refresh(); });
    },

    deleteAssociation : function()
    {
        var item = this.getSelected();
        if (!item || !confirm("Delete route association " + item.id + ":" + item.subnetId + "?")) return;
        this.session.api.disassociateRouteTable(item.id, function() { ew_RouteTablesTreeView.refresh(); });
    },
};
ew_RouteAssociationsTreeView.__proto__ = TreeView;

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
