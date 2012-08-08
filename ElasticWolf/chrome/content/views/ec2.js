//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_EC2TreeView = {

    cycleHeader : function(col) {
    },
    sort : function() {
    },
    getCellProperties : function(idx, column, prop)
    {
        if (this.treeList[idx].folder) {
            prop.AppendElement(this.getAtom("bold"));
        }
    },

    invalidate: function()
    {
        var list = [];
        var eips = this.core.queryModel('addresses','vpcId', null);
        var enis = this.core.queryModel('networkInterfaces','vpcId', null);
        var instances = this.core.queryModel('instances','vpcId', null, 'state', 'running');
        var groups = this.core.queryModel('securityGroups','vpcId', null);
        var snapshots = this.core.queryModel('snapshots','owner', this.core.user.accountId);
        var images = this.core.queryModel('images','owner', this.core.user.accountId);
        var rsrvd = this.core.queryModel('reservedInstances');

        this.listToInfo(instances, "Instances", list);
        this.listToInfo(groups, "Security Groups", list);
        this.listToInfo(enis, "Network Interfaces", list);
        this.listToInfo(eips, "Elastic IPs Interfaces", list);
        this.listToInfo(images, "Images", list);
        this.listToInfo(snapshots, "Snapshots", list);
        this.listToInfo(rsrvd, "Reserved Instances", list);

        if (!list.length) list.push({name: "Retrieving the data..."});
        TreeView.display.call(this, list);
    },

    listToInfo: function(items, title, list)
    {
        if (items.length) {
            list.push({ name: title, folder: 1 })
            for (var i in items) {
                list.push({ name: "     " + items[i].toString() });
            }
        }
    },

    isRefreshable: function()
    {
        return true;
    },
};

var ew_AMIsTreeView = {
    model : ['images','securityGroups','instances', 'keypairs', 'vpcs', 'subnets', 'availabilityZones', 'instanceProfiles' ],
    favorites: "ew.images.favorites",
    properties: ['ownerAlias', 'status', 'state'],

    menuChanged : function(event)
    {
        var image = this.getSelected();
        if (!image) return;

        // These items apply only to AMIs
        fDisabled = !(image.id.match(regExs["ami"]));
        $("amis.context.register").disabled = fDisabled;
        $("amis.context.deregister").disabled = fDisabled;
        $("amis.context.launch").disabled = fDisabled;
        $("amis.context.delete").disabled = fDisabled;
        $("amis.context.perms").disabled = fDisabled || image.state == "deregistered";

        // These items don't apply to AMIs with root device type 'ebs'
        if (isEbsRootDeviceType(image.rootDeviceType)) {
            $("amis.context.delete").disabled = true;
            $("amis.context.deleteSnapshotAndDeregister").disabled = false;
        } else {
            $("amis.context.deleteSnapshotAndDeregister").disabled = true;
        }

        var type = $("ew.images.type").value;
        $("amis.context.fadd").disabled = type == "fav";
        $("amis.context.fdelete").disabled = type != "fav";
    },

    manageFavorites: function(remove) {
        var image = this.getSelected();
        if (image == null) return;
        var favs = this.coregetStrPrefs(this.favorites, "").split("^");
        debug(remove + ":" + favs)
        if (remove) {
            var i = favs.indexOf(image.id)
            if (i > -1) {
                favs.splice(i, 1)
            }
        } else {
            if (favs.indexOf(image.id) == -1) {
                favs.push(image.id)
            }
        }
        this.coresetStrPrefs(this.favorites, favs.join("^"));
        if (remove) {
            this.invalidate();
        }
    },

    filter: function(list)
    {
        if (!list) return list;
        var type = $("ew.images.type");
        if (type.value == "fav") {
            var favs = this.coregetStrPrefs(this.favorites, "").split("^");
            var images = [];
            for (var i in list) {
                if (favs.indexOf(list[i].id) >= 0) {
                    images.push(list[i])
                }
            }
            return TreeView.filter.call(this, images);
        }

        // Initialize the owner display filter to the empty string
        var alias = null, owner = null, root = null, rx = null;
        if (type.value == "my_ami" || type.value == "my_ami_rdt_ebs") {
            var groups = this.core.queryModel('securityGroups');
            if (groups && groups.length) {
                owner = groups[0].ownerId;
                rx = regExs["ami"];
                root = type.value == "my_ami" ? null : "ebs";
            }
        } else
        if (type.value == "amzn" || type.value == "amzn_rdt_ebs") {
            alias = "amazon";
            root = type.value == "amzn" ? null : "ebs";
        } else
        if (type.value == "rdt_ebs") {
            root = "ebs";
        } else
        if (type.value == "rdt_is") {
            root = "instance-store";
        } else {
            rx = regExs[type.value || "all"];
        }
        var nlist = new Array();
        for (var i in list) {
            if (rx && !list[i].id.match(rx)) continue;
            if (root && root != list[i].rootDeviceType) continue;
            if (alias && alias != list[i].ownerAlias) continue;
            if (owner && owner != list[i].owner) continue;
            nlist.push(list[i])
        }
        return TreeView.filter.call(this, nlist);
    },

    launchNewInstances : function()
    {
        var me = this;
        var image = this.getSelected();
        if (image == null) return;
        var retVal = { ok : null, tag: "", max: ew_InstancesTreeView.max };

        window.openDialog("chrome://ew/content/dialogs/create_instances.xul", null, "chrome,centerscreen,modal,resizable", image, this.core, retVal);
        if (retVal.ok) {
            if (retVal.name) {
                retVal.tag += (retVal.tag ? "," : "") + "Name:" + retVal.name;
            }
            this.core.api.runInstances(retVal.imageId, retVal.instanceType, retVal.minCount, retVal.maxCount, retVal, function(list) {
                if (retVal.tag != "") {
                    me.core.setTags(list, retVal.tag, function() { ew_InstancesTreeView.refresh() });
                } else {
                    ew_InstancesTreeView.refresh();
                }
                me.core.selectTab('ew.tabs.instance' + (me.core.isVpcMode() ? ".vpc" : ""));
            });
        }
    },

    callRegisterImageInRegion : function(manifest, region)
    {
        var me = this;
        this.core.api.registerImageInRegion(manifest, region, function() {
            me.refresh();
            alert("Image with Manifest: " + manifest + " was registered");
        });
    },

    registerNewImage : function()
    {
        var me = this;
        var value = prompt('AMI Manifest Path:');
        if (value) {
            var oldextre = new RegExp("\\.manifest$");
            var newextre = new RegExp("\\.manifest\\.xml$");
            if (value.match(oldextre) == null && value.match(newextre) == null) {
                alert("Manifest files should end in .manifest or .manifest.xml");
                return false;
            }
            var s3bucket = value.split('/')[0];
            if (s3bucket.match(new RegExp("[A-Z]"))) {
                alert("The S3 bucket must be all lower case");
                return false;
            }
            var httppre = new RegExp("^http", "i");
            if (value.match(httppre) != null) {
                alert("Just specify the bucket and manifest path name, not the entire S3 URL.");
                return false;
            }
            var s3bucket = value.split('/')[0];
            var region = this.core.api.getS3BucketLocation(s3bucket);
            callRegisterImageInRegion(value, region);
        }
    },

    deregisterImage : function(confirmed)
    {
        var me = this;
        var image = this.getSelected();
        if (!image) return;
        if (!confirmed && !confirm("Deregister AMI " + image.id + " (" + image.location + ")?")) return;
        this.core.api.deregisterImage(image.id, function() {me.refresh()});
    },

    deleteImage : function()
    {
        var image = this.getSelected();
        if (image == null) return;

        if (this.currentlyMigrating && this.amiBeingMigrated == image.id) {
            alert("This AMI is currently being migrated. Please try *Deleting* it after the Migration.");
            return;
        }

        if (confirm("Are you sure you want to delete this AMI and all its parts from S3? The AMI will be deregistered as well.")) {
            var parts = image.location.split('/');
            var sourceB = parts[0];
            var prefix = parts[1];
            // Remove the manifest.xml from the prefix
            prefix = prefix.substring(0, prefix.indexOf(".manifest.xml"));
            var obj = this.core.api.getS3BucketKeys(sourceB, {prefix:prefix});
            if (obj) {
                for (var i = 0; i < obj.keys.length; ++i) {
                    this.core.api.deleteS3BucketKey(sourceB, bucket.keys[i].name);
                }
                // Keys have been deleted. Let's deregister this image
                this.deregisterImage(true);
            }
        }
    },

    deleteSnapshotAndDeregister : function()
    {
        var me = this;
        var image = this.getSelected();
        if (image == null) return;

        var ami = image.id;
        var snapshot = image.snapshotId;
        if (confirm("Are you sure you want to delete this AMI (" + ami + ") " + "and the accompanying snapshot (" + snapshot + ")?")) {
            var wrap = function()
            {
                this.core.api.deleteSnapshot(snapshot, function() { ew_SnapshotTreeView.refresh() });
                me.refresh();
            }
            this.core.api.deregisterImage(ami, wrap);
        }
    },

    viewPermissions: function()
    {
        var me = this;
        var image = this.getSelected();
        if (image == null) return;
        this.core.api.describeLaunchPermissions(image.id, function(list) {
            window.openDialog("chrome://ew/content/dialogs/manage_ami_permissions.xul", null, "chrome,centerscreen,modal,resizable", me.core, image, list);
        });
    },
};

