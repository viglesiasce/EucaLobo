//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_PrefsView = {
   rowCount: 0,

   refresh: function() {
       this.rowCount++;
       var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
       var os = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS;

       $("ew.sys").value = os + " " + info.name + " " + info.vendor + " "+ info.platformVersion;
       $("ew.user").value = this.core.user.name + " " + this.core.user.id;
       $("ew.account").value = this.core.user.arn;
       $("ew.platforms").value = this.core.platforms + " " + (this.core.vpcId ? "Default VPC/" + this.core.vpcId : "");
       $("ew.version").value = info.version;
       $("ew.ec2_version").value = this.core.api.EC2_API_VERSION;
       $("ew.iam_version").value = this.core.api.IAM_API_VERSION;
       $("ew.elb_version").value = this.core.api.ELB_API_VERSION;
       $("ew.cw_version").value = this.core.api.CW_API_VERSION;
       $("ew.sqs_version").value = this.core.api.SQS_API_VERSION;
       $("ew.sts_version").value = this.core.api.STS_API_VERSION;
       $("ew.emr_version").value = this.core.api.EMR_API_VERSION;
       $("ew.ddb_version").value = this.core.api.DDB_API_VERSION;
       $("ew.as_version").value = this.core.api.AS_API_VERSION;
       $("ew.home").value = this.core.getHome();
       $("ew.profile").value = this.core.getProfileHome();
       $("ew.key.home").value = this.core.getKeyHome();
       $("ew.ssh.command").value = this.core.getSSHCommand();
       $("ew.ssh.args").value = this.core.getSSHArgs();
       $("ew.rdp.command").value = this.core.getRDPCommand();
       $("ew.rdp.args").value = this.core.getRDPArgs();
       $("ew.openssl.command").value = this.core.getOpenSSLCommand();
       $("ew.sshkeygen.command").value = this.core.getSSHKeygenCommand();
       $("ew.shell.command").value = this.core.getShellCommand();
       $("ew.shell.args").value = this.core.getShellArgs();
       this.getPrefs("ew.ssh.user");
       this.getPrefs("ew.pin");
       this.getPrefs('ew.path.java', this.core.getDefaultJavaHome());
       this.getPrefs('ew.path.ec2');
       this.getPrefs('ew.path.iam');
       this.getPrefs('ew.path.ami');
       this.getPrefs('ew.path.autoscaling');
       this.getPrefs('ew.path.cloudwatch');
       this.getPrefs("ew.debug.enabled");
       this.getPrefs("ew.http.enabled", true);
       this.getPrefs("ew.idle.timeout");
       this.getPrefs("ew.idle.action");
       this.getPrefs("ew.http.timeout", 15000);
       this.getPrefs("ew.prompt.open.port", true);
       this.getPrefs("ew.advanced.mode", false);
       this.getPrefs("ew.errors.show", true);
       // Optional debugging support
       $('ew.venkman').hidden = typeof start_venkman != 'function';
   },

   reset: function() {
       if (!this.rowCount) return;
       this.resetPrefs("ew.ssh.command");
       this.resetPrefs("ew.ssh.args");
       this.resetPrefs("ew.ssh.user");
       this.resetPrefs("ew.rdp.command");
       this.resetPrefs("ew.rdp.args");
       this.resetPrefs("ew.openssl.command");
       this.resetPrefs("ew.sshkeygen.command");
       this.resetPrefs("ew.shell.command");
       this.resetPrefs("ew.shell.args");
       this.resetPrefs("ew.key.home");
       this.refresh();
   },

   deactivate: function() {
       if (!this.rowCount) return;
       this.setPrefs("ew.ssh.command");
       this.setPrefs("ew.ssh.args");
       this.setPrefs("ew.ssh.user");
       this.setPrefs("ew.rdp.command");
       this.setPrefs("ew.rdp.args");
       this.setPrefs("ew.openssl.command");
       this.setPrefs("ew.sshkeygen.command");
       this.setPrefs("ew.shell.command");
       this.setPrefs("ew.shell.args");
       this.setPrefs("ew.key.home");
       this.setPrefs("ew.pin");
       this.setPrefs('ew.path.java', this.core.getDefaultJavaHome());
       this.setPrefs('ew.path.ec2');
       this.setPrefs('ew.path.iam');
       this.setPrefs('ew.path.ami');
       this.setPrefs('ew.path.autoscaling');
       this.setPrefs('ew.path.cloudwatch');
       this.setPrefs("ew.debug.enabled");
       this.setPrefs("ew.http.enabled");
       this.setPrefs("ew.errors.show");
       this.setPrefs("ew.idle.timeout");
       this.setPrefs("ew.idle.action");
       this.setPrefs("ew.http.timeout", 5000, 3600000);
       this.setPrefs("ew.prompt.open.port");
       this.setPrefs("ew.advanced.mode");

       this.core.setIdleTimer();
       this.core.updateMenu();
       this.rowCount = 0;
   },

   activate: function() {
       this.refresh();
   },

   display: function() {
   },

   invalidate: function() {
   },

   resetAll: function() {
       var items = document.getElementsByTagName("textbox")
       for (var i = 0; i < items.length; i++) {
           items[i].value = ""
       }
   },

   resetPrefs: function(name)
   {
       this.core.setStrPrefs(name, '');
   },

   setPrefs: function(name, min, max)
   {
       var obj = $(name);
       switch (obj.type) {
       case "password":
           this.core.savePassword(name, obj.value);
           break;

       case "number":
           this.core.setIntPrefs(name, obj.value, min, max);
           break;

       default:
           switch (obj.tagName) {
           case "checkbox":
               this.core.setBoolPrefs(name, obj.checked);
               break;

           default:
               this.core.setStrPrefs(name, obj.value.toString());
           }
       }
   },

   getPrefs: function(name, dflt)
   {
       var obj = $(name);
       switch (obj.type) {
       case "password":
           obj.value = this.core.getPassword(name);
           break;

       case "number":
           obj.value = this.core.getIntPrefs(name, dflt);
           break;

       default:
           switch (obj.tagName) {
           case "checkbox":
               obj.checked = this.core.getBoolPrefs(name, dflt);
               break;

           default:
               obj.value = this.core.getStrPrefs(name, dflt);
           }
       }
   },

   browse: function(id, forFile) {
      if (forFile) {
         path = this.core.promptForFile("Choose command:");
      } else {
         path = this.core.promptForDir("Choose directory where tools are located:");
      }
      if (path) {
          $(id).value = path;
      }
   },

   cleanup: function()
   {
       if (!confirm('All preferences and credentials will be removed from this computer, access to AWS will not be possible without new credentials, continue?')) return;
       DirIO.remove(this.core.getProfileHome());
       this.core.quit();
   },
}

