var ew_InstancesTreeView = {
    model: ['instances', 'images', 'addresses', 'networkInterfaces', 'subnets', 'vpcs', 'availabilityZones', 'snapshots', 'volumes'],
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

    showBundleDialog : function() {
        var retVal = {ok:null,bucketName:null,prefix:null};
        var instance = this.getSelected();
        if (instance == null) return;

        do {
            var bucketReg = null;
            window.openDialog("chrome://ew/content/dialogs/bundle_instance.xul", null, "chrome,centerscreen,modal,resizable", instance.id, ew_session, retVal);
            if (retVal.ok) {
                // Create the bucket if it doesn't exist
                retVal.ok = ew_session.controller.createS3Bucket(retVal.bucketName);
            } else {
                // The user doesn't want to proceed!
                // If you get rid of this, the dialog keeps popping back up!
                break;
            }

            if (retVal.ok) {
                bucketReg = ew_session.controller.getS3BucketLocation(retVal.bucketName) || ew_session.region;
                retVal.ok = (ew_session.region == bucketReg);
                if (!retVal.ok) {
                    alert ("You must specify a bucket in the '" + ew_session.region + "'. Please try again");
                    retVal.bucketName = "";
                }
            }

            // Determine whether the user owns the specified bucket
            if (retVal.ok) {
                retVal.ok = ew_session.controller.writeS3KeyInBucket(retVal.bucketName, retVal.prefix + ".manifest.xml", "ew-write-test", bucketReg);
                if (!retVal.ok) {
                    alert ("ERROR: It appears that you don't have write permissions on the bucket: " + retVal.bucketName);
                }
            }
        } while (!retVal.ok);

        if (retVal.ok) {
            ew_session.controller.bundleInstance(instance.id, retVal.bucketName, retVal.prefix, ew_session.getActiveCredentials(), function() {
                ew_model.refresh('bundleTasks');
                ew_session.selectTab('ew.tabs.bundletask');
            });
        }
    },

    showCreateImageDialog : function() {
        var retVal = {ok:null,amiName:null,amiDescription:null,noReboot:null};
        var instance = this.getSelected();
        if (instance == null) return;

        window.openDialog("chrome://ew/content/dialogs/create_image.xul", null, "chrome,centerscreen,modal,resizable", instance.id, ew_session, retVal);
        if (retVal.ok) {
            ew_session.controller.createImage(instance.id, retVal.amiName, retVal.amiDescription, retVal.noReboot, function(id) {
                alert("A new AMI is being created and will be available in a moment.\n\nThe AMI ID is: "+id);
            });
        }
    },

    attachEBSVolume : function() {
        var instance = this.getSelected();
        if (instance == null) return;

        if (instance.state != "running") {
            alert("Instance should in running state")
            return;
        }

        if (!this.isInstanceReadyToUse(instance)) return;

        // Determine if there is actually an EBS volume to attach to
        var volumes = ew_session.model.get('volumes');
        if (volumes == null || volumes.length == 0) {
            // There are no volumes to attach to.
            var fRet = confirm ("Would you like to create a new EBS volume to attach to this instance?");
            if (fRet) {
                fRet = ew_VolumeTreeView.createVolume();
            }
            if (fRet) {
                volumes = ew_session.model.get('volumes');
            } else {
                return;
            }
        }

        var retVal = {ok:null, volumeId:null, device:null, windows: isWindows(instance.platform) };
        window.openDialog("chrome://ew/content/dialogs/attach_ebs_volume.xul",null, "chrome,centerscreen,modal,resizable", ew_session, instance, retVal);
        if (retVal.ok) {
            ew_VolumeTreeView.attachEBSVolume(retVal.volumeId,instance.id,retVal.device);
            ew_VolumeTreeView.refresh();
            ew_VolumeTreeView.select({ id: retVal.volumeId });
            ew_session.selectTab('ew.tabs.volume')
        }
    },

    associateWithEIP : function() {
        var instance = this.getSelected();
        if (instance == null) return;
        if (instance.state != "running") {
            alert("Instance should in running state")
            return;
        }

        // Determine if there is actually an EIP to associate with
        var eipList = ew_session.model.get('addresses');
        if (!eipList) {
            if (confirm ("Would you like to create a new Elastic IP to associate with this instance?")) {;
                ew_session.selectTab('ew.tabs.eip');
                ew_ElasticIPTreeView.allocateAddress();
            }
            return;
        }
        var eips = [];
        for (var i in eipList) {
            var eip = eipList[i];
            if ((isVpc(instance) && eip.domain != "vpc") || (!isVpc(instance) && eip.domain == "vpc")) continue;
            eips.push(eip)
        }
        var idx = ew_session.promptList("Associate EIP with Instance", "Which EIP would you like to associate with " + instance.toString() + "?", eips);
        if (idx < 0) return;
        var eip = eips[idx];

        if (eip.instanceId) {
            if (!this.session.promptYesNo("Confirm", "Address " + eip.publicIp + " is already mapped to an instance, continue?")) {
                return false;
            }
        }
        ew_session.controller.associateAddress(eip, instance.id, null, function() { me.refresh() });
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

    promptForKeyFile : function(keyName)
    {
        var keyFile = ew_session.promptForFile("Select the EC2 Private Key File for key: " + keyName);
        if (keyFile) {
            ew_session.setLastEC2PrivateKeyFile(keyFile);
        }
        log("getkey: " + keyName + "=" + keyFile);
        return keyFile;
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
        var output = ew_session.controller.getConsoleOutput(instance.id);

        if (output == null || output.length == 0) {
            alert ("This instance is currently being configured. Please try again in a short while...");
            return;
        }

        // 3. Get the password hex array by parsing the console output
        var passwordHex = this.decodePassword(output, fSilent);
        if (!passwordHex) return;

        var prvKeyFile = ew_session.getPrivateKeyFile(instance.keyName);
        log("Private Key File: " + prvKeyFile);

        while (fSuccess) {
            // If the private key file was not specified, or couldn't be found,
            // ask the user for its location on the local filesystem
            if (prvKeyFile.length == 0) {
                prvKeyFile = this.promptForKeyFile(instance.keyName);
            }
            if (!FileIO.exists(prvKeyFile)) {
                fSuccess = false;
            }

            if (!fSuccess) {
                // Has a default key file been saved for this user account?
                var savedKeyFile = ew_session.getLastEC2PrivateKeyFile();
                if (savedKeyFile.length > 0 && prvKeyFile != savedKeyFile) {
                    prvKeyFile = savedKeyFile;
                    log("Using default private key file");
                    fSuccess = true;
                    continue;
                }

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
                    ew_session.copyToClipboard(password);
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
        ew_session.controller.runMoreInstances(instance, count, function() { me.refresh()});
    },

    terminateInstance : function() {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Terminate " + instances.length + " instance(s)?")) return;

        var me = this;
        ew_session.controller.terminateInstances(instances, function() { me.refresh()});
    },

    stopInstance : function(force) {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Stop " + instances.length + " instance(s)?")) return;

        var me = this;
        ew_session.controller.stopInstances(instances, force, function() { me.refresh()});
    },

    changeUserData: function() {
        var instance = this.getSelected();
        if (instance == null) return;

        var returnValue = {accepted:false , result:null};
        ew_session.controller.describeInstanceAttribute(instance.id, "userData", function(value) {
            var text = ew_session.promptForText('Instance User Data:', (value ? Base64.decode(value) : ''));
            if (text == null) return;

            ew_session.controller.modifyInstanceAttribute(instance.id, 'UserData', Base64.encode(text));
        });
    },

    changeInstanceType: function() {
        var instance = this.getSelected();
        if (!instance) return;
        var me = this;
        ew_session.controller.describeInstanceAttribute(instance.id, "instanceType", function(value) {
            var idx = ew_session.promptList('Instance Type', 'Select instance type:', instanceTypes );
            if (idx == -1) return;
            ew_session.controller.modifyInstanceAttribute(instance.id, 'InstanceType', instanceTypes[idx], function() { me.refresh() });
        });
    },

    changeTerminationProtection : function() {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        ew_session.controller.describeInstanceAttribute(instances[0].id, "disableApiTermination", function(value) {
            value = (value == "true")
            if (confirm((value ? "Disable" : "Enable") + " Termination Protection?")) {
                for (var i = 0; i < instances.length; i++) {
                  ew_session.controller.modifyInstanceAttribute(instances[i].id, "DisableApiTermination", !value);
                }
            }
        });
    },

    changeSourceDestCheck : function() {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        ew_session.controller.describeInstanceAttribute(instances[0].id, "sourceDestCheck", function(value) {
            value = (value == "true")
            if (confirm((value ? "Disable" : "Enable") + " source/destination checking?")) {
                for (var i = 0; i < instances.length; i++) {
                  ew_session.controller.modifyInstanceAttribute(instances[i].id, "SourceDesctCheck", !value);
                }
            }
        });
    },

    changeShutdownBehaviour : function(value) {
        var instances = this.getSelectedAll();
        if (!instances.length) return;
        var me = this;

        ew_session.controller.describeInstanceAttribute(instances[0].id, "instanceInitiatedShutdownBehavior", function(value) {
            value = value == "stop" ? "terminate" : "stop";
            if (confirm("Change instance initiated shutdown behaviour to " + value + " for "+instances.length+" instance(s)?")) {
                for (var i = 0; i < instances.length; i++) {
                    ew_session.controller.modifyInstanceAttribute(instances[i].id, "InstanceInitiatedShutdownBehavior", value);
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
        ew_session.controller.monitorInstances(instances, function() { me.refresh(); });
    },

    stopMonitoring: function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Stop monitoring "+instances.length+" instance(s)?")) return;
        var me = this;
        ew_session.controller.unmonitorInstances(instances, function() { me.refresh(); });
    },

    rebootInstance: function()
    {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        if (!confirm("Reboot "+instances.length+" instance(s)?")) return;
        var me = this;
        ew_session.controller.rebootInstances(instances, function() { me.refresh(); });
    },

    startInstance : function() {
        var instances = this.getSelectedAll();
        if (instances.length == 0) return;
        var me = this;
        ew_session.controller.startInstances(instances, function() {me.refresh()});
    },

    isInstanceReadyToUse : function(instance) {
        var ret = false;
        if (isWindows(instance.platform)) {
            var output = ew_session.controller.getConsoleOutput(instance.id);
            // Parse the response to determine whether the instance is ready to use
            ret = output.indexOf("Windows is Ready to use") >= 0;
        } else {
            ret = true;
        }
        if (!ret) {
            alert ("Please wait till 'Windows is Ready to use' before attaching an EBS volume to instance: " + instance.id);
        }
        return ret;
    },

    showConsoleOutput : function(id, timestamp, output)
    {
        var instance = this.getSelected();
        if (!instance) return;
        var output = ew_session.controller.getConsoleOutput(instance.id);
        window.openDialog("chrome://ew/content/dialogs/console_output.xul", null, "chrome,centerscreen,modal,resizable", output);
    },

    authorizeProtocolForGroup : function(transport, protocol, groups)
    {
        this.authorizeProtocolPortForGroup(transport,protocol,protPortMap[protocol],groups);
    },

    authorizeProtocolPortForGroup : function (transport, protocol, port, groups)
    {
        var fAdd = true;
        var openCIDR = "0.0.0.0/0";
        var hostCIDR = ew_session.queryCheckIP() + "/32";
        var networkCIDR = ew_session.queryCheckIP("block");

        debug("Host: " + hostCIDR + ", net:" + networkCIDR)

        var permissions = null;
        for (var j in groups) {
            if (groups[j])
                permissions = groups[j].permissions;
            else
                continue;

            // Is the Protocol enabled for the group?
            for (var i in permissions) {
                var perm = permissions[i];

                if (perm.protocol == transport) {
                    // Nothing needs to be done if:
                    // 1. Either the from or to port of a permission
                    // matches the protocol's port or the port is within the
                    // port range
                    // AND
                    // 2. The CIDR for the permission matches either
                    // the host's CIDR or the network's CIDR or
                    // the Firewall has been opened to the world
                    var fromPort = parseInt(perm.fromPort);
                    var toPort = parseInt(perm.toPort);
                    port = parseInt(port);
                    if ((perm.fromPort == port || perm.toPort == port || (perm.fromPort <= port && perm.toPort >= port)) &&
                        (perm.cidrIp == openCIDR || perm.cidrIp == hostCIDR || perm.cidrIp == networkCIDR)) {
                        // We have a match!
                        fAdd = false;
                        break;
                    }
                }
            }

            if (!fAdd) {
                break;
            }
        }

        if (fAdd) {
            var result = false;
            if (ew_session.getBoolPrefs("ew.prompt.open.port", true)) {
                port = port.toString();
                var msg = ew_session.getAppName() + " needs to open " + transport.toUpperCase() + " port " + port + " (" + protocol + ") to continue. Click Ok to authorize this action";
                var check = {value: false};
                result = ew_session.promptConfirm("EC2 Firewall Port Authorization", msg, "Do not ask me again", check);
                ew_session.setBoolPrefs("ew.prompt.open.port", !check.value);
            } else {
                result = true;
            }

            if (result) {
                result = false;
                var wrap = function() {
                    ew_SecurityGroupsTreeView.refresh();
                }
                // Authorize first available group
                for (var i in groups) {
                    if (groups[i]) {
                        ew_session.controller.authorizeSourceCIDR('Ingress', groups[i], transport, port, port, hostCIDR, wrap);
                        result = true
                        break;
                    }
                }
            }
            if (!result) {
                alert("Could not authorize port " + port)
            }
        }
    },

    connectToSelectedInstances : function(ipType)
    {
        for (var i in this.treeList) {
            if (this.selection.isSelected(i)) {
                log ("Connecting to " + ipType + ": " + this.treeList[i].id);
                this.selection.currentIndex = i;
                this.connectTo(this.treeList[i], ipType);
            }
        }
    },

    openConnectionPort : function(instance)
    {
        // Get the group in which this instance was launched
        var groups = ew_model.get('securityGroups');
        var instGroups = new Array(instance.groups.length);
        for (var j in instance.groups) {
            instGroups[j] = null;
            for (var i in groups) {
                if (groups[i].id == instance.groups[j]) {
                    instGroups[j] = groups[i];
                    break;
                }
            }
        }

        // If this is a Windows instance, we need to RDP instead
        if (isWindows(instance.platform)) {
            // Ensure that the RDP port is open in one of the instance's groups
            this.authorizeProtocolForGroup("tcp", "rdp", instGroups);
        } else {
            // Ensure that the SSH port is open in one of the instance's groups
            this.authorizeProtocolForGroup("tcp", "ssh", instGroups);
        }
    },

    // ipType: 0 - private, 1 - public, 2 - elastic, 3 - public or elastic, 4 - dns name
    connectTo : function(instance, ipType)
    {
        var args = ew_session.getSSHArgs();
        var cmd = ew_session.getSSHCommand();

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
            args = ew_session.getRDPArgs();
            cmd = ew_session.getRDPCommand();
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
            var keyFile = ew_session.getPrivateKeyFile(instance.keyName);
            if (!FileIO.exists(keyFile)) {
                keyFile = this.promptForKeyFile(instance.keyName);
            }
            if (!keyFile || !FileIO.exists(keyFile)) {
                alert('Cannot connect without private key file for keypair ' + instance.keyName)
                return;
            }
            params.push(["key", keyFile])
        }

        if (args.indexOf("${login}") >= 0 && ew_session.getStrPrefs("ew.ssh.user") == "") {
            var login = prompt("Please provide SSH user name:");
            if (login && login != "") {
                params.push(["login", login])
            }
        }

        // Common substitution
        args = ew_session.getArgsProcessed(args, params, hostname);

        ew_session.launchProcess(cmd, args);

    },

    rdpToMac : function(hostname, cmd)
    {
        var filename = ew_session.getHome() + "/" + ew_session.getAppName() + "/" + hostname + ".rdp";
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

        ew_session.launchProcess(cmd, [filename]);
    },

    isRefreshable : function()
    {
        for (var i in this.treeList) {
            if (this.treeList[i].state == "pending" || this.treeList[i].state == "shutting-down") return true;
        }
        return false;
    },

};

ew_InstancesTreeView.__proto__ = TreeView;
ew_InstancesTreeView.register();