var ew_InstancesTreeView = {
    model: ['instances', 'images', 'addresses', 'securityGroups', 'networkInterfaces', 'subnets', 'vpcs', 'availabilityZones', 'snapshots', 'volumes', 'instanceProfiles'],
    properties: [ 'state' ],
    max: 50,

    filter: function(list)
    {
        if (!list) return list;
        var noTerm = $("ew.instances.noterminated").checked;
        var noStop = $("ew.instances.nostopped").checked;

        var nlist = new Array();
        for(var i in list) {
            list[i].validate();
            if ((noTerm && list[i].state == "terminated") || (noStop && list[i].state == "stopped")) continue;
            nlist.push(list[i])
        }
        return TreeView.filter.call(this, nlist);
    },

    showBundleDialog : function()
    {
        var me = this;
        var retVal = {ok:null,bucketName:null,prefix:null};
        var instance = this.getSelected();
        if (instance == null) return;

        var values = this.core.promptInput('Create AMI', [{label:"Instance",type:"label",value:instance.toString()},
                                                          {label:"S3 Bucket Name",type:"name",required:1},
                                                          {label:"Image Name",required:1}, ]);
        if (!values) return;
        this.core.api.createS3Bucket(values[1], function() {
            me.core.api.bundleInstance(instance.id, values[1], values[2], me.core.getActiveCredentials(), function() {
                me.core.refreshModel('bundleTasks');
                me.core.selectTab('ew.tabs.bundletask');
            });
        });
    },

    showCreateImageDialog : function()
    {
        var retVal = {ok:null,amiName:null,amiDescription:null,noReboot:null};
        var instance = this.getSelected();
        if (instance == null) return;

        var values = this.core.promptInput('Create AMI', [{label:"Instance",type:"label",value:instance.toString()},
                                                          {label:"AMI Name",required:1},
                                                          {label:"Description"},
                                                          {label:"Snapshot without rebooting instance",type:"checkbox"} ]);
        if (!values) return;
        this.core.api.createImage(instance.id, values[1], values[2], values[3], function(id) {
            alert("A new AMI is being created and will be available in a moment.\n\nThe AMI ID is: "+id);
        });
    },

    attachEBSVolume : function() {
        var instance = this.getSelected();
        if (instance == null) return;

        if (instance.state != "running") {
            alert("Instance should in running state")
            return;
        }

        if (!this.isInstanceReadyToUse(instance)) return;

        // A volume can be attached to this instance only if:
        // 1. It is in the same zone as this instance
        // 2. It is not attached to another instance
        volumes = this.core.queryModel('volumes', 'availabilityZone', instance.availabilityZone, 'instanceId', '');
        if (volumes.length == 0) {
            if (confirm("No volumes available, would you like to create a new EBS volume to attach to this instance?")) {
                ew_VolumeTreeView.createVolume();
            }
            return;
        }
        var values = this.core.promptInput('Attach EBS Volume',
                                                [{label:"Instance",type:"label",value:instance.toString()},
                                                 {label:"Volume",type:"menulist",list:volumes,required:1},
                                                 {label:"Device",required:1,value:isWindows(instance.platform) ? "windows_device" : "",readonly: isWindows(instance.platform) ? true : false},
                                                 {type:"label",notitle:1,value:"Linux devices: /dev/sda through /dev/sdp"}]);
        if (!values) return;
        ew_VolumeTreeView.attachEBSVolume(values[1], instance.id, values[2]);
        this.core.selectTab('ew.tabs.volume')
    },

    associateWithEIP : function()
    {
        var me = this;
        var instance = this.getSelected();
        if (instance == null) return;
        if (instance.state != "running") {
            alert("Instance should in running state")
            return;
        }

        // Determine if there is actually an EIP to associate with
        var eipList = this.core.queryModel('addresses');
        if (!eipList) {
            if (confirm ("Would you like to create a new Elastic IP to associate with this instance?")) {;
                this.core.selectTab('ew.tabs.eip');
                ew_ElasticIPTreeView.allocateAddress();
            }
            return;
        }

        var eips = [];
        for (var i in eipList) {
            var eip = eipList[i];
            if ((instance.vpcId != '' && eip.domain != "vpc") || (instance.vpcId == '' && eip.domain == "vpc")) continue;
            eips.push(eip)
        }
        var idx = this.core.promptList("Associate EIP with Instance", "Which EIP would you like to associate with " + instance.toString() + "?", eips);
        if (idx < 0) return;
        var eip = eips[idx];

        if (eip.instanceId) {
            if (!this.core.promptYesNo("Confirm", "Address " + eip.publicIp + " is already mapped to an instance, continue?")) {
                return false;
            }
        }
        this.core.api.associateAddress(eip, instance.id, null, function() {
            me.refresh();
            me.core.refreshModel('addresses');
        });
    },

    retrieveRSAKeyFromKeyFile : function(keyFile, fSilent)
    {
        var fileIn = FileIO.open(keyFile);
        if (!fileIn || !fileIn.exists()) {
            alert ("Couldn't find EC2 Private Key File: " + keyFile);
            return null;
        }

        // Let's retrieve the RSA Private Key
        // 1. Read the RSA Private Key File In
        // 2. Remove the header and footer
        // 3. Bas64 Decode the string
        // 4. Convert the decoded string into a byte array
        // 5. Retrieve the key from the decoded byte array
        var str = FileIO.read(fileIn);
        var keyStart = "PRIVATE KEY-----";
        var keyEnd = "-----END RSA";

        var startIdx = str.indexOf(keyStart);
        var endIdx = str.indexOf(keyEnd);

        if (startIdx >= endIdx) {
            if (!fSilent) {
                alert ("Invalid EC2 Private Key");
            }
            return null;
        }

        startIdx += keyStart.length;
        var keyStr = str.substr(startIdx, endIdx - startIdx);
        keyStr = keyStr.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        var decodedKey = Base64.decode(keyStr);
        var keyArray = toByteArray(decodedKey);
        var hexArray = bin2hex(keyArray);
        log('RSA Key Str: ' + keyStr + " ByteArray: " + keyArray + " HexArray: " + hexArray);

        var rpk = parseRSAKey(keyArray);
        var rsakey = null;
        if (rpk != null) {
            rsakey = new RSAKey();
            rsakey.setPrivateEx(rpk.N, rpk.E, rpk.D, rpk.P, rpk.Q, rpk.DP, rpk.DQ, rpk.C);
        }
        return rsakey;
    },

    decodePassword : function(output, fSilent) {
        // Parse out the base64 encoded password string
        var fSuccess = true;
        var passStart = "<Password>";
        var passEnd = "</Password>";
        var startIdx = -1;
        var endIdx = -1;

        if (output == null) {
            fSuccess = false;
        }

        if (fSuccess) {
            startIdx = output.lastIndexOf(passStart);
            if (startIdx == -1) {
                fSuccess = false;
            }
        }

        if (fSuccess) {
            endIdx = output.lastIndexOf(passEnd);
            if ((endIdx < startIdx) || (endIdx == -1)) {
                fSuccess = false;
            }
        }

        if (fSuccess) {
            startIdx += passStart.length;
            var password = output.substr(startIdx, endIdx - startIdx);
            // Decode the password
            password = Base64.decode(password);
            // Convert the string to a byte array
            var passwordBytes = toByteArray(password);
            // Convert the byte array into a hex array that can be processed by the RSADecrypt function.
            var passwordHex = bin2hex(passwordBytes);
            return passwordHex;
        }

        if (!fSuccess) {
            if (!fSilent) {
                alert ("The Password has not been generated for this instance.");
            }
            return null;
        }
    },

    getAdminPassword : function(instance, fSilent)
    {
        if (instance == null) {
            instance = this.getSelected();
        }
        if (instance == null) return;
        if (!isWindows(instance.platform)) return;

        var password = "";
        var fSuccess = true;
        var output = this.core.api.getConsoleOutput(instance.id);

        if (output == null || output.length == 0) {
            alert ("This instance is currently being configured. Please try again in a short while...");
            return;
        }

        // 3. Get the password hex array by parsing the console output
        var passwordHex = this.decodePassword(output, fSilent);
        if (!passwordHex) return;

        var prvKeyFile = this.core.getPrivateKeyFile(instance.keyName);
        log("Private Key File: " + prvKeyFile);

        while (fSuccess) {
            // If the private key file was not specified, or couldn't be found,
            // ask the user for its location on the local filesystem
            if (prvKeyFile.length == 0) {
                prvKeyFile = this.core.promptForFile("Select the EC2 Private Key File for key: " + instance.keyName);
            }
            if (!FileIO.exists(prvKeyFile)) {
                fSuccess = false;
            }

            if (!fSuccess) {
                // There is no default EC2 Private Key File, and a bad Private Key File was specified. Ask the user whether they would like to retry with a new private key file
                if (!confirm ("An error occurred while reading the EC2 Private Key from file: " + prvKeyFile + ". Would you like to retry with a different private key file?")) {
                    break;
                } else {
                    prvKeyFile = "";
                    fSuccess = true;
                    continue;
                }
            }

            if (fSuccess) {
                // Get the RSA private key from the password file
                var rsaPrivateKey  = this.retrieveRSAKeyFromKeyFile(prvKeyFile, fSilent);
                fSuccess = (rsaPrivateKey != null);
            }

            if (fSuccess) {
                password = rsaPrivateKey.decrypt(passwordHex);

                // Display the admin password to the user
                if ((password != null) && (password.length > 0)) {
                    this.core.copyToClipboard(password);
                    if (!fSilent) {
                        alert ("Instance Administrator Password [" + password + "] has been saved to clipboard");
                    }
                } else

                if (!fSilent) {
                    fSuccess = false;
                    // Reset the instance's password to be the empty string.
                    password = "";
                    // Need to retry with a new private key file
                    if (!confirm("An error occurred while retrieving the password. Would you like to retry with a different private key file?")) {
                        break;
                    } else {
                        prvKeyFile = "";
                        fSuccess = true;
                        continue;
                    }
                }
            }
            // If we arrived here, everything succeeded, so let's exit out of the loop.
            break;
        }

        return password;
    },

    menuChanged  : function(event) {
        var instance = this.getSelected();
        var fDisabled = (instance == null);
        $("ew.instances.contextmenu").disabled = fDisabled;
        if (fDisabled) return;

        instance.validate();

        // Windows-based enable/disable
        if (isWindows(instance.platform)) {
          $("instances.context.getPassword").disabled = false;
        } else {
          $("instances.context.getPassword").disabled = true;
        }

        $("instances.context.connectPublic").disabled = instance.ipAddress == "";
        $("instances.context.copyPublic").disabled = instance.ipAddress == "";
        $("instances.context.connectElastic").disabled = instance.elasticIp == "";
        $("instances.context.copyElastic").disabled = instance.elasticIp == ""
        $("instances.context.connectPublicDns").disabled = instance.dnsName == "";
        $("instances.context.copyPublicDns").disabled = instance.dnsName == "";

        if (isEbsRootDeviceType(instance.rootDeviceType)) {
            $("instances.context.bundle").disabled = true;
            $("instances.context.createimage").disabled = false;
        } else {
            $("instances.context.createimage").disabled = true;

            if (isWindows(instance.platform)) {
                $("instances.context.bundle").disabled = false;
            } else {
                $("instances.context.bundle").disabled = true;
            }
        }
        $("instances.context.changeSecurityGroups").disabled = instance.vpcId == "";

        // These items are only valid for instances with EBS-backed root devices.
        var optDisabled = !isEbsRootDeviceType(instance.rootDeviceType);
        $("instances.context.start").disabled = optDisabled;
        $("instances.context.stop").disabled = optDisabled;
        $("instances.context.forceStop").disabled = optDisabled;
        $("instances.context.changeTerminationProtection").disabled = optDisabled;
        $("instances.context.changeShutdownBehaviour").disabled = optDisabled;
        $("instances.context.changeSourceDestCheck").disabled = optDisabled;
        $("instances.context.startMonitoring").disabled = optDisabled || instance.monitoringStatus != "";
        $("instances.context.stopMonitoring").disabled = optDisabled || instance.monitoringStatus == "";
        $("instances.button.start").disabled = optDisabled;
        $("instances.button.stop").disabled = optDisabled;
    },

    launchMore : function() {
        var instance = this.getSelected();
        if (instance == null) return;

        var count = prompt("How many more instances of "+instance.id+"?", "1");
        if (!count) return;
        count = parseInt(count.trim());
        if (isNan(count) || count < 0 || count > this.max) {
            return alert('Invalid number, must be between 1 and ' + this.max);
        }

        var me = this;
        this.core.api.runMoreInstances(instance, count, function() { me.refresh()});
    },

    terminateInstance : function() {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Terminate " + instances.length + " instance(s)?")) return;

        var me = this;
        this.core.api.terminateInstances(instances, function() { me.refresh()});
    },

    stopInstance : function(force)
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Stop " + instances.length + " instance(s)?")) return;

        var me = this;
        this.core.api.stopInstances(instances, force, function() { me.refresh()});
    },

    changeSecurityGroups: function() {
        var me = this;
        var instance = this.getSelected();
        if (!instance) return;
        var groups = this.core.queryModel('securityGroups', 'vpcId', instance.vpcId);
        var list = this.core.promptList('Change Security Groups', 'Select security groups for the instance:', groups, { multiple: true });
        if (!list || !list.length) return;
        var params = []
        for (var i = 0; i < list.length; i++) {
            params.push(["GroupId." + (i + 1), list[i].id])
        }
        me.core.api.modifyInstanceAttributes(instance.id, params);
    },

    changeDeleteOnTermination: function() {
        var me = this;
        var instance = this.getSelected();
        if (!instance) return;
        var checked = instance.volumes.filter(function(v) { return v.deleteOnTermination; });
        var params = { multiple: true, columns: ["deviceName"], headers: [ "DeleteOnTermination", "Device Name" ], checkedItems: checked, checkedProperty: "deleteOnTermination" };
        var list = this.core.promptList('Change Volumes Delete On Termination status', 'Select volumes:', instance.volumes, params);
        if (!list || !list.length) return;
        var params = [];
        for (var i = 0; i < list.length; i++) {
            params.push([ "BlockDeviceMapping." + (i + 1) + ".DeviceName" , list[i].deviceName ]);
            params.push([ "BlockDeviceMapping." + (i + 1) + ".Ebs.DeleteOnTermination", list[i].deleteOnTermination ]);
        }
        me.core.api.modifyInstanceAttributes(instance.id, params, function() { me.refresh(); });
    },

    changeUserData: function()
    {
        var me = this;
        var instance = this.getSelected();
        if (!instance) return;

        this.core.api.describeInstanceAttribute(instance.id, "userData", function(value) {
            var text = me.core.promptForText('Instance User Data:', (value ? Base64.decode(value) : ''));
            if (!text) return;
            me.core.api.modifyInstanceAttribute(instance.id, 'UserData', Base64.encode(text));
        });
    },

    changeInstanceType: function()
    {
        var instance = this.getSelected();
        if (!instance) return;
        var me = this;
        var types = this.core.getInstanceTypes();
        this.core.api.describeInstanceAttribute(instance.id, "instanceType", function(value) {
            var idx = me.core.promptList('Instance Type', 'Select instance type:', types );
            if (idx == -1) return;
            me.core.api.modifyInstanceAttribute(instance.id, 'InstanceType', types[idx].value, function() { me.refresh() });
        });
    },

    changeTerminationProtection : function()
    {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        this.core.api.describeInstanceAttribute(instances[0].id, "disableApiTermination", function(value) {
            value = (value == "true")
            if (confirm((value ? "Disable" : "Enable") + " Termination Protection?")) {
                for (var i = 0; i < instances.length; i++) {
                    me.core.api.modifyInstanceAttribute(instances[i].id, "DisableApiTermination", !value);
                }
            }
        });
    },

    changeSourceDestCheck : function()
    {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        this.core.api.describeInstanceAttribute(instances[0].id, "sourceDestCheck", function(value) {
            value = (value == "true")
            if (confirm((value ? "Disable" : "Enable") + " source/destination checking?")) {
                for (var i = 0; i < instances.length; i++) {
                    me.core.api.modifyInstanceAttribute(instances[i].id, "SourceDesctCheck", !value);
                }
            }
        });
    },

    changeShutdownBehaviour : function(value)
    {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        this.core.api.describeInstanceAttribute(instances[0].id, "instanceInitiatedShutdownBehavior", function(value) {
            value = value == "stop" ? "terminate" : "stop";
            if (confirm("Change instance initiated shutdown behaviour to " + value + " for "+instances.length+" instance(s)?")) {
                for (var i = 0; i < instances.length; i++) {
                    me.core.api.modifyInstanceAttribute(instances[i].id, "InstanceInitiatedShutdownBehavior", value);
                }
            }
        });
    },

    startMonitoring: function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Start monitoring "+instances.length+" instance(s)?")) return;
        var me = this;
        this.core.api.monitorInstances(instances, function() { me.refresh(); });
    },

    stopMonitoring: function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Stop monitoring "+instances.length+" instance(s)?")) return;
        var me = this;
        this.core.api.unmonitorInstances(instances, function() { me.refresh(); });
    },

    rebootInstance: function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Reboot "+instances.length+" instance(s)?")) return;
        var me = this;
        this.core.api.rebootInstances(instances, function() { me.refresh(); });
    },

    startInstance : function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        var me = this;
        this.core.api.startInstances(instances, function() {me.refresh()});
    },

    isInstanceReadyToUse : function(instance)
    {
        var rc = false;
        if (isWindows(instance.platform)) {
            var output = this.core.api.getConsoleOutput(instance.id);
            // Parse the response to determine whether the instance is ready to use
            rc = output.indexOf("Windows is Ready to use") >= 0;
        } else {
            rc = true;
        }
        if (!rc) {
            alert("Please wait till 'Windows is Ready to use' before attaching an EBS volume to instance: " + instance.toString());
        }
        return rc;
    },

    showConsoleOutput : function(id, timestamp, output)
    {
        var instance = this.getSelected();
        if (!instance) return;
        var output = this.core.api.getConsoleOutput(instance.id);
        this.core.promptInput('Console', [{notitle:1,multiline:true,cols:120,rows:50,scale:1,wrap:false,style:"font-family:monospace",readonly:true,value:output}])
    },

    authorizeProtocolForGroup : function(transport, protocol, groups)
    {
        this.authorizeProtocolPortForGroup(transport, protocol, protPortMap[protocol], groups);
    },

    authorizeProtocolPortForGroup : function (transport, protocol, port, groups)
    {
        var fAdd = true;
        var openCIDR = "0.0.0.0/0";
        var hostCIDR = this.core.api.queryCheckIP() + "/32";
        var networkCIDR = this.core.api.queryCheckIP("block");

        debug("Host: " + hostCIDR + ", net:" + networkCIDR + ", transport:" + transport + ", proto:" + protocol + ", port:" + port + ", groups:" + groups)

        var permissions = null;
        for (var j in groups) {
            var group = this.core.findModel('securityGroups', groups[j]);
            if (!group) continue;

            for (var i in group.permissions) {
                var perm = group.permissions[i];
                log("perm:" + perm.protocol + ":" + perm.fromPort + ":" + perm.toPort + ':' + perm.cidrIp);

                if (perm.protocol != transport) continue;
                // Nothing needs to be done if:
                // 1. Either the from or to port of a permission matches the protocol's port or the port is within the port range
                // AND
                // 2. The CIDR for the permission matches either the host's CIDR or the network's CIDR or the Firewall has been opened to the world
                var fromPort = parseInt(perm.fromPort);
                var toPort = parseInt(perm.toPort);
                port = parseInt(port);
                if ((perm.fromPort == port || perm.toPort == port || (perm.fromPort <= port && perm.toPort >= port)) &&
                    (perm.cidrIp == openCIDR || perm.cidrIp == hostCIDR || perm.cidrIp == networkCIDR)) {
                    fAdd = false;
                    break;
                }
            }
            if (!fAdd) return;
        }

        var result = true;
        if (this.core.getBoolPrefs("ew.prompt.open.port", true)) {
            port = port.toString();
            var msg = this.core.getAppName() + " needs to open " + transport.toUpperCase() + " port " + port + " (" + protocol + ") to continue. Click Ok to authorize this action";
            var check = {value: false};
            result = this.core.promptConfirm("EC2 Firewall Port Authorization", msg, "Do not ask me again", check);
            this.core.setBoolPrefs("ew.prompt.open.port", !check.value);
        }

        if (result) {
            result = false;
            // Authorize first available group
            for (var i in groups) {
                if (groups[i]) {
                    this.core.api.authorizeSourceCIDR('Ingress', groups[i], transport, port, port, hostCIDR, function() { ew_SecurityGroupsTreeView.refresh(); });
                    result = true
                    break;
                }
            }
        }
        if (!result) {
            this.core.errorMessage("Could not authorize " + transport + ":" + protocol + ":" + port)
        }
    },

    openConnectionPort : function(instance)
    {
        // If this is a Windows instance, we need to RDP instead
        if (isWindows(instance.platform)) {
            // Ensure that the RDP port is open in one of the instance's groups
            this.authorizeProtocolForGroup("tcp", "rdp", instance.securityGroups);
        } else {
            // Ensure that the SSH port is open in one of the instance's groups
            this.authorizeProtocolForGroup("tcp", "ssh", instance.securityGroups);
        }
    },

    // ipType: 0 - private, 1 - public, 2 - elastic, 3 - public or elastic, 4 - dns name
    connectTo : function(ipType)
    {
        var instance = this.getSelected();
        if (!instance) return;

        var args = this.core.getSSHArgs();
        var cmd = this.core.getSSHCommand();

        var hostname = !ipType ? instance.privateIpAddress :
                       ipType == 1 || ipType == 3 ? instance.ipAddress :
                       ipType == 4 ? instance.dnsName :
                       ipType == 2 ? instance.elasticIP : "";
        if (hostname == "" && ipType == 3) {
            hostname = this.instance.elasticIP
        }

        // Open ports for non private connection
        if (ipType) {
           this.openConnectionPort(instance);
        }

        if (hostname == "") {
            alert("No " + (!ipType ? "Private" : ipType == 1 ? "Public" : ipType == 2 ? "Elastic" : "") + " IP is available");
            return;
        }

        if (isWindows(instance.platform)) {
            args = this.core.getRDPArgs();
            cmd = this.core.getRDPCommand();
            if (isMac(navigator.platform)) {
                // On Mac OS X, we use a totally different connection mechanism that isn't particularly extensible
                this.getAdminPassword(instance);
                this.rdpToMac(hostname, cmd);
                return;
            }
        }
        var params = []
        params.push(["host", hostname]);
        params.push(["name", instance.name]);
        params.push(["keyname", instance.keyName])
        params.push(["publicDnsName", instance.dnsName]);
        params.push(["privateDnsName", instance.privateDnsName]);
        params.push(["privateIpAddress", instance.privateIpAddress]);

        if (args.indexOf("${pass}") >= 0) {
            var pass = this.getAdminPassword(instance, true);
            if (pass) {
                params.push(["pass", pass])
            }
        } else

        if (args.indexOf("${key}") >= 0) {
            var keyFile = this.core.getPrivateKeyFile(instance.keyName);
            if (!FileIO.exists(keyFile)) {
                keyFile = this.core.promptForFile("Select the EC2 Private Key File for key: " + instance.keyName);
            }
            if (!keyFile || !FileIO.exists(keyFile)) {
                alert('Cannot connect without private key file for keypair ' + instance.keyName)
                return;
            }
            params.push(["key", keyFile])
        }

        if (args.indexOf("${login}") >= 0 && this.core.getStrPrefs("ew.ssh.user") == "") {
            var login = prompt("Please provide SSH user name:");
            if (login && login != "") {
                params.push(["login", login])
            }
        }

        // Common substitution
        args = this.core.getArgsProcessed(args, params, hostname);

        this.core.launchProcess(cmd, args);

    },

    rdpToMac : function(hostname, cmd)
    {
        var filename = this.core.getHome() + "/" + this.core.getAppName() + "/" + hostname + ".rdp";
        var config = FileIO.open(filename)

        if (!config.exists()) {
            // create a bare-bones RDP connection file
            var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
                      '<plist version="1.0">\n' +
                      '  <dict>\n' +
                      '    <key>ConnectionString</key>\n' +
                      '    <string>' + hostname + '</string>\n' +
                      '    <key>UserName</key>\n' +
                      '    <string>Administrator</string>\n' +
                      '  </dict>\n' +
                      '</plist>';

            FileIO.write(config, xml);
        }

        this.core.launchProcess(cmd, [filename]);
    },

    isRefreshable : function()
    {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "pending" || this.treeList[i].state == "shutting-down") return true;
        }
        return false;
    },

};

