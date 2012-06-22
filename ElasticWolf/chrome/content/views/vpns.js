var ew_VpnConnectionTreeView = {
    model: ['vpnConnections','customerGateways','vpnGateways','vpcs'],
    searchElement: 'ew.vpnconnections.search',

    menuChanged : function() {
        var image = this.getSelected();
        $("ew.vpnconnections.contextmenu").disabled = (image == null);
        TreeView.menuChanged.call(this);
    },

    saveConnectionConfiguration : function (name, config) {
        var file = ew_session.promptForFile("Save VPN Connection Configuration", true, name + ".txt");
        if (file) {
            FileIO.write(FileIO.open(file), config);
        }
    },

    getCustomerConfig : function() {
        var vpn = this.getSelected();
        if (vpn == null) return;
        if (vpn.config == null) {
           alert("The Customer Gateway configuration for this VPN Connection is not present.")
           return;
        }

        var devices = ew_session.queryVpnConnectionStylesheets();
        var idx = ew_session.promptList("Customer Gateway configuration", "Select device type:", devices, ['title']);
        if (idx >= 0) {
            var result = ew_session.queryVpnConnectionStylesheets(devices[idx].filename, vpn.config);
            if (!result) {
                return alert("Error processing gateway configuration");
            }
            this.saveConnectionConfiguration(vpn.id, result);
        }
    },

    createVpnConnection : function(cgwid, vgwid) {
        var retVal = {ok:null, vgwid: vgwid, cgwid: cgwid, type:null}
        window.openDialog("chrome://ew/content/dialogs/create_vpn_connection.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            this.session.api.createVpnConnection(retVal.type, retVal.cgwid, retVal.vgwid, function() { me.refresh();});
        }
    },

    deleteVpnConnection : function () {
        var vpn = this.getSelected();
        if (vpn == null) return;

        var confirmed = confirm("Delete " + vpn.toString() + "?");
        if (!confirmed) return;

        var me = this;
        this.session.api.deleteVpnConnection(vpn.id, function() { me.refresh()});
    },
};

ew_VpnConnectionTreeView.__proto__ = TreeView;

var ew_CustomerGatewayTreeView = {
    model: 'customerGateways',
    searchElement: 'ew.customergateways.search',

    menuChanged : function() {
        var image = this.getSelected();
        $("ew.customergateways.contextmenu").disabled = (image == null);
        TreeView.menuChanged.call(this);
    },

    createCustomerGateway : function () {
        var retVal = {ok:null,type:null, ipaddress:null, bgpasn:null}
        window.openDialog("chrome://ew/content/dialogs/create_customer_gateway.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            this.session.api.createCustomerGateway(retVal.type, retVal.ipaddress, retVal.bgpasn, function(id) { me.refresh(); });
        }
    },

    deleteCustomerGateway : function () {
        var cgw = this.getSelected();
        if (cgw == null) return;

        var confirmed = confirm("Delete " + cgw.toString() + "?");
        if (!confirmed) return;

        var me = this;
        this.session.api.deleteCustomerGateway(cgw.id, function(id) { me.refresh(); });
    },

    createVpnConnection : function() {
        var cgw = this.getSelected();
        if (cgw == null) return;

        ew_VpnConnectionTreeView.createVpnConnection(cgw.id, null);
        ew_session.selectTab('ew.tabs.vpn')
    },
};

ew_CustomerGatewayTreeView.__proto__ = TreeView;

var ew_VpnGatewayTreeView = {
    model: ['vpnGateways', 'vpcs'],

    menuChanged : function() {
        var image = this.getSelected();
        $("ew.vpnGateways.contextmenu").disabled = (image == null);
        TreeView.menuChanged.call(this);
    },

    selectionChanged : function(event) {
        var list = [];
        var vgw = this.getSelected();
        ew_VpnAttachmentTreeView.display(vgw ? vgw.attachments : []);
    },

    createVpnGateway : function () {
        var retVal = {ok:null,type:null, az:null}
        window.openDialog("chrome://ew/content/dialogs/create_vpn_gateway.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);

        if (retVal.ok) {
            var me = this;
            this.session.api.createVpnGateway(retVal.type, retVal.az, function() {me.refresh()});
        }
    },

    deleteVpnGateway : function () {
        var vgw = this.getSelected();
        if (vgw == null) return;

        var confirmed = confirm("Delete " + vgw.toString() + "?");
        if (!confirmed) return;

        var me = this;
        this.session.api.deleteVpnGateway(vgw.id, function() { me.refresh() });
    },

    createVpnConnection : function() {
        var vgw = this.getSelected();
        if (vgw == null) return;

        ew_VpnConnectionTreeView.createVpnConnection(null, vgw.id);
    },

    attachToVpc : function() {
        var vgw = this.getSelected();
        if (vgw == null) return;

        ew_VpnAttachmentTreeView.attachToVpc(null, vgw.id);
    },
};

ew_VpnGatewayTreeView.__proto__ = TreeView;

var ew_VpnAttachmentTreeView = {
    name: "vpnattachments",

    menuChanged : function()
    {
        var image = this.getSelected();
        $("ew.vpnattachments.contextmenu").disabled = (image == null);
        TreeView.menuChanged.call(this);
    },

    deleteVpnAttachment : function()
    {
        var att = this.getSelected();
        if (att == null) return;

        var confirmed = confirm("Delete attachment of " + att.vgwId + " to " + att.vpcId + "?");
        if (!confirmed) return;

        var me = this;
        this.session.api.detachVpnGatewayFromVpc(att.vgwId, att.vpcId, function() { me.refresh() });
    },

    attachToVpc : function(vpcid, vgwid)
    {
        var retVal = { ok : null, vgwid : vgwid, vpcid : vpcid }
        window.openDialog("chrome://ew/content/dialogs/attach_vpn_gateway.xul", null, "chrome,centerscreen,modal,resizable", ew_session, retVal);
        if (retVal.ok) {
            var me = this;
            this.session.api.attachVpnGatewayToVpc(retVal.vgwid, retVal.vpcid, function() { me.refresh() });
        }
    },
};

ew_VpnAttachmentTreeView.__proto__ = TreeView;
