//main object that holds the current session information
var ec2ui_session = {
    accessCode : "",
    secretKey : "",
    initialized : false,
    controller : null,
    model : null,
    client : null,
    credentials : null,
    accountidmap : null,
    endpointmap : null,
    instanceTags : null,
    volumeTags : null,
    snapshotTags : null,
    imageTags : null,
    eipTags : null,
    vpcTags : null,
    subnetTags : null,
    dhcpOptionsTags : null,
    vgwTags : null,
    cgwTags : null,
    vpnTags : null,
    refreshedTabs : new Array(),

    initialize : function()
    {
        if (!this.initialized) {
            this.controller = ec2ui_controller;
            this.model = ec2ui_model;
            this.client = ec2ui_client;
            this.preferences = ec2ui_prefs;
            ec2ui_prefs.init();

            document.title = ec2ui_prefs.getAppName();
            document.getElementById("ec2ui.images.view").view = ec2ui_AMIsTreeView;
            document.getElementById("ec2ui.keypairs.view").view = ec2ui_KeypairTreeView;
            document.getElementById("ec2ui.certs.view").view = ec2ui_CertTreeView;
            document.getElementById("ec2ui.accesskeys.view").view = ec2ui_AccessKeyTreeView;
            document.getElementById("ec2ui.instances.view").view = ec2ui_InstancesTreeView;
            document.getElementById("ec2ui.securitygroups.view").view = ec2ui_SecurityGroupsTreeView;
            document.getElementById("ec2ui.permissions.view").view = ec2ui_PermissionsTreeView;
            document.getElementById("ec2ui.eip.view").view = ec2ui_ElasticIPTreeView;
            document.getElementById("ec2ui.azones.view").view = ec2ui_AvailZoneTreeView;
            document.getElementById("ec2ui.volumes.view").view = ec2ui_VolumeTreeView;
            document.getElementById("ec2ui.snapshots.view").view = ec2ui_SnapshotTreeView;
            document.getElementById("ec2ui.bundleTasks.view").view = ec2ui_BundleTasksTreeView;
            document.getElementById("ec2ui.offerings.view").view = ec2ui_LeaseOfferingsTreeView;
            document.getElementById("ec2ui.rsvdInst.view").view = ec2ui_ReservedInstancesTreeView;
            document.getElementById("ec2ui.loadbalancer.view").view = ec2ui_LoadbalancerTreeView;
            document.getElementById("ec2ui.instancehealth.view").view = ec2ui_InstanceHealthTreeView;
            document.getElementById("ec2ui.vpcs.view").view = ec2ui_VpcTreeView;
            document.getElementById("ec2ui.subnets.view").view = ec2ui_SubnetTreeView;
            document.getElementById("ec2ui.dhcpoptions.view").view = ec2ui_DhcpoptsTreeView;
            document.getElementById("ec2ui.vpngateways.view").view = ec2ui_VpnGatewayTreeView;
            document.getElementById("ec2ui.vpnconnections.view").view = ec2ui_VpnConnectionTreeView;
            document.getElementById("ec2ui.customergateways.view").view = ec2ui_CustomerGatewayTreeView;
            document.getElementById("ec2ui.vpnattachments.view").view = ec2ui_VpnAttachmentTreeView;
            document.getElementById("ec2ui.internetgateways.view").view = ec2ui_InternetGatewayTreeView;
            document.getElementById("ec2ui.routetables.view").view = ec2ui_RouteTablesTreeView;
            document.getElementById("ec2ui.routes.view").view = ec2ui_RoutesTreeView;
            document.getElementById("ec2ui.route.associations.view").view = ec2ui_RouteAssociationsTreeView;
            document.getElementById("ec2ui.acls.view").view = ec2ui_NetworkAclsTreeView;
            document.getElementById("ec2ui.acls.associations.view").view = ec2ui_NetworkAclAssociationsTreeView;
            document.getElementById("ec2ui.acls.rules.view").view = ec2ui_NetworkAclRulesTreeView;
            document.getElementById("ec2ui.enis.view").view = ec2ui_NetworkInterfacesTreeView;
            document.getElementById("ec2ui.enis.attachments.view").view = ec2ui_NetworkInterfaceAttachmentsTreeView;
            document.getElementById("ec2ui.s3.view").view = ec2ui_S3BucketsTreeView;

            // Enable about:blank to work if noscript is installed
            if ("@maone.net/noscript-service;1" in Components.classes) {
                (Components.classes["@maone.net/noscript-service;1"].getService().wrappedJSObject).setJSEnabled("about:blank", true);
            }

            this.loadAccountIdMap();
            this.loadCredentials();
            this.loadEndpointMap();
            this.switchCredentials();
            this.loadAllTags();

            this.initialized = true;
        }

        this.loadEndpointMap();
        this.switchEndpoints();
        this.args = this.parseURL();
        this.processURLArguments();
    },

    quit: function()
    {
        var app = Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup);
        app.quit(Components.interfaces.nsIAppStartup.eForceQuit);
    },

    parseURL : function()
    {
        return parseQuery(window.location.href)
    },

    processURLArguments : function()
    {
        // At this moment, we only act on the ami argument
        var fSync = false;
        var amiToLaunch = this.args.ami;
        var tabBox = document.getElementById("ec2ui.primary.tabs");
        if (amiToLaunch && amiToLaunch.match(regExs["ami"])) {
            fSync = true;
            if (tabBox.selectedIndex != 1) {
                tabBox.selectedIndex = 1;
            }
            this.showBusyCursor(true);
            // this is a synchronous call, meaning
            // an ami launch was requested
            ec2ui_AMIsTreeView.selectByImageId(amiToLaunch);
            this.showBusyCursor(false);
            ec2ui_AMIsTreeView.launchNewInstances();
        } else {
            // Since this is an async call, and the UI has
            // not switched over to the Images Tab,
            if (tabBox.selectedIndex != 1) {
                this.controller.describeImages(fSync);
            }
            this.showBusyCursor(false);
        }
    },

    addTabToRefreshList : function(tab)
    {
        log("Called by: " + tab + " to start refreshing");
        if (tab != null) {
            this.refreshedTabs[tab] = 1;
        }
    },

    removeTabFromRefreshList : function(tab)
    {
        log("Called by: " + tab + " to stop refreshing");
        if (tab != null) {
            this.refreshedTabs[tab] = 0;
        }
    },

    tabSelectionChanged : function(event)
    {
        if (!this.initialized) {
            return;
        }
        var tabs = document.getElementById("ec2ui.tabs");

        var toCall = "invalidate()";
        if (this.getActiveCredential() != null) {
            toCall = "refresh()";
        }

        // stop the refresh timers of all tabs
        for ( var tab in this.refreshedTabs) {
            if (this.refreshedTabs[tab] == 1) {
                this.refreshedTabs[tab] = 0;
                log("Stopping Refresh of tab: " + tab);
                eval(tab + ".stopRefreshTimer()");
            }
        }

        switch (tabs.selectedItem.label) {
        case 'Instances':
            eval("ec2ui_InstancesTreeView." + toCall);
            break;
        case 'Images':
            this.showBusyCursor(true);
            this.model.getSecurityGroups();
            this.model.getImages();
            this.showBusyCursor(false);
            break;
        case "Access":
            eval("ec2ui_AccessKeyTreeView." + toCall);
            eval("ec2ui_KeypairTreeView." + toCall);
            eval("ec2ui_CertTreeView." + toCall);
            break;
        case "Security Groups":
            eval("ec2ui_SecurityGroupsTreeView." + toCall);
            break;
        case "Elastic IPs":
            eval("ec2ui_ElasticIPTreeView." + toCall);
            break;
        case "Vols and Snaps":
            eval("ec2ui_VolumeTreeView." + toCall);
            eval("ec2ui_SnapshotTreeView." + toCall);
            break;
        case "BT":
            eval("ec2ui_BundleTasksTreeView." + toCall);
            break;
        case "AZ":
            eval("ec2ui_AvailZoneTreeView." + toCall);
            break;
        case "RI":
            eval("ec2ui_LeaseOfferingsTreeView." + toCall);
            eval("ec2ui_ReservedInstancesTreeView." + toCall);
            break;
        case "VPC":
            eval("ec2ui_VpcTreeView." + toCall);
            eval("ec2ui_SubnetTreeView." + toCall);
            eval("ec2ui_DhcpoptsTreeView." + toCall);
            break;
        case "VPNC":
            eval("ec2ui_VpnConnectionTreeView." + toCall);
            eval("ec2ui_VpnGatewayTreeView." + toCall);
            eval("ec2ui_CustomerGatewayTreeView." + toCall);
            eval("ec2ui_VpnAttachmentTreeView." + toCall);
            break;
        case "ELB":
            eval("ec2ui_LoadbalancerTreeView." + toCall);
            break;
        case "Routing":
            eval("ec2ui_InternetGatewayTreeView." + toCall);
            eval("ec2ui_RouteTablesTreeView." + toCall);
            break;
        case "ACLs":
            eval("ec2ui_NetworkAclsTreeView." + toCall);
            break;
        case "ENIs":
            eval("ec2ui_NetworkInterfacesTreeView." + toCall);
            break;
        case "S3":
            eval("ec2ui_S3BucketsTreeView." + toCall);
            break;
        default:
            log("This is an invalid tab: " + tabs.selectedItem.label);
            break;
        }

        ec2ui_prefs.setCurrentTab(tabs.selectedIndex);
    },

    getCredentials : function () {
        var credentials = new Array();
        var list = ec2ui_session.getPasswordList("Cred:")
        for (var i = 0; i < list.length; i++) {
            var pw = list[i][1].split(";;");
            if (pw.length > 1) {
                var cred = new Credential(list[i][0].substr(5).trim(), pw[0], pw[1], pw.length > 2 ? pw[2] : "")
                credentials.push(cred);
            }
        }
        return credentials;
    },

    updateCredentials : function(cred, key, secret, endpoint)
    {
        if (cred == null || key == null || key == "" || secret == null || secret == "") {
            alert("Invalid access key given for account");
            return;
        }
        cred.accessKey = key;
        cred.secretKey = secret;
        if (endpoint) {
            cred.endPoint = endpoint;
        }
        this.saveCredentials(cred);
    },

    removeCredentials : function(cred)
    {
        this.deletePassword('Cred:' + cred.name)
    },

    saveCredentials : function(cred)
    {
        this.savePassword('Cred:' + cred.name, cred.toStr())
    },

    loadCredentials : function()
    {
        var activeCredsMenu = document.getElementById("ec2ui.active.credentials.list");
        activeCredsMenu.removeAllItems();

        var lastUsedCred = ec2ui_prefs.getLastUsedAccount();
        this.credentials = this.getCredentials();
        for ( var i in this.credentials) {
            activeCredsMenu.insertItemAt(i, this.credentials[i].name, this.credentials[i].name);
            if (lastUsedCred == this.credentials[i].name) {
                activeCredsMenu.selectedIndex = i;
            }
        }

        if (this.credentials.length == 0) {
            // invalidate all the views
            this.model.invalidate();
            // Reset the credentials stored in the client
            this.client.setCredentials("", "");
        }
    },

    getActiveCredential : function()
    {
        var activeCredsMenu = document.getElementById("ec2ui.active.credentials.list");

        if (this.credentials != null && this.credentials.length > 0) {
            if (activeCredsMenu.selectedIndex == -1) {
                activeCredsMenu.selectedIndex = 0;
            }
            return this.credentials[activeCredsMenu.selectedIndex];
        }
        return null;
    },

    switchCredentials : function(cred)
    {
        if (!cred) {
            cred = this.getActiveCredential();
        } else {
            document.getElementById("ec2ui.active.credentials.list").value = cred.name;
        }

        if (cred != null) {
            debug("switch credentials to " + cred.name)
            ec2ui_prefs.setLastUsedAccount(cred.name);
            this.client.setCredentials(cred.accessKey, cred.secretKey);

            if (cred.endPoint && cred.endPoint != "") {
                var endpoint = new Endpoint("", cred.endPoint)
                this.client.setEndpoint(endpoint);
                var activeEndpoints = document.getElementById("ec2ui.active.endpoints.list");
                for ( var i = 0; i < activeEndpoints.itemCount; i++) {
                    if (activeEndpoints.getItemAtIndex(i).value == endpoint.name) {
                        activeEndpoints.selectedIndex = i
                    }
                }
                if (activeEndpoints.value != endpoint.name) {
                    activeEndpoints.appendItem(endpoint.name, endpoint.name);
                    activeEndpoints.selectedIndex = activeEndpoints.itemCount - 1
                    this.endpointmap.put(endpoint.name, endpoint);
                    log("add endpoint " + endpoint.name)
                }
                ec2ui_prefs.setLastUsedEndpoint(endpoint.name);
            }
            this.loadAllTags();

            // Since we are switching creds, ensure that all the views are redrawn
            this.model.invalidate();

            // Set the active tab to the last tab we were viewing
            document.getElementById("ec2ui.tabs").selectedIndex = ec2ui_prefs.getCurrentTab();

            // The current tab's view needs to either be invalidated or refreshed
            this.tabSelectionChanged();
        }
    },

    getActiveEndpoint : function()
    {
        var activeEndpointname = document.getElementById("ec2ui.active.endpoints.list").value;
        log("active endpoint: " + activeEndpointname)
        if (activeEndpointname == null || activeEndpointname.length == 0) {
            activeEndpointname = ec2ui_prefs.getLastUsedEndpoint();
        }
        if (this.endpointmap == null) {
            return new Endpoint(activeEndpointname, ec2ui_prefs.getServiceURL());
        } else {
            return this.endpointmap.get(activeEndpointname);
        }
    },

    switchEndpoints : function()
    {
        var activeEndpoint = this.getActiveEndpoint();

        if (activeEndpoint != null) {
            ec2ui_prefs.setLastUsedEndpoint(activeEndpoint.name);
            ec2ui_prefs.setServiceURL(activeEndpoint.url);
            this.client.setEndpoint(activeEndpoint);
            this.loadAllTags();

            // Since we are switching creds, ensure that all the views are redrawn
            this.model.invalidate();

            // Set the active tab to the last tab we were viewing
            document.getElementById("ec2ui.tabs").selectedIndex = ec2ui_prefs.getCurrentTab();

            // The current tab's view needs to either
            // be invalidated or refreshed
            this.tabSelectionChanged();
        } else {
            // There are no endpoints in the system, let's ask the user to enter them
            var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
            var text = "Would you like to provide an EC2 Endpoint?";
            // if the user says no, the return value will not be 0 in this case, just fall out.
            if (promptService.confirmEx(window, "EC2 Endpoint Needed", text, promptService.STD_YES_NO_BUTTONS | promptService.BUTTON_POS_0_DEFAULT, "", "", "", null, {})) {
                // Reset the endpoint stored in the client and prefs
                this.client.setEndpoint(new Endpoint());
                ec2ui_prefs.setServiceURL("");
            } else {
                this.manageEndpoints();
            }
        }
    },

    loadEndpointMap : function()
    {
        this.endpointmap = ec2ui_prefs.getEndpointMap();
        var activeEndpointsMenu = document.getElementById("ec2ui.active.endpoints.list");
        activeEndpointsMenu.removeAllItems();
        var lastUsedEndpoint = ec2ui_prefs.getLastUsedEndpoint();
        var endpointlist = this.endpointmap.toArray(function(k, v) { return new Endpoint(k, v.url) });

        for ( var i in endpointlist) {
            activeEndpointsMenu.insertItemAt(i, endpointlist[i].name, endpointlist[i].name);
            if (lastUsedEndpoint == endpointlist[i].name) {
                activeEndpointsMenu.selectedIndex = i;
            }
        }
    },

    manageEndpoints : function()
    {
        window.openDialog("chrome://ec2ui/content/dialog_manage_endpoints.xul", null, "chrome,centerscreen,modal,resizable", this.endpointmap);
        this.loadEndpointMap();
    },

    getEndpoints : function()
    {
        return this.endpointmap.toArray(function(k, v)
        {
            return new Endpoint(k, v.url)
        });
    },

    loadAllTags : function()
    {
        this.imageTags = ec2ui_prefs.getImageTags();
        this.instanceTags = ec2ui_prefs.getInstanceTags();
        this.volumeTags = ec2ui_prefs.getVolumeTags();
        this.snapshotTags = ec2ui_prefs.getSnapshotTags();
        this.eipTags = ec2ui_prefs.getEIPTags();
        this.vpcTags = ec2ui_prefs.getVpcTags();
        this.subnetTags = ec2ui_prefs.getSubnetTags();
        this.dhcpOptionsTags = ec2ui_prefs.getDhcpOptionsTags();
        this.vpnTags = ec2ui_prefs.getVpnConnectionTags();
        this.cgwTags = ec2ui_prefs.getCustomerGatewayTags();
        this.vgwTags = ec2ui_prefs.getVpnGatewayTags();
    },

    setResourceTag : function(id, tag)
    {
        if (!tag || tag.length == 0) return;

        tag = escape(tag);
        if (id.match(ec2ui_InstancesTreeView.instanceIdRegex)) {
            this.instanceTags.put(id, tag, "setInstanceTags");
        } else
        if (id.match(ec2ui_AMIsTreeView.imageIdRegex)) {
            this.imageTags.put(id, tag, "setImageTags");
        } else
        if (id.match(ec2ui_VolumeTreeView.imageIdRegex)) {
            this.volumeTags.put(id, tag, "setVolumeTags");
        } else
        if (id.match(ec2ui_SnapshotTreeView.imageIdRegex)) {
            this.snapshotTags.put(id, tag, "setSnapshotTags");
        } else
        if (id.match(ec2ui_ElasticIPTreeView.imageIdRegex)) {
            this.eipTags.put(id, tag, "setEIPTags");
        } else
        if (id.match(ec2ui_VpcTreeView.imageIdRegex)) {
            this.vpcTags.put(id, tag, "setVpcTags");
        } else
        if (id.match(ec2ui_SubnetTreeView.imageIdRegex)) {
            this.subnetTags.put(id, tag, "setSubnetTags");
        } else
        if (id.match(ec2ui_DhcpoptsTreeView.imageIdRegex)) {
            this.dhcpOptionsTags.put(id, tag, "setDhcpOptionsTags");
        } else
        if (id.match(ec2ui_VpnConnectionTreeView.imageIdRegex)) {
            this.vpnTags.put(id, tag, "setVpnConnectionTags");
        } else
        if (id.match(ec2ui_VpnGatewayTreeView.imageIdRegex)) {
            this.vgwTags.put(id, tag, "setVpnGatewayTags");
        } else
        if (id.match(ec2ui_CustomerGatewayTreeView.imageIdRegex)) {
            this.cgwTags.put(id, tag, "setCustomerGatewayTags");
        }
    },

    getResourceTag : function(id)
    {
        var tag = "";
        if (id.match(ec2ui_InstancesTreeView.instanceIdRegex)) {
            tag = this.instanceTags.get(id);
        } else
        if (id.match(ec2ui_VolumeTreeView.imageIdRegex)) {
            tag = this.volumeTags.get(id);
        } else
        if (id.match(ec2ui_SnapshotTreeView.imageIdRegex)) {
            tag = this.snapshotTags.get(id);
        } else
        if (id.match(regExs["ami"])) {
            tag = this.imageTags.get(id);
        } else
        if (id.match(ec2ui_ElasticIPTreeView.imageIdRegex)) {
            tag = this.eipTags.get(id);
        } else
        if (id.match(ec2ui_VpcTreeView.imageIdRegex)) {
            tag = this.vpcTags.get(id);
        } else
        if (id.match(ec2ui_SubnetTreeView.imageIdRegex)) {
            tag = this.subnetTags.get(id);
        } else
        if (id.match(ec2ui_DhcpoptsTreeView.imageIdRegex)) {
            tag = this.dhcpOptionsTags.get(id);
        } else
        if (id.match(ec2ui_VpnConnectionTreeView.imageIdRegex)) {
            tag = this.vpnTags.get(id);
        } else
        if (id.match(ec2ui_VpnGatewayTreeView.imageIdRegex)) {
            tag = this.vgwTags.get(id);
        } else
        if (id.match(ec2ui_CustomerGatewayTreeView.imageIdRegex)) {
            tag = this.cgwTags.get(id);
        }

        if (tag) return unescape(tag);
        return "";
    },

    getResourceTags : function(resourceType)
    {
        switch (resourceType) {
        case this.model.resourceMap.instances:
            return this.instanceTags;
        case this.model.resourceMap.volumes:
            return this.volumeTags;
        case this.model.resourceMap.snapshots:
            return this.snapshotTags;
        case this.model.resourceMap.images:
            return this.imageTags;
        case this.model.resourceMap.eips:
            return this.eipTags;
        case this.model.resourceMap.vpcs:
            return this.vpcTags;
        case this.model.resourceMap.subnets:
            return this.subnetTags;
        case this.model.resourceMap.dhcpOptions:
            return this.dhcpOptionsTags;
        case this.model.resourceMap.vpnConnections:
            return this.vpnTags;
        case this.model.resourceMap.vpnGateways:
            return this.vgwTags;
        case this.model.resourceMap.customerGateways:
            return this.cgwTags;
        default:
            return null;
        }
    },

    setResourceTags : function(resourceType, tags)
    {
        switch (resourceType) {
        case this.model.resourceMap.instances:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setInstanceTags(tags);

            this.instanceTags = null;
            // Retrieve the appropriate data structure from the store
            this.instanceTags = ec2ui_prefs.getInstanceTags();
            break;

        case this.model.resourceMap.volumes:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setVolumeTags(tags);

            this.volumeTags = null;
            // Retrieve the appropriate data structure from the store
            this.volumeTags = ec2ui_prefs.getVolumeTags();
            break;

        case this.model.resourceMap.snapshots:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setSnapshotTags(tags);

            this.snapshotTags = null;
            // Retrieve the appropriate data structure from the store
            this.snapshotTags = ec2ui_prefs.getSnapshotTags();
            break;

        case this.model.resourceMap.images:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setImageTags(tags);

            this.imageTags = null;
            // Retrieve the appropriate data structure from the store
            this.imageTags = ec2ui_prefs.getImageTags();
            break;

        case this.model.resourceMap.eips:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setEIPTags(tags);

            this.eipTags = null;
            // Retrieve the appropriate data structure from the store
            this.eipTags = ec2ui_prefs.getEIPTags();
            break;

        case this.model.resourceMap.vpcs:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setVpcTags(tags);

            this.vpcTags = null;
            // Retrieve the appropriate data structure from the store
            this.vpcTags = ec2ui_prefs.getVpcTags();
            break;

        case this.model.resourceMap.subnets:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setSubnetTags(tags);

            this.subnetTags = null;
            // Retrieve the appropriate data structure from the store
            this.subnetTags = ec2ui_prefs.getSubnetTags();
            break;

        case this.model.resourceMap.dhcpOptions:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setDhcpOptionsTags(tags);

            this.dhcpOptionsTags = null;
            // Retrieve the appropriate data structure from the store
            this.dhcpOptionsTags = ec2ui_prefs.getDhcpOptionsTags();
            break;

        case this.model.resourceMap.vpnConnections:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setVpnConnectionTags(tags);

            this.vpnTags = null;
            // Retrieve the appropriate data structure from the store
            this.vpnTags = ec2ui_prefs.getVpnConnectionTags();
            break;

        case this.model.resourceMap.vpnGateways:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setVpnGatewayTags(tags);

            this.vgwTags = null;
            // Retrieve the appropriate data structure from the store
            this.vgwTags = ec2ui_prefs.getVpnGatewayTags();
            break;

        case this.model.resourceMap.customerGateways:
            // The Tags must first be persisted to the prefs store
            ec2ui_prefs.setCustomerGatewayTags(tags);

            this.cgwTags = null;
            // Retrieve the appropriate data structure from the store
            this.cgwTags = ec2ui_prefs.getCustomerGatewayTags();
            break;
        }
    },

    manageCredentials : function()
    {
        window.openDialog("chrome://ec2ui/content/dialog_manage_credentials.xul", null, "chrome,centerscreen, modal, resizable", ec2ui_session);
        this.loadCredentials();
    },

    manageTools : function()
    {
        window.openDialog("chrome://ec2ui/content/dialog_manage_tools.xul", null, "chrome,centerscreen,modal, resizable");
    },

    loadAccountIdMap : function()
    {
        this.accountidmap = ec2ui_prefs.getAccountIdMap();
    },

    manageAccountIds : function()
    {
        window.openDialog("chrome://ec2ui/content/dialog_manage_accountids.xul", null, "chrome,centerscreen,modal,resizable", this.accountidmap);
        this.loadAccountIdMap();
    },

    lookupAccountId : function(id)
    {
        if (this.accountidmap == null) {
            return id;
        }
        if (this.accountidmap.get(id) == null) {
            return id;
        }
        return this.accountidmap.get(id);
    },

    displayAbout : function()
    {
        window.openDialog("chrome://ec2ui/content/dialog_about.xul", null, "chrome,centerscreen,modal,resizable", this.client);
    },

    showBusyCursor : function(fShow)
    {
        if (fShow) {
            document.getElementById("ec2ui-window").setAttribute("wait-cursor", true);
        } else {
            document.getElementById("ec2ui-window").removeAttribute("wait-cursor");
        }
    },

    openMainWindow : function()
    {
        var url = "chrome://ec2ui/content/ec2ui_window.xul";
        ec2ui_prefs.init();
        if (ec2ui_prefs.isOpenInNewTabEnabled()) {
            getBrowser().selectedTab = getBrowser().addTab(url);
        } else {
            getBrowser().selectedBrowser.contentDocument.location = url;
        }
    },

    generateCertificate : function(name)
    {
        // Make sure we have directory
        if (!ec2ui_prefs.makeKeyHome()) {
            return 0
        }

        var certfile = ec2ui_prefs.getCertificateFile(name);
        var keyfile = ec2ui_prefs.getPrivateKeyFile(name);
        var pubfile = ec2ui_prefs.getPublicKeyFile(name);
        var openssl = ec2ui_prefs.getOpenSSLCommand();
        var conffile = ec2ui_prefs.getKeyHome() + DirIO.sep + "openssl.cnf"

        FileIO.remove(certfile);
        FileIO.remove(keyfile);
        FileIO.remove(pubfile);
        FileIO.remove(conffile);

        // Create openssl config file
        var confdata = "[req]\nprompt=no\ndistinguished_name=n\nx509_extensions=c\n[c]\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always,issuer\nbasicConstraints=CA:true\n[n]\nCN=EC2\nOU=EC2\nemailAddress=ec2@amazonaws.com\n"
        FileIO.write(FileIO.open(conffile), confdata)

        // Create private and cert files
        ec2ui_prefs.setEnv("OPENSSL_CONF", conffile);
        this.launchProcess(openssl, [ "genrsa", "-out", keyfile, "1024" ], true);
        if (!waitForFile(keyfile, 5000)) {
            debug("ERROR: no private key generated")
            FileIO.remove(conffile);
            return 0
        }
        FileIO.open(keyfile).permissions = 0600;

        this.launchProcess(openssl, [ "req", "-new", "-x509", "-nodes", "-sha1", "-days", "730", "-key", keyfile, "-out", certfile, "-config", conffile ], true);
        if (!waitForFile(certfile, 5000)) {
            debug("ERROR: no certificate generated")
            FileIO.remove(conffile);
            return 0
        }

        // Create public file
        this.launchProcess(openssl, [ "rsa", "-in", keyfile, "-pubout", "-out", pubfile ], true)
        // Wait a little because if process is running in the background on Windows it may take some time but we return immediately
        if (!waitForFile(pubfile, 5000)) {
            debug("ERROR: no public file generated")
            FileIO.remove(conffile);
            return 0
        }
        FileIO.remove(conffile);

        return FileIO.toString(certfile)
    },

    launchShell : function(name)
    {
        // Make sure we have directory
        if (!ec2ui_prefs.makeKeyHome()) {
            return 0
        }

        // Save current acces key into file
        FileIO.write(FileIO.open(ec2ui_prefs.getCredentialFile(name)), "AWSAccessKeyId=" + ec2ui_client.accessCode + "\nAWSSecretKey=" + ec2ui_client.secretKey + "\n")

        // Setup environment
        ec2ui_prefs.setEnv("EC2_URL", ec2ui_client.serviceURL);
        ec2ui_prefs.setEnv("EC2_PRIVATE_KEY", ec2ui_prefs.getPrivateKeyFile(name));
        ec2ui_prefs.setEnv("EC2_CERT", ec2ui_prefs.getCertificateFile(name));
        ec2ui_prefs.setEnv("AWS_CREDENTIAL_FILE", ec2ui_prefs.getCredentialFile(name));
        ec2ui_prefs.setEnv("AWS_IAM_URL", ec2ui_client.getIAMURL());

        // Current PATH
        var path = ec2ui_prefs.getEnv("PATH");
        var sep = isWindows(navigator.platform) ? ";" : ":";

        // Update path to the command line tools
        var paths = [ec2ui_prefs.JAVA_TOOLS_PATH, ec2ui_prefs.EC2_TOOLS_PATH, ec2ui_prefs.IAM_TOOLS_PATH, ec2ui_prefs.AMI_TOOLS_PATH, ec2ui_prefs.CLOUDWATCH_TOOLS_PATH, ec2ui_prefs.AWS_AUTOSCALING_TOOLS_PATH];
        for(var i in paths) {
            var p = ec2ui_prefs.getStringPreference(paths[i], "");
            if (p == "") {
                continue;
            }
            ec2ui_prefs.setEnv(paths[i].split(".").pop().toUpperCase(), p);
            path += sep + p + DirIO.sep + "bin";
        }
        debug(path)
        ec2ui_prefs.setEnv("PATH", path);
        this.launchProcess(ec2ui_prefs.getShellCommand(), []);
    },

    launchProcess : function(cmd, args, block)
    {
        debug("launch: " + cmd + " " + args.join(" "));

        var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(cmd);

        var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
        try {
            process.init(file);
        }
        catch (e) {
            alert("Couldn't launch: " + cmd + "\n\n" + e.message);
            return false;
        }

        try {
            process.run(block, args, args.length);
            debug("launch: " + cmd + " finished with status " + process.exitValue)
        }
        catch (e) {
            alert("Couldn't launch: " + cmd + "\nWith arguments: " + args.join(" ") + "\n\n" + e.message);
            return false
        }
        return true
    },

    promptList: function(title, msg, items, columns)
    {
        var list = []
        for (var i = 0; i < items.length; i++) {
            if (typeof items[i] == "object") {
                var item = ""
                for (p in items[i]) {
                    if (!columns || columns.indexOf(p) > -1) {
                        item += (item != "" ? ": " : "") + items[i][p]
                    }
                }
                list.push(item)
            } else {
                list.push(items[i])
            }
        }

        var selected = {};
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
        if (!prompts.select(null, title, msg, list.length, list, selected)) {
            return -1;
        }
        return selected.value
    },

    promptForFile : function(msg, save, filename)
    {
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, msg, save ? nsIFilePicker.modeSave : nsIFilePicker.modeOpen);
        fp.displayDirectory = FileIO.open(ec2ui_prefs.getKeyHome());
        fp.defaultString = filename || ""
        if (fp.show() != nsIFilePicker.returnCancel) {
            return fp.file.path;
        }
        return null
    },

    promptForDir : function(msg, save)
    {
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, msg, nsIFilePicker.modeGetFolder);
        fp.displayDirectory = FileIO.open(ec2ui_prefs.getKeyHome());
        if (fp.show() != nsIFilePicker.returnCancel) {
            return fp.file.path;
        }
        return null
    },

    promptYesNo : function(title, text)
    {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
        return promptService.confirmEx(window, title, text, promptService.STD_YES_NO_BUTTONS| promptService.BUTTON_POS_0_DEFAULT, "", "", "", null, {}) == 0
    },

    savePassword : function(key, secret)
    {
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
        var login = new nsLoginInfo(this.client.HOST, null, this.client.REALM, key, secret, "", "");
        var logins = loginManager.findLogins({}, this.client.HOST, "", this.client.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username == key) {
                log("modifying password: " + key)
                loginManager.modifyLogin(logins[i], login);
                return false
            }
        }
        log("adding password: " + key)
        loginManager.addLogin(login);
        return true
    },

    deletePassword : function(key)
    {
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var logins = loginManager.findLogins({}, this.client.HOST, "", this.client.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username == key) {
                log("removing password: " + key)
                loginManager.removeLogin(logins[i]);
                return true
            }
        }
        return false
    },

    getPassword : function(key)
    {
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var logins = loginManager.findLogins({}, this.client.HOST, "", this.client.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username == key) {
                return logins[i].password;
            }
        }
        return ""
    },

    getPasswordList : function(prefix)
    {
        var list = []
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var logins = loginManager.findLogins({}, this.client.HOST, "", this.client.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username.indexOf(prefix) == 0) {
                list.push([ logins[i].username, logins[i].password ])
            }
        }
        return list
    }
};