var ew_VolumeTreeView = {
    model: ['volumes','availabilityZones','instances','snapshots'],
    properties: ['status'],

    filter : function(list) {
        if (!list) return list;
        if ($("ew.volumes.norootdev").checked) {
          var newList = [];
          for (var i = 0; i < list.length; i++) {
              var volume = list[i];
              if (volume.device != '/dev/sda1') {
                  newList.push(volume);
              }
          }
          list = newList;
        }
        return TreeView.filter.call(this, list);
    },

    menuChanged : function()
    {
        var image = this.getSelected();
        document.getElementById("ew.volumes.contextmenu").disabled = (image == null);
        if (image == null) return;

        var fAssociated = image.status == "available" ? false : true;

        // If this is not a Windows Instance, Disable the following context menu items.
        document.getElementById("volumes.context.attach").disabled = fAssociated;
        document.getElementById("volumes.context.detach").disabled = !fAssociated;
        document.getElementById("volumes.context.forcedetach").disabled = !fAssociated;
        document.getElementById("volumes.context.deleteOnTermination").disabled = !fAssociated;
    },

    createSnapshot : function ()
    {
        var image = this.getSelected();
        if (image == null) return;
        var me = this;
        this.core.api.createSnapshot(image.id, function(snapId) { ew_SnapshotTreeView.refresh(); });
    },

    createVolume : function (snap)
    {
        var me = this;
        var zones = this.core.queryModel('availabilityZones');
        var snapshots = this.core.queryModel('snapshots', "status", "completed");
        this.core.sortObjects(snapshots, ['name','description']);
        var values = this.core.promptInput('Create Volume', [{label:"Size (GB)",type:"number",min:1,required:1},
                                                             {label:"Name"},
                                                             {label:"Availability Zone",type:"menulist",list:zones,required:1},
                                                             {label:"Snapshot",type:"menulist",list:snapshots}]);
        if (!values) return;
        this.core.api.createVolume(values[0],values[3],values[2],function(id) {
            if (values[1]) {
                me.core.setTags(id, "Name:" + values[1], function() { me.refresh() });
            } else {
                me.refresh();
            }
        });
    },

    deleteVolume : function ()
    {
        var image = this.getSelected();
        if (image == null) return;
        var label = image.name ? (image.name + '@' + image.id) : image.id;
        if (!confirm("Delete volume " + label + "?")) return;
        var me = this;
        this.core.api.deleteVolume(image.id, function() {me.refresh()});
    },

    attachEBSVolume : function (volumeId, instId, device)
    {
        if (device == "windows_device") {
            device = this.determineWindowsDevice(instId);
        }
        var me = this;
        this.core.api.attachVolume(volumeId, instId, device, function() {me.refresh();});
    },

    attachVolume : function ()
    {
        var image = this.getSelected();
        if (image == null) return;

        var instances = this.core.queryModel('instances', 'state', 'running', 'availabilityZone', image.availabilityZone);
        if (!instances.length) {
            return alert('No instances running this the same availability zone');
        }

        var values = this.core.promptInput('Create EBS Atatchment', [{label:"Volume",type:"label",list:image.toString()},
                                                                     {label:"Instance",type:"menulist",list:instances,required:1,oncommand:"rc.items[2].obj.value = isWindows(rc.items[1].list[rc.items[1].obj.selectedIndex].platform)?'windows_device':''"},
                                                                     {label:"Device",required:1},
                                                                     {type:"label",notitle:1,value:"Linux devices: /dev/sda through /dev/sdp"}]);
        if (!values) return;

        // If this is a Windows instance, the device should be windows_device and the instance should be ready to use
        var instance = this.core.findModel('instances', values[1]);
        if (!instance) return alert('Instance disappeared')
        if (!ew_InstancesTreeView.isInstanceReadyToUse(instance)) return;
        this.attachEBSVolume(image.id, values[1], values[2]);
    },

    determineWindowsDevice : function (instId)
    {
        // Need to walk through the list of Volumes If any volume is attached to this instance, that device id is removed from the list of possible device ids for this instance.
        var devList = this.getWindowsDeviceList();

        // Enumerate the volumes associated with the instId
        var volumes = this.core.getModel("volumes");

        // If a volume is associated with this instance, mark the associated device as taken
        for (var i in volumes) {
            if (volumes[i].instanceId == instId) {
                devList[volumes[i].device] = 1;
            }
        }

        for (var device in devList) {
            if (devList[device] != 1) {
                return devList[device];
            }
        }
        return "";
    },

    detachVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        if (!confirm("Detach volume " + image.id + "?")) return;
        this.core.api.detachVolume(image.id, function() { me.refresh() });
    },

    forceDetachVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        if (!confirm("Force detach volume " + image.id + "?")) return;
        var me = this;
        this.core.api.forceDetachVolume(image.id, function() { me.refresh() });
    },

    isRefreshable: function() {
        // Walk the list of volumes to see whether there is a volume whose state needs to be refreshed
        for (var i in this.treeList) {
            var volume = this.treeList[i];
            if (volume.status == "creating" || volume.status == 'deleting' || volume.attachStatus == "attaching" || volume.attachStStatus == "detaching") {
                return true;
            }
        }
        return false;
    },

    changeDeleteOnTermination: function()
    {
        var me = this;
        var image = this.getSelected();
        if (image == null | !image.instanceId) return;
        if (!confirm("Change Delete On Termination to " + !image.deleteOnTermination + "?")) return;
        image.deleteOnTermination = !image.deleteOnTermination;

        var params = [];
        params.push([ "BlockDeviceMapping.1.DeviceName" , image.device]);
        params.push([ "BlockDeviceMapping.1.Ebs.DeleteOnTermination", image.deleteOnTermination ]);
        this.core.api.modifyInstanceAttributes(image.instanceId, params, function() { me.core.refreshModel('instances'); });
    },

    getWindowsDeviceList: function()
    {
        var devlist = new Array();
        devlist["xvdg"] = "xvdg";
        devlist["xvdh"] = "xvdh";
        devlist["xvdi"] = "xvdi";
        devlist["xvdj"] = "xvdj";
        devlist["xvdk"] = "xvdk";
        devlist["xvdl"] = "xvdl";
        devlist["xvdm"] = "xvdm";
        devlist["xvdn"] = "xvdn";
        devlist["xvdo"] = "xvdo";
        devlist["xvdp"] = "xvdp";
        devlist["xvdf"] = "xvdf";
        devlist["xvde"] = "xvde";
        devlist["xvdd"] = "xvdd";
        devlist["xvdc"] = "xvdc";
        return devlist;
    },
};

