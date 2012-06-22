var ew_PrefsView = {
   rowCount: 0,

   refresh: function() {
       this.rowCount++;
       var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
       var os = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS;
       $("ew.sys").value = os + " " + info.platformVersion;
       $("ew.version").value = ew_session.VERSION;
       $("ew.ec2_version").value = ew_session.EC2_API_VERSION;
       $("ew.iam_version").value = ew_session.IAM_API_VERSION;
       $("ew.elb_version").value = ew_session.ELB_API_VERSION;
       $("ew.cw_version").value = ew_session.CW_API_VERSION;
       $("ew.user").value = ew_session.user.name + " " + ew_session.user.arn;
       $("ew.home").value = ew_session.getHome();
       $("ew.profile").value = ew_session.getProfileHome();
       $("ew.key.home").value = ew_session.getKeyHome();
       $("ew.ssh.command").value = ew_session.getSSHCommand();
       $("ew.ssh.args").value = ew_session.getSSHArgs();
       $("ew.rdp.command").value = ew_session.getRDPCommand();
       $("ew.rdp.args").value = ew_session.getRDPArgs();
       $("ew.openssl.command").value = ew_session.getOpenSSLCommand();
       $("ew.shell.command").value = ew_session.getShellCommand();
       $("ew.shell.args").value = ew_session.getShellArgs();
       this.getPrefs("ew.ssh.user");
       this.getPrefs("ew.pin");
       this.getPrefs('ew.path.java', ew_session.getDefaultJavaHome());
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
       // Optional debugging support
       $('ew.venkman').hidden = typeof start_venkman != 'function';
   },

   deactivate: function() {
       if (!this.rowCount) return;
       this.setPrefs("ew.ssh.command");
       this.setPrefs("ew.ssh.args");
       this.setPrefs("ew.ssh.user");
       this.setPrefs("ew.rdp.command");
       this.setPrefs("ew.rdp.args");
       this.setPrefs("ew.openssl.command");
       this.setPrefs("ew.shell.command");
       this.setPrefs("ew.shell.args");
       this.setPrefs("ew.key.home");
       this.setPrefs("ew.pin");
       this.setPrefs('ew.path.java', ew_session.getDefaultJavaHome());
       this.setPrefs('ew.path.ec2');
       this.setPrefs('ew.path.iam');
       this.setPrefs('ew.path.ami');
       this.setPrefs('ew.path.autoscaling');
       this.setPrefs('ew.path.cloudwatch');
       this.setPrefs("ew.debug.enabled");
       this.setPrefs("ew.http.enabled");
       this.setPrefs("ew.idle.timeout");
       this.setPrefs("ew.idle.action");
       this.setPrefs("ew.http.timeout", 5000, 3600000);
       this.setPrefs("ew.prompt.open.port");
       this.setPrefs("ew.advanced.mode");

       ew_session.setIdleTimer();
       ew_menu.update();
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

   setPrefs: function(name, min, max)
   {
       var obj = $(name);
       switch (obj.type) {
       case "password":
           ew_session.savePassword(name, obj.value);
           break;

       case "number":
           ew_session.setIntPrefs(name, obj.value, min, max);
           break;

       default:
           switch (obj.tagName) {
           case "checkbox":
               ew_session.setBoolPrefs(name, obj.checked);
               break;

           default:
               ew_session.setStrPrefs(name, obj.value.toString());
           }
       }
   },

   getPrefs: function(name, dflt)
   {
       var obj = $(name);
       switch (obj.type) {
       case "password":
           obj.value = ew_session.getPassword(name);
           break;

       case "number":
           obj.value = ew_session.getIntPrefs(name, dflt);
           break;

       default:
           switch (obj.tagName) {
           case "checkbox":
               obj.checked = ew_session.getBoolPrefs(name, dflt);
               break;

           default:
               obj.value = ew_session.getStrPrefs(name, dflt);
           }
       }
   },

   browse: function(id, forFile) {
      if (forFile) {
         path = ew_session.promptForFile("Choose command:");
      } else {
         path = ew_session.promptForDir("Choose directory where tools are located:");
      }
      if (path) {
          $(id).value = path;
      }
   },

   cleanup: function()
   {
       if (!confirm('All preferences and credentials will be removed from this computer, access to AWS will not be possible without new credentials, continue?')) return;
       DirIO.remove(ew_session.getProfileHome());
       ew_session.quit();
   },
}

