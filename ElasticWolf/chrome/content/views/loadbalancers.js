var ew_LoadbalancerTreeView = {
    model: [ "loadBalancers", "availabilityZones", "securityGroups", "instances","serverCerts", "subnets", "elbPolicyTypes" ],

    display: function(list)
    {
        TreeView.display.call(this, list);
        if (!list || !list.length) {
            ew_InstanceHealthTreeView.display([]);
        }
    },

    selectionChanged : function() {
        var elb = this.getSelected();
        if (!elb) return;
        if (elb.InstanceHealth) {
            ew_InstanceHealthTreeView.display(elb.InstanceHealth);
        } else {
            this.core.api.describeInstanceHealth(elb.name, function(list) { ew_InstanceHealthTreeView.display(list); });
        }
    },

    deleteLoadBalancer : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        if (!confirm("Delete Loadbalancer "+elb.name+"?")) return;
        var me = this;
        this.core.api.deleteLoadBalancer(elb.name, function () { me.refresh(); });
    },

    create: function() {
        var me = this;
        var retVal = {ok:null, vpc: this.core.isVpcMode() };
        window.openDialog("chrome://ew/content/dialogs/create_loadbalancer.xul",null,"chrome,centerscreen,modal,resizable",this.core, retVal);
        if (retVal.ok) {
            this.core.api.createLoadBalancer(retVal.name, retVal.Protocol, retVal.elbport, retVal.instanceport, retVal.cert, retVal.azones, retVal.subnets, retVal.securityGroups, retVal.scheme, function() {
                me.core.api.configureHealthCheck(retVal.name,retVal.Target,retVal.Interval,retVal.Timeout,retVal.HealthyThreshold,retVal.UnhealthyThreshold, function() {
                    if (retVal.instances.length > 0) {
                        me.core.api.registerInstancesWithLoadBalancer(retVal.name, retVal.instances, function() { me.refresh(); });
                    } else {
                        me.refresh();
                    }
                    me.core.selectTab('ew.tabs.loadbalancer' + (retVal.subnetId ? ".vpc" : ""));
                });
            });
        }
     },

     createListener: function() {
         var elb = this.getSelected();
         if (elb == null) return;
         var certs = this.core.queryModel('serverCerts');
         var inputs = [{label:"Load Balancer",type:"label",value:elb.name,bold:1},
                       {label:"Instance Port:",type:"number",required:1},
                       {label:"Instance Protocol:",type:"menulist",required:1,list:["HTTP","HTTPS","TCP","SSL"]},
                       {label:"LoadBalancer Port:",type:"number",required:1},
                       {label:"LoadBalancer Protocol:",type:"menulist",required:1,list:["HTTP","HTTPS","TCP","SSL"]},
                       {label:"SSL Certificate",type:"menulist",list:certs,key:'arn'}];

         var values = this.core.promptInput('Create LoadBalancer Listener', inputs);
         if (!values) return;
         var me = this;
         this.core.api.createLoadBalancerListeners(elb.name,values[1],values[2],values[3],values[4],values[5],function() { me.refresh(); });
     },

     configureHealthCheck: function() {
        var elb = this.getSelected();
        if (elb == null) return;
        var inputs = [{label:"Load Balancer",type:"label",value:elb.name,bold:1},
                      {label:"Target",size:45,required:1},
                      {label:"Interval",type:"number",help:"seconds",required:1},
                      {label:"Timeout",type:"number", help:"seconds",required:1},
                      {label:"Healthy Threshold",type:"number",required:1},
                      {label:"Unhealthy Threhold",type:"number",required:1}];

        var values = this.core.promptInput("Configure Health Check", inputs);
        if (!values) return;
        var me = this;
        this.core.api.configureHealthCheck(elb.name,values[1],values[2],values[3],values[4],values[5],function() { me.refresh(); });
    },

    registerInstances : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var instances = [];
        if (elb.vpcId) {
            instances = this.core.queryModel('instances', 'state', 'running', 'vpcId', elb.vpcId);
        } else {
            instances = this.core.queryModel('instances', 'state', 'running');
        }
        var list = this.core.promptList('Register Instances', 'Select instances to register with this load balancer:', instances, { multiple: true });
        if (!list || !list.length) return;
        var me = this;
        instances = [];
        for (var i in list) {
            instances.push(list[i].id);
        }
        this.core.api.registerInstancesWithLoadBalancer(elb.name, instances, function() { me.refresh(); });
    },

    deregisterInstances : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var instances = [];
        for (var  i in elb.Instances) {
            instances.push(this.core.findModel('instances', elb.Instances[i]));
        }
        var list = this.core.promptList('Deregister Instances', 'Select instances to deregister with this load balancer:', instances, { multiple: true });
        if (!list || !list.length) return;
        var me = this;
        instances = [];
        for (var i in list) {
            instances.push(list[i].id);
        }
        this.core.api.deregisterInstancesWithLoadBalancer(elb.name, instances, function() { me.refresh(); });
    },

    manageZones : function(enable) {
        var elb = this.getSelected();
        if (elb == null) return;
        var zones = this.core.queryModel('availabilityZones');
        var checked = [];
        if (enable) {
            for (var i in zones) {
                if (elb.zones.indexOf(zones[i].name) >= 0) {
                    checked.push(zones[i]);
                }
            }
        }
        var list = this.core.promptList((enable ? "Enable" : "Disable") + 'Availability Zones', 'Select Zones to ' + (enable ? "enable" : "disable") + ' for this load balancer:', zones, { multiple: true, checkedItems: checked });
        if (!list || !list.length) return;
        var zonelist = [];
        for (var i in list) {
            zonelist.push(list[i].name);
        }
        var me = this;
        if (enable) {
            this.core.api.enableAvailabilityZonesForLoadBalancer(elb.name, zonelist, function() { me.refresh(); });
        } else {
            this.core.api.disableAvailabilityZonesForLoadBalancer(elb.name, zonelist, function() { me.refresh(); });
        }
    },

    setSSLCertificate : function(enable) {
        var elb = this.getSelected();
        if (elb == null) return;
        var certs = this.core.queryModel('serverCerts');
        if (!certs.length) {
            if (confirm("There are no server certificates, do you want to create one now?")) {
                ew_ServerCertsTreeView.createCert();
                return;
            }
        }
        var values = this.core.promptInput('Server Certificates', [{label:"LoadBalancer Port:",type:"number",required:1}, {label:"Certificate",type:"menulist",list:certs,required:1}]);
        if (!values) return;
        var me = this;
        this.core.api.setLoadBalancerListenerSSLCertificate(elb.name, values[0], values[1], function() { me.refresh(); });
    },

    disableStickness :function()
    {
        var elb = this.getSelected();
        if (elb == null) return;
        if (!confirm("Disable stickiness for Load balancer " + elb.name+"?")) return;
        var me = this;

        for (var i in elb.lbStickinessPolicies) {
            this.core.api.deleteLoadBalancerPolicy(elb.name, elb.lbStickinessPolicies[i].name, function() { me.refresh(); });
        }
        for (var i in elb.appStickinessPolicies) {
            this.core.api.deleteLoadBalancerPolicy(elb.name, elb.appStickinessPolicies[i].name, function() { me.refresh(); });
        }
    },

    applicationSticknesss :function()
    {
        var elb = this.getSelected();
        if (elb == null) return;
        var name = this.core.prompt("Please provide your application cookie name:");
        if (!name) return;
        var me = this;
        this.core.api.createAppCookieStickinessPolicy(elb.name, elb.name + "-" + name + "-AppStickinessPolicy", name,function() { me.refresh(); });
    },

    loadbalancerStickness :function()
    {
        var elb = this.getSelected();
        if (elb == null) return;
        var period = this.core.prompt("Please provide your Cookie Expiration Period in seconds:");
        if (!period) return;
        if (!/^[0-9]+$/.test(period)) {
            alert('Cookie expiration period must be a number of seconds.');
            return;
        }
        var me = this;
        this.core.api.createLBCookieStickinessPolicy(elb.name, elb.name + "-"+ period + "-LBStickinessPolicy", period, function() { me.refresh(); });
    },

    menuChanged : function(){
        var elb = this.getSelected();
        if (!elb) return;
        document.getElementById("loadbalancer.context.disablestickness").disabled = !elb.appStickinessPolicies && !elb.lbStickinessPolicies;
        document.getElementById("loadbalancer.context.instances").disabled = elb.Instances.length == 0 ? true : false;
        document.getElementById("loadbalancer.context.disablezones").disabled = elb.zones.length > 1 ? false : true;
        document.getElementById("loadbalancer.context.enableezones").disabled = elb.vpcId != '' ? true : false;
        document.getElementById("loadbalancer.context.changegroups").disabled = elb.vpcId != '' ? false : true;

        document.getElementById("loadbalancer.context.addsubnet").disabled = elb.vpcId != '' ? false : true;
        document.getElementById("loadbalancer.context.delsubnet").disabled = elb.subnets && elb.subnets.length ? false : true;
    },

    changeSecurityGroup: function() {
        var elb = this.getSelected();
        if (!elb) return;
        var groups = this.core.queryModel('securityGroups', 'vpcId', elb.vpcId);
        var list = this.core.promptList('Change Security Groups', 'Select security groups for load balancer:', groups, { multiple: true });
        if (!list || !list.length) return;
        var me = this;
        groups = [];
        for (var i in list) {
            groups.push(list[i].id);
        }
        this.core.api.applySecurityGroupsToLoadBalancer(elb.name, groups, function() { me.refresh();});
    },

    addSubnet: function()
    {
        var me = this;
        var elb = this.getSelected();
        if (!elb) return;
        var list = [];
        var subnets = this.core.queryModel('subnets', 'vpcId', elb.vpcId);
        for (var i in subnets) {
            if (elb.subnets.indexOf(subnets[i].id) >= 0) continue;
            list.push(subnets[i]);
        }
        if (list.length == 0) {
            alert('No available subnets to attach to');
            return;
        }
        list = this.core.promptList('Attach to Subnets', 'Select subnets to attach this load balancer to', list, { multiple: true });
        if (!list || !list.length) return;
        subnets = [];
        for (var i in list) {
            subnets.push(list[i].id);
        }
        this.core.api.attachLoadBalancerToSubnets(elb.name, subnets, function() { me.refresh(); });
    },

    deleteSubnet: function()
    {
        var me = this;
        var elb = this.getSelected();
        if (!elb || !elb.subnets || !elb.subnets.length) return;
        var list = [];
        var subnets = this.core.queryModel('subnets', 'vpcId', elb.vpcId);
        for (var i in subnets) {
            if (elb.subnets.indexOf(subnets[i].id) == -1) continue;
            list.push(subnets[i]);
        }
        list = this.core.promptList('Detach from Subnets', 'Select subnets to dettach from this load balancer', list, { multiple: true });
        if (!list || !list.length) return;
        subnets = [];
        for (var i in list) {
            subnets.push(list[i].id);
        }
        this.core.api.dettachLoadBalancerFromSubnets(elb.name, subnets, function() { me.refresh(); });
    },
};

var ew_InstanceHealthTreeView = {
    name: "instanceHealth",
};

var ew_AvailZoneTreeView = {
    model: 'availabilityZones',
};
