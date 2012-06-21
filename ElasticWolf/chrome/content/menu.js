var ew_menu = {
    // Order of te tabs should match order of tabpanels
    tabs: [
            { name: "ew.tabs.prefs",         views: [ { view: ew_PrefsView } ] },

            { name: "ew.tabs.credential",    views: [ { id: "ew.credentials.view", view: ew_CredentialsTreeView },
                                                      { id: "ew.endpoints.view", view: ew_EndpointsTreeView }] },

            { name: "ew.tabs.policy",        views: [ { view: ew_PasswordPolicyView } ] },

            { name: "ew.tabs.iam.folder",    views: [ { view: ew_AccountSummaryView } ] },

            { name: "ew.tabs.vmfa",          views: [ { id: "ew.vmfas.view", view: ew_VMFATreeView } ] },

            { name: "ew.tabs.instance",      views: [ { id: "ew.instances.view", view: ew_InstancesTreeView, filterList: [ { name: "vpcId", empty: true }] } ], },

            { name: "ew.tabs.vpcinstance",   views: [ { id: "ew.instances.view", view: ew_InstancesTreeView, filterList: [ { name: "vpcId", empty: false }] } ],
              owner: "ew.tabs.instance"  },

            { name: "ew.tabs.image",         views: [ { id: "ew.images.view", view: ew_AMIsTreeView } ], },

            { name: "ew.tabs.access",        views: [ { id: "ew.accesskeys.view", view: ew_AccessKeysTreeView },
                                                      { id: "ew.keypairs.view", view: ew_KeypairsTreeView, } ], },

            { name: "ew.tabs.cert",          views: [  { id: "ew.certs.view", view: ew_CertsTreeView },
                                                       { id: "ew.serverCerts.view", view: ew_ServerCertsTreeView }] },

            { name: "ew.tabs.users",         views: [ { id: "ew.users.view", view: ew_UsersTreeView, }, ] },

            { name: "ew.tabs.groups",        views: [ { id: "ew.groups.view", view: ew_GroupsTreeView, },
                                                      { id: "ew.groupUsers.view", view: ew_GroupUsersTreeView, }, ] },

            { name: "ew.tabs.securitygroup", views: [ { id: "ew.securitygroups.view", view: ew_SecurityGroupsTreeView, filterList: [ { name: "vpcId", empty: true }] },
                                                      { id: "ew.permissions.view", view: ew_PermissionsTreeView }], },

            { name: "ew.tabs.vpcgroup",      views: [ { id: "ew.securitygroups.view", view: ew_SecurityGroupsTreeView, filterList: [ { name: "vpcId", empty: false }] },
                                                      { id: "ew.permissions.view", view: ew_PermissionsTreeView }],
              owner: "ew.tabs.securitygroup"
            },

            { name: "ew.tabs.eip",           views: [ { id: "ew.eip.view", view: ew_ElasticIPTreeView, filterList: [ { name: "domain", value: "standard" }] }], },

            { name: "ew.tabs.vpceip",        views: [ { id: "ew.eip.view", view: ew_ElasticIPTreeView, filterList: [ { name: "domain", value: "vpc" }] }],
              owner: "ew.tabs.eip"
            },

            { name: "ew.tabs.volume",        views: [ { id: "ew.volumes.view", view: ew_VolumeTreeView }], },

            { name: "ew.tabs.snapshot",      views: [ { id: "ew.snapshots.view", view: ew_SnapshotTreeView }], },

            { name: "ew.tabs.loadbalancer",  views: [ { id: "ew.loadbalancer.view", view: ew_LoadbalancerTreeView, filterList: [ { name: "vpcId", empty: true }] },
                                                      { id: "ew.instancehealth.view", view: ew_InstanceHealthTreeView }], },

            { name: "ew.tabs.vpcelb",        views: [ { id: "ew.loadbalancer.view", view: ew_LoadbalancerTreeView, filterList: [ { name: "vpcId", empty: false }] },
                                                      { id: "ew.instancehealth.view", view: ew_InstanceHealthTreeView }],
              owner: "ew.tabs.loadbalancer"
            },

            { name: "ew.tabs.bundletask",    views: [ { id: "ew.bundleTasks.view", view: ew_BundleTasksTreeView } ], },

            { name: "ew.tabs.vpc",           views: [ { id: "ew.vpcs.view", view: ew_VpcTreeView }, ] },

            { name: "ew.tabs.dhcp",          views: [ { id: "ew.dhcpOptions.view", view: ew_DhcpoptsTreeView } ], },

            { name: "ew.tabs.lease",         views: [ { id: "ew.offerings.view", view: ew_LeaseOfferingsTreeView },
                                                      { id: "ew.reservedInstances.view", view: ew_ReservedInstancesTreeView } ], },

            { name: "ew.tabs.subnet",        views: [ { id: "ew.subnets.view", view: ew_SubnetsTreeView },
                                                     { id: "ew.subnetroutes.view", view: ew_SubnetRoutesTreeView },
                                                     { id: "ew.subnetacls.view", view: ew_SubnetAclRulesTreeView } ], },

            { name: "ew.tabs.routing",       views: [ { id: "ew.routetables.view", view: ew_RouteTablesTreeView },
                                                     { id: "ew.routes.view", view: ew_RoutesTreeView },
                                                     { id: "ew.route.associations.view", view: ew_RouteAssociationsTreeView }, ], },

            { name: "ew.tabs.igw",           views: [ { id: "ew.internetgateways.view", view : ew_InternetGatewayTreeView } ], },

            { name: "ew.tabs.acl",           views: [ { id: "ew.acls.view", view: ew_NetworkAclsTreeView } ,
                                                     { id: "ew.acls.associations.view", view: ew_NetworkAclAssociationsTreeView },
                                                     { id: "ew.acls.rules.view", view: ew_NetworkAclRulesTreeView }], },

            { name: "ew.tabs.eni",           views: [ { id: "ew.enis.view", view: ew_NetworkInterfacesTreeView },] },

            { name: "ew.tabs.vgw",           views: [ { id: "ew.vpnGateways.view", view: ew_VpnGatewayTreeView },
                                                     { id: "ew.vpnattachments.view", view: ew_VpnAttachmentTreeView } ], },

            { name: "ew.tabs.vpn",           views: [ { id: "ew.vpnconnections.view", view: ew_VpnConnectionTreeView } ] },

            { name: "ew.tabs.cgw",           views: [ { id: "ew.customergateways.view", view: ew_CustomerGatewayTreeView },] },

            { name: "ew.tabs.availzone",     views: [ { id: "ew.azones.view", view: ew_AvailZoneTreeView }], },

            { name: "ew.tabs.s3",            views: [ { id: "ew.s3Buckets.view", view: ew_S3BucketsTreeView }], },

            { name: "ew.tabs.alarm",         views: [ { id: "ew.alarms.view", view: ew_AlarmsTreeView }], },
    ],

    init: function() {
        this.tree = $('ew.menu')
        for (var i in this.tabs) {
            // Because owner refers to the real panel need to skip it
            if (this.tabs[i].owner) continue;
            for (var v in this.tabs[i].views) {
                var id = this.tabs[i].views[v].id;
                if (!id) continue;
                var tree = $(id);
                if (!tree) {
                    debug('view not found ' + id);
                    continue;
                }
                this.tabs[i].views[v].view.init(tree, this.tabs[i]);
            }
        }
    },

    get: function(name) {
        for (var i in this.tabs) {
            if (this.tabs[i].name == name) return this.tabs[i];
        }
        return null;
    },

    getCurrent: function() {
        return this.get(this.current);
    },

    select: function(name)
    {
        var tab = this.get(name);
        if (!tab) return false;

        // Deactivate current tab
        var curtab = this.getCurrent();
        if (curtab) {
            for (var i in curtab.views) {
                curtab.views[i].view.deactivate();
            }
        }

        // Activate new tab
        var idx = this.getMenu(name);
        if (idx == -1) {
            debug('menu not found ' + name)
            return false;
        }
        this.tree.currentIndex = idx;
        this.tree.view.selection.select(idx);
        this.current = name;
        $("ew.tabs").selectedPanel = $(tab.owner || name);

        // Activate and refresh if no records yet
        for (var i in tab.views) {
            debug('activate ' + tab.views[i].id + ", rows=" + tab.views[i].view.rowCount)
            tab.views[i].view.activate();
            // Assign new filter list and refresh contents
            tab.views[i].view.filterList = tab.views[i].filterList;
            tab.views[i].view.invalidate();
        }
        // Non view tabs cannot be selected
        if (tab.call) {
            tab.call();
            return false;
        }
        return true;
    },

    isViewVisible: function(view)
    {
        for (var i in this.tabs) {
            for (var j in this.tabs[i].views) {
                if (this.tabs[i].views[j].view == view) return true
            }
        }
        return false;
    },

    getSelected: function()
    {
        return this.tree.currentIndex >= 0 ? this.get(this.tree.view.getCellValue(this.tree.currentIndex, this.tree.columns[0])) : null;
    },

    getMenu: function(id)
    {
        for (var i = 0; i < this.tree.view.rowCount; i++) {
            var val = this.tree.view.getCellValue(i, this.tree.columns[0]);
            if (val == id) return i;
        }
        return -1;
    },

    openClose: function(event)
    {
        var id = this.tree.view.getCellValue(this.tree.currentIndex, this.tree.columns[0]);
        if (id == "" || id.indexOf(".folder") > 0) {
            var label = this.tree.view.getCellText(this.tree.currentIndex, this.tree.columns[0]).replace(/[()]+/g, '');
            this.tree.view.setCellText(this.tree.currentIndex, this.tree.columns[0], this.tree.view.isContainerOpen(this.tree.currentIndex) ? label : "(" + label + ")");
        }
    },

    selectionChanged: function(event)
    {
        var id = this.tree.view.getCellValue(this.tree.currentIndex, this.tree.columns[0]);
        ew_session.selectTab(id);
    },

    update: function() {
        var idx = this.getMenu("ew.tabs.credential")
        if (idx > 0) {
            var cred = ew_session.getActiveCredentials();
            var endpoint = ew_session.getActiveEndpoint();
            var label = cred ? 'Credentials: ' + cred.name + (endpoint ? "/" + endpoint.name : "") : "Manage Credentials";
            this.tree.view.setCellText(idx, this.tree.columns[0], label);
        }
    },

};

