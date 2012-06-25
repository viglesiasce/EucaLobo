
var ew_api = {
    session: null,

    // Main callback on request complete, if callback specified in the form onComplete:id,
    // then response will put value of the node 'id' in the result
    onResponseComplete : function(response)
    {
        var id = null;
        var method = response.method;
        if (!method) return;

        // Return value in response
        if (method.indexOf(":") > 0) {
            var m = method.split(":");
            method = m[0];
            id = m[1];
        }

        if (this[method]) {
            this[method](response, id);
        } else {
           alert('Error calling handler ' + response.method + ' for ' + response.action);
        }
    },

    // Common response callback when there is no need to parse result but only to call user callback
    onComplete : function(response, id)
    {
        if (id) response.result = getNodeValue(response.responseXML, id);
    },

    // Parse XML node parentNode and extract all items by itemNode tag name, if item node has multiple fields, columns may be used to restrict which
    // fields needs to be extracted and put into Javascript object as properties. If callback specified, the final object will be passed through the
    // callback as parameters which shoulkd return valid object or value to be included in the list
    getItems : function(item, parentNode, itemsNode, columns, callback)
    {
        var list = [];
        var tagSet = item.getElementsByTagName(parentNode)[0];
        if (tagSet) {
            var items = tagSet.getElementsByTagName(itemsNode);
            for (var i = 0; i < items.length; i++) {
                if (items[i].parentNode && items[i].parentNode.tagName != parentNode) continue;
                if (columns) {
                    // Return object or just plain list if columns is a string
                    if (columns instanceof Array) {
                        var obj = {};
                        for (var j in columns) {
                            var val = getNodeValue(items[i], columns[j]);
                            if (val) obj[columns[j]] = val;
                        }
                        list.push(callback ? callback(obj) : obj);
                    } else {
                        var val = getNodeValue(items[i], columns);
                        if (val) list.push(callback ? callback(val) : val);
                    }
                } else {
                    list.push(callback ? callback(items[i]) : items[i]);
                }
            }
        }
        return list;
    },

    // Retrieve all tags from the response XML structure
    getTags : function(item)
    {
        return this.getItems(item, "tagSet", "item", ["key", "value"], function(obj) { return new Tag(obj.key, obj.value)});
    },

    getGroups : function(item)
    {
        return this.getItems(item, "groupSet", "item", ["groupId", "groupName"], function(obj) { return new Group(obj.groupId, obj.groupName)});
    },

    registerImageInRegion : function(manifestPath, region, callback)
    {
        // The image's region is the same as the active region
        if (ew_session.region == region) {
            return this.registerImage(manifestPath, callback);
        }

        var endpoint = ew_session.getEndpoint(region)
        if (!endpoint) {
            return alert('Cannot determine endpoint url for ' + region);
        }
        ew_session.queryEC2InRegion(region, "RegisterImage", [ [ "ImageLocation", manifestPath ] ], this, false, "onComplete", callback, endpoint.url);
    },

    registerImage : function(manifestPath, callback)
    {
        ew_session.queryEC2("RegisterImage", [ [ "ImageLocation", manifestPath ] ], this, false, "onComplete", callback);
    },

    registerImageFromSnapshot : function(snapshotId, amiName, amiDescription, architecture, kernelId, ramdiskId, deviceName, deleteOnTermination, callback)
    {
        var params = [];

        params.push([ 'Name', amiName ]);
        amiDescription && params.push([ 'Description', amiDescription ]);
        params.push([ 'Architecture', architecture ]);
        kernelId && params.push([ 'KernelId', kernelId ]);
        ramdiskId && params.push([ 'RamdiskId', ramdiskId ]);
        params.push([ 'RootDeviceName', deviceName ]);
        params.push([ 'BlockDeviceMapping.1.DeviceName', deviceName ]);
        params.push([ 'BlockDeviceMapping.1.Ebs.SnapshotId', snapshotId ]);
        params.push([ 'BlockDeviceMapping.1.Ebs.DeleteOnTermination', deleteOnTermination ]);

        ew_session.queryEC2("RegisterImage", params, this, false, "onComplete", callback);
    },

    deregisterImage : function(imageId, callback)
    {
        ew_session.queryEC2("DeregisterImage", [ [ "ImageId", imageId ] ], this, false, "onComplete", callback);
    },

    createSnapshot : function(volumeId, callback)
    {
        ew_session.queryEC2("CreateSnapshot", [ [ "VolumeId", volumeId ] ], this, false, "onComplete", callback);
    },

    attachVolume : function(volumeId, instanceId, device, callback)
    {
        var params = []
        if (volumeId != null) params.push([ "VolumeId", volumeId ]);
        if (instanceId != null) params.push([ "InstanceId", instanceId ]);
        if (device != null) params.push([ "Device", device ]);
        ew_session.queryEC2("AttachVolume", params, this, false, "onComplete", callback);
    },

    createVolume : function(size, snapshotId, zone, callback)
    {
        var params = []
        if (size != null) params.push([ "Size", size ]);
        if (snapshotId != null) params.push([ "SnapshotId", snapshotId ]);
        if (zone != null) params.push([ "AvailabilityZone", zone ]);
        ew_session.queryEC2("CreateVolume", params, this, false, "onComplete", callback);
    },

    deleteSnapshot : function(snapshotId, callback)
    {
        ew_session.queryEC2("DeleteSnapshot", [ [ "SnapshotId", snapshotId ] ], this, false, "onComplete", callback);
    },

    deleteVolume : function(volumeId, callback)
    {
        ew_session.queryEC2("DeleteVolume", [ [ "VolumeId", volumeId ] ], this, false, "onComplete", callback);
    },

    detachVolume : function(volumeId, callback)
    {
        ew_session.queryEC2("DetachVolume", [ [ "VolumeId", volumeId ] ], this, false, "onComplete", callback);
    },

    forceDetachVolume : function(volumeId, callback)
    {
        ew_session.queryEC2("DetachVolume", [ [ "VolumeId", volumeId ], [ "Force", true ] ], this, false, "onComplete", callback);
    },

    describeVolumes : function(callback)
    {
        ew_session.queryEC2("DescribeVolumes", [], this, false, "onCompleteDescribeVolumes", callback);
    },

    onCompleteDescribeVolumes : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "volumeSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "volumeId");
            var size = getNodeValue(item, "size");
            var snapshotId = getNodeValue(item, "snapshotId");

            var zone = getNodeValue(item, "availabilityZone");
            var status = getNodeValue(item, "status");
            var createTime = new Date();
            createTime.setISO8601(getNodeValue(item, "createTime"));

            // Zero out the values for attachment
            var instanceId = "";
            var device = "";
            var attachStatus = "";
            var attachTime = new Date();
            // Make sure there is an attachment
            if (item.getElementsByTagName("attachmentSet")[0].firstChild) {
                instanceId = getNodeValue(item, "instanceId");
                device = getNodeValue(item, "device");
                attachStatus = item.getElementsByTagName("status")[1].firstChild;
                if (attachStatus) {
                    attachStatus = attachStatus.nodeValue;
                }
                attachTime.setISO8601(getNodeValue(item, "attachTime"));
            }
            var tags = this.getTags(item);
            list.push(new Volume(id, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, tags));
        }

        this.session.model.set('volumes', list);
        response.result = list;
    },

    describeSnapshots : function(callback)
    {
        ew_session.queryEC2("DescribeSnapshots", [], this, false, "onCompleteDescribeSnapshots", callback);
    },

    onCompleteDescribeSnapshots : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "snapshotSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "snapshotId");
            var volumeId = getNodeValue(item, "volumeId");
            var status = getNodeValue(item, "status");
            var startTime = new Date();
            startTime.setISO8601(getNodeValue(item, "startTime"));
            var progress = getNodeValue(item, "progress");
            var volumeSize = getNodeValue(item, "volumeSize");
            var description = getNodeValue(item, "description");
            var ownerId = getNodeValue(item, "ownerId")
            var ownerAlias = getNodeValue(item, "ownerAlias")
            var tags = this.getTags(item);
            list.push(new Snapshot(id, volumeId, status, startTime, progress, volumeSize, description, ownerId, ownerAlias, tags));
        }

        this.session.model.set('snapshots', list);
        response.result = list;
    },

    describeSnapshotAttribute: function(id, callback) {
        ew_session.queryEC2("DescribeSnapshotAttribute", [ ["SnapshotId", id], ["Attribute", "createVolumePermission"] ], this, false, "onCompleteDescribeSnapshotAttribute", callback);
    },

    onCompleteDescribeSnapshotAttribute : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var id = getNodeValue(xmlDoc, "snapshotId");

        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var group = getNodeValue(items[i], "group");
            var user = getNodeValue(items[i], "userId");
            if (group != '') {
                list.push({ id: group, type: 'Group', snapshotId: snapshotId })
            } else
            if (user != '') {
                list.push({ id: user, type: 'UserId', snapshotId: snapshotId })
            }
        }

        response.result = list;
    },

    modifySnapshotAttribute: function(id, add, remove, callback) {
        var params = [ ["SnapshotId", id]]

        // Params are lists in format: [ { "UserId": user} ], [ { "Group": "all" }]
        if (add) {
            for (var i = 0; i < add.length; i++) {
                params.push(["CreateVolumePermission.Add." + (i + 1) + "." + add[i][0], add[i][1] ])
            }
        }
        if (remove) {
            for (var i = 0; i < remove.length; i++) {
                params.push(["CreateVolumePermission.Remove." + (i + 1) + "." + remove[i][0], remove[i][1] ])
            }
        }
        ew_session.queryEC2("ModifySnapshotAttribute", params, this, false, "onComplete", callback);
    },

    describeVpcs : function(callback)
    {
        ew_session.queryEC2("DescribeVpcs", [], this, false, "onCompleteDescribeVpcs", callback);
    },

    onCompleteDescribeVpcs : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "vpcSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "vpcId");
            var cidr = getNodeValue(item, "cidrBlock");
            var state = getNodeValue(item, "state");
            var dhcpopts = getNodeValue(item, "dhcpOptionsId");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var tags = this.getTags(item);
            list.push(new Vpc(id, cidr, state, dhcpopts, tenancy, tags));
        }
        this.session.model.set('vpcs', list);
        response.result = list;
    },

    createVpc : function(cidr, tenancy, callback)
    {
        var params = [ [ "CidrBlock", cidr ] ];
        if (tenancy) params.push([ "InstanceTenancy", tenancy ]);
        ew_session.queryEC2("CreateVpc", params, this, false, "onComplete:vpcId", callback);
    },

    deleteVpc : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpc", [ [ "VpcId", id ] ], this, false, "onComplete", callback);
    },

    describeSubnets : function(callback)
    {
        ew_session.queryEC2("DescribeSubnets", [], this, false, "onCompleteDescribeSubnets", callback);
    },

    onCompleteDescribeSubnets : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "subnetSet", "item");
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "subnetId");
            var vpcId = getNodeValue(item, "vpcId");
            var cidrBlock = getNodeValue(item, "cidrBlock");
            var state = getNodeValue(item, "state");
            var availableIp = getNodeValue(item, "availableIpAddressCount");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var tags = this.getTags(item);
            list.push(new Subnet(id, vpcId, cidrBlock, state, availableIp, availabilityZone, tags));
        }
        this.session.model.set('subnets', list);
        response.result = list;
    },

    createSubnet : function(vpcId, cidr, az, callback)
    {
        ew_session.queryEC2("CreateSubnet", [ [ "CidrBlock", cidr ], [ "VpcId", vpcId ], [ "AvailabilityZone", az ] ], this, false, "onComplete:subnetId", callback);
    },

    deleteSubnet : function(id, callback)
    {
        ew_session.queryEC2("DeleteSubnet", [ [ "SubnetId", id ] ], this, false, "onComplete", callback);
    },

    describeDhcpOptions : function(callback)
    {
        ew_session.queryEC2("DescribeDhcpOptions", [], this, false, "onCompleteDescribeDhcpOptions", callback);
    },

    onCompleteDescribeDhcpOptions : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "dhcpOptionsSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "dhcpOptionsId");
            var options = new Array();

            var optTags = item.getElementsByTagName("dhcpConfigurationSet")[0];
            var optItems = optTags.childNodes;
            log("Parsing DHCP Options: " + optItems.length + " option sets");

            for ( var j = 0; j < optItems.length; j++) {
                if (optItems.item(j).nodeName == '#text') continue;
                var key = getNodeValue(optItems.item(j), "key");
                var values = new Array();

                var valtags = optItems.item(j).getElementsByTagName("valueSet")[0];
                var valItems = valtags.childNodes;
                log("Parsing DHCP Option " + key + ": " + valItems.length + " values");

                for ( var k = 0; k < valItems.length; k++) {
                    if (valItems.item(k).nodeName == '#text') continue;
                    values.push(getNodeValue(valItems.item(k), "value"));
                }
                options.push(key + " = " + values.join(","))
            }
            var tags = this.getTags(item);
            list.push(new DhcpOptions(id, options.join("; "), tags));
        }
        this.session.model.set('dhcpOptions', list);
        response.result = list;
    },

    associateDhcpOptions : function(dhcpOptionsId, vpcId, callback)
    {
        ew_session.queryEC2("AssociateDhcpOptions", [ [ "DhcpOptionsId", dhcpOptionsId ], [ "VpcId", vpcId ] ], this, false, "onComplete", callback);
    },

    createDhcpOptions : function(opts, callback)
    {
        var params = new Array();

        for ( var i = 0; i < opts.length; i++) {
            if (opts[i][1] == null || opts[i][1].length == 0) continue;

            params.push([ "DhcpConfiguration." + (i + 1) + ".Key", opts[i][0] ]);
            for ( var j = 0; j < opts[i][1].length; j++) {
                params.push([ "DhcpConfiguration." + (i + 1) + ".Value." + (j + 1), opts[i][1][j] ]);
            }
        }

        ew_session.queryEC2("CreateDhcpOptions", params, this, false, "onComplete", callback);
    },

    deleteDhcpOptions : function(id, callback)
    {
        ew_session.queryEC2("DeleteDhcpOptions", [ [ "DhcpOptionsId", id ] ], this, false, "onComplete", callback);
    },

    createNetworkAclEntry : function(aclId, num, proto, action, egress, cidr, var1, var2, callback)
    {
        var params = [ [ "NetworkAclId", aclId ] ];
        params.push([ "RuleNumber", num ]);
        params.push([ "Protocol", proto ]);
        params.push([ "RuleAction", action ]);
        params.push([ "Egress", egress ]);
        params.push([ "CidrBlock", cidr ]);

        switch (proto) {
        case "1":
            params.push([ "Icmp.Code", var1])
            params.push([ "Icmp.Type", var2])
            break;
        case "6":
        case "17":
            params.push(["PortRange.From", var1])
            params.push(["PortRange.To", var2])
            break;
        }
        ew_session.queryEC2("CreateNetworkAclEntry", params, this, false, "onComplete", callback);
    },

    deleteNetworkAclEntry : function(aclId, num, egress, callback)
    {
        ew_session.queryEC2("DeleteNetworkAclEntry", [ [ "NetworkAclId", aclId ], ["RuleNumber", num], ["Egress", egress] ], this, false, "onComplete", callback);
    },

    ReplaceNetworkAclAssociation: function(assocId, aclId, callback)
    {
        ew_session.queryEC2("ReplaceNetworkAclAssociation", [ [ "AssociationId", assocId ], ["NetworkAclId", aclId] ], this, false, "onComplete", callback);
    },

    createNetworkAcl : function(vpcId, callback)
    {
        ew_session.queryEC2("CreateNetworkAcl", [ [ "VpcId", vpcId ] ], this, false, "onComplete:networkAclId", callback);
    },

    deleteNetworkAcl : function(id, callback)
    {
        ew_session.queryEC2("DeleteNetworkAcl", [ [ "NetworkAclId", id ] ], this, false, "onComplete", callback);
    },

    describeNetworkAcls : function(callback)
    {
        ew_session.queryEC2("DescribeNetworkAcls", [], this, false, "onCompleteDescribeNetworkAcls", callback);
    },

    onCompleteDescribeNetworkAcls : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();

        var items = this.getItems(xmlDoc, "networkAclSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var entryList = [], assocList = []
            var id = getNodeValue(item, "networkAclId");
            var vpcId = getNodeValue(item, "vpcId");
            var dflt = getNodeValue(item, "default");

            var entries = item.getElementsByTagName("entrySet")[0].getElementsByTagName("item");
            for ( var j = 0; j < entries.length; j++) {
                var num = getNodeValue(entries[j], "ruleNumber");
                var proto = getNodeValue(entries[j], "protocol");
                var action = getNodeValue(entries[j], "ruleAction");
                var egress = getNodeValue(entries[j], "egress");
                var cidr = getNodeValue(entries[j], "cidrBlock");

                var icmpList = [], portList = []
                var code = getNodeValue(entries[j], "code");
                var type = getNodeValue(entries[j], "type");
                if (code != "" && type != "") {
                    icmpList.push([code, type])
                }
                var from = getNodeValue(entries[j], "from");
                var to = getNodeValue(entries[j], "to");
                if (from != "" && to != "") {
                    portList.push([from, to])
                }
                entryList.push(new NetworkAclEntry(num, proto, action, egress, cidr, icmpList, portList))
            }

            var assoc = item.getElementsByTagName("associationSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < assoc.length; j++) {
                var aid = getNodeValue(assoc[j], "networkAclAssociationId");
                var acl = getNodeValue(assoc[j], "networkAclId");
                var subnet = getNodeValue(assoc[j], "subnetId");
                assocList.push(new NetworkAclAssociation(aid, acl, subnet))
            }
            var tags = this.getTags(item);
            list.push(new NetworkAcl(id, vpcId, dflt, entryList, assocList, tags));
        }

        this.session.model.set('networkAcls', list);
        response.result = list;
    },

    describeVpnGateways : function(callback)
    {
        ew_session.queryEC2("DescribeVpnGateways", [], this, false, "onCompleteDescribeVpnGateways", callback);
    },

    onCompleteDescribeVpnGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "vpnGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "vpnGatewayId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var attachments = new Array();

            var atttags = item.getElementsByTagName("attachments")[0].getElementsByTagName("item");
            for ( var j = 0; j < atttags.length; j++) {
                var vpcId = getNodeValue(atttags[j], "vpcId");
                var attstate = getNodeValue(atttags[j], "state");
                var att = new VpnGatewayAttachment(vpcId, id, attstate);
                attachments.push(att);
            }
            list.push(new VpnGateway(id, availabilityZone, state, type, attachments));
        }
        this.session.model.set('vpnGateways', list);
        response.result = list;
    },

    createVpnGateway : function(type, az, callback)
    {
        ew_session.queryEC2("CreateVpnGateway", [ [ "Type", type ], [ "AvailabilityZone", az ] ], this, false, "onComplete:vpnGatewayId", callback);
    },

    attachVpnGatewayToVpc : function(vgwid, vpcid, callback)
    {
        ew_session.queryEC2("AttachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    detachVpnGatewayFromVpc : function(vgwid, vpcid, callback)
    {
        ew_session.queryEC2("DetachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    deleteVpnGateway : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpnGateway", [ [ "VpnGatewayId", id ] ], this, false, "onComplete", callback);
    },

    describeCustomerGateways : function(callback)
    {
        ew_session.queryEC2("DescribeCustomerGateways", [], this, false, "onCompleteDescribeCustomerGateways", callback);
    },

    onCompleteDescribeCustomerGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "customerGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "customerGatewayId");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var ipAddress = getNodeValue(item, "ipAddress");
            var bgpAsn = getNodeValue(item, "bgpAsn");
            var tags = this.getTags(item);
            list.push(new CustomerGateway(id, ipAddress, bgpAsn, state, type, tags));
        }
        this.session.model.set('customerGateways', list);
        response.result = list;
    },

    createCustomerGateway : function(type, ip, asn, callback)
    {
        ew_session.queryEC2("CreateCustomerGateway", [ [ "Type", type ], [ "IpAddress", ip ], [ "BgpAsn", asn ] ], this, false, "onComplete:customerGatewayId", callback);
    },

    deleteCustomerGateway : function(id, callback)
    {
        ew_session.queryEC2("DeleteCustomerGateway", [ [ "CustomerGatewayId", id ] ], this, false, "onComplete", callback);
    },

    describeInternetGateways : function(callback)
    {
        ew_session.queryEC2("DescribeInternetGateways", [], this, false, "onCompleteDescribeInternetGateways", callback);
    },

    onCompleteDescribeInternetGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "internetGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var vpcId = null, tags = []
            var id = getNodeValue(item, "internetGatewayId");

            var etags = item.getElementsByTagName("attachmentSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < etags.length; j++) {
                vpcId = getNodeValue(etags[j], "vpcId");
            }
            var tags = this.getTags(item);
            list.push(new InternetGateway(id, vpcId, tags));
        }
        this.session.model.set('internetGateways', list);
        response.result = list;
    },

    createInternetGateway : function(callback)
    {
        ew_session.queryEC2("CreateInternetGateway", [], this, false, "onComplete:internetGatewayId", callback);
    },

    deleteInternetGateway : function(id, callback)
    {
        ew_session.queryEC2("DeleteInternetGateway", [ [ "InternetGatewayId", id ] ], this, false, "onComplete", callback);
    },

    attachInternetGateway : function(igwid, vpcid, callback)
    {
        ew_session.queryEC2("AttachInternetGateway", [["InternetGatewayId", igwid], ["VpcId", vpcid]], this, false, "onComplete", callback);
    },

    detachInternetGateway : function(igwid, vpcid, callback)
    {
        ew_session.queryEC2("DetachInternetGateway", [["InternetGatewayId", igwid], ["VpcId", vpcid]], this, false, "onComplete", callback);
    },

    describeVpnConnections : function(callback)
    {
        ew_session.queryEC2("DescribeVpnConnections", [], this, false, "onCompleteDescribeVpnConnections", callback);
    },

    onCompleteDescribeVpnConnections : function(response)
    {
        var xmlDoc = response.responseXML;

        // required due to the size of the customer gateway config
        // being very close to or in excess of 4096 bytes
        xmlDoc.normalize();

        var list = new Array();
        var items = this.getItems(xmlDoc, "vpnConnectionSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "vpnConnectionId");
            var cgwId = getNodeValue(item, "customerGatewayId");
            var vgwId = getNodeValue(item, "vpnGatewayId");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var ipAddress = getNodeValue(item, "ipAddress");
            // Required since Firefox limits nodeValue to 4096 bytes
            var cgwtag = item.getElementsByTagName("customerGatewayConfiguration")
            var config = null;
            if (cgwtag[0]) {
                config = cgwtag[0].textContent;
            }

            var bgpAsn = getNodeValue(item, "bgpAsn");
            var tags = this.getTags(item);
            list.push(new VpnConnection(id, vgwId, cgwId, type, state, config, tags));
        }
        this.session.model.set('vpnConnections', list);
        response.result = list;
    },

    createVpnConnection : function(type, cgwid, vgwid, callback)
    {
        ew_session.queryEC2("CreateVpnConnection", [ [ "Type", type ], [ "CustomerGatewayId", cgwid ], [ "VpnGatewayId", vgwid ] ], this, false, "onComplete:vpnConnectionId", callback);
    },

    deleteVpnConnection : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpnConnection", [ [ "VpnConnectionId", id ] ], this, false, "onComplete", callback);
    },

    unpackImage: function(item)
    {
        if (!item) return null;
        var imageId = getNodeValue(item, "imageId");
        var imageLocation = getNodeValue(item, "imageLocation");
        var imageState = getNodeValue(item, "imageState");
        var owner = getNodeValue(item, "imageOwnerId");
        var isPublic = getNodeValue(item, "isPublic");
        var platform = getNodeValue(item, "platform");
        var aki = getNodeValue(item, "kernelId");
        var ari = getNodeValue(item, "ramdiskId");
        var rdt = getNodeValue(item, "rootDeviceType");
        var rdn = getNodeValue(item, "rootDeviceName");
        var ownerAlias = getNodeValue(item, "imageOwnerAlias");
        var productCodes = this.getItems(item, "productCodes", "item", ["productCode", "type"], function(obj) { return new Group(obj.productCode, obj.type) });
        var name = getNodeValue(item, "name");
        var description = getNodeValue(item, "description");
        var snapshotId = getNodeValue(item, "snapshotId");
        var volumes = [];
        var objs = this.getItems(item, "blockDeviceMapping", "item");
        for (var i = 0; i < objs.length; i++) {
            var vdevice = getNodeValue(objs[i], "deviceName");
            var vname = getNodeValue(objs[i], "virtualName");
            var vid = getNodeValue(objs[i], "ebs", "snapshotId");
            var vsize = getNodeValue(objs[i], "ebs", "volumeSize");
            var vdel = getNodeValue(objs[i], "ebs", "deleteOnTermination");
            var nodev = objs[i].getElementsByTagName("noDevice");
            volumes.push(new BlockDeviceMapping(vdevice, vname, vid, vsize, vdel, nodev.length ? true : false));
        }
        var virtType = getNodeValue(item, 'virtualizationType');
        var hypervisor = getNodeValue(item, 'hypervisor');
        var arch = getNodeValue(item, 'architecture');
        var tags = this.getTags(item);
        return new AMI(imageId, name, description, imageLocation, imageState, (isPublic == 'true' ? 'public' : 'private'), arch, platform, aki, ari, rdt, rdn, owner, ownerAlias, snapshotId, volumes, virtType, hypervisor, productCodes, tags);
    },

    describeImage : function(imageId, callback)
    {
        ew_session.queryEC2("DescribeImages", [ [ "ImageId", imageId ] ], this, false, "onCompleteDescribeImage", callback);
    },

    onCompleteDescribeImage : function(response)
    {
        var xmlDoc = response.responseXML;
        var items = this.getItems(xmlDoc, "imagesSet", "item");
        response.result = this.unpackImage(items[0]);
    },

    createImage : function(instanceId, amiName, amiDescription, noReboot, callback)
    {
        var noRebootVal = noReboot ? "true" : "false";

        ew_session.queryEC2("CreateImage", [ [ "InstanceId", instanceId ], [ "Name", amiName ], [ "Description", amiDescription ], [ "NoReboot", noRebootVal ] ], this, false, "onCompleteCreateImage", callback);
    },

    onCompleteCreateImage: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "imageId");
    },

    describeImages : function( callback)
    {
        ew_session.queryEC2("DescribeImages", [], this, false, "onCompleteDescribeImages", callback);
    },

    onCompleteDescribeImages : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "imagesSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var ami = this.unpackImage(item);
            if (ami) list.push(ami);
        }
        this.session.model.set('images', list);
        response.result = list;
    },

    describeLeaseOfferings : function(callback)
    {
        ew_session.queryEC2("DescribeReservedInstancesOfferings", [], this, false, "onCompleteDescribeLeaseOfferings", callback);
    },

    onCompleteDescribeLeaseOfferings : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "reservedInstancesOfferingsSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "reservedInstancesOfferingId");
            var type = getNodeValue(item, "instanceType");
            var az = getNodeValue(item, "availabilityZone");
            var duration = secondsToYears(getNodeValue(item, "duration"));
            var fPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            var uPrice = getNodeValue(item, "usagePrice");
            var desc = getNodeValue(item, "productDescription");
            var otype = getNodeValue(item, "offeringType");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var rPrices = this.getItems(item, "recurringCharges", "item", ["frequency", "amount"], function(obj) { return new RecurringCharge(obj.frequency, obj.amount)});

            list.push(new LeaseOffering(id, type, az, duration, fPrice, uPrice, rPrices, desc, otype, tenancy));
        }

        this.session.model.set('offerings', list);
        response.result = list;
    },

    describeReservedInstances : function(callback)
    {
        ew_session.queryEC2("DescribeReservedInstances", [], this, false, "onCompleteDescribeReservedInstances", callback);
    },

    onCompleteDescribeReservedInstances : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "reservedInstancesSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "reservedInstancesId");
            var type = getNodeValue(item, "instanceType");
            var az = getNodeValue(item, "availabilityZone");
            var start = new Date();
            start.setISO8601(getNodeValue(item, "start"));
            var duration = secondsToYears(getNodeValue(item, "duration"));
            var fPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            var uPrice = getNodeValue(item, "usagePrice");
            var count = getNodeValue(item, "instanceCount");
            var desc = getNodeValue(item, "productDescription");
            var state = getNodeValue(item, "state");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var rPrices = this.getItems(item, "recurringCharges", "item", ["frequency", "amount"], function(obj) { return new RecurringCharge(obj.frequency, obj.amount)});

            list.push(new ReservedInstance(id, type, az, start, duration, fPrice, uPrice, rPrices, count, desc, state, tenancy));
        }

        this.session.model.set('reservedInstances', list);
        response.result = list;
    },

    purchaseOffering : function(id, count, callback)
    {
        ew_session.queryEC2("PurchaseReservedInstancesOffering", [ [ "ReservedInstancesOfferingId", id ], [ "InstanceCount", count ] ], this, false, "onComplete", callback);
    },

    describeLaunchPermissions : function(imageId, callback)
    {
        ew_session.queryEC2("DescribeImageAttribute", [ [ "ImageId", imageId ], [ "Attribute", "launchPermission" ] ], this, false, "onCompleteDescribeLaunchPermissions", callback);
    },

    onCompleteDescribeLaunchPermissions : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            if (items[i].getElementsByTagName("group")[0]) {
                list.push(getNodeValue(items[i], "group"));
            }
            if (items[i].getElementsByTagName("userId")[0]) {
                list.push(getNodeValue(items[i], "userId"));
            }
        }

        response.result = list;
    },

    addLaunchPermission : function(imageId, name, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        params.push([ "OperationType", "add" ]);
        if (name == "all") {
            params.push([ "UserGroup.1", name ]);
        } else {
            params.push([ "UserId.1", name ]);
        }
        ew_session.queryEC2("ModifyImageAttribute", params, this, false, "onComplete", callback);
    },

    revokeLaunchPermission : function(imageId, name, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        params.push([ "OperationType", "remove" ]);
        if (name == "all") {
            params.push([ "UserGroup.1", name ]);
        } else {
            params.push([ "UserId.1", name ]);
        }
        ew_session.queryEC2("ModifyImageAttribute", params, this, false, "onComplete", callback);
    },

    resetLaunchPermissions : function(imageId, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        ew_session.queryEC2("ResetImageAttribute", params, this, false, "onComplete", callback);
    },

    describeInstances : function(callback)
    {
        ew_session.queryEC2("DescribeInstances", [], this, false, "onCompleteDescribeInstances", callback);
    },

    onCompleteDescribeInstances : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "reservationSet", "item");
        for ( var k = 0; k < items.length; k++) {
            var item = items[k];
            var reservationId = getNodeValue(item, "reservationId");
            var ownerId = getNodeValue(item, "ownerId");
            var requesterId = getNodeValue(item, "requesterId");
            var groups = [];
            var objs = this.getItems(item, "groupSet", "item", ["groupId", "groupName"]);
            for (var j = 0; j < objs.length; j++) {
                groups.push(new Group(objs[j].groupId, objs[j].groupName));
            }
            var instancesSet = item.getElementsByTagName("instancesSet")[0];
            var instanceItems = instancesSet.childNodes;
            if (instanceItems) {
                for (var j = 0; j < instanceItems.length; j++) {
                    if (instanceItems[j].nodeName == '#text') continue;
                    var instance = instanceItems[j];
                    var instanceId = getNodeValue(instance, "instanceId");
                    var imageId = getNodeValue(instance, "imageId");
                    var state = getNodeValue(instance, "instanceState", "name");
                    var productCodes = this.getItems(instance, "productCodes", "item", ["productCode", "type"], function(obj) { return new Group(obj.productCode, obj.type) });
                    var allGroups = groups.concat(this.getGroups(instance));
                    var dnsName = getNodeValue(instance, "dnsName");
                    var privateDnsName = getNodeValue(instance, "privateDnsName");
                    var privateIpAddress = getNodeValue(instance, "privateIpAddress");
                    var vpcId = getNodeValue(instance, "vpcId");
                    var subnetId = getNodeValue(instance, "subnetId");
                    var keyName = getNodeValue(instance, "keyName");
                    var reason = getNodeValue(instance, "reason");
                    var amiLaunchIdx = getNodeValue(instance, "amiLaunchIndex");
                    var instanceType = getNodeValue(instance, "instanceType");
                    var launchTime = new Date();
                    launchTime.setISO8601(getNodeValue(instance, "launchTime"));
                    var availabilityZone = getNodeValue(instance, "placement", "availabilityZone");
                    var tenancy = getNodeValue(instance, "placement", "tenancy");
                    var monitoringStatus = getNodeValue(instance, "monitoring", "status");
                    var stateReason = getNodeValue(instance, "stateReason", "code");
                    var platform = getNodeValue(instance, "platform");
                    var kernelId = getNodeValue(instance, "kernelId");
                    var ramdiskId = getNodeValue(instance, "ramdiskId");
                    var rootDeviceType = getNodeValue(instance, "rootDeviceType");
                    var rootDeviceName = getNodeValue(instance, "rootDeviceName");
                    var virtType = getNodeValue(instance, 'virtualizationType');
                    var hypervisor = getNodeValue(instance, 'hypervisor');
                    var ip = getNodeValue(instance, "ipAddress");
                    var srcDstCheck = getNodeValue(instance, 'sourceDestCheck');
                    var architecture = getNodeValue(instance, "architecture");
                    var instanceLifecycle = getNodeValue(instance, "instanceLifecycle")
                    var clientToken = getNodeValue(instance, "clientToken")
                    var spotId = getNodeValue(instance ,"spotInstanceRequestId");
                    var volumes = [];
                    var objs = this.getItems(instance, "blockDeviceMapping", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var vdevice = getNodeValue(objs[i], "deviceName");
                        var vid = getNodeValue(objs[i], "ebs", "volumeId");
                        var vstatus = getNodeValue(objs[i], "ebs", "status");
                        var vtime = getNodeValue(objs[i], "ebs", "attachTime");
                        var vdel = getNodeValue(objs[i], "ebs", "deleteOnTermination");
                        volumes.push(new InstanceBlockDeviceMapping(vdevice, vid, vstatus, vtime, vdel));
                    }
                    var enis = [];
                    var objs = this.getItems(instance, "networkInterfaceSet", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var eid = getNodeValue(objs[i], "networkInterfaceId");
                        var estatus = getNodeValue(objs[i], "status");
                        var edescr = getNodeValue(objs[i], "description");
                        var esubnetId = getNodeValue(objs[i], "subnetId");
                        var evpcId = getNodeValue(objs[i], "vpcId");
                        var eownerId = getNodeValue(objs[i], "ownerId");
                        var eprivateIp = getNodeValue(objs[i], "privateIpAddress");
                        var epublicIp = getNodeValue(objs[i], "publicIp");
                        var ednsName = getNodeValue(objs[i], "privateDnsName");
                        var esrcDstCheck = getNodeValue(objs[i], "sourceDestCheck");
                        enis.push(new InstanceNetworkInterface(eid, estatus, edescr, esubnetId, evpcId, eownerId, eprivateIp, epublicIp, ednsName, esrcDstCheck));
                    }

                    var tags = this.getTags(instance);

                    list.push(new Instance(reservationId, ownerId, requesterId, instanceId, imageId, state, productCodes, allGroups, dnsName, privateDnsName, privateIpAddress,
                                           vpcId, subnetId, keyName, reason, amiLaunchIdx, instanceType, launchTime, availabilityZone, tenancy, monitoringStatus, stateReason,
                                           platform, kernelId, ramdiskId, rootDeviceType, rootDeviceName, virtType, hypervisor, ip, srcDstCheck, architecture, instanceLifecycle,
                                           clientToken, spotId, volumes, enis, tags));
                }
            }
        }

        this.session.model.set('instances', list);
        response.result = list;
    },

    runMoreInstances: function(instance, count, callback) {
        this.session.api.describeInstanceAttribute(instance.id, "userData", function(data) {
            this.runInstances(instance.imageId, instance.kernelId, instance.ramdiskId, count, count, instance.keyName,
                              instance.groups, data, null, instance.instanceType, instance.availabilityZone,
                              instance.tenancy, instance.subnetId, null, instance.monitoringStatus != "", callback);
        });
    },

    runInstances : function(imageId, kernelId, ramdiskId, minCount, maxCount, keyName, securityGroups, userData, properties, instanceType, availabilityZone, tenancy, subnetId, ipAddress, monitoring, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        if (kernelId != null && kernelId != "") {
            params.push([ "KernelId", kernelId ]);
        }
        if (ramdiskId != null && ramdiskId != "") {
            params.push([ "RamdiskId", ramdiskId ]);
        }
        params.push([ "InstanceType", instanceType ]);
        params.push([ "MinCount", minCount ]);
        params.push([ "MaxCount", maxCount ]);
        if (keyName != null && keyName != "") {
            params.push([ "KeyName", keyName ]);
        }
        for (var i in securityGroups) {
            params.push([ "SecurityGroupId." + (i + 1), typeof securityGroups[i] == "object" ? securityGroups[i].id : securityGroups[i] ]);
        }
        if (userData != null) {
            var b64str = "Base64:";
            if (userData.indexOf(b64str) != 0) {
                // This data needs to be encoded
                userData = Base64.encode(userData);
            } else {
                userData = userData.substring(b64str.length);
            }
            params.push([ "UserData", userData ]);
        }
        if (properties) {
            params.push([ "AdditionalInfo", properties ]);
        }
        if (monitoring) {
            params.push([ "Monitoring.Enabled", "true"]);
        }
        if (availabilityZone) {
            params.push([ "Placement.AvailabilityZone", availabilityZone ]);
        }
        if (tenancy) {
            params.push([ "Placement.Tenancy", tenancy ]);
        }
        if (subnetId) {
            params.push([ "SubnetId", subnetId ]);

            if (ipAddress != null && ipAddress != "") {
                params.push([ "PrivateIpAddress", ipAddress ]);
            }
        }

        ew_session.queryEC2("RunInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    onCompleteRunInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "instancesSet", "item", "instanceId");

        response.result = list;
    },

    describeInstanceAttribute : function(instanceId, attribute, callback)
    {
        ew_session.queryEC2("DescribeInstanceAttribute", [[ "InstanceId", instanceId ], [ "Attribute", attribute ]], this, false, "onCompleteDescribeInstanceAttribute", callback);
    },

    onCompleteDescribeInstanceAttribute : function(response)
    {
        var xmlDoc = response.responseXML;
        var value = getNodeValue(xmlDoc, "value");

        response.result = value;
    },

    modifyInstanceAttribute : function(instanceId, name, value, callback)
    {
        ew_session.queryEC2("ModifyInstanceAttribute", [ [ "InstanceId", instanceId ], [ name + ".Value", value ] ], this, false, "onComplete", callback);
    },

    describeInstanceStatus : function (callback) {
        ew_session.queryEC2("DescribeInstanceStatus", [], this, false, "onCompleteDescribeInstanceStatus", callback);
    },

    onCompleteDescribeInstanceStatus : function (response) {
        var xmlDoc = response.responseXML;
        var items = this.getItems(xmlDoc, "instanceStatusSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var eventsSet = item.getElementsByTagName("eventsSet")[0];
            if (!eventsSet) { continue; }
            var instanceId = getNodeValue(item, "instanceId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var eventsSetItems = eventsSet.childNodes;
            var list = new Array();

            for (var j = 0; j < eventsSetItems.length; j++) {
                var event = eventsSetItems[j];
                if (event.nodeName == '#text') continue;
                var code = getNodeValue(event, "code");
                var description = getNodeValue(event, "description");
                var startTime = getNodeValue(event, "notBefore");
                var endTime = getNodeValue(event, "notAfter");
                list.push(new InstanceStatusEvent(instanceId, availabilityZone, code, description, startTime, endTime));
            }
            var instance = this.session.model.find('instances', instanceId);
            if (instance) instance.events = list;
        }
    },

    terminateInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        ew_session.queryEC2("TerminateInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    stopInstances : function(instances, force, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        if (force == true) {
            params.push([ "Force", "true" ]);
        }
        ew_session.queryEC2("StopInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    startInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        ew_session.queryEC2("StartInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    monitorInstances: function(instances, callback)
    {
        var params = [];
        for ( var i in instances) {
            params.push( [ "InstanceId." + (i + 1), instances[i].id ]);
        }
        ew_session.queryEC2("MonitorInstances", params, this, false, "onComplete", callback);
    },

    unmonitorInstances: function(instances, callback)
    {
        var params = [];
        for ( var i in instances) {
            params.push( [ "InstanceId." + (i + 1), instances[i].id ]);
        }
        ew_session.queryEC2("UnmonitorInstances", params, this, false, "onComplete", callback);
    },

    bundleInstance : function(instanceId, bucket, prefix, activeCred, callback)
    {
        // Generate the S3 policy string using the bucket and prefix
        var s3policy = generateS3Policy(bucket, prefix);
        var s3polb64 = Base64.encode(s3policy);
        // Sign the generated policy with the secret key
        var policySig = b64_hmac_sha1(activeCred.secretKey, s3polb64);

        var params = []
        params.push([ "InstanceId", instanceId ]);
        params.push([ "Storage.S3.Bucket", bucket ]);
        params.push([ "Storage.S3.Prefix", prefix ]);
        params.push([ "Storage.S3.AWSAccessKeyId", activeCred.accessKey ]);
        params.push([ "Storage.S3.UploadPolicy", s3polb64 ]);
        params.push([ "Storage.S3.UploadPolicySignature", policySig ]);

        ew_session.queryEC2("BundleInstance", params, this, false, "onCompleteBundleInstance", callback);
    },

    onCompleteBundleInstance : function(response)
    {
        var xmlDoc = response.responseXML;

        var item = xmlDoc.getElementsByTagName("bundleInstanceTask")[0];
        if (!item) return;
        response.result = this.unpackBundleTask(item);
    },

    cancelBundleTask : function(id, callback)
    {
        var params = []
        params.push([ "BundleId", id ]);

        ew_session.queryEC2("CancelBundleTask", params, this, false, "onComplete", callback);
    },

    unpackBundleTask : function(item)
    {
        var instanceId = getNodeValue(item, "instanceId");
        var id = getNodeValue(item, "bundleId");
        var state = getNodeValue(item, "state");

        var startTime = new Date();
        startTime.setISO8601(getNodeValue(item, "startTime"));

        var updateTime = new Date();
        updateTime.setISO8601(getNodeValue(item, "updateTime"));

        var storage = item.getElementsByTagName("storage")[0];
        var s3bucket = getNodeValue(storage, "bucket");
        var s3prefix = getNodeValue(storage, "prefix");
        var error = item.getElementsByTagName("error")[0];
        var errorMsg = "";
        if (error) {
            errorMsg = getNodeValue(error, "message");
        }
        var progress = getNodeValue(item, "progress");
        if (progress.length > 0) {
            state += " " + progress;
        }

        return new BundleTask(id, instanceId, state, startTime, updateTime, s3bucket, s3prefix, errorMsg);
    },

    describeBundleTasks : function(callback)
    {
        ew_session.queryEC2("DescribeBundleTasks", [], this, false, "onCompleteDescribeBundleTasks", callback);
    },

    onCompleteDescribeBundleTasks : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "bundleInstanceTasksSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            list.push(this.unpackBundleTask(item));
        }

        this.session.model.set('bundleTasks', list);
        response.result = list;
    },

    createS3Bucket : function(bucket, region, params, callback)
    {
        if (region) {
            content = "<CreateBucketConstraint><LocationConstraint>" + region + "</LocationConstraint></CreateBucketConstraint>";
        }
        ew_session.queryS3("PUT", bucket, "", "", params, content, this, false, "onComplete", callback);
    },

    listS3Buckets : function(callback)
    {
        ew_session.queryS3("GET", "", "", "", {}, content, this, false, "onCompleteListS3Buckets", callback);
    },

    onCompleteListS3Buckets : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var owner = getNodeValue(xmlDoc, "ID")
        var items = xmlDoc.getElementsByTagName("Bucket");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "Name");
            var date = getNodeValue(items[i], "CreationDate");
            list.push(new S3Bucket(name, date, owner));
        }
        this.session.model.set('s3Buckets', list);

        response.result = list;
    },

    getS3BucketAcl : function(bucket, callback)
    {
        ew_session.queryS3("GET", bucket, "", "?acl", {}, content, this, false, "onCompleteGetS3BucketAcl", callback);
    },

    onCompleteGetS3BucketAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
        debug(response.responseText)
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("Grant");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "ID");
            var type = items[i].getElementsByTagName("Grantee")[0].getAttribute("xsi:type");
            var uri = getNodeValue(items[i], "URI");
            var email = getNodeValue(items[i], "EmailAddress");
            var name = getNodeValue(items[i], "DisplayName");
            var perms = getNodeValue(items[i], "Permission");
            switch (type) {
            case "CanonicalUser":
                break;

            case "AmazonCustomerByEmail":
                id = email
                name = email
                break;

            case "Group":
                id = uri
                name = uri.split("/").pop()
                break;
            }
            list.push(new S3BucketAcl(id, type, name, perms));
        }
        var obj = this.session.model.getS3Bucket(bucket)
        if (obj) obj.acls = list; else obj = { acls: list };

        response.result = list;
    },

    setS3BucketAcl : function(bucket, content, callback)
    {
        ew_session.queryS3("PUT", bucket, "", "?acl", {}, content, this, false, "onCompleteSetS3BucketAcl", callback);
    },

    onCompleteSetS3BucketAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
        var obj = this.session.model.getS3Bucket(bucket);
        if (obj) obj.acls = null; else obj = { acls: list };

        response.result = obj;
    },

    // Without callback it uses sync mode and returns region
    getS3BucketLocation : function(bucket, callback)
    {
        return ew_session.queryS3("GET", bucket, "", "?location", {}, null, this, callback ? false : true, "onCompleteGetS3BucketLocation", callback);
    },

    onCompleteGetS3BucketLocation : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];

        var region = getNodeValue(xmlDoc, "LocationConstraint");
        var obj = this.session.model.getS3Bucket(bucket)
        if (obj) obj.region = region;
        response.result = region;
    },

    listS3BucketKeys : function(bucket, params, callback)
    {
        ew_session.queryS3("GET", bucket, "", "", {}, null, this, false, "onCompleteListS3BucketKeys", callback);
    },

    onCompleteListS3BucketKeys : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var bucket = getNodeValue(xmlDoc, "Name");
        var items = xmlDoc.getElementsByTagName("Contents");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "Key");
            var size = getNodeValue(items[i], "Size");
            var type = getNodeValue(items[i], "StorageClass");
            var etag = getNodeValue(items[i], "ETag");
            var mtime = getNodeValue(items[i], "LastModified");
            var owner = getNodeValue(items[i], "ID")
            list.push(new S3BucketKey(bucket, id, type, size, mtime, owner, etag));
        }
        var obj = this.session.model.getS3Bucket(bucket);
        if (obj) {
            obj.keys = list;
        } else {
            obj = new S3Bucket(bucket);
            obj.keys = list;
        }

        response.result = obj;
    },

    deleteS3Bucket : function(bucket, params, callback)
    {
        ew_session.queryS3("DELETE", bucket, "", "", params, null, this, false, "onComplete", callback);
    },

    createS3BucketKey : function(bucket, key, params, data, callback)
    {
        ew_session.queryS3("PUT", bucket, key, "", params, data, this, false, "onComplete", callback);
    },

    deleteS3BucketKey : function(bucket, key, params, callback)
    {
        ew_session.queryS3("DELETE", bucket, key, "", params, null, this, false, "onComplete", callback);
    },

    getS3BucketKey : function(bucket, key, path, params, file, callback, progresscb)
    {
        ew_session.downloadS3("GET", bucket, key, path, params, file, callback, progresscb);
    },

    readS3BucketKey : function(bucket, key, path, params, callback)
    {
        ew_session.queryS3("GET", bucket, key, path, {}, null, this, false, "onCompleteReadS3BucketKey", callback);
    },

    onCompleteReadS3BucketKey : function(response)
    {
        response.result = response.responseText;
    },

    putS3BucketKey : function(bucket, key, path, params, text, callback)
    {
        if (!params["Content-Type"]) params["Content-Type"] = ew_session.getMimeType(key);
        ew_session.queryS3("PUT", bucket, key, path, params, text, this, false, "onComplete", callback);
    },

    initS3BucketKeyUpload : function(bucket, key, params, callback)
    {
        ew_session.queryS3("POST", bucket, key, "?uploads", params, null, this, false, "onCompleteInitS3BucketKeyUpload", callback);
    },

    onCompleteInitS3BucketKeyUpload : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "UploadId");
    },

    uploadS3BucketFile : function(bucket, key, path, params, file, callback, progresscb)
    {
        if (!params["Content-Type"]) params["Content-Type"] = ew_session.getMimeType(key);
        ew_session.uploadS3(bucket, key, path, params, file, callback, progresscb);
    },

    getS3BucketKeyAcl : function(bucket, key, callback)
    {
        ew_session.queryS3("GET", bucket, key, "?acl", {}, null, this, false, "onCompleteGetS3BucketKeyAcl", callback);
    },

    onCompleteGetS3BucketKeyAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
        var key = response.params[1];

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("Grant");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "ID");
            var type = items[i].getElementsByTagName("Grantee")[0].getAttribute("xsi:type");
            var uri = getNodeValue(items[i], "URI");
            var email = getNodeValue(items[i], "EmailAddress");
            var name = getNodeValue(items[i], "DisplayName");
            var perms = getNodeValue(items[i], "Permission");
            switch (type) {
            case "CanonicalUser":
                break;

            case "AmazonCustomerByEmail":
                id = email
                name = email
                break;

            case "Group":
                id = uri
                name = uri.split("/").pop()
                break;
            }
            list.push(new S3BucketAcl(id, type, name, perms));
        }
        var obj = this.session.model.getS3BucketKey(bucket, key)
        if (obj) obj.acls = list;

        response.result = obj;
    },

    setS3BucketKeyAcl : function(bucket, key, content, callback)
    {
        ew_session.queryS3("PUT", bucket, key, "?acl", {}, content, this, false, "onCompleteSetS3BucketKeyAcl", callback);
    },

    onCompleteSetS3BucketKeyAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
        var key = response.params[1];

        var obj = this.session.model.getS3BucketKey(bucket, key)
        if (obj) obj.acls = null;

        response.result = obj;
    },

    getS3BucketWebsite : function(bucket, callback)
    {
        ew_session.queryS3("GET", bucket, "", "?website", {}, null, this, false, "onCompleteGetS3BucketWebsite", callback);
    },

    onCompleteGetS3BucketWebsite : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
        var obj = this.session.model.getS3Bucket(bucket);
        if (!obj) obj = {};

        if (response.hasErrors) {
            // Ignore no website error
            if (response.faultCode == "NoSuchWebsiteConfiguration") {
                response.hasErrors = false;
            }
        } else {
            var doc = xmlDoc.getElementsByTagName("IndexDocument");
            obj.indexSuffix = getNodeValue(doc[0], "Suffix");
            var doc = xmlDoc.getElementsByTagName("ErrorDocument");
            obj.errorKey = getNodeValue(doc[0], "Key");

            response.result = obj;
        }
    },

    setS3BucketWebsite : function(bucket, index, error, callback)
    {
        var content = '<WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
        if (index) {
            content += '<IndexDocument><Suffix>' + index + '</Suffix></IndexDocument>';
        }
        if (error) {
            content += '<ErrorDocument><Key>' + error + '</Key></ErrorDocument>';
        }
        content += '</WebsiteConfiguration>';
        ew_session.queryS3("PUT", bucket, "", "?website", {}, content, this, false, "onComplete", callback);
    },

    deleteS3BucketWebsite : function(bucket, callback)
    {
        ew_session.queryS3("DELETE", bucket, "", "?website", {}, content, this, false, "onComplete", callback);
    },

    describeKeypairs : function(callback)
    {
        ew_session.queryEC2("DescribeKeyPairs", [], this, false, "onCompleteDescribeKeypairs", callback);
    },

    onCompleteDescribeKeypairs : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "keyName");
            var fp = getNodeValue(items[i], "keyFingerprint");
            list.push(new KeyPair(name, fp));
        }

        this.session.model.set('keypairs', list);
        response.result = list;
    },

    createKeypair : function(name, callback)
    {
        ew_session.queryEC2("CreateKeyPair", [ [ "KeyName", name ] ], this, false, "onCompleteCreateKeyPair", callback);
    },

    onCompleteCreateKeyPair : function(response)
    {
        var xmlDoc = response.responseXML;

        var name = getNodeValue(xmlDoc, "keyName");
        var fp = getNodeValue(xmlDoc, "keyFingerprint");
        var material = getNodeValue(xmlDoc, "keyMaterial");

        response.result = new Keypair(name, fp, material);
    },

    deleteKeypair : function(name, callback)
    {
        ew_session.queryEC2("DeleteKeyPair", [ [ "KeyName", name ] ], this, false, "onComplete", callback);
    },

    describeRouteTables : function(callback)
    {
        ew_session.queryEC2("DescribeRouteTables", [], this, false, "onCompleteDescribeRouteTables", callback);
    },

    onCompleteDescribeRouteTables : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "routeTableSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var routes = [], associations = []
            var id = getNodeValue(item, "routeTableId");
            var vpcId = getNodeValue(item, "vpcId");

            var routeItems = item.getElementsByTagName("routeSet")[0].childNodes;
            for ( var j = 0; routeItems && j < routeItems.length; j++) {
                if (routeItems.item(j).nodeName == '#text') continue;
                var cidr = getNodeValue(routeItems.item(j), "destinationCidrBlock");
                var gateway = getNodeValue(routeItems.item(j), "gatewayId");
                var instance = getNodeValue(routeItems.item(j), "instanceId");
                var owner = getNodeValue(routeItems.item(j), "instanceOwnerId");
                var eni = getNodeValue(routeItems.item(j), "networkInterfaceId");
                var state = getNodeValue(routeItems.item(j), "state");
                routes.push(new Route(id, cidr, state, gateway, eni, instance, owner));
            }
            var assocSet = item.getElementsByTagName("associationSet")[0];
            var assocItems = assocSet.childNodes;
            if (assocItems) {
                for ( var j = 0; j < assocItems.length; j++) {
                    if (assocItems.item(j).nodeName == '#text') continue;
                    var aid = getNodeValue(assocItems.item(j), "routeTableAssociationId");
                    var table = getNodeValue(assocItems.item(j), "routeTableId");
                    var subnet = getNodeValue(assocItems.item(j), "subnetId");
                    associations.push(new RouteAssociation(aid, table, subnet));
                }
            }
            var tags = this.getTags(item);
            list.push(new RouteTable(id, vpcId, routes, associations, tags));
        }
        this.session.model.set('routeTables', list);
        response.result = list;
    },

    createRouteTable : function(vpcId, callback)
    {
        ew_session.queryEC2("CreateRouteTable", [["VpcId", vpcId]], this, false, "onComplete:routeTableId", callback);
    },

    deleteRouteTable : function(tableId, callback)
    {
        ew_session.queryEC2("DeleteRouteTable", [["RouteTableId", tableId]], this, false, "onComplete", callback);
    },

    createRoute : function(tableId, cidr, gatewayId, instanceId, networkInterfaceId, callback)
    {
        var params = [];
        params.push(["RouteTableId", tableId]);
        params.push(["DestinationCidrBlock", cidr]);
        if (gatewayId) {
            params.push(["GatewayId", gatewayId]);
        }
        if (instanceId) {
            params.push(["InstanceId", instanceId]);
        }
        if (networkInterfaceId) {
            params.push(["NetworkInterfaceId", networkInterfaceId]);
        }
        ew_session.queryEC2("CreateRoute", params, this, false, "onComplete", callback);
    },

    deleteRoute : function(tableId, cidr, callback)
    {
        ew_session.queryEC2("DeleteRoute", [["RouteTableId", tableId], ["DestinationCidrBlock", cidr]], this, false, "onComplete", callback);
    },

    associateRouteTable : function(tableId, subnetId, callback)
    {
        ew_session.queryEC2("AssociateRouteTable", [["RouteTableId", tableId], ["SubnetId", subnetId]], this, false, "onComplete:associationId", callback);
    },

    disassociateRouteTable : function(assocId, callback)
    {
        ew_session.queryEC2("DisassociateRouteTable", [["AssociationId", assocId]], this, false, "onComplete", callback);
    },

    createNetworkInterface : function(subnetId, ip, descr, groups, callback)
    {
        var params = [["SubnetId", subnetId]];
        if (ip) {
            params.push( ["PrivateIpAddress", ip ])
        }
        if (descr) {
            params.push([ "Description", descr])
        }
        if (groups) {
            for (var i in groups) {
                params.push(["SecurityGroupId."+(i+1), groups[i]]);
            }
        }
        ew_session.queryEC2("CreateNetworkInterface", params, this, false, "onComplete:networkInterfaceId", callback);
    },

    deleteNetworkInterface : function(id, callback)
    {
        ew_session.queryEC2("DeleteNetworkInterface", [["NetworkInterfaceId", id]], this, false, "onComplete", callback);
    },

    modifyNetworkInterfaceAttribute : function (id, name, value, callback)
    {
        ew_session.queryEC2("ModifyNetworkInterfaceAttribute", [ ["NetworkInterfaceId", id], [name + ".Value", value] ], this, false, "onComplete", callback);
    },

    modifyNetworkInterfaceAttributes : function (id, attributes, callback)
    {
        var params = [ ["NetworkInterfaceId", id] ];
        for (var i in attributes) {
            params.push(attributes[i]);
        }

        ew_session.queryEC2("ModifyNetworkInterfaceAttribute", params, this, false, "onComplete", callback);
    },

    attachNetworkInterface : function (id, instanceId, deviceIndex, callback)
    {
        ew_session.queryEC2("AttachNetworkInterface", [["NetworkInterfaceId", id], ["InstanceId", instanceId], ["DeviceIndex", deviceIndex]], this, false, "onComplete", callback);
    },

    detachNetworkInterface : function (attachmentId, force, callback)
    {
        var params = [ ['AttachmentId', attachmentId] ];

        if (force) {
            params.push(['Force', force]);
        }

        ew_session.queryEC2("DetachNetworkInterface", params, this, false, "onComplete", callback);
    },

    describeNetworkInterfaces : function(callback)
    {
        ew_session.queryEC2("DescribeNetworkInterfaces", [], this, false, "onCompleteDescribeNetworkInterfaces", callback);
    },

    onCompleteDescribeNetworkInterfaces : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "networkInterfaceSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "networkInterfaceId");
            var subnetId = getNodeValue(item, "subnetId");
            var vpcId = getNodeValue(item, "vpcId");
            var descr = getNodeValue(item, "description");
            var status = getNodeValue(item, "status");
            var mac = getNodeValue(item, "macAddress");
            var ip = getNodeValue(item, "privateIpAddress");
            var check = getNodeValue(item, "sourceDestCheck");
            var azone = getNodeValue(item, "availabilityZone");
            var tags = [];
            var attachment = null;
            var association = null;

            var aitem = item.getElementsByTagName("attachment")[0];
            if (aitem) {
                var aid = getNodeValue(aitem, "attachmentId");
                var instId = getNodeValue(aitem, "instanceId");
                var owner = getNodeValue(aitem, "instanceOwnerId");
                var index = getNodeValue(aitem, "deviceIndex");
                var astatus = getNodeValue(aitem, "status");
                var time = getNodeValue(aitem, "attachTime");
                var del = getNodeValue(aitem, "deleteOnTermination");
                attachment = new NetworkInterfaceAttachment(aid, instId, owner, index, astatus, time, del);
            }

            aitem = item.getElementsByTagName("association")[0];
            if (aitem) {
                aid = getNodeValue(aitem, "associationId");
                var pubip = getNodeValue(aitem, "publicIp");
                var owner = getNodeValue(aitem, "ipOwnerId");
                var instId = getNodeValue(aitem, "instanceID");
                var attId = getNodeValue(aitem, "attachmentID");
                association = new NetworkInterfaceAssociation(aid, pubip, owner, instId, attId);
            }
            var groups = this.getGroups(item);
            var tags = this.getTags(item);
            list.push(new NetworkInterface(id, status, descr, subnetId, vpcId, azone, mac, ip, check, groups, attachment, association, tags));
        }

        this.session.model.set('networkInterfaces', list);
        response.result = list;
    },

    describeSecurityGroups : function(callback)
    {
        ew_session.queryEC2("DescribeSecurityGroups", [], this, false, "onCompleteDescribeSecurityGroups", callback);
    },

    parsePermissions: function(type, list, items)
    {
        if (items) {
            for ( var j = 0; j < items.length; j++) {
                if (items.item(j).nodeName == '#text') continue;
                var ipProtocol = getNodeValue(items.item(j), "ipProtocol");
                var fromPort = getNodeValue(items.item(j), "fromPort");
                var toPort = getNodeValue(items.item(j), "toPort");
                log("Group ipp [" + ipProtocol + ":" + fromPort + "-" + toPort + "]");

                var groups = items[j].getElementsByTagName("groups")[0];
                if (groups) {
                    var groupsItems = groups.childNodes;
                    for ( var k = 0; k < groupsItems.length; k++) {
                        if (groupsItems.item(k).nodeName == '#text') continue;
                        var srcGrp = { ownerId : getNodeValue(groupsItems[k], "userId"), id : getNodeValue(groupsItems[k], "groupId"), name : getNodeValue(groupsItems[k], "groupName") }
                        list.push(new Permission(type, ipProtocol, fromPort, toPort, srcGrp));
                    }
                }
                var ipRanges = items[j].getElementsByTagName("ipRanges")[0];
                if (ipRanges) {
                    var ipRangesItems = ipRanges.childNodes;
                    for ( var k = 0; k < ipRangesItems.length; k++) {
                        if (ipRangesItems.item(k).nodeName == '#text') continue;
                        var cidrIp = getNodeValue(ipRangesItems[k], "cidrIp");
                        list.push(new Permission(type, ipProtocol, fromPort, toPort, null, cidrIp));
                    }
                }
            }
        }
        return list
    },

    onCompleteDescribeSecurityGroups : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "securityGroupInfo", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var ownerId = getNodeValue(item, "ownerId");
            var groupId = getNodeValue(item, "groupId");
            var groupName = getNodeValue(item, "groupName");
            var groupDescription = getNodeValue(item, "groupDescription");
            var vpcId = getNodeValue(item, "vpcId");
            log("Group name [id=" + groupId + ", name=" + groupName + ", vpcId=" + vpcId + "]");

            var ipPermissions = item.getElementsByTagName("ipPermissions")[0];
            var ipPermissionsList = this.parsePermissions('Ingress', [], ipPermissions.childNodes);
            ipPermissions = item.getElementsByTagName("ipPermissionsEgress")[0];
            ipPermissionsList = this.parsePermissions('Egress', ipPermissionsList, ipPermissions.childNodes);
            var tags = this.getTags(item);
            list.push(new SecurityGroup(groupId, ownerId, groupName, groupDescription, vpcId, ipPermissionsList, tags));
        }

        this.session.model.set('securityGroups', list);
        response.result = list;
    },

    createSecurityGroup : function(name, desc, vpcId, callback)
    {
        var params = [];
        params.push([ "GroupName", name ]);
        params.push([ "GroupDescription", desc ]);
        if (vpcId && vpcId != "") {
            params.push([ "VpcId", vpcId ])
        }
        ew_session.queryEC2("CreateSecurityGroup", params, this, false, "onComplete:groupId", callback, null);
    },

    deleteSecurityGroup : function(group, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        ew_session.queryEC2("DeleteSecurityGroup", params, this, false, "onComplete", callback);
    },

    authorizeSourceCIDR : function(type, group, ipProtocol, fromPort, toPort, cidrIp, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        params.push([ "IpPermissions.1.IpRanges.1.CidrIp", cidrIp ]);
        ew_session.queryEC2("AuthorizeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    revokeSourceCIDR : function(type, group, ipProtocol, fromPort, toPort, cidrIp, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        params.push([ "IpPermissions.1.IpRanges.1.CidrIp", cidrIp ]);
        ew_session.queryEC2("RevokeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    authorizeSourceGroup : function(type, group, ipProtocol, fromPort, toPort, srcGroup, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        if (group.vpcId && group.vpcId != "") {
            params.push([ "IpPermissions.1.Groups.1.GroupId", srcGroup.id ]);
        } else {
            params.push([ "IpPermissions.1.Groups.1.GroupName", srcGroup.name ]);
            params.push([ "IpPermissions.1.Groups.1.UserId", srcGroup.ownerId ]);
        }
        ew_session.queryEC2("AuthorizeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    revokeSourceGroup : function(type, group, ipProtocol, fromPort, toPort, srcGroup, callback)
    {
        var params = group.id && group.id != "" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group.name ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        if (group.vpcId && group.vpcId != "") {
            params.push([ "IpPermissions.1.Groups.1.GroupId", srcGroup.id ]);
        } else {
            params.push([ "IpPermissions.1.Groups.1.GroupName", srcGroup.name ]);
            params.push([ "IpPermissions.1.Groups.1.UserId", srcGroup.ownerId ]);
        }
        ew_session.queryEC2("RevokeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    rebootInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        ew_session.queryEC2("RebootInstances", params, this, false, "onComplete", callback);
    },

    // Without callback the request will be sync and the result will be cnsole output
    getConsoleOutput : function(instanceId, callback)
    {
        return ew_session.queryEC2("GetConsoleOutput", [ [ "InstanceId", instanceId ] ], this, callback ? false : true, "onCompleteGetConsoleOutput", callback);
    },

    onCompleteGetConsoleOutput : function(response)
    {
        var xmlDoc = response.responseXML;
        var instanceId = getNodeValue(xmlDoc, "instanceId");
        var timestamp = getNodeValue(xmlDoc, "timestamp");
        var output = xmlDoc.getElementsByTagName("output")[0];
        if (output.textContent) {
            output = Base64.decode(output.textContent);
            output = output.replace(/\x1b/mg, "\n").replace(/\r/mg, "").replace(/\n+/mg, "\n");
        } else {
            output = '';
        }
        response.result = output;
    },

    describeAvailabilityZones : function(callback)
    {
        ew_session.queryEC2("DescribeAvailabilityZones", [], this, false, "onCompleteDescribeAvailabilityZones", callback);
    },

    onCompleteDescribeAvailabilityZones : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "zoneName");
            var state = getNodeValue(items[i], "zoneState");
            list.push(new AvailabilityZone(name, state));
        }

        this.session.model.set('availabilityZones', list);
        response.result = list;
    },

    describeAddresses : function(callback)
    {
        ew_session.queryEC2("DescribeAddresses", [], this, false, "onCompleteDescribeAddresses", callback);
    },

    onCompleteDescribeAddresses : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var publicIp = getNodeValue(items[i], "publicIp");
            var instanceid = getNodeValue(items[i], "instanceId");
            var allocId = getNodeValue(items[i], "allocationId");
            var assocId = getNodeValue(items[i], "associationId");
            var domain = getNodeValue(items[i], "domain");
            var tags = this.getTags(items[i]);
            list.push(new EIP(publicIp, instanceid, allocId, assocId, domain, tags));
        }
        this.session.model.set('addresses', list);
        response.result = list;
    },

    allocateAddress : function(vpc, callback)
    {
        var params = vpc ? [["Domain", "vpc"]] : []
        ew_session.queryEC2("AllocateAddress", params, this, false, "onComplete:allocationId", callback);
    },

    releaseAddress : function(eip, callback)
    {
        var params = eip.allocationId ? [["AllocationId", eip.allocationId]] : [[ 'PublicIp', eip.publicIp ]]
        ew_session.queryEC2("ReleaseAddress", params, this, false, "onComplete", callback);
    },

    associateAddress : function(eip, instanceId, networkInterfaceId, callback)
    {
        var params = eip.allocationId ? [["AllocationId", eip.allocationId]] : [[ 'PublicIp', eip.publicIp ]]
        if (instanceId) {
            params.push([ 'InstanceId', instanceId ])
        }
        if (networkInterfaceId) {
            params.push([ 'NetworkInterfaceId', networkInterfaceId ])
        }
        ew_session.queryEC2("AssociateAddress", params, this, false, "onComplete:associationId", callback);
    },

    disassociateAddress : function(eip, callback)
    {
        var params = eip.associationId ? [["AssociationId", eip.associationId]] : [[ 'PublicIp', eip.publicIp ]]
        ew_session.queryEC2("DisassociateAddress", params, this, false, "onComplete", callback);
    },

    describeRegions : function(callback)
    {
        ew_session.queryEC2("DescribeRegions", [], this, false, "onCompleteDescribeRegions", callback);
    },

    onCompleteDescribeRegions : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "regionInfo", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var name = getNodeValue(item, "regionName");
            var url = getNodeValue(item, "regionEndpoint");
            if (url.indexOf("https://") != 0) {
                url = "https://" + url;
            }
            list.push(new Endpoint(name, url));
        }

        response.result = list;
    },

    describeLoadBalancers : function(callback)
    {
        ew_session.queryELB("DescribeLoadBalancers", [], this, false, "onCompleteDescribeLoadBalancers", callback);
    },

    onCompleteDescribeLoadBalancers : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var LoadBalancerName = getNodeValue(items[i], "LoadBalancerName");
            var CreatedTime = getNodeValue(items[i], "CreatedTime");
            var DNSName = getNodeValue(items[i], "DNSName");
            var Instances = new Array();
            var InstanceId = items[i].getElementsByTagName("InstanceId");
            for ( var j = 0; j < InstanceId.length; j++) {
                Instances.push(InstanceId[j].firstChild.nodeValue);
            }

            var listener = items[i].getElementsByTagName("ListenerDescriptions");
            for ( var k = 0; k < listener.length; k++) {
                var Protocol = getNodeValue(listener[k], "Protocol");
                var LoadBalancerPort = getNodeValue(listener[k], "LoadBalancerPort");
                var InstancePort = getNodeValue(listener[k], "InstancePort");
            }

            var HealthCheck = items[i].getElementsByTagName("HealthCheck");
            for ( var k = 0; k < HealthCheck.length; k++) {
                var Interval = getNodeValue(HealthCheck[k], "Interval");
                var Timeout = getNodeValue(HealthCheck[k], "Timeout");
                var HealthyThreshold = getNodeValue(HealthCheck[k], "HealthyThreshold");
                var UnhealthyThreshold = getNodeValue(HealthCheck[k], "UnhealthyThreshold");
                var Target = getNodeValue(HealthCheck[k], "Target");
            }

            var azones = new Array();
            var AvailabilityZones = items[i].getElementsByTagName("AvailabilityZones");
            for ( var k = 0; k < AvailabilityZones.length; k++) {
                var zone = AvailabilityZones[k].getElementsByTagName("member");
                for ( var j = 0; j < zone.length; j++) {
                    azones.push(zone[j].firstChild.nodeValue);
                }
            }

            var AppCookieStickinessPolicies = items[i].getElementsByTagName("AppCookieStickinessPolicies");
            for ( var k = 0; k < AppCookieStickinessPolicies.length; k++) {
                var CookieName = getNodeValue(AppCookieStickinessPolicies[k], "CookieName");
                var APolicyName = getNodeValue(AppCookieStickinessPolicies[k], "PolicyName");
            }

            var LBCookieStickinessPolicies = items[i].getElementsByTagName("LBCookieStickinessPolicies");
            for ( var k = 0; k < LBCookieStickinessPolicies.length; k++) {
                var CookieExpirationPeriod = getNodeValue(LBCookieStickinessPolicies[k], "CookieExpirationPeriod");
                var CPolicyName = getNodeValue(LBCookieStickinessPolicies[k], "PolicyName");
            }

            var securityGroups = items[i].getElementsByTagName("SecurityGroups");
            var groupList = [];

            if (securityGroups[0] && securityGroups[0].childNodes.length > 0) {
                var securityGroupMembers = securityGroups[0].getElementsByTagName("member");
                for ( var k = 0; k < securityGroupMembers.length; k++) {
                    groupList.push(securityGroupMembers[k].firstChild.nodeValue);
                }
            }

            var vpcId = getNodeValue(items[i], "VPCId");
            var subnets = items[i].getElementsByTagName("Subnets");
            var subnetList = [];

            if (subnets[0] && subnets[0].childNodes.length > 0) {
                var subnetMembers = subnets[0].getElementsByTagName("member");
                for ( var k = 0; k < subnetMembers.length; k++) {
                    subnetList.push(subnetMembers[k].firstChild.nodeValue);
                }
            }

            if (LoadBalancerName != '' && CreatedTime != '') {
                list.push(new LoadBalancer(LoadBalancerName, CreatedTime, DNSName, Instances, Protocol, LoadBalancerPort, InstancePort, Interval, Timeout, HealthyThreshold, UnhealthyThreshold, Target, azones, CookieName, APolicyName, CookieExpirationPeriod, CPolicyName, vpcId, subnetList, groupList));
            }
        }
        this.session.model.set('loadBalancers', list);
        response.result = list;
    },

    describeInstanceHealth : function(LoadBalancerName, callback)
    {
        var params =[ [ "LoadBalancerName", LoadBalancerName ] ];

        ew_session.queryELB("DescribeInstanceHealth", params, this, false, "onCompleteDescribeInstanceHealth", callback);
    },

    onCompleteDescribeInstanceHealth : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var Description = getNodeValue(items[i], "Description");
            var State = getNodeValue(items[i], "State");
            var InstanceId = getNodeValue(items[i], "InstanceId");
            var ReasonCode = getNodeValue(items[i], "ReasonCode");

            list.push(new InstanceHealth(Description, State, InstanceId, ReasonCode));
        }

        var elb = this.session.model.find('loadBalancers', response.params[0][1]);
        if (elb) elb.InstanceHealth = list;

        response.result = list;
    },

    deleteLoadBalancer : function(LoadBalancerName, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);

        ew_session.queryELB("DeleteLoadBalancer", params, this, false, "onComplete", callback);
    },

    createLoadBalancer : function(LoadBalancerName, Protocol, elbport, instanceport, Zone, subnet, groups, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "AvailabilityZones.member.1", Zone ]);
        if (subnet) {
            params.push(["Subnets.member.1", subnet]);
            for (var i = 0; i < groups.length; i++) {
                params.push(["SecurityGroups.member." + (i + 1), groups[i]]);
            }
        }
        params.push([ "Listeners.member.Protocol", Protocol ]);
        if (Protocol == "HTTPS") {
            params.push([ "Listeners.member.SSLCertificateId", "arn:aws:iam::322191361670:server-certificate/testCert" ]);
        }
        params.push([ "Listeners.member.LoadBalancerPort", elbport ]);
        params.push([ "Listeners.member.InstancePort", instanceport ]);
        ew_session.queryELB("CreateLoadBalancer", params, this, false, "onComplete", callback);
    },

    configureHealthCheck : function(LoadBalancerName, Target, Interval, Timeout, HealthyThreshold, UnhealthyThreshold, callback)
    {
        var params = [];
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "HealthCheck.Target", Target ]);
        params.push([ "HealthCheck.Interval", Interval ]);
        params.push([ "HealthCheck.Timeout", Timeout ]);
        params.push([ "HealthCheck.HealthyThreshold", HealthyThreshold ]);
        params.push([ "HealthCheck.UnhealthyThreshold", UnhealthyThreshold ]);

        ew_session.queryELB("ConfigureHealthCheck", params, this, false, "onComplete", callback);
    },

    registerInstancesWithLoadBalancer : function(LoadBalancerName, instances, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < instances.length; i++) {
            params.push([ "Instances.member." + (i + 1) + ".InstanceId", instances[i] ]);
        }
        ew_session.queryELB("RegisterInstancesWithLoadBalancer", params, this, false, "onComplete", callback);
    },

    deregisterInstancesWithLoadBalancer : function(LoadBalancerName, instances, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < instances.length; i++) {
            params.push([ "Instances.member." + (i + 1) + ".InstanceId", instances[i] ]);
        }
        ew_session.queryELB("DeregisterInstancesFromLoadBalancer", params, this, false, "onComplete", callback);
    },

    enableAvailabilityZonesForLoadBalancer : function(LoadBalancerName, Zones, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < Zones.length; i++) {
            params.push([ "AvailabilityZones.member." + (i + 1), Zones[i] ]);
        }
        ew_session.queryELB("EnableAvailabilityZonesForLoadBalancer", params, this, false, "onComplete", callback);
    },

    disableAvailabilityZonesForLoadBalancer : function(LoadBalancerName, Zones, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0 ; i < Zones.length; i++) {
            params.push([ "AvailabilityZones.member." + (i + 1), Zones[i] ]);
        }
        ew_session.queryELB("DisableAvailabilityZonesForLoadBalancer", params, this, false, "onComplete", callback);
    },

    createAppCookieStickinessPolicy : function(LoadBalancerName, CookieName, callback)
    {
        var uniqueid = new Date;
        var id = uniqueid.getTime();

        var PolicyName = "AWSConsolePolicy-" + id;
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "CookieName", CookieName ]);
        params.push([ "PolicyName", PolicyName ]);
        ew_session.queryELB("CreateAppCookieStickinessPolicy", params, this, false, "onComplete", callback);
    },

    createLBCookieStickinessPolicy : function(LoadBalancerName, CookieExpirationPeriod, callback)
    {
        var uniqueid = new Date;
        var id = uniqueid.getTime();

        var PolicyName = "AWSConsolePolicy-" + id;
        var params = []
        params.push([ "CookieExpirationPeriod", CookieExpirationPeriod ]);
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "PolicyName", PolicyName ]);
        ew_session.queryELB("CreateLBCookieStickinessPolicy", params, this, false, "onComplete", callback);
    },

    deleteLoadBalancerPolicy : function(LoadBalancerName, policy, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);

        params.push([ "PolicyName", policy ]);
        ew_session.queryELB("DeleteLoadBalancerPolicy", params, this, false, "onComplete", callback);
    },

    applySecurityGroupsToLoadBalancer : function (loadBalancerName, groups, callback)
    {
        var params = [ ["LoadBalancerName", loadBalancerName] ];
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            params.push(["SecurityGroups.member." + (i + 1), group]);
        }
        ew_session.queryELB("ApplySecurityGroupsToLoadBalancer", params, this, false, "onComplete", callback);
    },

    attachLoadBalancerToSubnets : function(LoadBalancerName, subnets, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["Subnets.member." + (i + 1), subnets[i]]);
        }
        ew_session.queryELB("AttachLoadBalancerToSubnets", params, this, false, "onComplete", callback);
    },

    detachLoadBalancerFromSubnets : function(LoadBalancerName, subnets, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["Subnets.member." + (i + 1), subnets[i]]);
        }
        ew_session.queryELB("DetachLoadBalancerFromSubnets", params, this, false, "onComplete", callback);
    },

    uploadServerCertificate : function(ServerCertificateName, CertificateBody, PrivateKey, Path, callback)
    {
        var params = []
        params.push([ "ServerCertificateName", ServerCertificateName ]);
        params.push([ "CertificateBody", CertificateBody ]);
        params.push([ "PrivateKey", PrivateKey ]);
        if (Path != null) params.push([ "Path", Path ]);
        ew_session.queryIAM("UploadServerCertificate", params, this, false, "onComplete", callback);
    },

    createTags : function(tags, callback)
    {
        var params = new Array();

        for ( var i = 0; i < tags.length; i++) {
            params.push([ "ResourceId." + (i + 1), tags[i].resourceId ]);
            params.push([ "Tag." + (i + 1) + ".Key", tags[i].name ]);
            params.push([ "Tag." + (i + 1) + ".Value", tags[i].value ]);
        }

        ew_session.queryEC2("CreateTags", params, this, false, "onComplete", callback);
    },

    deleteTags : function(tags, callback)
    {
        var params = new Array();

        for ( var i = 0; i < tags.length; i++) {
            params.push([ "ResourceId." + (i + 1), tags[i].resourceId ]);
            params.push([ "Tag." + (i + 1) + ".Key", tags[i].name ]);
        }

        ew_session.queryEC2("DeleteTags", params, this, false, "onComplete", callback);
    },

    describeTags : function(ids, callback)
    {
        if (!(ids instanceof Array)) ids = [ ids ];

        var params = new Array();
        for ( var i = 0; i < ids.length; i++) {
            params.push([ "Filter." + (i + 1) + ".Name", "resource-id" ]);
            params.push([ "Filter." + (i + 1) + ".Value.1", ids[i] ]);
        }

        ew_session.queryEC2("DescribeTags", params, this, false, "onCompleteDescribeTags", callback);
    },

    onCompleteDescribeTags : function(response)
    {
        var xmlDoc = response.responseXML;
        var tags = new Array();

        var items = this.getItems(xmlDoc, "tagSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "resourceId");
            var key = getNodeValue(item, "key");
            var value = getNodeValue(item, "value");
            tags.push(new Tag(key, value, id));
        }

        response.result = tags;
    },

    describeVolumeStatus : function (callback) {
        ew_session.queryEC2("DescribeVolumeStatus", [], this, false, "onCompleteDescribeVolumeStatus", callback);
    },

    onCompleteDescribeVolumeStatus : function (response) {
        var xmlDoc = response.responseXML;
        var list = new Array();

        var items = this.getItems(xmlDoc, "volumeStatusSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var eventsSet = item.getElementsByTagName("eventsSet")[0];
            if (!eventsSet) { continue; }

            var volumeId = getNodeValue(item, "volumeId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var eventsSetItems = eventsSet.childNodes;

            for (var j = 0; j < eventsSetItems.length; j++) {
                var event = eventsSetItems[j];
                if (event.nodeName == '#text') continue;
                var eventId = getNodeValue(event, "eventId");
                var eventType = getNodeValue(event, "eventType");
                var description = getNodeValue(event, "description");
                var startTime = getNodeValue(event, "notBefore");
                var endTime = getNodeValue(event, "notAfter");
                list.push(new VolumeStatusEvent(volumeId, availabilityZone, code, description, startTime, endTime));
            }
        }

        response.result = list;
    },

    listAccountAliases : function(callback)
    {
        ew_session.queryIAM("ListAccountAliases", [], this, false, "onCompleteListAccountAliases", callback);
    },

    onCompleteListAccountAliases : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "AccountAliases", "member");
    },

    createAccountAlias: function(name, callback)
    {
        ew_session.queryIAM("CreateAccountAlias", [ ["AccountAlias", name]], this, false, "onComplete", callback);
    },

    deleteAccountAlias: function(name, callback)
    {
        ew_session.queryIAM("DeleteAccountAlias", [ ["AccountAlias", name]], this, false, "onComplete", callback);
    },

    getAccountSummary: function(callback)
    {
        ew_session.queryIAM("GetAccountSummary", [], this, false, "onCompleteGetAccountSummary", callback);
    },

    onCompleteGetAccountSummary: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.getItems(xmlDoc, "SummaryMap", "entry", ["key", "value"]);
    },

    createAccessKey : function(name, callback)
    {
        var params = []

        if (name) {
            params.push([ "UserName", name ])
        }
        ew_session.queryIAM("CreateAccessKey", params, this, false, "onCompleteCreateAccessKey", callback);
    },

    onCompleteCreateAccessKey : function(response)
    {
        var xmlDoc = response.responseXML;

        var user = getNodeValue(xmlDoc, "UserName");
        var key = getNodeValue(xmlDoc, "AccessKeyId");
        var secret = getNodeValue(xmlDoc, "SecretAccessKey");
        var status = getNodeValue(xmlDoc, "Status");
        debug("Access key = " + key + ", secret = " + secret)

        response.result = new AccessKey(key, secret, status, user);
    },

    deleteAccessKey : function(id, user, callback)
    {
        var params = [ [ "AccessKeyId", id ] ];
        if (user) params.push(["UserName", user])
        ew_session.queryIAM("DeleteAccessKey", params, this, false, "onComplete", callback);
    },

    listAccessKeys : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        ew_session.queryIAM("ListAccessKeys", params, this, false, "onCompleteListAccessKeys", callback);
    },

    onCompleteListAccessKeys : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var user = getNodeValue(xmlDoc, "UserName");
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for (var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "AccessKeyId");
            var status = getNodeValue(items[i], "Status");
            var date = getNodeValue(items[i], "CreateDate");
            list.push(new AccessKey(id, "", status, user, date));
        }

        this.session.model.update('users', getParam(params, 'UserName'), 'accessKeys', list)

        response.result = list;
    },

    listVirtualMFADevices : function(status, callback)
    {
        var params = [];
        if (status) params.push(["AssignmentStatus", status]);
        ew_session.queryIAM("ListVirtualMFADevices", [], this, false, "onCompleteListVirtualMFADevices", callback);
    },

    onCompleteListVirtualMFADevices : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "VirtualMFADevices", "member");
        for ( var i = 0; i < items.length; i++) {
            var serial = getNodeValue(items[i], "SerialNumber");
            var arn = getNodeValue(items[i], "Arn");
            var date = getNodeValue(items[i], "EnableDate");
            var user = getNodeValue(items[i], "UserName");
            list.push(new MFADevice(serial, date, arn.split(/[:\/]+/).pop(), user));
            debug(i + " " + serial)
        }
        this.session.model.set('vmfas', list);
        response.result = list;
    },

    createVirtualMFADevice : function(name, path, callback)
    {
        ew_session.queryIAM("CreateVirtualMFADevice", [["VirtualMFADeviceName", name], [ "Path", path || "/" ]], this, false, "onCompleteCreateVirtualMFADevice", callback);
    },

    onCompleteCreateVirtualMFADevice : function(response)
    {
        var xmlDoc = response.responseXML;

        var obj = [];
        obj.id = getNodeValue(xmlDoc, "SerialNumber");
        obj.seed = getNodeValue(xmlDoc, "Base32StringSeed");
        obj.qrcode = getNodeValue(xmlDoc, "QRCodePNG");

        response.result = obj;
    },

    deleteVirtualMFADevice: function(serial, callback)
    {
        ew_session.queryIAM("DeleteVirtualMFADevice", [ ["SerialNumber", serial] ], this, false, "onComplete", callback);
    },

    listMFADevices : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        ew_session.queryIAM("ListMFADevices", params, this, false, "onCompleteListMFADevices", callback);
    },

    onCompleteListMFADevices : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = this.getItems(xmlDoc, "MFADevices", "member", ["SerialNumber", "EnableDate"], function(obj) { return new MFADevice(obj.SerialNumber, obj.EnableDate)});

        var user = getNodeValue(xmlDoc, "UserName");
        if (!user) user = getParam(params, 'UserName');
        if (!user) user = ew_session.user.name;
        this.session.model.update('users', user, 'mfaDevices', list)

        response.result = list;
    },

    enableMFADevice: function(user, serial, auth1, auth2, callback)
    {
        ew_session.queryIAM("EnableMFADevice", [["UserName", user], ["SerialNumber", serial], ["AuthenticationCode1", auth1], ["AuthenticationCode2", auth2] ], this, false, "onComplete", callback);
    },

    resyncMFADevice: function(user, serial, auth1, auth2, callback)
    {
        ew_session.queryIAM("ResyncMFADevice", [["UserName", user], ["SerialNumber", serial], ["AuthenticationCode1", auth1], ["AuthenticationCode2", auth2] ], this, false, "onComplete", callback);
    },

    deactivateMFADevice: function(user, serial, callback)
    {
        ew_session.queryIAM("DeactivateMFADevice", [["UserName", user], ["SerialNumber", serial] ], this, false, "onComplete", callback);
    },

    listUsers : function(callback)
    {
        ew_session.queryIAM("ListUsers", [], this, false, "onCompleteListUsers", callback);
    },

    unpackUser: function(item)
    {
        var id = getNodeValue(item, "UserId");
        var name = getNodeValue(item, "UserName");
        var path = getNodeValue(item, "Path");
        var arn = getNodeValue(item, "Arn");
        return new User(id, name, path, arn)
    },

    onCompleteListUsers : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackUser(items[i]));
        }
        this.session.model.set('users', list);
        response.result = list;
    },

    getUser : function(name, callback)
    {
        var params = [];
        if (name) params.push(["UserName", user])
        ew_session.queryIAM("GetUser", params, this, false, "onCompleteGetUser", callback);
    },

    onCompleteGetUser : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackUser(xmlDoc);
    },

    getUserPolicy : function(user, policy, callback)
    {
        ew_session.queryIAM("GetUserPolicy", [ ["UserName", user], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    putUserPolicy: function(user, name, text, callback)
    {
        ew_session.queryIAM("PutUserPolicy", [ ["UserName", user], [ "PolicyName", name ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    deleteUserPolicy : function(user, policy, callback)
    {
        ew_session.queryIAM("DeleteUserPolicy", [ ["UserName", name], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    onCompleteGetPolicy : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = decodeURIComponent(getNodeValue(xmlDoc, "PolicyDocument"));
    },

    createUser : function(name, path, callback)
    {
        ew_session.queryIAM("CreateUser", [ ["UserName", name], [ "Path", path || "/"] ], this, false, "onCompleteGetUser", callback);
    },

    deleteUser : function(name, callback)
    {
        ew_session.queryIAM("DeleteUser", [ ["UserName", name] ], this, false, "onComplete", callback);
    },

    getLoginProfile : function(name, callback)
    {
        var params = [];
        if (name) params.push(["UserName", name])
        ew_session.queryIAM("GetLoginProfile", params, this, false, "onCompleteGetLoginProfile", callback);
    },

    onCompleteGetLoginProfile : function(response)
    {
        var xmlDoc = response.responseXML;

        var name = getNodeValue(xmlDoc, "UserName");
        var date = getNodeValue(xmlDoc, "CreateDate");

        // It is valid not to have it
        if (!response.hasErrors) {
            this.session.model.update('users', name, 'loginProfileDate', date)
        }
        response.hasErrors = false;
        response.result = date;
    },

    createLoginProfile : function(name, pwd, callback)
    {
        ew_session.queryIAM("CreateLoginProfile", [ ["UserName", name], [ "Password", pwd ] ], this, false, "onComplete", callback);
    },

    updateLoginProfile : function(name, pwd, callback)
    {
        ew_session.queryIAM("UpdateLoginProfile", [ ["UserName", name], [ "Password", pwd ] ], this, false, "onComplete", callback);
    },

    updateUser : function(name, newname, newpath, callback)
    {
        var params = [ ["UserName", name] ]
        if (newname) params.push([ "NewUserName", newname])
        if (newpath) params.push(["NewPath", newpath])
        ew_session.queryIAM("UpdateUser", params, this, false, "onComplete", callback);
    },

    deleteLoginProfile : function(name, callback)
    {
        ew_session.queryIAM("DeleteLoginProfile", [ ["UserName", name] ], this, false, "onComplete", callback);
    },

    listUserPolicies : function(user, callback)
    {
        ew_session.queryIAM("ListUserPolicies", [ ["UserName", user]], this, false, "onCompleteListPolicies", callback);
    },

    changePassword : function(oldPw, newPw, callback)
    {
        ew_session.queryIAM("ChangePassword", [ ["OldPassword", oldPw], [ "NewPassword", newPw ] ], this, false, "onComplete", callback);
    },

    addUserToGroup : function(user, group, callback)
    {
        ew_session.queryIAM("AddUserToGroup", [ ["UserName", user], [ "GroupName", group ] ], this, false, "onComplete", callback);
    },

    removeUserFromGroup : function(user, group, callback)
    {
        ew_session.queryIAM("RemoveUserFromGroup", [ ["UserName", user], [ "GroupName", group ] ], this, false, "onComplete", callback);
    },

    listGroups : function(callback)
    {
        ew_session.queryIAM("ListGroups", [], this, false, "onCompleteListGroups", callback);
    },

    listGroupsForUser : function(user, callback)
    {
        ew_session.queryIAM("ListGroupsForUser", [ ["UserName", user]], this, false, "onCompleteListGroups", callback);
    },

    unpackGroup: function(item)
    {
        var path = getNodeValue(item, "Path");
        var name = getNodeValue(item, "GroupName");
        var id = getNodeValue(item, "GroupId");
        var arn = getNodeValue(item, "Arn");
        return new UserGroup(id, name, path, arn);
    },

    onCompleteListGroups : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackGroup(items[i]));
        }

        // Update model directly
        switch (response.action) {
        case 'ListGroups':
            this.session.model.set('groups', list);
            break;

        case "ListGroupsForUser":
            this.session.model.update('users', getParam(params, 'UserName'), 'groups', list)
            break;
        }

        response.result = list;
    },

    listGroupPolicies : function(name, callback)
    {
        ew_session.queryIAM("ListGroupPolicies", [ ["GroupName", name]], this, false, "onCompleteListPolicies", callback);
    },

    onCompleteListPolicies : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(items[i].firstChild.nodeValue);
        }

        // Update model directly
        switch(response.action) {
        case "ListGroupPolicies":
            this.session.model.update('groups', getParam(params, 'GroupName'), 'policies', list)
            break;

        case "ListUserPolicies":
            this.session.model.update('users', getParam(params, 'UserName'), 'policies', list)
            break;
        }

        response.result = list;
    },

    getGroupPolicy : function(group, policy, callback)
    {
        ew_session.queryIAM("GetGroupPolicy", [ ["GroupName", group], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    deleteGroupPolicy : function(group, policy, callback)
    {
        ew_session.queryIAM("DeleteGroupPolicy", [ ["GroupName", group], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    putGroupPolicy: function(group, name, text, callback)
    {
        ew_session.queryIAM("PutGroupPolicy", [ ["GroupName", group], [ "PolicyName", name ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    createGroup : function(name, path, callback)
    {
        ew_session.queryIAM("CreateGroup", [ ["GroupName", name], [ "Path", path || "/"] ], this, false, "onCompleteGetGroup", callback);
    },

    deleteGroup : function(name, callback)
    {
        ew_session.queryIAM("DeleteGroup", [ ["GroupName", name] ], this, false, "onComplete", callback);
    },

    getGroup : function(name, callback)
    {
        ew_session.queryIAM("GetGroup", [ ["GroupName", name]], this, false, "onCompleteGetGroup", callback);
    },

    onCompleteGetGroup : function(response)
    {
        var xmlDoc = response.responseXML;

        var group = this.unpackGroup(xmlDoc);
        // User real object from the model
        var obj = this.session.model.find('groups', group.id);
        if (!obj) obj = group;

        var users = this.getItems(xmlDoc, 'Users', 'member', ["UserId", "UserName", "Path", "Arn"], function(obj) { return new User(obj.UserId, obj.UserName, obj.Path, obj.Arn); });

        // Update with real users from the model so we can share between users and groups screens
        for (var i in users) {
            var user = this.session.model.find('users', users[i].id);
            if (user) users[i] = user;
        }
        obj.users = users;
        response.result = obj;
    },

    updateGroup: function(name, newname, newpath, callback)
    {
        var params = [ ["GroupName", name] ]
        if (newname) params.push([ "NewGroupName", newname])
        if (newpath) params.push(["NewPath", newpath])
        ew_session.queryIAM("UpdateGroup", params, this, false, "onComplete", callback);
    },

    getAccountPasswordPolicy: function(callback)
    {
        ew_session.queryIAM("GetAccountPasswordPolicy", [], this, false, "onCompleteGetPasswordPolicy", callback);
    },

    onCompleteGetPasswordPolicy: function(response)
    {
        debug(response.responseText)
        var xmlDoc = response.responseXML;
        var obj = { MinimumPasswordLength: null, RequireUppercaseCharacters: null, RequireLowercaseCharacters: null, RequireNumbers: null, RequireSymbols: null, AllowUsersToChangePassword: null };

        // It is ok not to have a policy
        if (!response.hasErrors) {
            obj.MinimumPasswordLength = getNodeValue(xmlDoc, 'MinimumPasswordLength');
            obj.RequireUppercaseCharacters = getNodeValue(xmlDoc, 'RequireUppercaseCharacters');
            obj.RequireLowercaseCharacters = getNodeValue(xmlDoc, 'RequireLowercaseCharacters');
            obj.RequireNumbers = getNodeValue(xmlDoc, 'RequireNumbers');
            obj.RequireSymbols = getNodeValue(xmlDoc, 'RequireSymbols');
            obj.AllowUsersToChangePassword = getNodeValue(xmlDoc, 'AllowUsersToChangePassword');
        } else {
            obj.disabled = true;
            response.hasErrors = false;
        }
        response.result = obj;
    },

    updateAccountPasswordPolicy: function(obj, callback)
    {
        var params = []
        for (var p in obj) {
            params.push([ p, obj[p]])
        }
        ew_session.queryIAM("UpdateAccountPasswordPolicy", params, this, false, "onComplete", callback);
    },

    deleteAccountPasswordPolicy: function(callback)
    {
        ew_session.queryIAM("DeleteAccountPasswordPolicy", [], this, false, "onComplete", callback);
    },

    importKeypair : function(name, keyMaterial, callback)
    {
        ew_session.queryEC2("ImportKeyPair", [ [ "KeyName", name ], [ "PublicKeyMaterial", keyMaterial ] ], this, false, "onComplete", callback);
    },

    listSigningCertificates : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        ew_session.queryIAM("ListSigningCertificates", params, this, false, "onCompleteListSigningCertificates", callback);
    },

    onCompleteListSigningCertificates : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "CertificateId");
            var body = getNodeValue(items[i], "CertificateBody");
            var user = getNodeValue(items[i], "UserName");
            list.push(new Certificate(id, user, body));
        }
        response.result = list;
    },

    uploadSigningCertificate : function(user, body, callback)
    {
        var params = [ [ "CertificateBody", body ] ];
        if (user) params.push([["UserName", user]])
        ew_session.queryIAM("UploadSigningCertificate", params, this, false, "onComplete", callback);
    },

    deleteSigningCertificate : function(id, callback)
    {
        ew_session.queryIAM("DeleteSigningCertificate", [ [ "CertificateId", id ] ], this, false, "onComplete", callback);
    },

    updateSigningCertificate : function(id, status, callback)
    {
        ew_session.queryIAM("UpdateSigningCertificate", [ [ "CertificateId", id ], ["Status", status] ], this, false, "onComplete", callback);
    },

    uploadServerCertificate : function(name, body, privateKey, path, chain, callback)
    {
        var params = [ ["ServerCertificateName", name]];
        params.push([ "CertificateBody", body ]);
        params.push(["PrivateKey", privateKey ]);
        if (path) params.push([["Path", user]])
        if (chain) params.push(["CertificateChain", chain])
        ew_session.queryIAM("UploadServerCertificate", params, this, false, "onComplete", callback);
    },

    deleteServerCertificate : function(name, callback)
    {
        ew_session.queryIAM("DeleteServerCertificate", [ [ "ServerCertificateName", name ] ], this, false, "onComplete", callback);
    },

    updateServerCertificate : function(name, newname, newpath, callback)
    {
        var params = [ [ "ServerCertificateName", name ] ];
        if (newname) params.push(["NewServerCertificateName", newname]);
        if (newpath) params.push(["NewPath", newpath]);
        ew_session.queryIAM("UpdateServerCertificate", params, this, false, "onComplete", callback);
    },

    getServerCertificate : function(name, callback)
    {
        ew_session.queryIAM("GetServerCertificate", [ [ "ServerCertificateName", name ] ], this, false, "onCompleteGetServerCertificate", callback);
    },

    unpackServerCertificate: function(item)
    {
        var id = getNodeValue(item, "ServerCertificateId");
        var name = getNodeValue(item, "ServerCertificateName");
        var arn = getNodeValue(item, "Arn");
        var path = getNodeValue(item, "Path");
        var date = getNodeValue(item, "UploadDate");
        var body = getNodeValue(item, "CertificateBody");
        return new ServerCertificate(id, name, arn, path, date, body);
    },

    onCompleteGetServerCertificate : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackServerCertificate(xmlDoc);
    },

    listServerCertificates : function(callback)
    {
        var params = [];
        ew_session.queryIAM("ListServerCertificates", params, this, false, "onCompleteListServerCertificates", callback);
    },

    onCompleteListServerCertificates : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackServerCertificate(items[i]));
        }
        this.session.model.set('serverCerts', list);
        response.result = list;
    },

    describeAlarms : function(callback)
    {
        ew_session.queryCloudWatch("DescribeAlarms", [], this, false, "onCompleteDescribeAlarms", callback);
    },

    onCompleteDescribeAlarms : function(response)
    {
        var xmlDoc = response.responseXML;
        var alarms = new Array();

        var items = this.getItems(xmlDoc, "MetricAlarms", "member");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var arn = getNodeValue(item, "AlarmArn");
            var name = getNodeValue(item, "AlarmName");
            var enabled = getNodeValue(item, "ActionsEnabled");
            var actions = getNodeValue(item, "AlarmActions");
            var descr = getNodeValue(item, "AlarmDescription");
            var stateReason = getNodeValue(item, "StateReason");
            var stateReasonData = getNodeValue(item, "StateReasonData");
            var stateValue = getNodeValue(item, "StateValue");
            var namespace = getNodeValue(item, "Namespace");
            var period = getNodeValue(item, "Period");
            var threshold = getNodeValue(item, "Threshold");
            var statistic = getNodeValue(item, "Statistic");
            var oper = getNodeValue(item, "ComparisonOperator");
            var metricName = getNodeValue(item, "MetricName");
            var evalPeriods = getNodeValue(item, "EvaluationPeriods");
            var dims = [];
            var list = this.getItems(item, "Dimensions", "member", ["Name", "Value"]);
            for (var j = 0; j < list.length; j++) {
                dims.push(new Tag(list[j].Name, list[j].Value));
            }
            var actions = [];
            list = this.getItems(item, "AlarmActions", "member");
            for (var j = 0; j < list.length; j++) {
                actions.push(list[j].firstChild.nodeValue);
            }

            alarms.push(new MetricAlarm(name, arn, descr, stateReason, stateReasonData, stateValue, namespace, period, threshold, statistic, oper, metricName, evalPeriods, dims, actions));
        }

        this.session.model.set('alarms', alarms);

        response.result = alarms;
    },

    getSessionToken : function (duration, callback)
    {
        var params = [];
        if (duration) params.push(["DurationSeconds", duration]);

        ew_session.querySTS("GetSessionToken", params, this, false, "onCompleteGetSessionToken", callback);
    },

    getFederationToken : function (duration, name, policy, callback)
    {
        var params = [ ["Name", name] ];
        if (duration) params.push(["DurationSeconds", duration]);
        if (policy) params.push(["Policy", policy]);

        ew_session.querySTS("GetFederationToken", params, this, false, "onCompleteGetSessionToken", callback);
    },

    onCompleteGetSessionToken : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var item = xmlDoc.getElementsByTagName('Credentials')[0];
        var id = getNodeValue(xmlDoc, "FederatedUser", "FederatedUserId");
        var arn = getNodeValue(xmlDoc, "FederatedUser", "Arn");

        var token = getNodeValue(item, "SessionToken");
        var key = getNodeValue(item, "AccessKeyId");
        var secret = getNodeValue(item, "SecretAccessKey");
        var expire = getNodeValue(item, "Expiration");
        var name = getParam(params, "Name");
        var obj = new TempAccessKey(key, secret, token, expire, name || ew_session.user.name, id || ew_session.user.id, arn || ew_session.user.arn);

        response.result = obj;
    },

    onCompleteCustomerGatewayConfigFormats: function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        switch (response.action) {
        case "customer-gateway-config-formats.xml":
            var list = [];
            var items = this.getItems(xmlDoc, "CustomerGatewayConfigFormats" ,"Format");
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var platform = getNodeValue(item, "Platform");
                var filename = getNodeValue(item, "Filename");
                var vendor = getNodeValue(item, "Vendor");
                var software = getNodeValue(item, "Software");
                list.push({ title: vendor + " " + platform + " [" + software + "]", filename: filename });
            }
            response.result = list;
            break;

        default:
            try {
                configXml = new DOMParser().parseFromString(params, "text/xml");
                var proc = new XSLTProcessor;
                proc.importStylesheet(xmlDoc);
                var resultXml = proc.transformToDocument(configXml);
                response.result = getNodeValue(resultXml, "transformiix:result");
            } catch (e) {
                debug("Exception while processing XSLT: "+e)
            }
        }
    },

    listQueues : function(callback)
    {
        ew_session.querySQS(null, "ListQueues", [], this, false, "onCompleteListQueues", callback);
    },

    onCompleteListQueues : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "ListQueuesResult", "QueueUrl", null, function(node) { return new Queue(node.firstChild.nodeValue); });
        this.session.model.set('queues', list);
        response.result = list;
    },

    getQueueAttributes : function(url, callback)
    {
        ew_session.querySQS(url, "GetQueueAttributes", [ ["AttributeName.1", "All"] ], this, false, "onCompleteGetQueueAttributes", callback);
    },

    onCompleteGetQueueAttributes : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "GetQueueAttributesResult", "Attribute", ["Name", "Value"], function(obj) { return new Tag(obj.Name,obj.Value)});
        response.result = list;
    },

    setQueueAttributes : function(url, name, value, callback)
    {
        ew_session.querySQS(url, "SetQueueAttributes", [ ["Attribute.Name", name], ["Attribute.Value", value] ], this, false, "onComplete", callback);
    },

    createQueue : function(name, params, callback)
    {
        if (!params) params = [];
        params.push(["QueueName", name]);
        ew_session.querySQS(null, "CreateQueue", params, this, false, "onComplete:QueueUrl", callback);
    },

    deleteQueue : function(url, callback)
    {
        ew_session.querySQS(url, "DeleteQueue", [], this, false, "onComplete", callback);
    },

    sendMessage : function(url, body, delay, callback)
    {
        var params = [["MessageBody", body]];
        if (delay) params.push(["DelaySeconds", delay]);
        ew_session.querySQS(url, "SendMessage", params, this, false, "onComplete:MessageId", callback);
    },

    deleteMessage : function(url, handle, callback)
    {
        ew_session.querySQS(url, "DeleteMessage", [["ReceiptHandle", handle]], this, false, "onComplete", callback);
    },

    receiveMessage : function(url, max, visibility, callback)
    {
        var params = [ [ "AttributeName", "All"] ];
        if (max) params.push(["MaxNumberOfMessages", max]);
        if (visibility) params.push(["VisibilityTimeout", visibility]);
        ew_session.querySQS(url, "ReceiveMessage", params, this, false, "onCompleteReceiveMessage", callback);
    },

    onCompleteReceiveMessage : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ReceiveMessageResult", "Message");
        for (var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "MessageId");
            var handle = getNodeValue(items[i], "ReceiptHandle");
            var body = getNodeValue(items[i], "Body");
            var msg = new Message(id, body, handle, response.url);

            var attrs = items[i].getElementsByTagName('Attribute');
            for (var j = 0; j < attrs.length; j++) {
                var name = getNodeValue(attrs[j], "Name");
                var value = getNodeValue(attrs[j], "Value");
                switch (name) {
                case "":
                    break;
                case "SentTimestamp":
                case "ApproximateFirstReceiveTimestamp":
                    msg[name] = new Date(value * 1000);
                    break;
                default:
                    msg[name] = value;
                }
            }
            list.push(msg);
        }
        response.result = list;
    },

    addPermission : function(url, label, actions, callback)
    {
        var params = [ ["Label", label]];
        for (var i = 0; i < actions.length; i++) {
            params.push(["ActionName." + (i + 1), actions[i].name]);
            params.push(["AWSAccountId." + (i + 1), actions[i].id]);
        }
        ew_session.querySQS(url, "AddPermission", params, this, false, "onComplete:QueueUrl", callback);
    },

    removePermission : function(url, label, callback)
    {
        ew_session.querySQS(url, "RemovePermission", [["Label", label]], this, false, "onComplete", callback);
    },
};