var ew_SnapshotTreeView = {
    model: ['snapshots', 'securityGroups', 'availabilityZones', 'volumes'],

    filter: function(list) {
        if (!list) return list;
        var type = $("ew.snapshots.type").value;
        if (type == "my_snapshots") {
            var nlist = [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].owner == this.core.user.accountId) {
                    nlist.push(list[i]);
                }
            }
            list = nlist;
        }

        if ($("ew.snapshots.noami").checked) {
            var nlist = [];
            for (var i = 0; i < list.length; i++) {
                if (!(list[i].amiId || '').trim()) {
                    nlist.push(list[i]);
                }
            }
            list = nlist;
        }
        return TreeView.filter.call(this, list);
    },

    snapshotTypeChanged : function() {
        $(this.searchElement).value = "";
        this.invalidate();
    },

    deleteSnapshot : function () {
        var image = this.getSelected();
        if (image == null) return;
        var label = image.name ? (image.name + '@' + image.id) : image.id;
        if (!confirm("Delete snapshot " + label + "?"))  return;
        this.core.api.deleteSnapshot(image.id);
    },

    createVolume : function () {
        var image = this.getSelected();
        if (image == null) return;
        ew_VolumeTreeView.createVolume(image);
    },

    isRefreshable: function() {
        for (var i in this.treeList) {
            if (this.treeList[i].status != "completed") return true;
        }
        return false;
    },

    showRegisterImageFromSnapshotDialog : function() {
        var image = this.getSelected();
        if (image == null) return;

        var values = this.core.promptInput('Create AMI', [{label:"Snapshot",type:"label",value:image.toString()},
                                                          {label:"AMI Name",type:"name",required:1},
                                                          {label:"Description"},
                                                          {label:"Architecture",type:"menulist",list: ["i386", "x86_64"],required:1},
                                                          {label:"Kernel ID"},
                                                          {label:"Ramdisk ID"},
                                                          {label:"Device Name", help:"e.g. /dev/sda1",required:1},
                                                          {label:"Delete On Termination",type:"checkbox"}]);
        if (!values) return;
        this.core.api.registerImageFromSnapshot(image.id, values[1], values[2], values[3], values[4], values[5], values[6], values[7], function(id) {
            alert("A new AMI is registered.\n\nThe AMI ID is: "+id);
        });
    },

    viewPermissions: function()
    {
        var me = this;
        var image = this.getSelected();
        if (image == null) return;
        this.core.api.describeSnapshotAttribute(image.id, function(list) {
           window.openDialog("chrome://ew/content/dialogs/manage_snapshot_permissions.xul", null, "chrome,centerscreen,modal,resizable", me.core, image, list);
        });
    },

};

