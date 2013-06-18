//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_core = {
    URL: 'http://www.elasticwolf.com/',
    ISSUES: 'https://github.com/aws-ew-dev/ElasticWolf/issues',
    REALM : 'chrome://ew/',
    HOST  : 'chrome://ew/',

    disabled: false,
    locked: false,
    api : null,
    user: {},
    win: {},
    tabs: null,
    platforms: "EC2,VPC",
    vpcId: null,
    credentials : null,
    endpoints: null,
    prefs: null,
    cmdline: null,
    components : {},
    progress: {},
    appdir: null,

    // Intialize core object with current menu and api implementation
    initialize : function(tabs, api)
    {
        var me = this;
        if (this.prefs == null) {
            this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        }

        this.tabs = tabs;
        this.api = api;
        this.api.core = this;

        // Detect actual path where the extension is installed, on Windows we will use it for .exe files
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
        AddonManager.getAllAddons(function(addons) {
            for (var i in addons) {
                if (addons[i].name == 'ElasticWolf') {
                    me.appdir = addons[i].getResourceURI("").QueryInterface(Components.interfaces.nsIFileURL).file.path;
                }
            }
        });

        // Connect tree tags to tree view controllers
        for (var i in this.tabs) {
            // Because owner refers to the real panel need to skip it
            if (this.tabs[i].owner) continue;
            for (var v in this.tabs[i].views) {
                var id = this.tabs[i].views[v].id;
                var view = this.tabs[i].views[v].view;
                if (!view) continue;
                // Not TreeView, just assign the core
                if (!id) {
                    view.core = this;
                    continue;
                }
                var tree = $(id);
                if (!tree) {
                    debug('view not found ' + id);
                    continue;
                }
                // Must inherit from our tree view implementation
                view.__proto__ = TreeView;
                // Init with session
                view.init(tree, this.tabs[i], this);
            }
        }
        this.restoreMenu();
        this.checkAccessLog();
        this.credentials = this.getCredentials();
        this.getEndpoints();

        document.title = this.getAppName();
        document.getElementById("ew.header").label = this.getAppName() + " version " + this.getAppVersion();
        document.getElementById("ew.url").value = this.URL;

        // Use last used credentials
        this.selectEndpoint(this.getActiveEndpoint());
        this.switchCredentials(this.findCredentials(this.getAccountName()));
        this.selectTab(this.getStrPrefs("ew.tab.current", "ew.tabs.ew.folder"));

        // Parse command line
        this.cmdLine = window.arguments ? window.arguments[0].QueryInterface(Components.interfaces.nsICommandLine) : null;

        // Passing credentials
        if (this.cmdLine) {
            var name = this.cmdLine.handleFlagWithParam('name', true);
            var key = this.cmdLine.handleFlagWithParam('key', true);
            var secret = this.cmdLine.handleFlagWithParam('secret', true);
            var endpoint = this.cmdLine.handleFlagWithParam('endpoint', true);
            var token = this.cmdLine.handleFlagWithParam('token', true);

            if (key && key != '' && secret && secret != '') {
                var cred = new Credential(name || 'AWS', key, secret, endpoint, token);
                this.switchCredentials(cred);
            } else if (endpoint && endpoint != '') {
                var e = new Endpoint("", endpoint);
                this.switchEndpoints(e);
            }

            // Disable credentials management.  This is not hardened security because the javascript source code is available and can be installed
            // alongside in user home and executed directly. This is just a simple way to secure already running app when there is no
            // other access to the machine hard drive, in locked Windows installation for example and EW is used like the only
            // application running
            this.locked = this.cmdLine.handleFlag('lock', true);
        }

        // Check for pin
        this.promptForPin();
        this.setIdleTimer();
        this.refreshEndpoints();

        // On fresh install offer to enter endpoint the endpoints and credentials,
        // need timeout to allow the UI to settle
        if (this.endpoints.length == 0) {
            setTimeout(function() { ew_EndpointsTreeView.addEndpoint(); }, 1000);
            setTimeout(function() { ew_CredentialsTreeView.addCredentials(); }, 1000);
            this.addEndpoint("AWS","AWS","https://ec2.amazonaws.com","https://s3.amazonaws.com");
        }
    },

    setIdleTimer: function()
    {
        var me = this;
        var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService);
        if (this.idleObserver) {
            idleService.removeIdleObserver(this.idleObserver, this.idleObserver.timeout);
            this.idleObserver = null;
        }
        var timeout = this.getIntPrefs("ew.idle.timeout", 0);
        if (isNaN(timeout) || timeout <= 0) return;

        this.idleObserver = {
             timeout: timeout * 60,
             observe: function(subject, topic, data) {
                 var action = me.getStrPrefs("ew.idle.action", "");
                 debug(subject + ", " + topic + ", " + data + ", " + action)
                 switch (topic + ':' + action) {
                 case "idle:exit":
                     me.quit();
                     break;

                 case 'idle:pin':
                     me.promptForPin();
                     break;
                 }
             }
        };
        idleService.addIdleObserver(this.idleObserver, this.idleObserver.timeout);
    },

    reload: function()
    {
        if (!this.locked && !this.disabled) {
            window.location.reload();
        }
    },

    quit: function()
    {
        var app = Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup);
        app.quit(Components.interfaces.nsIAppStartup.eForceQuit);
    },

    getCurrentTab: function() {
        return this.getTab(this.currentTab);
    },

    getSelectedTab: function()
    {
        var tree = $('ew.menu');
        return tree.currentIndex >= 0 ? this.getTab(tree.view.getCellValue(this.tree.currentIndex, tree.columns[0])) : null;
    },

    getTab: function(name) {
        for (var i in this.tabs) {
            if (this.tabs[i].name == name) return this.tabs[i];
        }
        return null;
    },

    selectTab: function(name)
    {
        if (this.disabled) return;

        var tree = $('ew.menu');
        var tab = this.getTab(name);
        if (!tab) return false;

        // Deactivate current tab
        var curtab = this.getCurrentTab();
        if (curtab) {
            for (var i in curtab.views) {
                curtab.views[i].view.deactivate();
            }
        }

        // Activate new tab
        var idx = this.getMenu(name);
        if (idx == -1) {
            // Try directly if this panel not in the menu
            var panel = $(name);
            if (!panel) {
                debug('menu not found ' + name)
                return false;
            }
        } else {
            tree.currentIndex = idx;
            tree.view.selection.select(idx);
        }
        this.currentTab = name;
        $("ew.tabs").selectedPanel = $(tab.owner || name);

        // Activate and refresh if no records yet
        for (var i in tab.views) {
            debug('activate ' + tab.views[i].id + ", rows=" + tab.views[i].view.rowCount)
            tab.views[i].view.activate();
            // Assign new filter list and refresh contents
            tab.views[i].view.filterList = tab.views[i].filterList;
            tab.views[i].view.invalidate();
            // Focus the first view
            if (i == 0 && tab.views[i].view.focus) tab.views[i].view.focus();
        }
        // Non view tabs cannot be selected
        if (tab.proc) {
            tab.proc.call(tab.context);
            return false;
        }

        this.setStrPrefs("ew.tab.current", name);

        // Check for updates, daily
        var now = (new Date()).getTime()/1000;
        if (now - this.getIntPrefs('ew.updates.time', 0) > 86400) {
            this.checkForUpdates();
        }
        return true;
    },

    // Returns true if the current tab is in VPC display mode
    isVpcMode: function()
    {
        var tab = this.getCurrentTab();
        return tab && tab.name.indexOf('.vpc') > 0 ? true : false;
    },

    isViewVisible: function(view)
    {
        for (var i in this.tabs) {
            for (var j in this.tabs[i].views) {
                if (this.tabs[i].views[j].view == view) return true;
            }
        }
        return false;
    },

    menuOpenClose: function(event)
    {
        var tree = $('ew.menu');
        var id = tree.view.getCellValue(tree.currentIndex, tree.columns[0]);
        if (id == "" || id.indexOf(".folder") > 0) {
            var label = tree.view.getCellText(tree.currentIndex, tree.columns[0]).replace(/[()]+/g, '');
            tree.view.setCellText(tree.currentIndex, tree.columns[0], tree.view.isContainerOpen(tree.currentIndex) ? label : "(" + label + ")");
            this.setBoolPrefs("menu.state." + label, tree.view.isContainerOpen(tree.currentIndex));
        }
    },

    menuSelected: function(event)
    {
        var tree = $('ew.menu');
        var id = tree.view.getCellValue(tree.currentIndex, tree.columns[0]);
        this.selectTab(id);
    },

    menuPressed: function(event)
    {
        if (event.keyCode == 13) {
            this.menuSelected(event);
            event.stopPropagation();
            event.preventDefault();
            return false;
        }
        return true;
    },

    getMenu: function(id)
    {
        var tree = $('ew.menu');
        for (var i = 0; i < tree.view.rowCount; i++) {
            var val = tree.view.getCellValue(i, tree.columns[0]);
            if (val == id) return i;
        }
        return -1;
    },

    restoreMenu: function()
    {
        var tree = $('ew.menu');
        for (var i = 0; i < tree.view.rowCount; i++) {
            var label = tree.view.getCellText(i, tree.columns[0]).replace(/[()]+/g, '');
            if (!this.getBoolPrefs("menu.state." + label, true)) {
                tree.view.toggleOpenState(i);
                tree.view.setCellText(i, tree.columns[0], tree.view.isContainerOpen(i) ? label : "(" + label + ")");
            }
        }
    },

    updateMenu: function()
    {
        var tree = $('ew.menu');
        var idx = this.getMenu("ew.tabs.credential");
        if (idx > -1) {
            var cred = this.getActiveCredentials();
            var label = cred ? 'Current: ' + cred.name + "/" + this.api.region : "Manage Credentials";
            tree.view.setCellText(idx, tree.columns[0], label);
            $('ew_status').label = cred ? cred.name + "/" + this.api.region : "";
        }
        // Hide items in non advanced mode
        var advanced = this.getBoolPrefs("ew.advanced.mode", false);
        var items = document.getElementsByClassName("advanced");
        for (var i = 0; i < items.length; i++) {
            items[i].hidden = !advanced;
        }
        // Hie items in VPC only mode
        var items = document.getElementsByClassName("ec2");
        for (var i = 0; i < items.length; i++) {
            items[i].hidden = this.vpcId != null;
        }
    },

    // Clear all views with models except the current one
    invalidateMenu: function()
    {
        var curtab = this.getCurrentTab();
        for (var i in this.tabs) {
            if (curtab && this.tabs[i].name == curtab.name) continue;
            for (var v in this.tabs[i].views) {
                if (this.tabs[i].views[v].display) {
                    this.tabs[i].views[v].display([]);
                }
            }
        }
        this.updateMenu();
    },

    getCredentials : function () {
        var credentials = new Array();
        var list = this.getPasswordList("Cred:")
        for (var i = 0; i < list.length; i++) {
            var pw = list[i][1].split(";;");
            if (pw.length > 1) {
                var cred = new Credential(list[i][0].substr(5).trim(), pw[0], pw[1], pw.length > 2 ? pw[2] : "", pw.length > 3 ? pw[3] : "", pw.length > 4 ? pw[4] : "")
                credentials.push(cred);
            }
        }
        return credentials;
    },

    updateCredentials : function(cred, key, secret, url, token)
    {
        if (!cred) return;
        if (key) cred.accessKey = key;
        if (secret) cred.secretKey = secret;
        if (typeof url == "string") cred.ec2_url = url;
        if (typeof token == "string") cred.securityToken = token;
        this.saveCredentials(cred);
    },

    removeCredentials : function(cred)
    {
        this.deletePassword('Cred:' + cred.name)
        this.credentials = this.getCredentials();
    },

    saveCredentials : function(cred)
    {
        this.savePassword('Cred:' + cred.name, cred.toString())
    },

    getActiveCredentials : function()
    {
        for (var i in this.credentials) {
            if (this.api.accessKey == this.credentials[i].accessKey) return this.credentials[i];
        }
        return null;
    },

    findCredentials : function(name, key)
    {
        for (var i in this.credentials) {
            if (name && name == this.credentials[i].name) return this.credentials[i];
            if (key && key == this.credentials[i].accessKey) return this.credentials[i];
        }
        return null;
    },

    switchCredentials : function(cred)
    {
        if (this.locked)
        {
            alert("Credentials are locked and cannot be switched");
            return;
        }

        if (this.disabled) return;

        var wasGovCloud = this.isGovCloud();
        if (cred) {
            debug("switch credentials to " + cred.name + " " + cred.ec2_url)
            this.setStrPrefs("ew.account.name", cred.name);
            this.api.setCredentials(cred.accessKey, cred.secretKey, cred.securityToken);

            // Default endpoint does not need to be saved
            if (cred.url != "") {
                var endpoint = this.getEndpoint(null, cred.ec2_url);
                if (!endpoint) endpoint = new Endpoint("", cred.ec2_url)
                this.selectEndpoint(endpoint, true);
            } else
            // GovCloud credentials require endpoint to be set explicitely, switching from GovCloud without explicit endpoint will result in errors
            if (wasGovCloud) {
                // Reset and then use last saved endpoint
                this.api.setEndpoint(new Endpoint());
                this.selectEndpoint(this.getActiveEndpoint());
            }
            // Since we are switching creds, ensure that all the views are redrawn
            this.invalidateModel();
            this.invalidateMenu();
            var me = this;
            // Retrieve current user info
            this.api.getUser(null, function(user) { me.user = user || {}; })
            return true;
        }
        return false;
    },

    createCredentials: function(name, key, url, active)
    {
        var cred = this.getActiveCredentials();
        cred = new Credential(name, key.id, key.secret, url || cred.url, key.securityToken, key.expire);
        this.saveCredentials(cred);
        if (active) this.switchCredentials(cred);
        this.selectTab('ew.tabs.credential');
    },

    createTempCredentials: function(item, active)
    {
        if (!item) return;
        if (item.accessKeys && item.accessKeys.filter(function(x) { return x.status != "Temporary" }).length >= 2) {
            return alert((item.name || 'You') + ' already have ' + item.accessKeys.length + ' regular Access Keys. Please delete one key in order to create new credentials.');
        }

        var inputs = [ {label:"Credentials name",type:"name",required:1,value:(item.name || 'Temporary')},
                       {label:"Duration(sec)",type:"number",min:3600,max:3600*36} ];

        if (item.mfaDevices && item.mfaDevices.length) {
            inputs.push({label:"MFA Device:",type:"menulist",list:item.mfaDevices});
            inputs.push({label:"MFA Token Code"});
        }

        var me = this;
        var values = this.promptInput('Create Temporary Credentials', inputs);
        if (!values) return;
        var cred = this.findCredentials(values[0]);
        if (cred && (!cred.expire || cred.expire > (new Date()).getTime())) {
            return alert('Credentials with name ' + values[0]  + ' already exist, please choose another name');
        }

        this.api.createAccessKey(item.name, function(key) {
            me.api.showBusy(true);
            setTimeout(function() {
                me.api.getSessionToken(values[1], values[2], values[3], key, {
                    success: function(tempkey) {
                        me.createCredentials(values[0], tempkey, null, active);
                        me.api.deleteAccessKey(key.id, item.name);
                        me.api.showBusy(false);
                    },
                    error: function() {
                        me.api.deleteAccessKey(key.id, item.name);
                        me.api.showBusy(false);
                    }
                });
            }, 10000);
        });
    },

    getActiveEndpoint : function()
    {
        var endpoint = this.getEndpoint(this.getStrPrefs("ew.endpoint.ec2_url"));
        return endpoint ? endpoint : new Endpoint("", this.getStrPrefs("ew.endpoint.ec2_url", "https://ec2.us-east-1.amazonaws.com"));
    },

    getEndpoint: function(name, ec2_url)
    {
        if (this.endpoints) {
            for (var i in this.endpoints) {
                if (name && this.endpoints[i].name == name) return this.endpoints[i];
                if (ec2_url && this.endpoints[i].ec2_url == ec2_url) return this.endpoints[i];
            }
        }
        return null;
    },

    selectEndpoint: function(endpoint, dontsave)
    {
        if (endpoint != null) {
            if (!dontsave) {
                this.setStrPrefs("ew.endpoint.ec2_url", endpoint.ec2_url);
            }
            this.api.setEndpoint(endpoint);
            this.updateMenu();
            return true;
        }
        return false;
    },

    switchEndpoints : function(name)
    {
        if (this.locked || this.disabled) return;

        var wasGovCloud = this.isGovCloud();
        var endpoint = this.getEndpoint(name);
        if (this.selectEndpoint(endpoint)) {
            // Switching between GovCloud, reset credentials
            if (this.isGovCloud() != wasGovCloud) {
                debug('disable credentials when switching to/from GovCloud')
                this.api.setCredentials("", "");
                this.setStrPrefs("ew.account.name", "");
            }
            // Since we are switching creds, ensure that all the views are redrawn
            this.invalidateModel();
            this.invalidateMenu();
        } else {
            alert('Endpoint ' + name + ' does not exist.')
        }
    },

    addEndpoint: function(name, type, ec2_url, s3_url)
    {
        if (this.endpoints) {
            if (this.getEndpoint(name)) return;
            this.endpoints.push(new Endpoint(name, type, ec2_url, s3_url));
            this.setListPrefs("ew.endpoints", this.endpoints);
        }
    },

    deleteEndpoint: function(name)
    {
        if (this.endpoints) {
            for (var i in this.endpoints) {
                if (this.endpoints[i].name == name) {
                    this.endpoints.splice(i, 1);
                    this.setListPrefs("ew.endpoints", this.endpoints);
                    break;
                }
            }
        }
    },

    getEndpoints : function()
    {
        if (this.endpoints == null) {
            this.endpoints = [];

            // Default endpoints with posssible custom configuration like urls, versions for each service
            var regions = this.api.getEC2Regions();
            for (var i in regions) {
                this.endpoints.push(regions[i]);
            }

            // Merge with added endpoints
            var list = this.getListPrefs("ew.endpoints");
            for (var i in list) {
                if (list[i] && list[i].name && list[i].type && list[i].ec2_url && list[i].s3_url) {
                    this.endpoints.push(new Endpoint(list[i].name,list[i].type, list[i].ec2_url, list[i].s3_url));
                }
            }
        }
        return this.endpoints;
    },

    refreshEndpoints: function()
    {
        var me = this;
        // Merge with saved list of regions
        this.api.describeRegions(function(regions) {
            for (var i in regions) {
                if (me.getEndpoint(regions[i].name) == null) {
                    me.endpoints.push(regions[i]);
                }
            }
        });
    },

    displayErrors: function()
    {
        this.promptInput("Error Log", [{notitle:1,multiline:true,cols:100,rows:30,flex:1,scale:1,style:"font-family:monospace",readonly:true,wrap:false,value:this.api.errorList.join("\n")}], {modeless:true});
    },

    displayUrl: function(url, protocol)
    {
        if (!url) return;
        try {
          var io = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
          var uri = io.newURI(url, null, null);
          var eps = Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService)
          var launcher = eps.getProtocolHandlerInfo(protocol || 'http');
          launcher.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
          launcher.launchWithURI(uri, null);
        } catch (e) {
          alert(e);
        }
    },

    submitIssue: function()
    {
        this.displayUrl(this.ISSUES);
    },

    playAlertSound: function()
    {
        var sound = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound);
        var io = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
        var uri = io.newURI("chrome://ew/content/images/alert.mp3", null, null);
        if (sound) sound.play(uri);
    },

    prompt: function(title, value)
    {
        var values = this.promptInput("", [{label:title,value:value,required:1}]);
        return values ? values[0] : null;
    },

    // Select from the list
    // items are objects to show
    // multiple: if checkbox can be used to selected items
    // width: absolute width of the dialog
    // columns: is list of propety names to show, otherwise convert object to string using toString
    // checkedItems: is list of initially selected items
    // checkedTitle: is name of checkbox column
    // checkProperty: if not null all the items will be returned with this property set or unset
    promptList: function(title, msg, items, params)
    {
        if (!params) params = {};
        params.core = this;
        params.title = title;
        params.msg = msg;
        params.items = items;
        params.selectedIndex = -1;
        params.selectedItems = [];
        // By default it is single select
        if (typeof params.multiple == "undefined") params.multiple = false;
        window.openDialog("chrome://ew/content/dialogs/select.xul", null, "chrome,centerscreen,modal,resizable", params);
        return params.multiple ? (params.checkedProperty ? params.items : params.selectedItems) : params.selectedIndex;
    },

    // MultiInput dialog:
    // items is list of input field descriptor objects with reserved properties:
    // label: - name of the field
    // value:  initial value for the input field
    // type: default is textbox, can be checkbox, password, label, image...
    // all other properties will be additional attributes of the element
    promptInput: function(title, items, params)
    {
        if (!params) params = {};
        params.core = this;
        params.title = title;
        params.items = items || [ "" ];
        params.values = null;

        // Complex type, additional options
        if (typeof title == "object") {
            for (var p in title) params[p] = title[p];
        }
        var win = window.openDialog("chrome://ew/content/dialogs/input.xul", null, "chrome,centerscreen,resizable," + (params.modeless ? "modeless" : "modal"), params);
        return params.modeless ? win : (params.ok ? params.values : null);
    },

    promptForFile : function(msg, save, filename)
    {
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, msg, save ? nsIFilePicker.modeSave : nsIFilePicker.modeOpen);
        fp.displayDirectory = FileIO.open(this.getKeyHome());
        fp.defaultString = filename || "";
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
        fp.displayDirectory = FileIO.open(this.getKeyHome());
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

    promptConfirm: function(title, msg, checkmsg, checkval)
    {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
        return promptService.confirmCheck(window, title, msg, checkmsg, checkval);
    },

    promptData: function(title, msg, data, checkmsg, checkval)
    {
        var val = { value: data || "" };
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
        var rc = promptService.prompt(window, title, msg, val, checkmsg, checkval);
        return rc ? val.value : null;
    },

    // Does not wait for response, once called it will ask for pin and quit if entered wrongly
    promptForPin: function() {
        var me = this;
        var pin = this.getPassword('ew.pin');
        // If already disabled or no pin just ignore, once pin appeared the only way to hide it by entering correct pin
        if (this.pinPrompt || pin == '') return;
        this.disabled = true;

        // Use timer so we do not block all the time and give a chance to process events
        setTimeout(function() {
            var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
            var pw = { value: "" };
            me.pinPrompt = true;
            var rc = prompts.promptPassword(null, "PIN", "Enter access PIN:", pw, null, {});
            me.pinPrompt = false;
            if (!rc) {
                me.quit();
            } else
            if (pw.value == pin) {
                me.disabled = false;
            } else {
                me.promptForPin();
            }
        }, 10);
    },

    promptForPassword: function(title, text)
    {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
        var pw = { value: "" };
        var rc = promptService.promptPassword(null, title, text, pw, null, {});
        return rc ? pw.value : null;
    },

    promptForTag: function(tags)
    {
        var values = this.promptInput("Tags (Key:Value, Key:Value...)",
                            [{label:"Tags",multiline:true,rows:20,cols:60,value:String(tags)},
                             {label:"",type:"description",value:"Predefined tags:\n - Name: for primary name"}]);
        return values ? (values[0] || '').replace(/(\n|\r)+/g, ' ').trim() : null;
    },

    // Use for updating attributes, fields is list of predefined or well known inputs, it must contain propetry name: to match attributes items,
    // attributes is a list of name value pairs, reurns updates attributes list with only changed values or null
    promptAttributes: function(title, fields, attributes)
    {
        var inputs = [];
        for (var i in attributes) {
            var input = {label: attributes[i].name, type: 'label'};
            for (var j in fields) {
                if (fields[j].name == attributes[i].name) {
                    input = fields[j];
                    input.found = true;
                    break;
                }
            }
            input.value = attributes[i].value;
            if (attributes[i].name.indexOf("Timestamp") > 0) {
                input.value = new Date(input.value * 1000);
            }
            // Nice help hints about the numbers
            if(input.label.indexOf("Seconds") > -1) {
                input.help = formatDuration(parseInt(input.value));
            }
            if(input.label.indexOf("Size") > -1) {
                input.help = formatSize(parseInt(input.value));
            }
            if (input.label.indexOf("Policy") > -1 && input.value != "") {
                try {
                    input.value = formatJSON(input.value);
                }
                catch(e) { debug(e) }
            }
            if (input.found) inputs.splice(0, 0, input); else inputs.push(input);
        }
        // Add missing entries
        for (var j in fields) {
            if (!fields[j].found) {
                inputs.splice(0, 0, fields[j]);
            }
        }
        var values = this.promptInput(title, inputs);
        if (!values) return null;
        var updated = [];
        for (var i in values) {
            if (values[i] && values[i] != inputs[i].value) {
                updated.push(new Tag(inputs[i].name, values[i]));
            }
        }
        return updated;
    },

    displayAccessLog: function()
    {
        var data = FileIO.toString(this.getProfileHome() + DirIO.slash + "access.log").split("\n");
        this.promptInput("Access Log", [{type:'listview',multiple:0,notitle:1,flex:1,scale:1,list:data}], {modeless:true});
    },

    writeAccessLog: function(line)
    {
        debug(line);
        if (!this.accessLog) {
            this.accessLog = FileIO.open(this.getProfileHome() + DirIO.slash + 'access.log');
            if (!this.accessLog) return;
        }
        FileIO.write(this.accessLog, new Date().toISOString() + ' ' + line + "\n", 'a');
    },

    checkAccessLog: function()
    {
        var log = FileIO.open(this.getProfileHome() + DirIO.slash + 'access.log');
        if (log && log.exists()) {
            if (log.fileSize > 1024*1024*2) {
                log.moveTo(null, "access.log.old");
            }
            log = null;
        }
    },

    saveAccessKey: function(file, accessKey)
    {
        if (!file || !accessKey) return false;
        if (!FileIO.write(FileIO.open(file), "AWSAccessKeyId=" + accessKey.id + "\nAWSSecretKey=" + accessKey.secret + "\n")) {
            return alert('Unable to create credentials file ' + file + ", please check directory permissions");
        }
        return true;
    },

    savePassword : function(key, secret)
    {
        if (!secret || secret == "") {
            return this.deletePassword(key);
        }
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
        var login = new nsLoginInfo(this.HOST, null, this.REALM, key, secret, "", "");
        var logins = loginManager.findLogins({}, this.HOST, "", this.REALM);
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
        var logins = loginManager.findLogins({}, this.HOST, "", this.REALM);
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
        var logins = loginManager.findLogins({}, this.HOST, "", this.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username == key) {
                return logins[i].password;
            }
        }
        return ""
    },

    getPasswordList : function(prefix)
    {
        var list = [];
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
        var logins = loginManager.findLogins({}, this.HOST, "", this.REALM);
        for ( var i = 0; i < logins.length; i++) {
            if (logins[i].username.indexOf(prefix) == 0) {
                list.push([ logins[i].username, logins[i].password ])
            }
        }
        return list
    },

    getTempKeys: function()
    {
        var list = [];
        var now = new Date();
        var keys = this.getPassword("ew.temp.keys");
        try { list = JSON.parse(keys); } catch(e) {};
        // Remove expired keys
        var rc = list.filter(function(x) {
            if (x.expire) x.expire = new Date(x.expire);
            if (x.expire <= now) return false;
            return true;
        });
        return rc;
    },

    deleteTempKey: function(key)
    {
        var list = this.getTempKeys();
        this.removeObject(list, key.id);
        this.saveTempKeys(list);
    },

    saveTempKeys: function(list)
    {
        list = JSON.stringify(list instanceof Array ? list : []);
        this.savePassword("ew.temp.keys", list);
    },

    // Wrapper around global debug with multiple parameters
    log: function()
    {
        var str = "";
        for (var i = 0; i < arguments.length; i++) {
            str += String(arguments[i]) + " ";
        }
        debug(str)
    },

    copyToClipboard: function(text)
    {
        if (!text) return;
        var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
        str.data = text;

        var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", str, text.length * 2);

        var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
        clip.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
    },

    versionNum: function(ver)
    {
        var v = ver.split(".");
        if (v.length != 3) return 0;
        return parseInt(v[0]) * 100 + parseInt(v[1]) * 10 + parseInt(v[2]);
    },

    checkForUpdates: function(msg)
    {
        var me = this;
        if (!this.isEnabled()) return null;

        // File naming convention
        var rx = new RegExp(this.getAppName() + ".*[-\.]([0-9]+\.[0-9]+\.[0-9]+)[-\.].*zip", "g");
        var verno = this.getAppVersion()
        var ver = this.versionNum(verno);

        // HTTP access to the releases, can be any kind of page or listing with files
        var xmlhttp = this.api.getXmlHttp();
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                var d, data = xmlhttp.responseText;
                while (d = rx.exec(data)) {
                    debug('update:' + d);
                    if (me.versionNum(d[1]) > ver) {
                        me.promptInput('Software Update', [{label:"New version " + d[1] + " is available at",value:me.URL,type:"link",url:me.URL}]);
                        return;
                    }
                }
                if (msg) alert("You are running the latest version: " + verno)
            }
        };
        xmlhttp.open("GET", this.URL + "?" + new Date().getTime(), true);
        xmlhttp.setRequestHeader("User-Agent", this.getUserAgent());
        xmlhttp.setRequestHeader("Cache-Control", "no-cache, must-revalidate");
        xmlhttp.send();
        // Mark when we checked last time
        this.setIntPrefs('ew.updates.time', (new Date()).getTime()/1000);
    },

    errorMessage: function(msg)
    {
        if (!msg) msg = "";
        // Resize message panel accordint to window size
        $('ew_message').setAttribute('maxwidth', window.outerWidth * 0.75);
        $('ew_message').label = msg;
        $('ew_alert').hidden = msg == "";

        if (this.errorTimer) clearTimeout(this.errorTimer);
        if (msg) {
            this.playAlertSound();
            this.errorTimer = setTimeout(this.errorMessage, 30000);
        }
    },

    // Show non modal error popup
    errorDialog : function(msg, response)
    {
        if (!response) response = {};
        var rc = { core: this, msg: msg, action: response.action || "", errCode: response.errCode || "", errString: response.errString || "", requestId: response.requestId || "" };
        // Reuse the same window
        if (!this.win.error) {
            this.win.error = window.openDialog("chrome://ew/content/dialogs/error.xul", null, "chrome,centerscreen,resizable,modeless", rc);
        } else
        if (this.win.error.setup) {
            this.win.error.setup.call(this.win.error, rc);
            this.win.error.focus();
        }
    },

    // Show error message instead of default alert popup
    alertDialog: function(title, msg, action, errCode)
    {
        var rc = { core: this, modal: true, title: title, msg: title, action: action || "", errCode: errCode || "", errString: msg || "" };
        window.openDialog("chrome://ew/content/dialogs/error.xul", null, "chrome,centerscreen,resizable,modal", rc);
    },

    // Extract common tags from the list and updater the object
    processTags: function(obj, name)
    {
        if (!obj || !obj.tags) return;
        for (var i in obj.tags) {
            switch (obj.tags[i].name) {
            case "Name":
                obj[name || "name"] = obj.tags[i].value;
                return;
            }
        }
    },

    // If tag is string, parse and return list of tags, if it is already a list, return as it is
    parseTags: function(tag)
    {
        var list = [];
        if (!tag) return list;

        if (typeof tag == "string") {
            tag += ',';
            var pairs = (tag.match(/\s*[^,":]+\s*:\s*("(?:[^"]|"")*"|[^,]*)\s*,\s*/g) || []);
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split(/\s*:\s*/, 2);
                var key = (pair[0] || "").trim();
                var value = (pair[1] || "").trim();
                value = value.replace(/,\s*$/, '').trim();
                value = value.replace(/^"/, '').replace(/"$/, '').replace(/""/, '"');
                if (key.length == 0) continue;
                list.push(new Tag(key, value));
            }
        } else
        if (tag instanceof Array) {
            list = tag;
        }
        return list;
    },

    // Set tags to the specified object(s).
    // objs an be an object, an id string or list of objects or list of ids
    // tags can be a string or list of tags
    setTags: function(objs, tags, callback)
    {
        log('setTags: id=' + objs + ", tags=" + tags)

        var me = this;
        var ntags = new Array();

        if (!(objs instanceof Array)) objs = [ objs ];
        tags = this.parseTags(tags);

        for (var i = 0; i < objs.length; i++) {
            var id = objs[i];
            if (typeof id == "object") id = id.id;
            for (var j = 0; j < tags.length; j++) {
                ntags.push(new Tag(tags[j].name, tags[j].value, id));
            }
        }

        function wrap() {
            if (ntags.length > 0) {
                me.api.createTags(ntags, callback);
            } else
            if (callback) {
                callback();
            }
        }

        // Get existing tags and delete them all, then create new tags if exist
        this.api.describeTags(objs, function(described) {
            var non_system_tags = [];
            // Ensure that system tags are not deleted on update
            var system_tags_pattern =/(euca:|aws:)/g;
            if (described.length) {
                for (var i = 0; i < described.length; i++) {
                    if (!system_tags_pattern.test(described[i])){
                        non_system_tags.push();
                    }
                }
                me.api.deleteTags(non_system_tags, wrap);
            } else {
                wrap();
            }
        });
    },

    isGovCloud : function(url)
    {
        return String(url || this.api.urls.EC2).indexOf("us-gov") > -1;
    },

    isEnabled: function()
    {
        return this.getBoolPrefs("ew.http.enabled", true) && !this.disabled && this.api.accessKey != "" && this.api.secretKey != "";
    },

    getMimeType: function(file)
    {
        if (!file || file.indexOf('.') == -1) return "";
        try {
            var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
            var url = ioService.newURI('file://' + (file[0] != '/' ? '/' : '') + file, null, null);
            var mService = Components.classes["@mozilla.org/mime;1"].getService(Components.interfaces.nsIMIMEService);
            var type = mService.getTypeFromURI(url);
            return type || "";
        }
        catch(e) { debug('Error: ' + file + ":" + e) }
        return "";
    },

    getDirSeparator : function()
    {
        return navigator.platform.toLowerCase().indexOf('win') > -1 ? '\\' : '/';
    },

    getAppName : function()
    {
        var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
        return info.name;
    },

    getAppVersion: function()
    {
        var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
        return info.version;
    },

    getUserAgent: function ()
    {
        return this.getAppName() + "/" + this.getAppVersion();
    },

    getHome : function()
    {
        var home = "";
        var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
        if (isWindows(navigator.platform)) {
            if (env.exists("HOMEDRIVE") && env.exists("HOMEPATH")) {
                home = env.get("HOMEDRIVE") + env.get("HOMEPATH");
            }
        }
        if (home == "" && env.exists('HOME')) {
            home = env.get("HOME");
        }
        return home
    },

    getAppPath : function()
    {
        return this.appdir || DirIO.get("CurProcD").path;
    },

    getUserHome : function()
    {
        return DirIO.get("Home").path;
    },

    getProfileHome : function()
    {
        return DirIO.get("ProfD").path;
    },

    getKeyHome : function()
    {
        return this.getStrPrefs("ew.key.home", this.getHome() + this.getDirSeparator() + this.getAppName());
    },

    makeKeyHome: function()
    {
        while (true) {
            var msg, path = this.getKeyHome();
            if (DirIO.mkpath(path)) {
                // Can we create files here?
                var file = DirIO.makepath(path, "test");
                var rc = FileIO.write(FileIO.open(file), "");
                FileIO.remove(file);
                if (rc) return 1;
                msg = "Directory " + path + " is not writable, please choose another place where to keep my files:"
            } else {
                msg = 'Unable to create directory ' + path + ", please choose another directory where to keep my files:"
            }
            path = this.promptForDir(msg);
            if (!path) return 0;
            this.setStrPrefs("ew.key.home", path);
        }
    },

    getAccountName : function()
    {
        return this.getStrPrefs("ew.account.name", "");
    },

    getShellCommand : function()
    {
        var shell = '/usr/bin/xterm';
        if (isMacOS(navigator.platform)) {
            shell = '/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal';
        } else

        if (isWindows(navigator.platform)) {
            shell = 'c:\\\Windows\\System32\\cmd.exe';
        }
        return this.getStrPrefs("ew.shell.command", shell);
    },

    getShellArgs : function()
    {
        return this.getStrPrefs("ew.shell.args", "");
    },

    getRDPCommand : function()
    {
        var cmd = "/usr/bin/rdesktop";
        if (isMacOS(navigator.platform)) {
            if (FileIO.exists("/Applications/Remote Desktop Connection.app")) {
                cmd = "/Applications/Remote Desktop Connection.app/Contents/MacOS/Remote Desktop Connection";
            } else
            if (FileIO.exists("/opt/local/bin/rdesktop")) {
                cmd = "/opt/local/bin/rdesktop";
            }
        } else
        if (isWindows(navigator.platform)) {
            cmd = "c:\\Windows\\System32\\mstsc.exe";
        }
        return this.getStrPrefs("ew.rdp.command", cmd);
    },

    getRDPArgs : function()
    {
        var args = "-g 1440x900 -u administrator -p ${pass} -x l ${host}";
        if (isMacOS(navigator.platform)) {
            if (FileIO.exists("/Applications/Remote Desktop Connection.app")) {
                args = "${host}";
            }
        } else
        if (isWindows(navigator.platform)) {
            args = '/v ${host}';
        }
        return this.getStrPrefs("ew.rdp.args", args);
    },

    getSSHCommand : function()
    {
        var cmd = '/usr/bin/xterm';
        if (isMacOS(navigator.platform)) {
            cmd = "/usr/bin/osascript";
        } else

        if (isWindows(navigator.platform)) {
            cmd = 'c:\\\Windows\\System32\\cmd.exe';
        }
        return this.getStrPrefs("ew.ssh.command", cmd);
    },

    getSSHArgs : function()
    {
        var args = "'-e /usr/bin/ssh -i ${key} ${login}@${host}";
        if (isMacOS(navigator.platform)) {
            var cmdline = [
                  'on run argv',
                  '  tell app "System Events" to set termOn to (exists process "Terminal")',
                  '  set cmd to "ssh -i ${key} ${login}@${host}"',
                  '  if (termOn) then',
                  '    tell app "Terminal" to do script cmd',
                  '  else',
                  '    tell app "Terminal" to do script cmd in front window',
                  '  end if',
                  '  tell app "Terminal" to activate',
                  'end run'];
            // turn into -e 'line1' -e 'line2' etc.
            args = cmdline.map(function(s) { return "-e '" + s.replace(/^\s+/, '') + "'" }).join(" ");
        } else

        if (isWindows(navigator.platform)) {
            args = "/c #!set HOME=" + this.getHome() + "#!" + quotepath(this.getAppPath() + '\\bin\\ssh.exe') + " -o \"ServerAliveInterval 5\" -i ${key} ${login}@${host}";
        }
        return this.getStrPrefs("ew.ssh.args", args);
    },

    getSSHKeygenCommand : function()
    {
        var cmd = "/usr/bin/ssh-keygen";
        if (isWindows(navigator.platform)) {
            cmd = this.getAppPath() + "\\bin\\ssh-keygen.exe";
        }
        return this.getStrPrefs("ew.sshkeygen.command", cmd);
    },

    getOpenSSLCommand : function()
    {
        var cmd = "/usr/bin/openssl";
        if (isWindows(navigator.platform)) {
            cmd = this.getAppPath() + "\\bin\\openssl.exe";
        }
        return this.getStrPrefs("ew.openssl.command", cmd);
    },

    getDefaultJavaHome: function() {
        if (isWindows(navigator.platform)) {
            return "C:\\Program Files (x86)\\Java\\jre6";
        } else

        if (isMacOS(navigator.platform)) {
            return "/System/Library/Frameworks/JavaVM.framework/Home";
        }
        return "/usr/lib/java";
    },

    getCredentialFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "AWSCredential_${keyname}.txt", [ [ "keyname", sanitize(name ? name : this.getAccountName()) ] ]);
    },

    getPrivateKeyFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "PrivateKey_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getAccountName()) ] ]);
    },

    getPublicKeyFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "PublicKey_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getAccountName()) ] ]);
    },

    getCertificateFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "X509Certificate_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getAccountName()) ] ]);
    },

    getTemplateProcessed : function(file, params)
    {
        var keyname = null;
        // Custom variables
        for ( var i = 0; params && i < params.length; i++) {
            var val = params[i][1];
            if (file.indexOf("${" + params[i][0] + "}") > -1) {
                file = file.replace(new RegExp("\\${" + params[i][0] + "}", "g"), quotepath(val));
            }
            switch (params[i][0]) {
            case "keyname":
                keyname = val;
                break;
            }
        }
        // Global variables
        if (file.indexOf("${login}") > -1) {
            var user = this.getStrPrefs("ew.ssh.user");
            if (user != "") {
                file = file.replace(/\${login}/g, user);
            } else {
                file = file.replace(/\${login}@/g, "");
            }
        }
        if (file.indexOf("${home}") > -1) {
            var home = this.getHome()
            file = file.replace(/\${home}/g, quotepath(home));
        }
        if (file.indexOf("${keyhome}") > -1) {
            var home = this.getKeyHome()
            file = file.replace(/\${keyhome}/g, quotepath(home));
        }
        if (file.indexOf("${user}") > -1) {
            file = file.replace(/\${user}/g, this.getAccountName());
        }
        if (file.indexOf("${key}") > -1) {
            file = file.replace(/\${key}/g, quotepath(this.getPrivateKeyFile(keyname)));
        }
        return file
    },

    getArgsProcessed: function(args, params, shellfile)
    {
        var idx = args.indexOf('#!');
        if (idx == -1) {
            return this.getTemplateProcessed(args, params);
        }

        // Batch file
        if (!this.makeKeyHome()) return null;

        var batch = args.substr(idx + 2).replace(/\#\!/g, "\r\n") + "\r\n";
        batch = this.getTemplateProcessed(batch, params);
        args = this.getTemplateProcessed(args.substr(0, idx) + " " + quotepath(shellfile), params);

        // Add propert line to the script, on Mac redirection uses 0x0D in the file name
        var fd = FileIO.open(shellfile);
        FileIO.write(fd, batch + (isWindows(navigator.platform) ? "\r\n" : "\n"));
        fd.permissions = 0700;

        debug("BATCH:" + shellfile + "\n" + batch)
        return args;
    },

    // Produce file name for shel script
    getShellFile: function(name) {
        return this.getKeyHome() + DirIO.slash + name + (isWindows(navigator.platform) ? ".bat" : ".sh");
    },

    // Create keypair with private and public keys for given key name
    generateKeypair : function(keyname)
    {
        // Make sure we have directory
        if (!this.makeKeyHome()) return 0

        var certfile = this.getCertificateFile(keyname);
        var keyfile = this.getPrivateKeyFile(keyname);
        var pubfile = this.getPublicKeyFile(keyname);
        var openssl = this.getOpenSSLCommand();
        var conffile = this.getKeyHome() + DirIO.slash + "openssl.cnf"

        // Make sure we do not lose existing private keys
        if (FileIO.exists(keyfile)) {
            if (!confirm('Private key file ' + keyfile + ' already exists, it will be overwritten. OK to continue?')) return null;
        }

        FileIO.remove(certfile);
        FileIO.remove(keyfile);
        FileIO.remove(pubfile);
        FileIO.remove(conffile);

        // Create openssl config file
        var confdata = "[req]\nprompt=no\ndistinguished_name=n\nx509_extensions=c\n[c]\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always,issuer\nbasicConstraints=CA:true\n[n]\nCN=EC2\nOU=EC2\nemailAddress=ec2@amazonaws.com\n"
        if (!FileIO.write(FileIO.open(conffile), confdata)) {
            return alert('Unable to create file ' + conffile + ", please check permissions.");
        }

        // Create private and cert files
        this.setEnv("OPENSSL_CONF", conffile);
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
        this.launchProcess(openssl, [ "rsa", "-in", keyfile, "-pubout", "-out", pubfile ], true);
        // Wait a little because if process is running in the background on Windows it may take some time but we return immediately
        if (!waitForFile(pubfile, 5000)) {
            debug("ERROR: no public file generated")
            FileIO.remove(conffile);
            return 0
        }
        FileIO.remove(conffile);

        // Create openssh compatible public key, need to use shell wrapper with ssh-keygen
        var sshfile = DirIO.dirName(pubfile) + DirIO.slash + DirIO.baseName(pubfile) + ".pub";
        if (isWindows(navigator.platform)) {
            // Use patched openssl with added openssh command
            this.launchProcess(openssl, ["openssh", "-in", pubfile, "-name", keyname, "-out", sshfile], true);
        } else {
            var args = "#!" + this.getSSHKeygenCommand()+ " -i -m PKCS8 -f " + pubfile + " > " + sshfile;
            var shellfile = this.getShellFile(keyname);
            args = this.getArgsProcessed(args, [], shellfile);
            this.launchProcess("/bin/sh", args, true);
            FileIO.remove(shellfile);
        }

        return true;
    },

    // Start command shell with given key pair and access key, setup environment variables to be used by AWS command line tools
    launchShell : function(cred)
    {
        // Make sure we have directory
        if (!this.makeKeyHome()) return 0

        // Save access key into file by credentials name or account name
        if (!cred) cred = this.getActiveCredentials();
        var file = this.getCredentialFile(cred ? cred.name : this.getAccountName());
        this.saveAccessKey(file, { id: cred ? cred.accessKey : this.api.accessKey, secret: cred ? cred.secretKey : this.api.secretKey });
        this.setEnv("AWS_CREDENTIAL_FILE", file);

        // Deprecated API for older EC2 tools
        this.setEnv("EC2_PRIVATE_KEY", this.getPrivateKeyFile());
        this.setEnv("EC2_CERT", this.getCertificateFile());

        // New API for EC2 tools
        this.setEnv("AWS_ACCESS_KEY", cred ? cred.accessKey : this.api.accessKey);
        this.setEnv("AWS_SECRET_KEY", cred ? cred.secretKey : this.api.secretKey);

        this.setEnv("EC2_URL", this.api.urls.EC2);
        this.setEnv("AWS_IAM_URL", this.api.urls.IAM);
        this.setEnv("AWS_CLOUDWATCH_URL", this.api.urls.CW);

        // Current PATH
        var path = this.getEnv("PATH");
        var sep = isWindows(navigator.platform) ? ";" : ":";

        // Update path to the command line tools
        var paths = [{ name: "ec2", home: "EC2_HOME" },
                     { name: "java", home: "JAVA_HOME" },
                     { name: "iam", home:"AWS_IAM_HOME" },
                     { name: "ami", home: "EC2_AMITOOL_HOME" },
                     { name: "cloudwatch", home: "AWS_CLOUDWATCH_HOME" },
                     { name: "autoscaling", home: "AWS_AUTO_SCALING_HOME" } ];

        for(var i in paths) {
            var p = this.getStrPrefs("ew.path." + paths[i].name, "");
            if (p == "") {
                continue;
            }
            this.setEnv(paths[i].home, p);
            path += sep + p + DirIO.slash + "bin";
        }
        debug('launchShell:' + cred + " " + path)
        this.setEnv("PATH", path);
        this.launchProcess(this.getShellCommand(), this.getStrPrefs("ew.shell.args"));
    },

    launchProcess : function(cmd, args, block)
    {
        // Split string to array
        if (typeof args == "string") {
            var tokens = [];
            var sep = ' ';
            var tok = '';

            for ( var i = 0; i < args.length; i++) {
                var ch = args[i];
                if (ch == sep) {
                    if (sep == ' ') {
                        if (tok.length > 0) {
                            tokens.push(tok);
                        }
                        tok = '';
                    } else {
                        sep = ' ';
                    }
                } else
                if (sep == ' ' && (ch == '"' || ch == "'")) {
                    sep = ch;
                } else {
                    tok += ch;
                }
            }
            if (tok.length > 0) {
                tokens.push(tok);
            }
            args = tokens;
        }

        debug("launch: " + cmd + " with args: " + args.join(" "));

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
        return true;
    },

    getFileContents: function(path)
    {
        return FileIO.toString(path);
    },

    getBinaryFileContents: function(path, base64)
    {
        return FileIO.readBinary(FileIO.open(path), base64);
    },

    getEnv : function(name, dflt)
    {
        var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
        var rc = env.exists(name) ? env.get(name) : "";
        return rc != "" ? rc : (dflt || "");
    },

    setEnv : function(name, value)
    {
        var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
        env.set(name, value);
    },

    getS3Protocol: function(region, bucket)
    {
        return this.getStrPrefs("ew.s3.proto." + region + "." + bucket, 'http://');
    },

    setS3Protocol: function(region, bucket, proto)
    {
        this.setStrPrefs("ew.s3.proto." + region + "." + bucket, proto || 'http://');
    },

    getListPrefs: function(name)
    {
        var list = [];
        try {
            list = JSON.parse(this.getStrPrefs(name));
        }
        catch(e) {}
        if (!(list && list instanceof Array)) list = [];
        return list;
    },

    setListPrefs: function(name, list)
    {
        if (name) this.setStrPrefs(name, JSON.stringify((list && list instanceof Array) ? list : []));
    },

    getStrPrefs : function(name, defValue)
    {
        if (!defValue || defValue == null) defValue = '';
        if (this.prefs && name) {
            if (!this.prefs.prefHasUserValue(name)) {
                return defValue;
            }
            if (this.prefs.getPrefType(name) != this.prefs.PREF_STRING) {
                return defValue;
            }
            var prefValue = this.prefs.getCharPref(name).toString();
            if (prefValue.length == 0) {
                prefValue = defValue;
            }
            return prefValue;
        }
        return defValue;
    },

    setStrPrefs : function(name, value)
    {
        if (name) this.prefs.setCharPref(name, value || '');
    },

    getIntPrefs : function(name, defValue, minValue, maxValue)
    {
        if (!defValue || defValue == null) defValue = 0;
        var val = defValue;
        if (this.prefs && name) {
            if (!this.prefs.prefHasUserValue(name)) {
                val = defValue;
            } else
            if (this.prefs.getPrefType(name) != this.prefs.PREF_INT) {
                val = defValue;
            } else {
                val = this.prefs.getIntPref(name);
            }
        }
        if (minValue && val < minValue) val = minValue;
        if (maxValue && val > maxValue) val = maxValue;
        return val;
    },

    setIntPrefs : function(name, value, min, max)
    {
        var n = parseInt(value);
        if (isNaN(n)) n = 0;
        if (n < min) n = min;
        if (n > max) n = max;
        if (name) this.prefs.setIntPref(name, n);
    },

    getBoolPrefs : function(name, defValue)
    {
        if (!defValue || defValue == null) defValue = false;
        if (this.prefs && name) {
            if (!this.prefs.prefHasUserValue(name)) {
                return defValue;
            }
            if (this.prefs.getPrefType(name) != this.prefs.PREF_BOOL) {
                return defValue;
            }
            return this.prefs.getBoolPref(name);
        }
        return defValue;
    },

    setBoolPrefs : function(name, value)
    {
        if (name) this.prefs.setBoolPref(name, value);
    },

    // Model objects
    model: {
        accesskeys: null,
        certs: null,
        serverCerts: null,
        volumes : null,
        images : null,
        snapshots : null,
        instances : null,
        keypairs : null,
        availabilityZones : null,
        securityGroups : null,
        addresses : null,
        bundleTasks : null,
        offerings : null,
        reservedInstances : null,
        loadBalancers : null,
        subnets : null,
        vpcs : null,
        dhcpOptions : null,
        vpnConnections : null,
        vpnGateways : null,
        customerGateways : null,
        internetGateways : null,
        routeTables: null,
        networkAcls: null,
        networkInterfaces: null,
        placementGroups: null,
        s3Buckets: null,
        regions: null,
        users: null,
        groups: null,
        vmfas: null,
        mfas: null,
        alarms: null,
        metrics: null,
        queues: null,
        elbPolicyTypes: null,
        topics: null,
        subscriptions: null,
        dbinstances: null,
        dbengines: null,
        dbevents: null,
        dboptions: null,
        dbparameters: null,
        dbsubnets: null,
        dbgroups: null,
        dbsnapshots: null,
        dbofferings: null,
        dbreserved: null,
        roles: null,
        instanceProfiles: null,
        instanceStatus: null,
        hostedZones: null,
        hostedChanges: [],
        asgroups: null,
        asconfigs: null,
        aspolicies: null,
        asactions: null,
        asactivities: null,
        asinstances: null,
        asnotifications: null,
        exportTasks: null,
        conversionTaskss: null,
        spotPriceHistory: null,
        spotInstanceRequests: null,
        jobflows: null,
        ddb: null,
        swfdomains: null,
    },

    // Refresh model list by name, this is primary interface to use in the lists and trees
    refreshModel: function()
    {
        var me = this;
        for (var i = 0; i < arguments.length; i++) {
            var name = arguments[i];
            var now = (new Date).getTime();
            if (this.progress[name] > 0 && now - this.progress[name] < 30000) {
                debug('refresh: ' + name + ' in progress')
                continue;
            }
            debug('refresh model ' + name)
            this.progress[name] = now;

            switch (name) {
            case 'swfdomains':
                this.api.listDomains(function(list) { me.setModel("swfdomains", list); });
                break;
            case 'placementGroups':
                this.api.describePlacementGroups();
                break;
            case 'exportTasks':
                this.api.describeExportTasks();
                break;
            case 'conversionTasks':
                this.api.describeConversionTasks();
                break;
            case 'spotInstanceRequests':
                this.api.describeSpotInstanceRequests();
                break;
            case "asactions":
                this.api.describeScheduledActions();
                break;
            case "aspolicies":
                this.api.describePolicies();
                break;
            case "asgroups":
                this.api.describeAutoScalingGroups();
                break;
            case "asconfigs":
                this.api.describeLaunchConfigurations();
                break;
            case "asactivities":
                this.api.describeScalingActivities(function(list) { me.setModel("asactivities", list); });
                break;
            case "asnotifications":
                this.api.describeNotificationConfigurations(function(list) { me.setModel("asnotifications", list); });
                break;
            case "asinstances":
                this.api.describeAutoScalingInstances();
                break;
            case "instanceProfiles":
                this.api.listInstanceProfiles();
                break;
            case "roles":
                this.api.listRoles();
                break;
            case "queues":
                this.api.listQueues();
                break;
            case "certs":
                this.api.listSigningCertificates(null, function(list) { me.setModel("certs", list); });
                break;
            case "serverCerts":
                this.api.listServerCertificates();
                break;
            case "accesskeys":
                this.api.listAccessKeys(null, function(list) { me.setModel("accesskeys", list); });
                break;
            case "alarms":
                this.api.describeAlarms();
                break;
            case "metrics":
                this.api.listMetrics(null, null, null, function(list) { me.setModel("metrics", list); });
                break;
            case "vmfas":
                this.api.listVirtualMFADevices();
                break;
            case "mfas":
                this.api.listMFADevices(null, function(list) { me.setModel("mfas", list); });
                break;
            case "regions":
                this.api.describeRegions();
                break;
            case "instanceStatus":
                this.api.describeInstanceStatus(null, true);
                break;
            case "volumeStatus":
                this.api.describeVolumeStatus();
                break;
            case "volumes":
                this.api.describeVolumes();
                break;
            case "images":
                this.api.describeImages();
                break;
            case "snapshots":
                this.api.describeSnapshots();
                break;
            case "instances":
                this.api.describeInstances();
                break;
            case "keypairs":
                this.api.describeKeypairs();
                break;
            case "availabilityZones":
                this.api.describeAvailabilityZones();
                break;
            case "securityGroups":
                this.api.describeSecurityGroups();
                break;
            case "addresses":
                this.api.describeAddresses();
                break;
            case "bundleTasks":
                this.api.describeBundleTasks();
                break;
            case "offerings":
                this.api.describeReservedInstancesOfferings(null, function(list) { me.setModel("offerings", list); });
                break;
            case "reservedInstances":
                this.api.describeReservedInstances();
                break;
            case "loadBalancers":
                this.api.describeLoadBalancers();
                break;
            case "subnets":
                this.api.describeSubnets();
                break;
            case "vpcs":
                this.api.describeVpcs();
                break;
            case "dhcpOptions":
                this.api.describeDhcpOptions();
                break;
            case "vpnConnections":
                this.api.describeVpnConnections();
                break;
            case "vpnGateways":
                this.api.describeVpnGateways();
                break;
            case "customerGateways":
                this.api.describeCustomerGateways();
                break;
            case "internetGateways":
                this.api.describeInternetGateways();
                break;
            case "routeTables":
                this.api.describeRouteTables();
                break;
            case "networkAcls":
                this.api.describeNetworkAcls();
                break;
            case "networkInterfaces":
                this.api.describeNetworkInterfaces();
                break;
            case "s3Buckets":
                this.api.listS3Buckets();
                break;
            case "users":
                this.api.listUsers();
                break;
            case "groups":
                this.api.listGroups();
                break;
            case "elbPolicyTypes":
                this.api.DescribeLoadBalancerPolicyTypes();
                break;
            case "topics":
                this.api.listTopics();
                break;
            case "subscriptions":
                this.api.listSubscriptions();
                break;
            case "dbsnapshots":
                this.api.describeDBSnapshots(function(list) { me.setModel("dbsnapshots", list); });
                break;
            case "dbreserved":
                this.api.describeReservedDBInstances(function(list) { me.setModel("dbreserved", list); });
                break;
            case "dbofferings":
                this.api.describeReservedDBInstancesOfferings(function(list) { me.setModel("dbofferings", list); });
                break;
            case "dbevents":
                this.api.describeDBEvents(function(list) { me.setModel("dbevents", list); });
                break;
            case "dbinstances":
                this.api.describeDBInstances(function(list) { me.setModel("dbinstances", list); });
                break;
            case "dbgroups":
                this.api.describeDBSecurityGroups(function(list) { me.setModel("dbgroups", list); });
                break;
            case "dbengines":
                this.api.describeDBEngineVersions(function(list) { me.setModel("dbengines", list); });
                break;
            case "dbsubnets":
                this.api.describeDBSubnetGroups(function(list) { me.setModel("dbsubnets", list); });
                break;
            case "dboptions":
                this.api.describeOptionGroups(function(list) { me.setModel("dboptions", list); });
                break;
            case "dbparameters":
                this.api.describeDBParameterGroups(function(list) { me.setModel("dbparameters", list); });
                break;
            case "jobflows":
                this.api.describeJobFlows();
                break;
            case "ddb":
                this.api.listTables({}, function(list) { me.setModel('ddb', list) });
                break;
            case "hostedZones":
                this.api.listHostedZones();
                break;
            default:
                debug('Error: model not known ' + name);
            }
        }
    },

    // Return list or initiate refresh if it is empty, perform search if arguments specified
    queryModel: function()
    {
        var list = this.getModel(arguments[0]);
        if (list == null) {
            this.refreshModel(arguments[0]);
        }
        var args = [];
        for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
        return this.getObjects(list, args);
    },

    // Return direct list to the model objects
    getModel: function(name)
    {
        if (!this.model.hasOwnProperty(name)) debug('model ' + name + ' not found');
        return name ? this.model[name] : null;
    },

    // Update model list and notify components
    setModel: function(name, list)
    {
        debug('update model ' + name + ' with ' + (list ? list.length : 0) + ' records')
        this.progress[name] = 0;
        this.model[name] = list;
        this.notifyComponents(name);
    },

    appendModel: function(name, list, reset)
    {
        debug('append model ' + name + ' with ' + (list ? list.length : 0) + ' records' + (reset ? " with reset" : ""))
        this.progress[name] = 0;
        if (!this.model[name] || reset) this.model[name] = [];
        this.model[name] = this.model[name].concat(list);
        this.notifyComponents(name);
    },

    // Find object in the model list, optional field can be used first before comparing id and name fields
    findModel: function(model, id, field)
    {
        return this.findObject(this.getModel(model), id, field);
    },

    // Add object to the model
    addModel: function(name, obj)
    {
        var list = this.getModel(name);
        if (list) list.push(obj);
    },

    // Remove object from the model
    removeModel: function(model, id, field)
    {
        return this.removeObject(this.getModel(model), id, field);
    },

    // Update field of an object in the model
    updateModel: function(model, id, field, value)
    {
        if (!model || !id || !field) return null;
        var obj = this.findObject(this.getModel(model), id);
        if (obj) {
            obj[field] = value;
            // Additional fields
            if (arguments.length > 4) {
                for (var i = 4; i < arguments.length; i+= 2) {
                    obj[arguments[i]] = arguments[i + 1];
                }
            }
        }
        return obj;
    },

    // Updates existing object or adds a new one to the model
    replaceModel: function(model, obj, field)
    {
        var o = this.findModel(model, obj[field || 'id']);
        if (o) {
            for (var p in obj) {
                o[p] = obj[p];
            }
        } else {
            this.addModel(model, obj);
        }
    },

    // Clean up all lists, mostly in credentials switch
    invalidateModel: function()
    {
        for (var p in this.model) {
            this.setModel(p, null);
        }
    },

    // Common replacement for cells by name, builds human readable value
    modelValue: function(name, value, keepName)
    {
        if (!value) return typeof value == "boolean" ? false : "";
        var idMap = { vpcId: this.model.vpcs,
                      subnetId: this.model.subnets,
                      instanceId: this.model.instances,
                      volumeId: this.model.volumes,
                      tableId: this.model.routeTables,
                      imageId: this.model.images,
                      gatewayId: this.model.internetGateways,
                      cgwId: this.model.customerGateways,
                      vgwId: this.model.vpnGateways,
                      igwId: this.model.internetGateways,
                      dhcpOptionsId: this.model.dhcpOptions,
                      networkInterfaceId: this.model.networkInterfaces,
                      groupId: this.model.securityGroups,
                      groups: this.model.securityGroups,
                      instanceProfile: this.model.instanceProfiles,
                      subnets: this.model.subnets };

        var list = idMap[toId(name)];
        if (list) {
            if (value instanceof Array) {
                var rc = [];
                for (var i in value) {
                    if (typeof value[i] == "object") {
                        rc.push(value[i].toString());
                    } else {
                        var obj = this.findObject(list, value[i]);
                        rc.push(obj ? obj.toString() : value[i]);
                    }
                }
                return rc.join(",");
            } else {
                var obj = this.findObject(list, value);
                if (obj) {
                    return obj.toString()
                }
            }
        }
        return (keepName ? name + ":" : "") + value;
    },

    // Convert object into string, used in listboxes, can use list of columns to limit what properties to show
    toString: function(obj, columns)
    {
        if (obj == null) return null;
        if (typeof obj == "object") {
            var item = "";
            if (!columns && obj.hasOwnProperty('toString')) {
                item = obj.toString()
            } else {
               for (var p in obj) {
                   if (typeof obj[p] == "function") {
                       if (p != "toString") continue;
                       item += (item != "" ? fieldSeparator : "") + obj.toString();
                   } else
                   if (!columns || columns.indexOf(p) >= 0) {
                       item += (item != "" ? fieldSeparator : "") + this.modelValue(p, obj[p]);
                   }
                }
            }
            return item
        }
        return obj;
    },

    // Find object in the list by id or name
    findObjectIndex: function(list, id, field)
    {
        if (id && typeof id == "object") id = id[field || "id"];
        for (var i in list) {
            if (field && list[i][field] == id) return i;
            if (list[i].id && list[i].id == id) return i;
            if (list[i].name && list[i].name == id) return i;
        }
        return -1;
    },

    // Find object in the list by id or name
    findObject: function(list, id, field)
    {
        var i = this.findObjectIndex(list, id, field);
        return i >= 0 ? list[i] : null;
    },

    // Remove object in the list by id or name
    removeObject: function(list, id, field)
    {
        var i = this.findObjectIndex(list, id, field);
        if (i >= 0) {
            list.splice(i, 1);
            return true;
        }
        return false;
    },

    // Return objects if all arguments match
    getObjects: function(items, args)
    {
        if (!args.length) return items || [];
        var list = [];
        if (items) {
            for (var i in items) {
                var matches = 0;
                for (var j = 0; j < args.length - 1; j += 2) {
                    // If value is null, this means opposite, the property should be empty
                    if (args[j + 1] == null) {
                        if (!items[i][args[j]]) matches++;
                    } else {
                        // Otherwise the property should match the value
                        if (items[i][args[j]] == args[j + 1]) matches++;
                    }
                }
                if (matches == args.length/2) {
                    list.push(items[i])
                }
            }
        }
        return list;
    },

    sortObjects: function(list, col, ascending)
    {
        if (!(list instanceof Array)) return;

        var sortFunc = function(a, b) {
            var aVal = "", bVal = "";
            if (col instanceof Array) {
                for (var i in col) {
                    aVal += (a[col[i]] || "") + fieldSeparator;
                    bVal += (b[col[i]] || "") + fieldSeparator;
                }
            } else {
                aVal = a[col] || "";
                bVal = b[col] || "";
            }

            switch (typeName(aVal)) {
            case "string":
            case "object":
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
                break;

            case "date":
                aVal = aVal.getTime();
                bVal = bVal.getTime();
                break;
            }
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        };
        list.sort(sortFunc);
    },

    // Send signal about updates model, assume TreeView interface
    notifyComponents: function(interest)
    {
        var comps = this.components[interest] || [];
        for (var i in comps) {
            comps[i].modelChanged(interest);
        }
    },

    // Register list of models to watch for updates
    registerInterest: function(component, interest)
    {
        var list = (interest instanceof Array) ? interest : [interest];
        for (var i in list) {
            if (!this.components[list[i]]) {
                this.components[list[i]] = [];
            }
            this.components[list[i]].push(component);
        }
    },

    getUserByName: function(name)
    {
        return this.findObject(this.model.users, name, 'name');
    },

    getGroupByName: function(name)
    {
        return this.findObject(this.model.groups, name, 'name');
    },

    getS3Bucket: function(bucket)
    {
        return this.findObject(this.model.s3Buckets, bucket, 'name');
    },

    getS3BucketKey: function(bucket, key)
    {
        var obj = this.getS3Bucket(bucket);
        if (!obj) return null;
        for (var j in obj.keys) {
            if (obj.keys[j].name == key) return obj.keys[j];
        }
        return null;
    },

    getImagesByType: function(list, type)
    {
        var nlist = new Array();
        if (type == "fav") {
            var favs = this.getStrPrefs("ew.images.favorites", "").split("^");
            for (var i in list) {
                if (favs.indexOf(list[i].id) >= 0) {
                    nlist.push(list[i])
                }
            }
            return nlist;
        }

        // Initialize the owner display filter to the empty string
        var alias = null, owner = null, root = null, rx = "mi";
        if (type == "my_ami" || type == "my_ami_rdt_ebs") {
            owner = this.user.accountId;
            root = type == "my_ami" ? null : "ebs";
        } else
        if (type == "amzn" || type == "amzn_rdt_ebs") {
            alias = "amazon";
            root = type == "amzn" ? null : "ebs";
        } else
        if (type == "rdt_ebs") {
            root = "ebs";
        } else
        if (type == "rdt_is") {
            root = "instance-store";
        }
        for (var i in list) {
            if (rx && !list[i].id.match(rx)) continue;
            if (root && root != list[i].rootDeviceType) continue;
            if (alias && alias != list[i].ownerAlias) continue;
            if (owner && owner != list[i].ownerId) continue;
            nlist.push(list[i])
        }
        return nlist;
    },

    getVpcById: function(id)
    {
        return this.findObject(this.model.vpcs, id)
    },

    getSubnetById: function(id)
    {
        return this.findObject(this.model.subnets, id)
    },

    getInstanceById: function(id)
    {
        return this.findObject(this.model.instances, id)
    },

    getSecurityGroupById: function(id)
    {
        return this.findObject(this.model.securityGroups, id)
    },

    getInstanceTypes: function(arch, region)
    {
        var types = [
           { name: "t1.micro", id: "t1.micro", x86_64: true, i386: true,  },
           { name: "m1.small", id: "m1.small", x86_64: true, i386: true,  },
           { name: "m1.medium", id: "m1.medium", x86_64: true, i386: true,  },
           { name: "m1.large", id: "m1.large", x86_64: true, i386: true, },
           { name: "m1.xlarge", id: "m1.xlarge", x86_64: true,  i386: true,  },
           { name: "c1.medium", id: "c1.medium", x86_64: true, i386: true,  },
           { name: "c1.xlarge", id: "c1.xlarge", x86_64: true,  i386: true, },
           { name: "m2.xlarge", id: "m2.xlarge", x86_64: true,  i386: true, },
           { name: "m2.2xlarge", id: "m2.2xlarge", x86_64: true,  i386: true, },
           { name: "m2.4xlarge", id: "m2.4xlarge", x86_64: true, i386: true,  },
           { name: "m3.xlarge", id: "m3.xlarge", x86_64: true,  i386: true, },
           { name: "m3.2xlarge", id: "m3.2xlarge", x86_64: true,  i386: true, },
           { name: "cc1.4xlarge", id: "cc1.4xlarge", x86_64: true,  i386: true, },
           { name: "cc2.8xlarge", id: "cc2.8xlarge", x86_64: true,  i386: true, },
           { name: "cg1.4xlarge", id: "cg1.4xlarge", x86_64: true,   i386: true, },
           { name: "hi1.4xlarge", id: "hi1.4xlarge", x86_64: true, i386: true, },
           { name: "hs1.8xlarge", id: "hs1.8xlarge", x86_64: true,  i386: true, },
           ];

        var list = [];
        for (var i in types) {
            types[i].toString = function() { return this.name + ", " + (this.x86_64 ? "x86_64" : "") + (this.i386 ? ", i386" : ""); }
            // Filter by region, type
            if (region && types[i][region] == false) continue;
            if (arch && !types[i][arch]) continue;
            list.push(types[i]);
        }
        return list;
    },

    getPolicyTypes: function()
    {
        return [ { name: "Administrator Access", toString: function() { return this.name; }, id: '{"Statement": [{"Effect": "Allow","Action": "*","Resource": "*"}]}' },
                 { name: "Power User Access", toString: function() { return this.name; }, id: '{"Statement": [{"Effect": "Allow","NotAction": "iam:*","Resource": "*"}]}' },
                 { name: "Read Only Access", toString: function() { return this.name; }, id: '{"Statement": [{"Action": ["autoscaling:Describe*","cloudwatch:Describe*","cloudwatch:Get*","cloudwatch:List*","ec2:Describe*","elasticache:Describe*","iam:List*","iam:Get*","s3:Get*","s3:List*"],"Effect": "Allow","Resource": "*"}]}' },
                 { name: "EC2 Full Access", toString: function() { return this.name; }, id: '{"Statement": [{"Action": "ec2:*","Effect": "Allow","Resource": "*"},{"Effect": "Allow","Action": "elasticloadbalancing:*","Resource": "*"},{"Effect": "Allow","Action": "cloudwatch:*","Resource": "*"},{"Effect": "Allow","Action": "autoscaling:*","Resource": "*"}]}' },
                 { name: "IAM Full Access", toString: function() { return this.name; }, id: '{"Statement": [{"Effect": "Allow","Action": "iam:*","Resource": "*"}]}' },
                 { name: "S3 Read Only Access", toString: function() { return this.name; }, id: '{"Statement": [{"Effect": "Allow","Action": ["s3:Get*","s3:List*"],"Resource": "*"}]}' },
                 ];
    },

    getCloudWatchNamespaces: function()
    {
        return [
               { name: "Amazon Elastic Block Store", type: "AWS/EBS" },
               { name: "Amazon Elastic Compute Cloud", type: "AWS/EC2" },
               { name: "Auto Scaling", type: "AWS/AutoScaling" },
               { name: "Elastic Load Balancing", type: "AWS/ELB" } ];
    },

    getImageFilters: function()
    {
        return [ {name:"All AMIs", value:"ami", toString: function() { return this.name; },},
                 {name:"My AMIs", value:"my_ami", toString: function() { return this.name; }, },
                 {name:"All AMIs with EBS Root Device", value:"rdt_ebs", toString: function() { return this.name; }, },
                 {name:"All AMIs with Instance Store Root Device", value:"rdt_is", toString: function() { return this.name; },},
                 {name:"My AMIs with EBS Root Device", value:"my_ami_rdt_ebs", toString: function() { return this.name; }, },
                 {name:"Favorites", value:"fav", toString: function() { return this.name; }, }];
    },
};
