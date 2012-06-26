var ew_VolumeAttacher = {
  core : null,
  retVal : null,
  volumeId : null,

  attach : function() {
    if (!this.validateDevice()) return false;

    this.retVal.instanceId = document.getElementById("ew.newattachment.instanceId").value.split(":")[0];
    this.retVal.volumeId = this.volumeId;
    this.retVal.device = document.getElementById("ew.newattachment.device").value;

    this.retVal.ok = true;
    return true;
  },

  validateDevice : function() {
    var textbox = document.getElementById("ew.newattachment.device");
    if (textbox.value == "") {
        alert("You must enter a device name (e.g. /dev/sdh)");
        textbox.select();
        return false;
    }
    return true;
  },

  enableOrDisableDeviceField : function() {
    var textbox = document.getElementById("ew.newattachment.device");
    var instanceId = document.getElementById("ew.newattachment.instanceId").value;

    // Since there is a chance that the instanceId has
    // the instance tag appended to it
    instanceId = instanceId.split(":")[0];
    var instances = this.core.queryModel('instances');
    var fdisabled = false;
    for (var i in instances) {
        if (instances[i].id == instanceId) {
            // Is this a Windows instance
            if (instances[i].platform == 'windows') {
                fdisabled = true;
                break;
            }
        }
    }
    textbox.disabled = fdisabled;
    if (fdisabled) {
        textbox.value = "windows_device";
    } else {
        textbox.value = "";
    }
  },

  init : function() {
    this.volumeId = window.arguments[0].id;
    this.zone = window.arguments[0].availabilityZone;
    this.core = window.arguments[1];
    this.retVal = window.arguments[2];

    // volume id
    document.getElementById("ew.newattachment.volumeId").value = this.volumeId;
    // instances
    var instanceIdMenu = document.getElementById("ew.newattachment.instanceId");
    var instances = this.core.queryModel('instances', 'state', 'running', 'AvailabilityZone', this.zone);
    for (var i in instances) {
        instanceIdMenu.appendItem(instances[i].toString(), instances[i].id);
    }
    instanceIdMenu.selectedIndex = 0;

    // Ensure that the device field is enabled or disabled as needed
    var textbox = document.getElementById("ew.newattachment.device");
    if (isWindows(instances[instanceIdMenu.selectedIndex].platform)) {
        textbox.disabled = true;
        textbox.value = "windows_device";
    } else {
        textbox.disabled = false;
        textbox.value = "";
    }

    // Select the instance id menu
    instanceIdMenu.select();

    var az = document.getElementById("ew.newattachment.instanceLabel");
    az.value += " [" + this.zone + "]";
  }
}