var ew_ElasticIPTreeView = {
    model: [ "addresses", "instances", "networkInterfaces" ],
    tagId: "publicIp",

    menuChanged : function() {
        var eip = this.getSelected();
        document.getElementById("ew.addresses.contextmenu").disabled = (eip == null);
        if (eip == null) return;
        document.getElementById("addresses.context.disassociate").disabled = !eip.instanceId;
        document.getElementById("addresses.context.dns").disabled = !eip.instanceId;
    },

    allocateAddress : function() {
        var me = this;
        this.core.api.allocateAddress(this.core.isVpcMode(), function() { me.refresh() });
    },

    releaseAddress : function() {
        var eip = this.getSelected();
        if (eip == null) return;
        if (!this.core.promptYesNo("Confirm", "Release "+eip.publicIp+"?")) return;

        var me = this;
        this.core.api.releaseAddress(eip, function() { me.refresh() });
    },

    getUnassociatedInstances : function() {
        var instances = this.core.queryModel('instances', 'state', 'running');
        var unassociated = new Array();
        var eips = {};

        // Build the list of EIPs that are associated with an instance
        for (var i in this.treeList) {
            var eip = this.treeList[i];
            if (eip.instanceId == null || eip.instanceId.length == 0) {
                continue;
            }
            eips[eip.instanceId] = eip.publicIp;
        }

        for (var i in instances) {
            if (eips[instances[i].id]) {
                continue;
            }
            unassociated.push(instances[i]);
        }
        return unassociated;
    },

    associateAddress : function(eip) {
        // If an elastic IP hasn't been passed in to be persisted to EC2, create a mapping between the Address and Instance.
        if (eip == null) {
            eip = this.getSelected();
            if (eip == null) return;

            if (eip.instanceId != null && eip.instanceId != '') {
                var confirmed = confirm("Address "+eip.publicIp+" is already mapped to an instance, are you sure?");
                if (!confirmed)
                    return;
            }

            var list = this.getUnassociatedInstances();
            list = list.concat(this.core.queryModel('networkInterfaces'))

            var idx = this.core.promptList("Associate Elastic IP", "Which Instance/ENI would you like to associate "+ eip.publicIp +" with?", list, { columns: ['__class__', 'toString'], width: 550 });
            if (idx < 0) return;
            // Determine what type we selected
            if (list[idx].imageId) {
                eip.instanceId = list[idx].id;
            } else {
                eip.eniId = list[idx].id;
            }
        }

        var me = this;
        this.core.api.associateAddress(eip, eip.instanceId, eip.eniId, function() { me.refresh() });
        return true;
    },

    disassociateAddress : function() {
        var eip = this.getSelected();
        if (eip == null) return;
        if (eip.instanceId == null || eip.instanceId == '') {
            alert("This EIP is not associated")
            return;
        }
        if (!confirm("Disassociate "+eip.publicIp+" and instance "+eip.instanceId+"?")) return;
        var me = this;
        this.core.api.disassociateAddress(eip, function() { me.refresh() });
    },

    copyPublicDnsToClipBoard : function(fieldName) {
        var eip = this.getSelected();
        if (!eip || !eip.instanceId) { return; }

        var instance = this.core.findModel('instances', eip.instanceId);
        if (instance) {
            this.core.copyToClipboard(instance.dnsName);
        }
    }

};

