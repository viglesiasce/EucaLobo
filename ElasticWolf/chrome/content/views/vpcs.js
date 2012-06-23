var ew_VpcTreeView = {
    model: [ "vpcs", "instances", "internetGateways", 'dhcpOptions', 'availabilityZones' ],

    menuChanged : function()
    {
        document.getElementById("ew.vpcs.contextmenu").disabled = (this.getSelected() == null);
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
                       ];

        var values = this.session.promptInput("Create VPC", inputs);
        if (values) {
            this.session.api.createVpc(values[1], values[2], function(id) {
                me.refresh();
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

        var subnets = this.session.model.get('subnets', 'vpcId', vpc.id);
        for (var i in subnets) {
            var instances = this.session.model.get('instances', 'subnetId', subnets[i].id, 'state', 'running');
            if (instances.length) {
                alert("There is instance " + instances[0].toString() + " in subnet " + subnets[i].toString());
                return;
            }
        }

        if (!confirm("Delete " + vpc.toString() + "?")) return;

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
ew_VpcTreeView.__proto__ = TreeView;

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
