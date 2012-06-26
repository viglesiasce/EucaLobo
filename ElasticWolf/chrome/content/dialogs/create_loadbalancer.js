function init()
{
    this.core = window.arguments[0];
    this.rc = window.arguments[1];

    ew_ListBox.name = 'ew.instances';
    ew_ListBox.session = this.core;
    ew_ListBox.multiple = true;
    ew_ListBox.listItems = this.core.queryModel('instances','state', 'running');
    ew_ListBox.init();

    var availZones = this.core.queryModel('availabilityZones');
    var availZoneMenu = document.getElementById("ew.azones");
    for(var i in availZones) {
        availZoneMenu.appendItem(availZones[i].name, availZones[i].name);
    }
    availZoneMenu.selectedIndex =  0;

    this.subnets = this.core.queryModel('subnets');
    var subnetMenu = document.getElementById("ew.subnets");
    for(var i = 0; i < subnets.length; i++) {
        subnetMenu.appendItem(subnets[i].toString(), subnets[i].id);
    }
    subnetMenu.selectedIndex = 0;

    var azsn = document.getElementById("ew.azsn").selectedIndex = this.rc.vpc ? 1 : 0;
}

function launch()
{
    this.rc.name = document.getElementById("ew.Name").value.trim();
    this.rc.Protocol = document.getElementById("ew.Protocol").value.trim();
    this.rc.elbport = document.getElementById("ew.elbport").value.trim();
    this.rc.instanceport = document.getElementById("ew.instanceport").value.trim();

    this.rc.pingprotocol = document.getElementById("ew.pingprotocol").value.trim();
    this.rc.pingport = document.getElementById("ew.pingport").value.trim();
    this.rc.pingpath = document.getElementById("ew.pingpath").value.trim();

    this.rc.Target = this.rc.pingprotocol + ":" + this.rc.pingport
    if (this.rc.pingprotocol.substr(0,4) == "HTTP") {
        this.rc.Target += this.rc.pingpath;
    }
    this.rc.Interval = document.getElementById("ew.Interval").value.trim();
    this.rc.Timeout = document.getElementById("ew.timeout").value.trim();
    this.rc.HealthyThreshold = document.getElementById("ew.HThreshold").value.trim();
    this.rc.UnhealthyThreshold = document.getElementById("ew.uThreshold").value.trim();

    var azsn = document.getElementById("ew.azsn").value;
    if (azsn == 'az') {
        this.rc.Zone = document.getElementById("ew.azones").selectedItem.value;
    } else {
        this.rc.subnetId = document.getElementById("ew.subnets").selectedItem.value;
        var groupMenu = document.getElementById('ew.groups');
        this.rc.groups = [];
        for (var i = 0; i < groupMenu.selectedItems.length; i++) {
            this.rc.groups.push(groupMenu.selectedItems[i].value);
        }
        var subnet = this.core.findModel('subnets', this.rc.subnetId);
        this.rc.Zone = subnet.availabilityZone;
    }
    ew_ListBox.done();

    this.rc.instances = [];
    for (var i in ew_ListBox.selectedItems) {
        this.rc.instances.push(ew_ListBox.selectedItems[i].id);
    }

    this.rc.ok = true;
    return true;
}

function refresh_group()
{
    var subnetMenu = document.getElementById("ew.subnets");
    var groupMenu = document.getElementById("ew.groups");

    for (var i = groupMenu.itemCount - 1; i >= 0; i--) {
        groupMenu.removeItemAt(i);
    }
    var subnet = this.subnets[subnetMenu.selectedIndex];
    if (!subnet) return;

    var groups = this.core.queryModel('securityGroups', 'vpcId', subnet.vpcId);
    for (var i = 0; i < groups.length; i++) {
        groupMenu.appendItem(groups[i].name, groups[i].id);
        if (groups[i].name == 'default') {
            groupMenu.selectItem(groupMenu.getItemAtIndex(i));
        }
    }
}

function validate1() {
    var name = document.getElementById('ew.Name').value;
    var elbport = document.getElementById('ew.elbport').value;
    var iElbport = parseInt(elbport);
    var instanceport = document.getElementById('ew.instanceport').value;
    var iInstanceport = parseInt(instanceport);

    if (!/^[A-Za-z0-9]+$/.test(name)) {
        alert('Domain names must contain only alphanumeric characters or dashes.');
        return false;
    }

    if (!/^[0-9]+$/.test(elbport) || !(iElbport == 80 || iElbport == 443 || (1024 <= iElbport && iElbport <= 65535))) {
        alert('Load Balancer port must be either 80, 443 or 1024-65535 inclusive.');
        return false;
    }

    if (!/^[0-9]+$/.test(instanceport) || !(1 <= iInstanceport && iInstanceport <= 65535)) {
        alert('Instance Balancer port must be 1-65535 inclusive.');
        return false;
    }

    var lbs = this.core.queryModel('loadBalancers', 'LoadBalancerName', name);
    if (lbs && lbs.length > 0) {
        alert('Duplicate Load Balancer name.');
        return false;
    }

    var azsn = document.getElementById("ew.azsn").selectedItem.value;
    if (azsn == 'sn') {
        var subnetMenu = document.getElementById("ew.subnets");
        if (!subnetMenu.selectedItem) {
            alert('Please choose a subnet.');
            return false;
        }

        var groups = document.getElementById('ew.groups');
        if (groups.selectedItems.length == 0) {
            alert('Please choose one or more security groups.');
            return false;
        }
    }

    return true;
}

function validate2()
{
    var pingprotocol = document.getElementById('ew.pingprotocol').selectedItem.value;
    var pingport = document.getElementById('ew.pingport').value;
    var iPingport = parseInt(pingport);
    var pingpath = document.getElementById('ew.pingpath').value;
    var timeout = document.getElementById('ew.timeout').value;
    var iTimeout = parseInt(timeout);
    var interval = document.getElementById('ew.Interval').value;
    var iInterval = parseInt(interval);
    var uthreshold = document.getElementById('ew.uThreshold').value;
    var iUthreshold = parseInt(uthreshold);
    var hthreshold = document.getElementById('ew.HThreshold').value;
    var iHthreshold = parseInt(hthreshold);

    if (!/^[0-9]+$/.test(pingport) || !(1 <= iPingport && iPingport <= 65535)) {
        alert('Ping port must be 1-65535 inclusive.');
        return false;
    }

    if (pingprotocol.substr(0,4) == 'HTTP' && !/^[\x21-\x7E]+$/.test(pingpath)) {
        alert('Ping path may only contain printable ASCII characters, without spaces.');
        return false;
    }

    if (!/^[0-9]+$/.test(timeout) || !(2 <= iTimeout && iTimeout <= 60)) {
        alert('Timeout port must be 2 sec - 60 sec.');
        return false;
    }

    if (!/^[0-9]+$/.test(interval) || !(5 <= iInterval && iInterval <= 300)) {
        alert('Interval port must be 5 sec - 300 sec.');
        return false;
    }

    if (iInterval <= iTimeout) {
        alert('HealthCheck timeout must be less than interval.');
        return false;
    }

    if (!/^[0-9]+$/.test(uthreshold) || !(2 <= iUthreshold && iUthreshold <= 10)) {
        alert('Unhealthy threshold must be 2 times - 10 times.');
        return false;
    }

    if (!/^[0-9]+$/.test(hthreshold) || !(2 <= iHthreshold && iHthreshold <= 10)) {
        alert('Healthy threshold must be 2 times - 10 times.');
        return false;
    }

    return true;
}