var ew_SecurityGroupsTreeView = {
    model: [ "securityGroups", "vpcs" ],

    selectionChanged : function() {
        var group = this.getSelected();
        if (!group) return;
        ew_PermissionsTreeView.display(group.permissions);
    },

    createNewGroup : function ()
    {
        var me = this;
        var opts = [{id:'Host', name: "Enable SSH and RDP for this Host"},
                    {id:'Network', name:"Enable SSH and RDP for your Network (includes this Host)"},
                    {id:'Manual', name:"I will authorize protocols for this group as needed."}];
        var vpcs = this.core.queryModel('vpcs');
        var values = this.core.promptInput('Create Security Group', [ {label:"Group Name",type:"name",required:1},
                                                                      {label:"Description",required:1},
                                                                      {label:"VPC",type:"menulist",list:vpcs},
                                                                      {label:"Permissions",type:"menulist",list:opts}])

        if (!values) return;
        this.core.api.createSecurityGroup(values[0], values[1], values[2], function(id) {
            var cidr = null;
            // Determine the CIDR for the protocol authorization request
            switch (values[3]) {
            case "Host":
                var ipAddress = me.core.api.queryCheckIP();
                cidr = ipAddress.trim() + "/32";
                break;

            case "Network":
                cidr = me.core.api.queryCheckIP("block") + "/1";
                break;

            case 'Manual':
                ew_PermissionsTreeView.grantPermission();
                return;

            default:
                return;
            }
            // Need to authorize SSH and RDP for either this host or the network.
            me.core.api.authorizeSourceCIDR('Ingress', {id: id}, "tcp", protPortMap["ssh"], protPortMap["ssh"], cidr, null);
            me.core.api.authorizeSourceCIDR('Ingress', {id: id}, "tcp", protPortMap["rdp"], protPortMap["rdp"], cidr, function() { me.refresh() });
        });
    },

    deleteSelected  : function () {
        var group = this.getSelected();
        if (group == null) return;

        var confirmed = confirm("Delete group "+group.name+"?");
        if (!confirmed)
            return;

        var me = this;
        var wrap = function() {
            me.refresh();
        }
        this.core.api.deleteSecurityGroup(group, wrap);
    },

};

