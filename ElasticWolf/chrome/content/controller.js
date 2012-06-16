// controller: slightly higher level of abstraction over the EC2 API
var ew_controller = {
    session: null,

    getNsResolver : function()
    {
        var me = this.session;
        return function(prefix) {
            var ns = { 's':  "http://schemas.xmlsoap.org/soap/envelope/",
                       'monitoring': "http://monitoring.amazonaws.com/doc/" + me.CW_API_VERSION + "/",
                       'ec2': "http://ec2.amazonaws.com/doc/" + me.EC2_API_VERSION + "/" };
            return ns[prefix] || null;
        }
    },

    // Call the method
    onResponseComplete : function(responseObj)
    {
        if (this[responseObj.method]) {
            this[responseObj.method](responseObj);
        } else {
           alert('Error calling handler ' + responseObj.method + ' for ' + responseObj.action);
        }
    },

    // Common controller response callback when there is no need to parse result but only to call user callback
    onComplete : function(responseObj)
    {
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

    onCompleteDescribeVolumes : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeVolumesResponse/ec2:volumeSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "volumeId");
            var size = getNodeValue(items.snapshotItem(i), "size");
            var snapshotId = getNodeValue(items.snapshotItem(i), "snapshotId");

            var zone = getNodeValue(items.snapshotItem(i), "availabilityZone");
            var status = getNodeValue(items.snapshotItem(i), "status");
            var createTime = new Date();
            createTime.setISO8601(getNodeValue(items.snapshotItem(i), "createTime"));

            // Zero out the values for attachment
            var instanceId = "";
            var device = "";
            var attachStatus = "";
            var attachTime = new Date();
            // Make sure there is an attachment
            if (items.snapshotItem(i).getElementsByTagName("attachmentSet")[0].firstChild) {
                instanceId = getNodeValue(items.snapshotItem(i), "instanceId");
                device = getNodeValue(items.snapshotItem(i), "device");
                attachStatus = items.snapshotItem(i).getElementsByTagName("status")[1].firstChild;
                if (attachStatus) {
                    attachStatus = attachStatus.nodeValue;
                }
                attachTime.setISO8601(getNodeValue(items.snapshotItem(i), "attachTime"));
            }
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new Volume(id, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, tags));
        }

        ew_model.set('volumes', list);
        responseObj.result = list;
    },

    describeSnapshots : function(callback)
    {
        ew_session.queryEC2("DescribeSnapshots", [], this, false, "onCompleteDescribeSnapshots", callback);
    },

    onCompleteDescribeSnapshots : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeSnapshotsResponse/ec2:snapshotSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "snapshotId");
            var volumeId = getNodeValue(items.snapshotItem(i), "volumeId");
            var status = getNodeValue(items.snapshotItem(i), "status");
            var startTime = new Date();
            startTime.setISO8601(getNodeValue(items.snapshotItem(i), "startTime"));
            var progress = getNodeValue(items.snapshotItem(i), "progress");
            var volumeSize = getNodeValue(items.snapshotItem(i), "volumeSize");
            var description = getNodeValue(items.snapshotItem(i), "description");
            var ownerId = getNodeValue(items.snapshotItem(i), "ownerId")
            var ownerAlias = getNodeValue(items.snapshotItem(i), "ownerAlias")
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new Snapshot(id, volumeId, status, startTime, progress, volumeSize, description, ownerId, ownerAlias, tags));
        }

        ew_model.set('snapshots', list);
        responseObj.result = list;
    },

    describeSnapshotAttribute: function(id, callback) {
        ew_session.queryEC2("DescribeSnapshotAttribute", [ ["SnapshotId", id], ["Attribute", "createVolumePermission"] ], this, false, "onCompleteDescribeSnapshotAttribute", callback);
    },

    onCompleteDescribeSnapshotAttribute : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
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

        responseObj.result = list;
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

    onCompleteDescribeVpcs : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeVpcsResponse/ec2:vpcSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "vpcId");
            var cidr = getNodeValue(items.snapshotItem(i), "cidrBlock");
            var state = getNodeValue(items.snapshotItem(i), "state");
            var dhcpopts = getNodeValue(items.snapshotItem(i), "dhcpOptionsId");
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new Vpc(id, cidr, state, dhcpopts, tags));
        }
        ew_model.set('vpcs', list);
        responseObj.result = list;
    },

    createVpc : function(cidr, callback)
    {
        ew_session.queryEC2("CreateVpc", [ [ "CidrBlock", cidr ] ], this, false, "onComplete", callback);
    },

    deleteVpc : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpc", [ [ "VpcId", id ] ], this, false, "onComplete", callback);
    },

    describeSubnets : function(callback)
    {
        ew_session.queryEC2("DescribeSubnets", [], this, false, "onCompleteDescribeSubnets", callback);
    },

    onCompleteDescribeSubnets : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeSubnetsResponse/ec2:subnetSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "subnetId");
            var vpcId = getNodeValue(items.snapshotItem(i), "vpcId");
            var cidrBlock = getNodeValue(items.snapshotItem(i), "cidrBlock");
            var state = getNodeValue(items.snapshotItem(i), "state");
            var availableIp = getNodeValue(items.snapshotItem(i), "availableIpAddressCount");
            var availabilityZone = getNodeValue(items.snapshotItem(i), "availabilityZone");
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new Subnet(id, vpcId, cidrBlock, state, availableIp, availabilityZone, tags));
        }
        ew_model.set('subnets', list);
        responseObj.result = list;
    },

    createSubnet : function(vpcId, cidr, az, callback)
    {
        ew_session.queryEC2("CreateSubnet", [ [ "CidrBlock", cidr ], [ "VpcId", vpcId ], [ "AvailabilityZone", az ] ], this, false, "onComplete", callback);
    },

    deleteSubnet : function(id, callback)
    {
        ew_session.queryEC2("DeleteSubnet", [ [ "SubnetId", id ] ], this, false, "onComplete", callback);
    },

    describeDhcpOptions : function(callback)
    {
        ew_session.queryEC2("DescribeDhcpOptions", [], this, false, "onCompleteDescribeDhcpOptions", callback);
    },

    onCompleteDescribeDhcpOptions : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeDhcpOptionsResponse/ec2:dhcpOptionsSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "dhcpOptionsId");
            var options = new Array();

            var optTags = items.snapshotItem(i).getElementsByTagName("dhcpConfigurationSet")[0];
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
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new DhcpOptions(id, options.join("; "), tags));
        }
        ew_model.set('dhcpOptions', list);
        responseObj.result = list;
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
        var params = [ [ "NetworkAclId", aclId ], [ "RuleNumber", num], ["Protocol", proto], ["RuleAction", action], ["Egress", egress], ["CidrBlock", cidr] ];
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
        ew_session.queryEC2("CreateNetworkAcl", [ [ "VpcId", vpcId ] ], this, false, "onComplete", callback);
    },

    deleteNetworkAcl : function(id, callback)
    {
        ew_session.queryEC2("DeleteNetworkAcl", [ [ "NetworkAclId", id ] ], this, false, "onComplete", callback);
    },

    describeNetworkAcls : function(callback)
    {
        ew_session.queryEC2("DescribeNetworkAcls", [], this, false, "onCompleteDescribeNetworkAcls", callback);
    },

    onCompleteDescribeNetworkAcls : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeNetworkAclsResponse/ec2:networkAclSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var entryList = [], assocList = []
            var id = getNodeValue(items.snapshotItem(i), "networkAclId");
            var vpcId = getNodeValue(items.snapshotItem(i), "vpcId");
            var dflt = getNodeValue(items.snapshotItem(i), "default");

            var entries = items.snapshotItem(i).getElementsByTagName("entrySet")[0].getElementsByTagName("item");
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

            var assoc = items.snapshotItem(i).getElementsByTagName("associationSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < assoc.length; j++) {
                var aid = getNodeValue(assoc[j], "networkAclAssociationId");
                var acl = getNodeValue(assoc[j], "networkAclId");
                var subnet = getNodeValue(assoc[j], "subnetId");
                assocList.push(new NetworkAclAssociation(aid, acl, subnet))
            }
            list.push(new NetworkAcl(id, vpcId, dflt, entryList, assocList));
        }

        ew_model.set('networkAcls', list);
        responseObj.result = list;
    },

    describeVpnGateways : function(callback)
    {
        ew_session.queryEC2("DescribeVpnGateways", [], this, false, "onCompleteDescribeVpnGateways", callback);
    },

    onCompleteDescribeVpnGateways : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeVpnGatewaysResponse/ec2:vpnGatewaySet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "vpnGatewayId");
            var availabilityZone = getNodeValue(items.snapshotItem(i), "availabilityZone");
            var type = getNodeValue(items.snapshotItem(i), "type");
            var state = getNodeValue(items.snapshotItem(i), "state");
            var attachments = new Array();

            var atttags = items.snapshotItem(i).getElementsByTagName("attachments")[0].getElementsByTagName("item");
            for ( var j = 0; j < atttags.length; j++) {
                var vpcId = getNodeValue(atttags[j], "vpcId");
                var attstate = getNodeValue(atttags[j], "state");
                var att = new VpnGatewayAttachment(vpcId, id, attstate)
                attachments.push(att)
            }
            list.push(new VpnGateway(id, availabilityZone, state, type, attachments));
        }
        ew_model.set('vpnGateways', list);
        responseObj.result = list;
    },

    createVpnGateway : function(type, az, callback)
    {
        ew_session.queryEC2("CreateVpnGateway", [ [ "Type", type ], [ "AvailabilityZone", az ] ], this, false, "onComplete", callback);
    },

    deleteVpnGateway : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpnGateway", [ [ "VpnGatewayId", id ] ], this, false, "onComplete", callback);
    },

    describeCustomerGateways : function(callback)
    {
        ew_session.queryEC2("DescribeCustomerGateways", [], this, false, "onCompleteDescribeCustomerGateways", callback);
    },

    onCompleteDescribeCustomerGateways : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeCustomerGatewaysResponse/ec2:customerGatewaySet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "customerGatewayId");
            var type = getNodeValue(items.snapshotItem(i), "type");
            var state = getNodeValue(items.snapshotItem(i), "state");
            var ipAddress = getNodeValue(items.snapshotItem(i), "ipAddress");
            var bgpAsn = getNodeValue(items.snapshotItem(i), "bgpAsn");
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new CustomerGateway(id, ipAddress, bgpAsn, state, type, tags));
        }
        ew_model.set('customerGateways', list);
        responseObj.result = list;
    },

    createCustomerGateway : function(type, ip, asn, callback)
    {
        ew_session.queryEC2("CreateCustomerGateway", [ [ "Type", type ], [ "IpAddress", ip ], [ "BgpAsn", asn ] ], this, false, "onComplete", callback);
    },

    deleteCustomerGateway : function(id, callback)
    {
        ew_session.queryEC2("DeleteCustomerGateway", [ [ "CustomerGatewayId", id ] ], this, false, "onComplete", callback);
    },

    describeInternetGateways : function(callback)
    {
        ew_session.queryEC2("DescribeInternetGateways", [], this, false, "onCompleteDescribeInternetGateways", callback);
    },

    onCompleteDescribeInternetGateways : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeInternetGatewaysResponse/ec2:internetGatewaySet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var vpcId = null, tags = []
            var id = getNodeValue(items.snapshotItem(i), "internetGatewayId");

            var etags = items.snapshotItem(i).getElementsByTagName("attachmentSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < etags.length; j++) {
                vpcId = getNodeValue(etags[j], "vpcId");
            }
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new InternetGateway(id, vpcId, tags));
        }
        ew_model.set('internetGateways', list);
        responseObj.result = list;
    },

    createInternetGateway : function(callback)
    {
        ew_session.queryEC2("CreateInternetGateway", [], this, false, "onComplete", callback);
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

    onCompleteDescribeVpnConnections : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        // required due to the size of the customer gateway config
        // being very close to or in excess of 4096 bytes
        xmlDoc.normalize();

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeVpnConnectionsResponse/ec2:vpnConnectionSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "vpnConnectionId");
            var cgwId = getNodeValue(items.snapshotItem(i), "customerGatewayId");
            var vgwId = getNodeValue(items.snapshotItem(i), "vpnGatewayId");
            var type = getNodeValue(items.snapshotItem(i), "type");
            var state = getNodeValue(items.snapshotItem(i), "state");
            var ipAddress = getNodeValue(items.snapshotItem(i), "ipAddress");
            // Required since Firefox limits nodeValue to 4096 bytes
            var cgwtag = items.snapshotItem(i).getElementsByTagName("customerGatewayConfiguration")
            var config = null;
            if (cgwtag[0]) {
                config = cgwtag[0].textContent;
            }

            var bgpAsn = getNodeValue(items.snapshotItem(i), "bgpAsn");
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new VpnConnection(id, vgwId, cgwId, type, state, config, tags));
        }
        ew_model.set('vpnConnections', list);
        responseObj.result = list;
    },

    createVpnConnection : function(type, cgwid, vgwid, callback)
    {
        ew_session.queryEC2("CreateVpnConnection", [ [ "Type", type ], [ "CustomerGatewayId", cgwid ], [ "VpnGatewayId", vgwid ] ], this, false, "onComplete", callback);
    },

    deleteVpnConnection : function(id, callback)
    {
        ew_session.queryEC2("DeleteVpnConnection", [ [ "VpnConnectionId", id ] ], this, false, "onComplete", callback);
    },

    attachVpnGatewayToVpc : function(vgwid, vpcid, callback)
    {
        ew_session.queryEC2("AttachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    detachVpnGatewayFromVpc : function(vgwid, vpcid, callback)
    {
        ew_session.queryEC2("DetachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    describeImage : function(imageId, callback)
    {
        ew_session.queryEC2("DescribeImages", [ [ "ImageId", imageId ] ], this, false, "onCompleteDescribeImage", callback);
    },

    onCompleteDescribeImage : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var items = xmlDoc.evaluate("/ec2:DescribeImagesResponse/ec2:imagesSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var item = items.snapshotItem(0);
        var ami = null;

        if (item) {
            var imageId = getNodeValue(item, "imageId");
            var imageLocation = getNodeValue(item, "imageLocation");
            var imageState = getNodeValue(item, "imageState");
            var owner = getNodeValue(item, "imageOwnerId");
            var isPublic = getNodeValue(item, "isPublic");
            var platform = getNodeValue(item, "platform");
            var aki = getNodeValue(item, "kernelId");
            var ari = getNodeValue(item, "ramdiskId");
            var rdt = getNodeValue(item, "rootDeviceType");
            var ownerAlias = getNodeValue(item, "imageOwnerAlias");
            var name = getNodeValue(item, "name");
            var description = getNodeValue(item, "description");
            var snapshotId = getNodeValue(item, "snapshotId");
            var tags = this.getTags(item);
            ami = new AMI(imageId, imageLocation, imageState, owner, (isPublic == 'true' ? 'public' : 'private'), platform, aki, ari, rdt, ownerAlias, name, description, snapshotId, tags);
        }
        responseObj.result = ami;
    },

    createImage : function(instanceId, amiName, amiDescription, noReboot, callback)
    {
        var noRebootVal = noReboot ? "true" : "false";

        ew_session.queryEC2("CreateImage", [ [ "InstanceId", instanceId ], [ "Name", amiName ], [ "Description", amiDescription ], [ "NoReboot", noRebootVal ] ], this, false, "onCompleteCreateImage", callback);
    },

    onCompleteCreateImage: function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        responseObj.result = getNodeValue(xmlDoc, "imageId");
    },

    describeImages : function( callback)
    {
        ew_session.queryEC2("DescribeImages", [], this, false, "onCompleteDescribeImages", callback);
    },

    onCompleteDescribeImages : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var img = null;
        var items = xmlDoc.evaluate("/ec2:DescribeImagesResponse/ec2:imagesSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var imageId = getNodeValue(items.snapshotItem(i), "imageId");
            var imageLocation = getNodeValue(items.snapshotItem(i), "imageLocation");
            var imageState = getNodeValue(items.snapshotItem(i), "imageState");
            var owner = getNodeValue(items.snapshotItem(i), "imageOwnerId");
            var isPublic = getNodeValue(items.snapshotItem(i), "isPublic");
            var arch = getNodeValue(items.snapshotItem(i), "architecture");
            var rdt = getNodeValue(items.snapshotItem(i), "rootDeviceType");
            var ownerAlias = getNodeValue(items.snapshotItem(i), "imageOwnerAlias");
            var name = getNodeValue(items.snapshotItem(i), "name");
            var description = getNodeValue(items.snapshotItem(i), "description");
            var snapshotId = getNodeValue(items.snapshotItem(i), "snapshotId");

            // These value might not exist, but getNodeValue
            // returns "" in case the element is not defined.
            var platform = getNodeValue(items.snapshotItem(i), "platform");
            var aki = getNodeValue(items.snapshotItem(i), "kernelId");
            var ari = getNodeValue(items.snapshotItem(i), "ramdiskId");
            var tags = this.getTags(items.snapshotItem(i));

            list.push(new AMI(imageId, imageLocation, imageState, owner, (isPublic == 'true' ? 'public' : 'private'), arch, platform, aki, ari, rdt, ownerAlias, name, description, snapshotId, tags));
        }

        ew_model.set('images', list);
        responseObj.result = list;
    },

    describeLeaseOfferings : function(callback)
    {
        ew_session.queryEC2("DescribeReservedInstancesOfferings", [], this, false, "onCompleteDescribeLeaseOfferings", callback);
    },

    onCompleteDescribeLeaseOfferings : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var img = null;
        var items = xmlDoc.evaluate("/ec2:DescribeReservedInstancesOfferingsResponse/ec2:reservedInstancesOfferingsSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "reservedInstancesOfferingId");
            var type = getNodeValue(items.snapshotItem(i), "instanceType");
            var az = getNodeValue(items.snapshotItem(i), "availabilityZone");
            var duration = secondsToYears(getNodeValue(items.snapshotItem(i), "duration"));
            var fPrice = parseInt(getNodeValue(items.snapshotItem(i), "fixedPrice")).toString();
            var uPrice = getNodeValue(items.snapshotItem(i), "usagePrice");
            var desc = getNodeValue(items.snapshotItem(i), "productDescription");
            var otype = getNodeValue(items.snapshotItem(i), "offeringType");
            var tenancy = getNodeValue(items.snapshotItem(i), "instanceTenancy");
            var rPrices = this.getItems(items.snapshotItem(i), "recurringCharges", "item", ["frequency", "amount"], function(obj) { return new RecurringCharge(obj.frequency, obj.amount)});

            list.push(new LeaseOffering(id, type, az, duration, fPrice, uPrice, rPrices, desc, otype, tenancy));
        }

        ew_model.set('offerings', list);
        responseObj.result = list;
    },

    describeReservedInstances : function(callback)
    {
        ew_session.queryEC2("DescribeReservedInstances", [], this, false, "onCompleteDescribeReservedInstances", callback);
    },

    onCompleteDescribeReservedInstances : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var img = null;
        var items = xmlDoc.evaluate("/ec2:DescribeReservedInstancesResponse/ec2:reservedInstancesSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var item = items.snapshotItem(i);
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

        ew_model.set('reservedInstances', list);
        responseObj.result = list;
    },

    purchaseOffering : function(id, count, callback)
    {
        ew_session.queryEC2("PurchaseReservedInstancesOffering", [ [ "ReservedInstancesOfferingId", id ], [ "InstanceCount", count ] ], this, false, "onComplete", callback);
    },

    describeLaunchPermissions : function(imageId, callback)
    {
        ew_session.queryEC2("DescribeImageAttribute", [ [ "ImageId", imageId ], [ "Attribute", "launchPermission" ] ], this, false, "onCompleteDescribeLaunchPermissions", callback);
    },

    onCompleteDescribeLaunchPermissions : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

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

        responseObj.result = list;
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

    onCompleteDescribeInstances : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeInstancesResponse/ec2:reservationSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var k = 0; k < items.snapshotLength; k++) {
            var reservationId = getNodeValue(items.snapshotItem(k), "reservationId");
            var ownerId = getNodeValue(items.snapshotItem(k), "ownerId");
            var requesterId = getNodeValue(items.snapshotItem(k), "requesterId");
            var groups = [];
            var objs = this.getItems(items.snapshotItem(k), "groupSet", "item", ["groupId", "groupName"]);
            for (var j = 0; j < objs.length; j++) {
                groups.push(new Group(objs[j].groupId, objs[j].groupName));
            }
            var instancesSet = items.snapshotItem(k).getElementsByTagName("instancesSet")[0];
            var instanceItems = instancesSet.childNodes;
            if (instanceItems) {
                for (var j = 0; j < instanceItems.length; j++) {
                    if (instanceItems[j].nodeName == '#text') continue;
                    var instance = instanceItems[j];
                    var instanceId = getNodeValue(instance, "instanceId");
                    var imageId = getNodeValue(instance, "imageId");
                    var state = getNodeValue(instance, "instanceState", "name");
                    var productCodes = [];
                    var objs = this.getItems(instance, "productCodes", "item", ["productCode", "type"]);
                    for (var i = 0; i < objs.length; i++) {
                        list.push(new Group(objs[i].productCode, objs[i].type));
                    }
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
                    var volumes = [];
                    var objs = this.getItems(instance, "blockDeviceMapping", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var vdevice = getNodeValue(objs[i], "deviceName");
                        var vid = getNodeValue(objs[i], "ebs", "volumeId");
                        var vstatus = getNodeValue(objs[i], "ebs", "status");
                        var vtime = getNodeValue(objs[i], "ebs", "attachTime");
                        var vdel = getNodeValue(objs[i], "ebs", "deleteOnTermination");
                        volumes.push(new InstanceVolumeAttachment(vid, vdevice, vstatus, vtime, vdel));
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
                                           clientToken, volumes, enis, tags));
                }
            }
        }

        ew_model.set('instances', list);
        responseObj.result = list;
    },

    runMoreInstances: function(instance, count, callback) {
        ew_session.controller.describeInstanceAttribute(instance.id, "userData", function(data) {
            var placement = { availabilityZone: instance.availabilityZone, tenancy: instance.tenancy };
            this.runInstances(instance.imageId, instance.kernelId, instance.ramdiskId, count, count, instance.keyName, instance.groups, data, null, instance.instanceType, placement, instance.subnetId, null, callback);
        });
    },

    runInstances : function(imageId, kernelId, ramdiskId, minCount, maxCount, keyName, securityGroups, userData, properties, instanceType, placement, subnetId, ipAddress, callback)
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
            log(userData);
            params.push([ "UserData", userData ]);
        }
        if (properties != null) {
            params.push([ "AdditionalInfo", properties ]);
        }
        if (placement) {
            if (placement.availabilityZone != null && placement.availabilityZone != "") {
                params.push([ "Placement.AvailabilityZone", placement.availabilityZone ]);
            }
            if (placement.tenancy != null && placement.tenancy != "") {
                params.push([ "Placement.Tenancy", placement.tenancy ]);
            }
        }
        if (subnetId != null) {
            params.push([ "SubnetId", subnetId ]);

            if (ipAddress != null && ipAddress != "") {
                params.push([ "PrivateIpAddress", ipAddress ]);
            }
        }

        ew_session.queryEC2("RunInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    onCompleteRunInstances : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = this.getItems(xmlDoc, "instancesSet", "item", "instanceId");

        responseObj.result = list;
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

    onCompleteBundleInstance : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var item = xmlDoc.getElementsByTagName("bundleInstanceTask")[0];
        if (!item) return;
        responseObj.result = this.unpackBundleTask(item);
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

    onCompleteDescribeBundleTasks : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeBundleTasksResponse/ec2:bundleInstanceTasksSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; ++i) {
            list.push(this.unpackBundleTask(items.snapshotItem(i)));
        }

        ew_model.set('bundleTasks', list);
        responseObj.result = list;
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

    onCompleteListS3Buckets : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var owner = getNodeValue(xmlDoc, "ID")
        var items = xmlDoc.getElementsByTagName("Bucket");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "Name");
            var date = getNodeValue(items[i], "CreationDate");
            list.push(new S3Bucket(name, date, owner));
        }
        ew_model.set('s3Buckets', list);

        responseObj.result = list;
    },

    getS3BucketAcl : function(bucket, callback)
    {
        ew_session.queryS3("GET", bucket, "", "?acl", {}, content, this, false, "onCompleteGetS3BucketAcl", callback);
    },

    onCompleteGetS3BucketAcl : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];

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
        var obj = ew_model.getS3Bucket(bucket)
        if (obj) obj.acls = list; else obj = { acls: list };

        responseObj.result = list;
    },

    setS3BucketAcl : function(bucket, content, callback)
    {
        ew_session.queryS3("PUT", bucket, "", "?acl", {}, content, this, false, "onCompleteSetS3BucketAcl", callback);
    },

    onCompleteSetS3BucketAcl : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];
        var obj = ew_model.getS3Bucket(bucket);
        if (obj) obj.acls = null; else obj = { acls: list };

        responseObj.result = obj;
    },

    // Without callback it uses sync mode and returns region
    getS3BucketLocation : function(bucket, callback)
    {
        ew_session.queryS3("GET", bucket, "", "?location", {}, null, this, callback ? false : true, "onCompleteGetS3BucketLocation", callback);
    },

    onCompleteGetS3BucketLocation : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];

        var region = getNodeValue(xmlDoc, "LocationConstraint");
        var obj = ew_model.getS3Bucket(bucket)
        if (obj) obj.region = region;

        responseObj.result = region;
    },

    listS3BucketKeys : function(bucket, params, callback)
    {
        ew_session.queryS3("GET", bucket, "", "", {}, null, this, false, "onCompleteListS3BucketKeys", callback);
    },

    onCompleteListS3BucketKeys : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

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
        var obj = ew_model.getS3Bucket(bucket);
        if (obj) obj.keys = list; else obj = { keys: list };

        responseObj.result = obj;
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

    onCompleteReadS3BucketKey : function(responseObj)
    {
        responseObj.result = responseObj.responseText;
    },

    putS3BucketKey : function(bucket, key, path, params, text, callback)
    {
        ew_session.queryS3("PUT", bucket, key, path, params, text, this, false, "onComplete", callback);
    },

    initS3BucketKeyUpload : function(bucket, key, params, callback)
    {
        ew_session.queryS3("POST", bucket, key, "?uploads", params, null, this, false, "onCompleteInitS3BucketKeyUpload", callback);
    },

    onCompleteInitS3BucketKeyUpload : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        responseObj.result = getNodeValue(xmlDoc, "UploadId");
    },

    uploadS3BucketFile : function(bucket, key, path, params, file, callback, progresscb)
    {
        ew_session.uploadS3(bucket, key, path, params, file, callback, progresscb);
    },

    getS3BucketKeyAcl : function(bucket, key, callback)
    {
        ew_session.queryS3("GET", bucket, key, "?acl", {}, null, this, false, "onCompleteGetS3BucketKeyAcl", callback);
    },

    onCompleteGetS3BucketKeyAcl : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];
        var key = responseObj.params[1];

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
        var obj = ew_model.getS3BucketKey(bucket, key)
        if (obj) obj.acls = list;

        responseObj.result = obj;
    },

    setS3BucketKeyAcl : function(bucket, key, content, callback)
    {
        ew_session.queryS3("PUT", bucket, key, "?acl", {}, content, this, false, "onCompleteSetS3BucketKeyAcl", callback);
    },

    onCompleteSetS3BucketKeyAcl : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];
        var key = responseObj.params[1];

        var obj = ew_model.getS3BucketKey(bucket, key)
        if (obj) obj.acls = null;

        responseObj.result = obj;
    },

    getS3BucketWebsite : function(bucket, callback)
    {
        ew_session.queryS3("GET", bucket, "", "?website", {}, null, this, false, "onCompleteGetS3BucketWebsite", callback);
    },

    onCompleteGetS3BucketWebsite : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var bucket = responseObj.params[0];
        var obj = ew_model.getS3Bucket(bucket);
        if (!obj) obj = {};

        if (responseObj.hasErrors) {
            // Ignore no website error
            if (responseObj.faultCode == "NoSuchWebsiteConfiguration") {
                responseObj.hasErrors = false;
            }
        } else {
            var doc = xmlDoc.getElementsByTagName("IndexDocument");
            obj.indexSuffix = getNodeValue(doc[0], "Suffix");
            var doc = xmlDoc.getElementsByTagName("ErrorDocument");
            obj.errorKey = getNodeValue(doc[0], "Key");

            responseObj.result = obj;
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

    onCompleteDescribeKeypairs : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "keyName");
            var fp = getNodeValue(items[i], "keyFingerprint");
            list.push(new KeyPair(name, fp));
        }

        ew_model.set('keypairs', list);
        responseObj.result = list;
    },

    createKeypair : function(name, callback)
    {
        ew_session.queryEC2("CreateKeyPair", [ [ "KeyName", name ] ], this, false, "onCompleteCreateKeyPair", callback);
    },

    onCompleteCreateKeyPair : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var name = getNodeValue(xmlDoc, "keyName");
        var fp = getNodeValue(xmlDoc, "keyFingerprint");
        var material = getNodeValue(xmlDoc, "keyMaterial");

        responseObj.result = new Keypair(name, fp, material);
    },

    deleteKeypair : function(name, callback)
    {
        ew_session.queryEC2("DeleteKeyPair", [ [ "KeyName", name ] ], this, false, "onComplete", callback);
    },

    describeRouteTables : function(callback)
    {
        ew_session.queryEC2("DescribeRouteTables", [], this, false, "onCompleteDescribeRouteTables", callback);
    },

    onCompleteDescribeRouteTables : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeRouteTablesResponse/ec2:routeTableSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var routes = [], associations = []
            var id = getNodeValue(items.snapshotItem(i), "routeTableId");
            var vpcId = getNodeValue(items.snapshotItem(i), "vpcId");

            var routeItems = items.snapshotItem(i).getElementsByTagName("routeSet")[0].childNodes;
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
            var assocSet = items.snapshotItem(i).getElementsByTagName("associationSet")[0];
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
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new RouteTable(id, vpcId, routes, associations, tags));
        }
        ew_model.set('routeTables', list);
        responseObj.result = list;
    },

    createRouteTable : function(vpcId, callback)
    {
        ew_session.queryEC2("CreateRouteTable", [["VpcId", vpcId]], this, false, "onComplete", callback);
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
        ew_session.queryEC2("AssociateRouteTable", [["RouteTableId", tableId], ["SubnetId", subnetId]], this, false, "onComplete", callback);
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
        ew_session.queryEC2("CreateNetworkInterface", params, this, false, "onComplete", callback);
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

    onCompleteDescribeNetworkInterfaces : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeNetworkInterfacesResponse/ec2:networkInterfaceSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var id = getNodeValue(items.snapshotItem(i), "networkInterfaceId");
            var subnetId = getNodeValue(items.snapshotItem(i), "subnetId");
            var vpcId = getNodeValue(items.snapshotItem(i), "vpcId");
            var descr = getNodeValue(items.snapshotItem(i), "description");
            var status = getNodeValue(items.snapshotItem(i), "status");
            var mac = getNodeValue(items.snapshotItem(i), "macAddress");
            var ip = getNodeValue(items.snapshotItem(i), "privateIpAddress");
            var check = getNodeValue(items.snapshotItem(i), "sourceDestCheck");
            var azone = getNodeValue(items.snapshotItem(i), "availabilityZone");
            var tags = [];
            var attachment = null;
            var association = null;

            var aitem = items.snapshotItem(i).getElementsByTagName("attachment")[0];
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

            aitem = items.snapshotItem(i).getElementsByTagName("association")[0];
            if (aitem) {
                aid = getNodeValue(aitem, "associationId");
                var pubip = getNodeValue(aitem, "publicIp");
                var owner = getNodeValue(aitem, "ipOwnerId");
                var instId = getNodeValue(aitem, "instanceID");
                var attId = getNodeValue(aitem, "attachmentID");
                association = new NetworkInterfaceAssociation(aid, pubip, owner, instId, attId);
            }
            var groups = this.getGroups(items.snapshotItem(i));
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new NetworkInterface(id, status, descr, subnetId, vpcId, azone, mac, ip, check, groups, attachment, association, tags));
        }

        ew_model.set('networkInterfaces', list);
        responseObj.result = list;
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

    onCompleteDescribeSecurityGroups : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.evaluate("/ec2:DescribeSecurityGroupsResponse/ec2:securityGroupInfo/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; i++) {
            var ownerId = getNodeValue(items.snapshotItem(i), "ownerId");
            var groupId = getNodeValue(items.snapshotItem(i), "groupId");
            var groupName = getNodeValue(items.snapshotItem(i), "groupName");
            var groupDescription = getNodeValue(items.snapshotItem(i), "groupDescription");
            var vpcId = getNodeValue(items.snapshotItem(i), "vpcId");
            log("Group name [id=" + groupId + ", name=" + groupName + ", vpcId=" + vpcId + "]");

            var ipPermissions = items.snapshotItem(i).getElementsByTagName("ipPermissions")[0];
            var ipPermissionsList = this.parsePermissions('Ingress', [], ipPermissions.childNodes);
            ipPermissions = items.snapshotItem(i).getElementsByTagName("ipPermissionsEgress")[0];
            ipPermissionsList = this.parsePermissions('Egress', ipPermissionsList, ipPermissions.childNodes);
            var tags = this.getTags(items.snapshotItem(i));
            list.push(new SecurityGroup(groupId, ownerId, groupName, groupDescription, vpcId, ipPermissionsList, tags));
        }

        ew_model.set('securityGroups', list);
        responseObj.result = list;
    },

    createSecurityGroup : function(name, desc, vpcId, callback)
    {
        var params = [];
        params.push([ "GroupName", name ]);
        params.push([ "GroupDescription", desc ]);
        if (vpcId && vpcId != "") {
            params.push([ "VpcId", vpcId ])
        }
        ew_session.queryEC2("CreateSecurityGroup", params, this, false, "onComplete", callback, null);
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

    onCompleteGetConsoleOutput : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var instanceId = getNodeValue(xmlDoc, "instanceId");
        var timestamp = getNodeValue(xmlDoc, "timestamp");
        var output = xmlDoc.getElementsByTagName("output")[0];
        if (output.textContent) {
            output = Base64.decode(output.textContent);
            output = output.replace(/\x1b/mg, "\n").replace(/\r/mg, "").replace(/\n+/mg, "\n");
        } else {
            output = '';
        }
        responseObj.result = output;
    },

    describeAvailabilityZones : function(callback)
    {
        ew_session.queryEC2("DescribeAvailabilityZones", [], this, false, "onCompleteDescribeAvailabilityZones", callback);
    },

    onCompleteDescribeAvailabilityZones : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "zoneName");
            var state = getNodeValue(items[i], "zoneState");
            list.push(new AvailabilityZone(name, state));
        }

        ew_model.set('availabilityZones', list);
        responseObj.result = list;
    },

    describeAddresses : function(callback)
    {
        ew_session.queryEC2("DescribeAddresses", [], this, false, "onCompleteDescribeAddresses", callback);
    },

    onCompleteDescribeAddresses : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

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
        ew_model.set('addresses', list);
        responseObj.result = list;
    },

    allocateAddress : function(vpc, callback)
    {
        var params = vpc ? [["Domain", "vpc"]] : []
        ew_session.queryEC2("AllocateAddress", params, this, false, "onComplete", callback);
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
        ew_session.queryEC2("AssociateAddress", params, this, false, "onComplete", callback);
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

    onCompleteDescribeRegions : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = [];
        var items = xmlDoc.evaluate("/ec2:DescribeRegionsResponse/ec2:regionInfo/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for ( var i = 0; i < items.snapshotLength; ++i) {
            var name = getNodeValue(items.snapshotItem(i), "regionName");
            var url = getNodeValue(items.snapshotItem(i), "regionEndpoint");
            if (url.indexOf("https://") != 0) {
                url = "https://" + url;
            }
            list.push(new Endpoint(name, url));
        }

        responseObj.result = list;
    },

    describeLoadBalancers : function(callback)
    {
        ew_session.queryELB("DescribeLoadBalancers", [], this, false, "onCompleteDescribeLoadBalancers", callback);
    },

    onCompleteDescribeLoadBalancers : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
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
            ew_model.set('loadBalancers', list);
            responseObj.result = list;
        }
    },

    describeInstanceHealth : function(LoadBalancerName, callback)
    {
        var params =[ [ "LoadBalancerName", LoadBalancerName ] ];

        ew_session.queryELB("DescribeInstanceHealth", params, this, false, "onCompleteDescribeInstanceHealth", callback);
    },

    onCompleteDescribeInstanceHealth : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var Description = getNodeValue(items[i], "Description");
            var State = getNodeValue(items[i], "State");
            var InstanceId = getNodeValue(items[i], "InstanceId");
            var ReasonCode = getNodeValue(items[i], "ReasonCode");

            list.push(new InstanceHealth(Description, State, InstanceId, ReasonCode));
        }

        var elb = ew_model.find('loadBalancers', responseObj.params[0][1]);
        if (elb) elb.InstanceHealth = list;

        responseObj.result = list;
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

    onCompleteDescribeTags : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var items = xmlDoc.evaluate("/ec2:DescribeTagsResponse/ec2:tagSet/ec2:item", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        var tags = new Array();

        for ( var i = 0; i < items.snapshotLength; ++i) {
            var id = getNodeValue(items.snapshotItem(i), "resourceId");
            var key = getNodeValue(items.snapshotItem(i), "key");
            var value = getNodeValue(items.snapshotItem(i), "value");
            tags.push(new Tag(key, value, id));
        }

        responseObj.result = tags;
    },

    describeInstanceAttribute : function(instanceId, attribute, callback)
    {
        ew_session.queryEC2("DescribeInstanceAttribute", [[ "InstanceId", instanceId ], [ "Attribute", attribute ]], this, false, "onCompleteDescribeInstanceAttribute", callback);
    },

    onCompleteDescribeInstanceAttribute : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var items = xmlDoc.evaluate("/ec2:DescribeInstanceAttributeResponse/*", xmlDoc, this.getNsResolver(), XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var value = getNodeValue(items.snapshotItem(2), "value");

        responseObj.result = value;
    },

    modifyInstanceAttribute : function(instanceId, name, value, callback)
    {
        ew_session.queryEC2("ModifyInstanceAttribute", [ [ "InstanceId", instanceId ], [ name + ".Value", value ] ], this, false, "onComplete", callback);
    },

    describeInstanceStatus : function (callback) {
        ew_session.queryEC2("DescribeInstanceStatus", [], this, false, "onCompleteDescribeInstanceStatus", callback);
    },

    onCompleteDescribeInstanceStatus : function (responseObj) {
        var xmlDoc = responseObj.xmlDoc;
        var items = xmlDoc.evaluate("/ec2:DescribeInstanceStatusResponse/ec2:instanceStatusSet/ec2:item",xmlDoc,this.getNsResolver(),XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);

        for (var i = 0 ; i < items.snapshotLength; i++) {
            var item = items.snapshotItem(i);
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
            var instance = ew_model.find('instances', instanceId);
            if (instance) instance.events = list;
        }
    },

    describeVolumeStatus : function (callback) {
        ew_session.queryEC2("DescribeVolumeStatus", [], this, false, "onCompleteDescribeVolumeStatus", callback);
    },

    onCompleteDescribeVolumeStatus : function (responseObj) {
        var xmlDoc = responseObj.xmlDoc;
        var items = xmlDoc.evaluate("/ec2:DescribeVolumeStatus/ec2:volumeStatusSet/ec2:item",xmlDoc,this.getNsResolver(),XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
        var list = new Array();

        for(var i = 0 ; i < items.snapshotLength; i++) {
            var item = items.snapshotItem(i);
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

        responseObj.result = list;
    },

    createAccessKey : function(name, callback)
    {
        var params = []

        if (name) {
            params.push([ "UserName", name ])
        }
        ew_session.queryIAM("CreateAccessKey", params, this, false, "onCompleteCreateAccessKey", callback);
    },

    onCompleteCreateAccessKey : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var user = getNodeValue(xmlDoc, "UserName");
        var key = getNodeValue(xmlDoc, "AccessKeyId");
        var secret = getNodeValue(xmlDoc, "SecretAccessKey");
        debug("Access key = " + key + ", secret = " + secret)

        responseObj.result = new AccessKey(user, key, secret);
    },

    deleteAccessKey : function(id, callback)
    {
        ew_session.queryIAM("DeleteAccessKey", [ [ "AccessKeyId", id ] ], this, false, "onComplete", callback);
    },

    listAccessKeys : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        ew_session.queryIAM("ListAccessKeys", params, this, false, "onCompleteListAccessKeys", callback);
    },

    onCompleteListAccessKeys : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var params = responseObj.params;

        var user = getNodeValue(xmlDoc, "UserName");
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for (var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "AccessKeyId");
            var status = getNodeValue(items[i], "Status");
            list.push(new AccessKey(id, status, user, "", ew_session.accessCode == id ? "Current" : ""));
        }

        ew_model.update('users', getParam(params, 'UserName'), 'keys', list)

        responseObj.result = list;
    },

    listMFADevices : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        ew_session.queryIAM("ListMFADevices", params, this, false, "onCompleteListMFADevices", callback);
    },

    onCompleteListMFADevices : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var params = responseObj.params;

        var user = getNodeValue(xmlDoc, "UserName");

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for (var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "SerialNumber");
            list.push(id);
        }

        ew_model.update('users', getParam(params, 'UserName'), 'devices', list)

        responseObj.result = list;
    },

    listVirtualMFADevices : function(user, callback)
    {
        ew_session.queryIAM("ListVirtualMFADevices", [], this, false, "onCompleteListVirtualMFADevices", callback);
    },

    onCompleteListVirtualMFADevices : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = [];
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var serial = getNodeValue(items[i], "SerialNumber");
            var arn = getNodeValue(items[i], "Arn");
            var date = getNodeValue(items[i], "EnableDate");
            list.push(new MFADevice(serial, date, arn.split(/[:\/]+/).pop(), arn));
        }
        ew_model.set('vmfas', list);
        responseObj.result = list;
    },

    createVirtualMFADevice : function(name, path, callback)
    {
        ew_session.queryIAM("CreateVirtualMFADevice", [["VirtualMFADeviceName", name], [ "Path", path || "/" ]], this, false, "onCompleteCreateVirtualMFADevice", callback);
    },

    onCompleteCreateVirtualMFADevice : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var obj = [];
        obj.id = getNodeValue(xmlDoc, "SerialNumber");
        obj.seed = getNodeValue(xmlDoc, "Base32StringSeed");
        obj.qr = getNodeValue(xmlDoc, "QRCodePNG");

        responseObj.result = obj;
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

    deleteVirtualMFADevice: function(serial, callback)
    {
        ew_session.queryIAM("DeleteVirtualMFADevice", [ ["SerialNumber", serial] ], this, false, "onComplete", callback);
    },

    listUsers : function(callback)
    {
        ew_session.queryIAM("ListUsers", [], this, false, "onCompleteListUsers", callback);
    },

    onCompleteListUsers : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var params = responseObj.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "UserId");
            var name = getNodeValue(items[i], "UserName");
            var path = getNodeValue(items[i], "Path");
            var arn = getNodeValue(items[i], "Arn");
            list.push(new User(id, name, path, arn));
        }

        // Top level list need to update the model
        switch (responseObj.action) {
        case 'ListUsers':
            ew_model.set('users', list);
            break;

        case "GetGroup":
            for (var i in list) {
                var user = ew_model.find('users', list[i].id);
                if (user) list[i] = user;
            }
            ew_model.update('groups', getParam(params, 'GroupName'), 'users', list)
            break;
        }

        responseObj.result = list;
    },

    getUser : function(name, callback)
    {
        var params = [];
        if (name) params.push(["UserName", user])
        ew_session.queryIAM("GetUser", params, this, false, "onCompleteGetUser", callback);
    },

    onCompleteGetUser : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var id = getNodeValue(xmlDoc, "UserId");
        var name = getNodeValue(xmlDoc, "UserName");
        var path = getNodeValue(xmlDoc, "Path");
        var arn = getNodeValue(xmlDoc, "Arn");

        responseObj.result = new User(id, name, path, arn);
    },

    getUserPolicy : function(user, policy, callback)
    {
        ew_session.queryIAM("GetUserPolicy", [ ["UserName", user], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    putUserPolicy: function(user, name, text, callback)
    {
        ew_session.queryIAM("PutUserPolicy", [ ["UserName", user], [ "PolicyName", name ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    onCompleteGetPolicy : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        responseObj.result = decodeURIComponent(getNodeValue(xmlDoc, "PolicyDocument"));
    },

    createUser : function(name, path, callback)
    {
        ew_session.queryIAM("CreateUser", [ ["UserName", name], [ "Path", path || "/"] ], this, false, "onComplete", callback);
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

    onCompleteGetLoginProfile : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var name = getNodeValue(xmlDoc, "UserName");
        var date = getNodeValue(xmlDoc, "CreateDate");
        ew_model.update('users', name, 'loginProfileDate', date)

        responseObj.result = date;
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

    deleteUserPolicy : function(user, policy, callback)
    {
        ew_session.queryIAM("DeleteUserPolicy", [ ["UserName", name], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
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

    onCompleteListGroups : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var params = responseObj.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var path = getNodeValue(items[i], "Path");
            var name = getNodeValue(items[i], "GroupName");
            var id = getNodeValue(items[i], "GroupId");
            var arn = getNodeValue(items[i], "Arn");
            list.push(new UserGroup(id, name, path, arn));
        }

        // Update model directly
        switch (responseObj.action) {
        case 'ListGroups':
            ew_model.set('groups', list);
            break;

        case "ListGroupsForUser":
            ew_model.update('users', getParam(params, 'UserName'), 'groups', list)
            break;
        }

        responseObj.result = list;
    },

    listGroupPolicies : function(name, callback)
    {
        ew_session.queryIAM("ListGroupPolicies", [ ["GroupName", name]], this, false, "onCompleteListPolicies", callback);
    },

    onCompleteListPolicies : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var params = responseObj.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(items[i].firstChild.nodeValue);
        }

        // Update model directly
        switch(responseObj.action) {
        case "ListGroupPolicies":
            ew_model.update('groups', getParam(params, 'GroupName'), 'policies', list)
            break;

        case "ListUserPolicies":
            ew_model.update('users', getParam(params, 'UserName'), 'policies', list)
            break;
        }

        responseObj.result = list;
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
        ew_session.queryIAM("CreateGroup", [ ["GroupName", name], [ "Path", path || "/"] ], this, false, "onComplete", callback);
    },

    deleteGroup : function(name, callback)
    {
        ew_session.queryIAM("DeleteGroup", [ ["GroupName", name] ], this, false, "onComplete", callback);
    },

    getGroup : function(name, callback)
    {
        ew_session.queryIAM("GetGroup", [ ["GroupName", name]], this, false, "onCompleteListUsers", callback);
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

    onCompleteGetPasswordPolicy: function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var obj = {};

        // It is ok not to have a policy
        if (!responseObj.hasErrors) {
            obj.MinimumPasswordLength = getNodeValue(xmlDoc, 'MinimumPasswordLength');
            obj.RequireUppercaseCharacters = getNodeValue(xmlDoc, 'RequireUppercaseCharacters');
            obj.RequireLowercaseCharacters = getNodeValue(xmlDoc, 'RequireLowercaseCharacters');
            obj.RequireNumbers = getNodeValue(xmlDoc, 'RequireNumbers');
            obj.RequireSymbols = getNodeValue(xmlDoc, 'RequireSymbols');
            obj.AllowUsersToChangePassword = getNodeValue(xmlDoc, 'AllowUsersToChangePassword');
        } else {
            responseObj.hasErrors = false;
        }
        responseObj.result = obj;
    },

    updateAccountPasswordPolicy: function(obj, callback)
    {
        var params = []
        for (var p in obj) {
            params.push([ p, obj[p]])
        }
        ew_session.queryIAM("UpdateAccountPasswordPolicy", params, this, false, "onComplete", callback);
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

    onCompleteListSigningCertificates : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "CertificateId");
            var body = getNodeValue(items[i], "CertificateBody");
            var user = getNodeValue(items[i], "UserName");
            list.push(new Certificate(id, user, body));
        }

        // Update user record with the key list
        ew_model.update('users', user, 'certs', list)

        responseObj.result = list;
    },

    uploadSigningCertificate : function(user, body, callback)
    {
        var params = [ [ "CertificateBody", body ] ];
        if (user) params.push([["UserName", user]])
        ew_session.queryIAM("UploadSigningCertificate", params, this, false, "onComplete", callback);
    },

    deleteSigningCertificate : function(cert, callback)
    {
        ew_session.queryIAM("DeleteSigningCertificate", [ [ "CertificateId", cert ] ], this, false, "onComplete", callback);
    },

    describeAlarms : function(callback)
    {
        ew_session.queryCloudWatch("DescribeAlarms", [], this, false, "onCompleteDescribeAlarms", callback);
    },

    onCompleteDescribeAlarms : function(responseObj)
    {
        var xmlDoc = responseObj.xmlDoc;
        var items = xmlDoc.evaluate("/monitoring:DescribeAlarmsResponse/monitoring:DescribeAlarmsResult/monitoring:MetricAlarms/monitoring:member",xmlDoc,this.getNsResolver(),XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
        var alarms = new Array();

        // Not in GovCloud yet
        responseObj.hasErrors = false;

        for (var i = 0 ; i < items.snapshotLength; i++) {
            var item = items.snapshotItem(i);
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

        ew_model.set('alarms', alarms);

        responseObj.result = alarms;
    },


};
