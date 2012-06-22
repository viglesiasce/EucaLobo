var ew_LoadbalancerTreeView = {
    model: ["loadBalancers", "availabilityZones", "instances" ],

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
            this.session.api.describeInstanceHealth(elb.name, function(list) { ew_InstanceHealthTreeView.display(list); });
        }
    },

    deleteLoadBalancer : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        if (!confirm("Delete Loadbalancer "+elb.name+"?")) return;
        var me = this;
        this.session.api.deleteLoadBalancer(elb.name, function () { me.refresh() });
    },

    create: function() {
        var tab = ew_menu.getCurrent();
        var retVal = {ok:null, vpc: tab && tab.name.match("vpc") };
        window.openDialog("chrome://ew/content/dialogs/create_loadbalancer.xul",null,"chrome,centerscreen,modal,resizable",ew_session,retVal);
        var me = this;
        if (retVal.ok) {
            this.session.api.createLoadBalancer(retVal.name,retVal.Protocol,retVal.elbport,retVal.instanceport,retVal.Zone,retVal.subnetId,retVal.groups, function() {
                this.session.api.configureHealthCheck(retVal.name,retVal.Target,retVal.Interval,retVal.Timeout,retVal.HealthyThreshold,retVal.UnhealthyThreshold, function() {
                    if (retVal.instances.length > 0) {
                        this.session.api.registerInstancesWithLoadBalancer(retVal.name, retVal.instances, function() { me.refresh() });
                    } else {
                        me.refresh();
                    }
                });
            });
        }
     },

     ConfigureHealthCheck: function() {
        var elb = this.getSelected();
        if (elb == null) return;
        var retVal = {ok:null};
        window.openDialog("chrome://ew/content/dialogs/configure_healthcheck.xul",null,"chrome,centerscreen,modal,resizable",elb,retVal);
        var me = this;
        if (retVal.ok) {
            this.session.api.configureHealthCheck(elb.name,retVal.Target,retVal.Interval,retVal.Timeout,retVal.HealthyThreshold,retVal.UnhealthyThreshold,function() { me.refresh(); });
        }
    },

    registerinstances : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var instances = [];
        if (elb.vpcId) {
            instances = ew_model.get('instances', 'state', 'running', 'vpcId', elb.vpcId);
        } else {
            instances = ew_model.get('instances', 'state', 'running');
        }
        var list = ew_session.promptList('Register Instances', 'Select instances to register with this load balancer:', instances, null, null, true);
        if (!list || !list.length) return;
        var me = this;
        instances = []
        for (var i in list) {
            instances.push(list[i].id)
        }
        this.session.api.registerInstancesWithLoadBalancer(elb.name, instances, function() { me.refresh() });
    },

    deregisterinstances : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var instances = [];
        for (var  i in elb.Instances) {
            instances.push(ew_model.find('instances', elb.Instances[i]))
        }
        var list = ew_session.promptList('Deregister Instances', 'Select instances to deregister with this load balancer:', instances, null, null, true);
        if (!list || !list.length) return;
        var me = this;
        instances = []
        for (var i in list) {
            instances.push(list[i].id)
        }
        this.session.api.deregisterInstancesWithLoadBalancer(elb.name, instances, function() { me.refresh() });
    },

    manageZones : function(enable) {
        var elb = this.getSelected();
        if (elb == null) return;
        var zones = ew_model.get('availabilityZones');
        var checked = [];
        if (enable) {
            for (var i in zones) {
                if (elb.zones.indexOf(zones[i].name) >= 0) {
                    checked.push(zones[i]);
                }
            }
        }
        var list = ew_session.promptList((enable ? "Enable" : "Disable") + 'Availability Zones', 'Select Zones to ' + (enable ? "enable" : "disable") + ' for this load balancer:', zones, null, null, true, checked);
        if (!list || !list.length) return;
        var zonelist = []
        for (var i in list) {
            zonelist.push(list[i].name);
        }
        var me = this;
        if (enable) {
            this.session.api.enableAvailabilityZonesForLoadBalancer(elb.name, zonelist, function() { me.refresh() });
        } else {
            this.session.api.disableAvailabilityZonesForLoadBalancer(elb.name, zonelist, function() { me.refresh() });
        }
    },

    disablestickness :function(){
        var elb = this.getSelected();
        if (elb == null) return;
        if (!confirm("Disable stickiness for Load balancer " + elb.name+"?")) return;
        var me = this;

        if (elb.APolicyName == "") {
            var policy = elb.CPolicyName;
            this.session.api.DeleteLoadBalancerPolicy(elb.name,policy, function() { me.refresh(); });
        } else {
            var policy = elb.APolicyName;
            this.session.api.DeleteLoadBalancerPolicy(elb.name,policy, function() { me.refresh(); });
        }
    },

    applicationsticknesss :function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var loadbalancername = elb.name;
        var cname = elb.CookieName;
        var policy = elb.APolicyName;
        if (cname){
            this.session.api.DeleteLoadBalancerPolicy(elb.name,policy);
        }
        var CookieName = prompt("Please provide your application cookie name:");
        if (CookieName == null) return;
        CookieName = CookieName.trim();
        if (!CookieName) {
            alert('Invalid cookie name.');
            return;
        }
        var me = this;
        this.session.api.CreateAppCookieSP(loadbalancername,CookieName,function() { me.refresh() });
    },

    loadbalancerstickness :function(){
        var elb = this.getSelected();
        if (elb == null) return;
        var loadbalancername = elb.name;
        var policy = elb.CPolicyName;
        var CookieExpirationPeriod = elb.CookieExpirationPeriod;
        if (CookieExpirationPeriod){
           this.session.api.DeleteLoadBalancerPolicy(elb.name,policy);
        }
        var CookieExpirationPeriod = prompt("Please provide your Cookie Expiration Period:");
        if (CookieExpirationPeriod == null) return;
        CookieExpirationPeriod = CookieExpirationPeriod.trim();

        if (!/^[0-9]+$/.test(CookieExpirationPeriod)) {
            alert('Cookie expiration period must be long integer.');
            return;
        }
        var me = this;
        this.session.api.CreateLBCookieSP(loadbalancername,CookieExpirationPeriod, function() { me.refresh(); });
    },

    menuChanged : function(){
        var elb = this.getSelected();
        if (elb == null) return;
        document.getElementById("loadbalancer.tree.contextmenu").disabled = true;
        document.getElementById("loadbalancer.context.appstickness").disabled = !elb.CookieName ? true : false;
        document.getElementById("loadbalancer.context.lbstickness").disabled = !elb.CookieExpirationPeriod ? true : false;
        if (!elb.CookieName && !elb.CookieExpirationPeriod) {
            document.getElementById("loadbalancer.context.disablestickness").disabled = true;
            document.getElementById("loadbalancer.context.lbstickness").disabled = false;
            document.getElementById("loadbalancer.context.appstickness").disabled = false;
        } else {
            document.getElementById("loadbalancer.context.disablestickness").disabled = false;
        }
        document.getElementById("loadbalancer.context.instances").disabled = elb.Instances.length == 0 ? true : false;
        document.getElementById("loadbalancer.context.disablezones").disabled = elb.zones.length > 1 ? false : true;
        document.getElementById("loadbalancer.context.enableezones").disabled = elb.vpcId != '' ? true : false;
        document.getElementById("loadbalancer.context.changegroups").disabled = elb.vpcId != '' ? false : true;

        document.getElementById("loadbalancer.context.addsubnet").disabled = elb.vpcId != '' ? false : true;
        document.getElementById("loadbalancer.context.delsubnet").disabled = elb.subnets && elb.subnets.length ? false : true;
    },

    changeSecurityGroup: function() {
        var me = this;
        var elb = this.getSelected();
        if (!elb) return;
        var groups = ew_model.get('securityGroups', 'vpcId', elb.vpcId);
        var list = ew_session.promptList('Change Security Groups', 'Select security groups for load balancer:', groups, null, null, true);
        if (!list || !list.length) return;
        var me = this;
        groups = []
        for (var i in list) {
            groups.push(list[i].id)
        }
        this.session.api.applySecurityGroupsToLoadBalancer(elb.name, groups, function() { me.refresh();});
    },

    addSubnet: function()
    {
        var me = this;
        var elb = this.getSelected();
        if (!elb) return;
        var list = [];
        var subnets = ew_model.get('subnets', 'vpcId', elb.vpcId);
        for (var i in subnets) {
            if (elb.subnets.indexOf(subnets[i].id) >= 0) continue;
            list.push(subnets[i])
        }
        if (list.length == 0) {
            alert('No available subnets to attach to')
            return;
        }
        list = ew_session.promptList('Attach to Subnets', 'Select subnets to attach this load balancer to', list, null, null, true);
        if (!list || !list.length) return;
        subnets = []
        for (var i in list) {
            subnets.push(list[i].id)
        }
        this.session.api.attachLoadBalancerToSubnets(elb.name, subnets, function() { me.refresh() });
    },

    deleteSubnet: function()
    {
        var me = this;
        var elb = this.getSelected();
        if (!elb || !elb.subnets || !elb.subnets.length) return;
        var list = [];
        var subnets = ew_model.get('subnets', 'vpcId', elb.vpcId);
        for (var i in subnets) {
            if (elb.subnets.indexOf(subnets[i].id) == -1) continue;
            list.push(subnets[i])
        }
        list = ew_session.promptList('Detach from Subnets', 'Select subnets to dettach from this load balancer', list, null, null, true);
        if (!list || !list.length) return;
        subnets = []
        for (var i in list) {
            subnets.push(list[i].id)
        }
        this.session.api.dettachLoadBalancerFromSubnets(elb.name, subnets, function() { me.refresh() });
    },
};
ew_LoadbalancerTreeView.__proto__ = TreeView;

var ew_InstanceHealthTreeView = {
};
ew_InstanceHealthTreeView.__proto__ = TreeView;

var ew_AvailZoneTreeView = {
    model: 'availabilityZones',
};
ew_AvailZoneTreeView.__proto__ = TreeView;