var ew_PermissionsTreeView = {

    grantPermission : function(type)
    {
        var group = ew_SecurityGroupsTreeView.getSelected();
        if (group == null) return;

        retVal = {ok:null, type: 'Ingress'};
        window.openDialog("chrome://ew/content/dialogs/create_permission.xul", null, "chrome,centerscreen,modal,resizable", group, this.core, retVal);

        if (retVal.ok) {
            var me = this;
            var wrap = function() {
                ew_SecurityGroupsTreeView.refresh();
            }

            var newPerm = retVal.newPerm;
            if (newPerm.cidrIp) {
                this.core.api.authorizeSourceCIDR(retVal.type, group, newPerm.ipProtocol, newPerm.fromPort, newPerm.toPort, newPerm.cidrIp, wrap);
            } else {
                this.core.api.authorizeSourceGroup(retVal.type, group, newPerm.ipProtocol, newPerm.fromPort, newPerm.toPort, newPerm.srcGroup, wrap);
            }
        }
    },

    revokePermission : function()
    {
        var group = ew_SecurityGroupsTreeView.getSelected();
        if (group == null) return;
        var perms = new Array();
        for(var i in this.treeList) {
            if (this.selection.isSelected(i)) {
                perms.push(this.treeList[i]);
            }
        }
        if (perms.length == 0) return;
        if (!confirm("Revoke selected permission(s) on group "+group.name+"?")) return;

        var me = this;
        var wrap = function() {
            ew_SecurityGroupsTreeView.refresh();
        }

        var permission = null;
        for (i in perms) {
            permission = perms[i];
            if (permission.cidrIp) {
                this.core.api.revokeSourceCIDR(permission.type,group,permission.protocol,permission.fromPort,permission.toPort,permission.cidrIp,wrap);
            } else {
                this.core.api.revokeSourceGroup(permission.type,group,permission.protocol,permission.fromPort,permission.toPort,permission.srcGroup,wrap);
            }
        }

    },

};

