var ew_InstanceLauncher = {
    image : null,
    session : null,
    retVal : null,
    securityGroups: null,
    unusedSecGroupsList : null,
    usedSecGroupsList : null,
    vpcMenu : null,
    azMenu : null,
    tnMenu: null,
    subnetMenu : null,
    unused : new Array(),
    used : new Array(),

    launch : function()
    {
        var minbox = document.getElementById("ew.min");
        var minval = parseInt(minbox.value);
        if (isNaN(minval) || minval <= 0 || minval > this.retVal.max) {
            alert("Minimum value must be a positive integer between 1 and " + this.retVal.max);
            minbox.select();
            return false;
        }
        // Assumes validateMin has been called
        var maxbox = document.getElementById("ew.max");
        var maxval = parseInt(maxbox.value);
        if (isNaN(maxval) || maxval <= 0 || maxval > this.retVal.max) {
            alert("Maximum value must be a positive integer between 1 and " + this.retVal.max);
            maxbox.select();
            return false;
        }
        if (minval > maxval) {
            alert("Maximum value may not be smaller than minimum value between 1 and " + maxval);
            minbox.select();
            return false;
        }

        this.retVal.imageId = this.image.id;
        this.retVal.kernelId = document.getElementById("ew.aki").value;
        this.retVal.ramdiskId = document.getElementById("ew.ari").value;
        this.retVal.instanceType = document.getElementById("ew.instancetypelist").selectedItem.value;
        this.retVal.minCount = document.getElementById("ew.min").value.trim();
        this.retVal.maxCount = document.getElementById("ew.max").value.trim();
        this.retVal.tag = document.getElementById("ew.tag").value.trim();
        this.retVal.name = document.getElementById("ew.name").value.trim();
        this.retVal.securityGroups = this.used;

        var subnet = document.getElementById("ew.subnetId").value;
        if (subnet == "" && this.vpcMenu.value != "") {
            alert("No subnet selected for VPC. Please select a subnet to continue.");
            return false;
        }
        this.retVal.subnetId = subnet;
        this.retVal.ipAddress = document.getElementById("ew.ipAddress").value.trim();

        // This will be an empty string if <none> is selected
        this.retVal.keyName = document.getElementById("ew.keypairlist").selectedItem.value;

        // This will be an empty string if <any> is selected
        this.retVal.availabilityZone = this.azMenu.value;
        this.retVal.tenancy = this.tnMenu.value;
        this.retVal.monitoring = document.getElementById("ew.monitor").checked;

        this.retVal.userData = document.getElementById("ew.userdata").value;
        if (this.retVal.userData == "") {
            this.retVal.userData = null;
        }
        this.retVal.properties = document.getElementById("ew.properties").value;
        if (this.retVal.properties == "") {
            this.retVal.properties = null;
        }
        this.retVal.ok = true;

        return true;
    },

    buildGroupList : function()
    {
        this.unused.splice(0, this.unused.length);
        this.used.splice(0, this.used.length);

        for (var i in this.securityGroups) {
            if (this.securityGroups[i].vpcId == this.vpcMenu.value) {
                this.unused.push(this.securityGroups[i]);
            }
        }
    },

    getSecurityGroup : function(id)
    {
        for (var i in this.securityGroups) {
            if (this.securityGroups[i].id == id) {
                return this.securityGroups[i]
            }
        }
        return null
    },

    addSecurityGroup : function()
    {
        var selected_list = [];

        for (var i = 0; i < this.unusedSecGroupsList.getRowCount(); i++) {
            var item = this.unusedSecGroupsList.getItemAtIndex(i);
            if (item.selected && item.value) {
                var group = this.getSecurityGroup(item.value)
                if (group) {
                    this.used.push(group);
                    selected_list.push(group.id);
                }
            }
        }

        for (var i = this.unused.length - 1; i >= 0; i--) {
            for (var j = 0; j < selected_list.length; j++) {
                if (this.unused[i].id == selected_list[j]) {
                    this.unused.splice(i, 1);
                    break;
                }
            }
        }

        this.refreshDisplay();
    },

    removeSecurityGroup : function()
    {
        var selected_list = [];

        for ( var i = 0; i < this.usedSecGroupsList.getRowCount(); i++) {
            var item = this.usedSecGroupsList.getItemAtIndex(i);
            if (item.selected && item.value) {
                var group = this.getSecurityGroup(item.value)
                if (group) {
                    this.unused.push(group);
                    selected_list.push(group.id);
                }
            }
        }

        for ( var i = this.used.length - 1; i >= 0; i--) {
            for ( var j = 0; j < selected_list.length; j++) {
                if (this.used[i].id == selected_list[j]) {
                    this.used.splice(i, 1);
                    break;
                }
            }
        }

        this.refreshDisplay();
    },

    vpcIdSelected : function()
    {
        var sel = this.vpcMenu.selectedItem;
        var az = this.azMenu.value

        // Reset subnets
        this.subnetMenu.removeAllItems();
        document.getElementById("ew.ipAddress").disabled = true;

        if (sel.value != null && sel.value != '') {
            var subnets = this.core.queryModel('subnets');
            for ( var i in subnets) {
                if (subnets[i].vpcId == sel.value && (az == "" || az == subnets[i].availabilityZone)) {
                    this.subnetMenu.appendItem(subnets[i].toString(), subnets[i].id)
                }
            }
            this.subnetMenu.selectedIndex = 0;
            document.getElementById("ew.ipAddress").disabled = false;
        }

        this.buildGroupList();
        this.refreshDisplay();
    },

    loadUserDataFromFile : function(fBinary)
    {
        var file = this.core.promptForFile("Load user data");
        if (!file) return;
        var data = "";
        if (fBinary) {
            data = "Base64:" + this.core.getBinaryFileContents(file, true);
        } else {
            data = this.core.getFileContents(file)
        }
        document.getElementById("ew.userdata").value = data;
    },

    init : function()
    {
        this.image = window.arguments[0];
        this.core = window.arguments[1];
        this.retVal = window.arguments[2];

        // Get the list of keypair names visible to this user.
        // This will trigger a DescribeKeyPairs if the model
        // doesn't have any keypair info yet. If there are no keypairs,
        // this dialog shouldn't be initialized any further.
        var keypairs = this.core.queryModel('keypairs');
        if (keypairs == null) {
            alert("Please create a keypair before launching an instance");
            return false;
        }

        var keypairMenu = document.getElementById("ew.keypairlist");
        keypairMenu.appendItem("<none>", null);
        for ( var i in keypairs) {
            keypairMenu.appendItem(keypairs[i].name, keypairs[i].name);
        }
        // If the user created at least one EC2 Keypair, select it.
        keypairMenu.selectedIndex = (keypairs.length > 0) ? 1 : 0;

        var typeMenu = document.getElementById("ew.instancetypelist");
        // Add the instance sizes based on AMI architecture
        var types = this.core.getInstanceTypes(this.image.arch);
        for (var i in types) {
            typeMenu.appendItem(types[i].name, types[i].id);
        }
        typeMenu.selectedIndex = 0;

        var textBox = document.getElementById("ew.ami");
        textBox.value = this.image.id;

        textBox = document.getElementById("ew.ami.tag");
        textBox.value = this.image.tag || "";

        textBox = document.getElementById("ew.ami.location");
        textBox.value = this.image.location.split('/').pop();

        textBox = document.getElementById("ew.min");
        textBox.focus();

        // availability zones
        this.azMenu = document.getElementById("ew.azId");
        this.azMenu.appendItem("<any>", null);
        var availZones = this.core.queryModel('availabilityZones');
        for ( var i in availZones) {
            this.azMenu.appendItem(availZones[i].name + " (" + availZones[i].state + ")", availZones[i].name);
        }
        this.azMenu.selectedIndex = 0;

        this.tnMenu = document.getElementById("ew.tenancy");

        // vpcs
        this.vpcMenu = document.getElementById("ew.vpcId");
        this.subnetMenu = document.getElementById("ew.subnetId");

        document.getElementById("ew.ipAddress").disabled = true;

        // Grab handles to the unused and used security group lists.
        this.unusedSecGroupsList = document.getElementById("ew.secgroups.unused");
        this.usedSecGroupsList = document.getElementById("ew.secgroups.used");

        // Get the list of security groups visible to this user. This will trigger a DescribeSecurityGroups
        // if the model doesn't have any info yet.
        this.securityGroups = this.core.queryModel('securityGroups');
        this.buildGroupList();

        var aki = this.image.aki;
        var ari = this.image.ari;

        // Populate the AKI and ARI lists
        var akiList = document.getElementById("ew.aki");
        var ariList = document.getElementById("ew.ari");
        var images = this.core.queryModel('images');
        var akiRegex = regExs["aki"];
        var ariRegex = regExs["ari"];
        akiList.appendItem("");
        ariList.appendItem("");

        if (!isWindows(this.image.platform)) {
            i = 0;
            var imgId = null;
            for (i in images) {
                imgId = images[i].id;
                if (imgId.match(akiRegex)) {
                    akiList.appendItem(imgId);
                    continue;
                }

                if (imgId.match(ariRegex)) {
                    ariList.appendItem(imgId);
                }
            }

            akiList.value = aki;
            ariList.value = ari;
        }

        // Populate VPCs
        var vpcs = this.core.queryModel('vpcs');
        this.vpcMenu.appendItem("", "");
        for (var i in vpcs) {
            this.vpcMenu.appendItem(vpcs[i].toString(), vpcs[i].id);
        }
        this.vpcMenu.selectedIndex = 0;
        this.vpcIdSelected();
        this.refreshDisplay();
    },

    refreshDisplay : function()
    {
        while (this.unusedSecGroupsList.getRowCount() > 0) {
            this.unusedSecGroupsList.removeItemAt(0);
        }
        while (this.usedSecGroupsList.getRowCount() > 0) {
            this.usedSecGroupsList.removeItemAt(0);
        }

        this.used.sort();
        this.unused.sort();

        for (var i in this.unused) {
            this.unusedSecGroupsList.appendItem(this.unused[i].id + ": " + this.unused[i].name + ": " + this.unused[i].description, this.unused[i].id);
        }
        for (var i in this.used) {
            this.usedSecGroupsList.appendItem(this.used[i].id + ": " + this.used[i].name + ": " + this.used[i].description, this.used[i].id);
        }
    }
}