var ew_ReservedInstancesTreeView = {
    model: 'reservedInstances',

    isRefreshable: function() {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "payment-pending") return true;
        }
        return false;
    },
};

var ew_LeaseOfferingsTreeView = {
    model: 'offerings',

    purchaseOffering : function()
    {
        var image = this.getSelected();
        if (image == null) return;
        var button = 0;

        while (button == 0) {
            var values = this.core.promptInput('Purchase Instance', [{label:"Instance Details",type:"section"},
                                                                     {label:"Offer ID",type:"label",value:image.id},
                                                                     {label:"Instance Type",type:"label",value:image.instanceType},
                                                                     {label:"Instance Tenancy",type:"label",value:image.tenancy},
                                                                     {label:"Duration(years)",type:"label",value:image.duration},
                                                                     {label:"Availability Zone",type:"label",value:image.azone},
                                                                     {label:"Offering Type",type:"label",value:image.offeringType},
                                                                     {label:"Usage Price(US$)",type:"label",value:image.usagePrice},
                                                                     {label:"Recuring Charges(US$)",type:"label",value:image.recurringCharges},
                                                                     {label:"Product Description",type:"label",value:image.productDescription},
                                                                     {label:"One Time Payment",type:"section"},
                                                                     {label:"One time payment/Instance(US$)",type:"label",value:image.fixedPrice},
                                                                     {label:"Number of instances",type:"number",size:6,required:1,min:0,onkeyup:"rc.items[13].obj.value=parseInt(rc.items[12].obj.value)*" + image.fixedPrice},
                                                                     {label:"Total one time payment, due now",type:"label"} ])
            if (!values || !parseInt(values[12])) return;
            // Ensure that the user actually wants to purchase this offering
            var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
            var flags = prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_0 + prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_1 + prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_2 + prompts.BUTTON_POS_0_DEFAULT;
            var msg = "You are about to purchase " + values[12] + " " + image.productDescription + " Reserved Instance(s) in the " + image.azone + " Availability Zone for $" + values[12] * parseInt(image.fixedPrice);
            msg = msg + ". Are you sure?\n\nAn email will be sent to you shortly after we receive your order.";
            button = prompts.confirmEx(window, "Confirm Reserved Instances Offering Purchase", msg, flags, "Edit Order", "Place Order", "", null, {});

            // Edit: 0, Purchase: 1, Cancel: 2
            if (button == 1) {
                this.core.api.purchaseOffering(image.id, values[12], function(id) { ew_ReservedInstancesTreeView.refresh(); });
            }
        }
    },
};

var ew_BundleTasksTreeView = {
    model: 'bundleTasks',
    searchElement: 'ew.bundleTasks.search',

    menuChanged  : function (event) {
        var task = this.getSelected();
        if (task == null) return;

        var fDisabled = (task.state == "complete" || task.state == "failed");

        // If the task has been completed or has failed, disable the
        // following context menu items.
        document.getElementById("bundleTasks.context.cancel").disabled = fDisabled;

        // If the task hasn't completed, you can't register a new AMI
        fDisabled = (task.state != "complete");
        document.getElementById("bundleTasks.context.register").disabled = fDisabled;
    },

    isRefreshable : function() {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "complete" || this.treeList[i].state == "failed") return true;
        }
        return false;
    },

    cancelBundleTask: function () {
        var selected = this.getSelectedBundle();
        if (selected == null) return;

        if (!confirm("Cancel bundle task:  " + selected.id + "?")) return;
        var me = this;
        this.core.api.cancelBundleTask(selected.id, function() { me.refresh() });
    },

    registerBundledImage : function (bucket, prefix)
    {
        var me = this;
        var manifestPath = bucket + "/" + prefix + ".manifest.xml";
        var region = this.core.api.getS3BucketLocation(bucket);
        this.core.api.registerImageInRegion(manifestPath, region, function() {
            me.core.modelRefresh('images');
            me.core.selectTab('ew.tabs.image');
        });
    },

    registerNewImage : function () {
        var selected = this.getSelected();
        if (selected == null) return;

        // Ensure that bundling has run to completion
        if (selected.state != "complete") {
            alert('Please wait for the Bundling State to be "complete" before Registering');
            return;
        }
        this.registerBundledImage(selected.s3bucket, selected.s3prefix);
    },
};
