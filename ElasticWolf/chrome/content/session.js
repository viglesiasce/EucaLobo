//main object that holds the current session information
var ew_session = {
    VERSION: "2.0",
    NAME: 'ElasticWolf',
    URL: 'http://www.awsps.com/ElasticWolf/',
    EC2_API_VERSION: '2012-06-01',
    ELB_API_VERSION: '2011-11-15',
    IAM_API_VERSION: '2010-05-08',
    CW_API_VERSION: '2010-08-01',
    STS_API_VERSION: '2011-06-15',
    VPN_CONFIG_PATH : 'https://ec2-downloads.s3.amazonaws.com/',
    SIG_VERSION: '2',
    REALM : 'chrome://ew/',
    HOST  : 'chrome://ew/',

    disabled: false,
    prefs: null,
    locked: false,
    controller : null,
    model : null,
    user: {},
    credentials : null,
    cmdline: null,
    endpoints: null,
    timers: {},
    region: "",
    urls: {},
    versions: {},
    accessKey: "",
    secretKey: "",
    securityToken: "",
    httpCount: 0,
    errorCount: 0,
    errorMax: 3,

    initialize : function()
    {
        if (this.prefs == null) {
            this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        }

        ew_menu.init();
        ew_controller.session = this;

        this.model = ew_model;
        this.controller = ew_controller;
        this.credentials = this.getCredentials();

        this.getEndpoints();

        document.title = ew_session.getAppName();

        // Use last used credentials
        this.selectEndpoint(this.getActiveEndpoint());
        this.switchCredentials(this.getActiveCredentials());
        this.selectTab(this.getStrPrefs("ew.tab.current"));

        // Parse command line
        this.cmdLine = window.arguments[0].QueryInterface(Components.interfaces.nsICommandLine);

        // Passing credentials
        var name = this.cmdLine.handleFlagWithParam('name', true);
        var key = this.cmdLine.handleFlagWithParam('key', true);
        var secret = this.cmdLine.handleFlagWithParam('secret', true);
        var endpoint = this.cmdLine.handleFlagWithParam('endpoint', true);
        var token = this.cmdLine.handleFlagWithParam('token', true);
        if (key && key != '' && secret && secret != '') {
            var cred = new Credential(name || 'AWS', key, secret, endpoint, token);
            this.switchCredentials(cred);
        } else

        if (endpoint && endpoint != '') {
            var e = new Endpoint("", endpoint);
            this.switchEndpoints(e);
        }

        // Disable credentials management
        this.locked = this.cmdLine.handleFlag('lock', true);

        // Check for pin
        this.promptForPin();
        this.setIdleTimer();
        this.refreshEndpoints();
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

    quit: function()
    {
        var app = Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup);
        app.quit(Components.interfaces.nsIAppStartup.eForceQuit);
    },

    selectTab: function(name) {
        if (this.disabled) return;

        if (ew_menu.select(name)) {
            this.setStrPrefs("ew.tab.current", name);
        }
    },

    getCredentials : function () {
        var credentials = new Array();
        var list = this.getPasswordList("Cred:")
        for (var i = 0; i < list.length; i++) {
            var pw = list[i][1].split(";;");
            if (pw.length > 1) {
                var cred = new Credential(list[i][0].substr(5).trim(), pw[0], pw[1], pw.length > 2 ? pw[2] : "")
                credentials.push(cred);
            }
        }
        return credentials;
    },

    updateCredentials : function(cred, key, secret, url)
    {
        if (cred == null || key == null || key == "" || secret == null || secret == "") {
            alert("Invalid access key given for account");
            return;
        }
        cred.accessKey = key;
        cred.secretKey = secret;
        if (url) cred.url = url;
        this.saveCredentials(cred);
    },

    removeCredentials : function(cred)
    {
        this.deletePassword('Cred:' + cred.name)
    },

    saveCredentials : function(cred)
    {
        this.savePassword('Cred:' + cred.name, cred.toString())
    },

    getActiveCredentials : function()
    {
        var cur = this.getCurrentUser();
        for (var i in this.credentials) {
            if (cur == this.credentials[i].name) return this.credentials[i];
        }
        return null;
    },

    switchCredentials : function(cred)
    {
        if (this.locked || this.disabled) return;

        var wasGovCloud = this.isGovCloud();
        if (cred) {
            debug("switch credentials to " + cred.name + " " + cred.url)
            this.setStrPrefs("ew.account.name", cred.name);
            this.setCredentials(cred.accessKey, cred.secretKey, cred.securityToken);

            if (cred.url != "") {
                var endpoint = this.getEndpoint(null, cred.url);
                if (!endpoint) endpoint = new Endpoint("", cred.url)
                this.selectEndpoint(endpoint);
            }
            // GovCloud credentials require endpoint to be set explicitely, switching from GovCloud without explicit endpoint will result in errros
            if (wasGovCloud && cred.url == '') {
                this.selectEndpoint(this.getEndpoint("us-east-1"));
            }
            // Since we are switching creds, ensure that all the views are redrawn
            this.model.invalidate();
            var me = this;
            // Retrieve current user info
            this.controller.getUser(null, function(user) { me.user = user || {}; })
            ew_menu.update();
            return true;
        }
        return false;
    },

    setCredentials : function (accessKey, secretKey, securityToken)
    {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.securityToken = typeof securityToken == "string" ? securityToken : "";
        this.errorCount = 0;
        debug('setCreds: ' + this.accessKey + ", " + this.secretKey + ", " + this.securityToken)
    },

    getActiveEndpoint : function()
    {
        var endpoint = this.getEndpoint(this.getLastUsedEndpoint());
        return endpoint ? endpoint : new Endpoint("", this.getStrPrefs("ew.endpoint.url", "https://ec2.us-east-1.amazonaws.com"));
    },

    getEndpoint: function(name, url)
    {
        if (this.endpoints) {
            for (var i in this.endpoints) {
                if (name && this.endpoints[i].name == name) return this.endpoints[i];
                if (url && this.endpoints[i].url == url) return this.endpoints[i];
            }
        }
        return null;
    },

    setEndpoint : function (endpoint)
    {
        if (endpoint != null) {
            this.errorCount = 0;
            this.region = endpoint.name;
            this.urls.EC2 = endpoint.url;
            this.versions.EC2 = endpoint.version || this.EC2_API_VERSION;
            this.urls.ELB = endpoint.urlELB || "https://elasticloadbalancing." + this.region + ".amazonaws.com";
            this.versions.ELB = endpoint.versionELB || this.ELB_API_VERSION;
            this.urls.CW = endpoint.urlCW || "https://monitoring." + this.region + ".amazonaws.com";
            this.versions.CW = endpoint.versionCW || this.CW_API_VERSION;
            this.urls.IAM = endpoint.urlIAM || 'https://iam.amazonaws.com';
            this.versions.IAM = endpoint.versionIAM || this.IAM_API_VERSION;
            this.urls.STS = endpoint.urlSTS || 'https://sts.amazonaws.com';
            this.versions.STS = endpoint.versionSTS || this.STS_API_VERSION;
            this.actionIgnore = endpoint.actionIgnore || [];
            debug('setEndpoint: ' + this.region + ", " + JSON.stringify(this.urls) + ", " + JSON.stringify(this.versions) + ", " + this.actionIgnore);
        }
    },

    selectEndpoint: function(endpoint)
    {
        if (endpoint != null) {
            this.setLastUsedEndpoint(endpoint.name);
            this.setStrPrefs("ew.endpoint.url", endpoint.url);
            this.setEndpoint(endpoint);
            ew_menu.update();
            return true;
        }
        return false;2
    },

    switchEndpoints : function(name)
    {
        if (this.locked || this.disabled) return;

        var wasGovCloud = this.isGovCloud();
        var endpoint = this.getEndpoint(name);
        if (this.selectEndpoint(endpoint)) {
            // Switching between GovClound, reset credentials
            if (this.isGovCloud() != wasGovCloud) {
                debug('disable credentials when switching to/from GovCloud')
                this.setCredentials("", "");
                this.setStrPrefs("ew.account.name", "");
                ew_menu.update();
            }
            // Since we are switching creds, ensure that all the views are redrawn
            this.model.invalidate();
        } else {
            alert('Endpoint ' + name + ' does not exists?')
        }
    },

    addEndpoint: function(name, url)
    {
        if (this.endpoints) {
            if (this.getEndpoint(name)) return;
            this.endpoints.push(new Endpoint(name, url))
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
            var regions = this.model.getEC2Regions();
            for (var i in regions) {
                this.endpoints.push(regions[i]);
            }

            // Merge with added endpoints
            var list = this.getListPrefs("ew.endpoints");
            for (var i in list) {
                if (list[i] && list[i].name && list[i].url && me.getEndpoint(regions[i].name) == null) {
                    this.endpoints.push(new Endpoint(list[i].name, list[i].url));
                }
            }
        }
        return this.endpoints;
    },

    refreshEndpoints: function()
    {
        var me = this;
        // Merge with saved list of regions
        this.controller.describeRegions(function(regions) {
            for (var i in regions) {
                if (me.getEndpoint(regions[i].name) == null) {
                    me.endpoints.push(regions[i]);
                }
            }
        });
    },

    displayAbout : function()
    {
        window.openDialog("chrome://ew/content/dialogs/about.xul", null, "chrome,centerscreen,modal,resizable", this);
    },

    displayHelp : function()
    {
        window.openDialog("chrome://ew/content/dialogs/help.xul", null, "chrome,centerscreen,modal,resizable", this);
    },

    // Create cert with private and public keys for given key name
    generateCertificate : function(keyname)
    {
        // Make sure we have directory
        if (!this.makeKeyHome()) return 0

        var certfile = this.getCertificateFile(keyname);
        var keyfile = this.getPrivateKeyFile(keyname);
        var pubfile = this.getPublicKeyFile(keyname);
        var openssl = this.getOpenSSLCommand();
        var conffile = this.getKeyHome() + DirIO.sep + "openssl.cnf"

        // Make sure we do not lose existing private keys
        if (FileIO.exists(keyfile)) {
            if (!confirm('Private key file ' + keyfile + ' already exists, it will be overwritten, OK continue?')) return null;
        }

        FileIO.remove(certfile);
        FileIO.remove(keyfile);
        FileIO.remove(pubfile);
        FileIO.remove(conffile);

        // Create openssl config file
        var confdata = "[req]\nprompt=no\ndistinguished_name=n\nx509_extensions=c\n[c]\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always,issuer\nbasicConstraints=CA:true\n[n]\nCN=EC2\nOU=EC2\nemailAddress=ec2@amazonaws.com\n"
        if (!FileIO.write(FileIO.open(conffile), confdata)) {
            return alert('Unable to create file ' + conffile + ", check permissions, aborting");
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
        this.launchProcess(openssl, [ "rsa", "-in", keyfile, "-pubout", "-out", pubfile ], true)
        // Wait a little because if process is running in the background on Windows it may take some time but we return immediately
        if (!waitForFile(pubfile, 5000)) {
            debug("ERROR: no public file generated")
            FileIO.remove(conffile);
            return 0
        }
        FileIO.remove(conffile);

        return FileIO.toString(certfile)
    },

    // Start command shell with given key pair and access key, setup environment variables to be used by AWS command line tools
    launchShell : function(keyPair, accessKey)
    {
        // Make sure we have directory
        if (!this.makeKeyHome()) return 0

        // Save access key into file
        var file = this.getCredentialFile(keyPair.name);
        if (!accessKey) accessKey = { id: this.accessKey, secret: this.secretKey };
        if (!FileIO.write(FileIO.open(file), "AWSAccessKeyId=" + accessKey.id + "\nAWSSecretKey=" + accessKey.secret + "\n")) {
            return alert('Unable to create credentials file ' + file + ", please check directory permissions");
        }

        // Setup environment
        if (keyPair) {
            this.setEnv("AWS_CREDENTIAL_FILE", this.getCredentialFile(keyPair.name));
            this.setEnv("EC2_PRIVATE_KEY", this.getPrivateKeyFile(keyPair.name));
            this.setEnv("EC2_CERT", this.getCertificateFile(keyPair.name));
        }
        this.setEnv("EC2_URL", this.urlEC2);
        this.setEnv("AWS_IAM_URL", this.urlIAM);
        this.setEnv("AWS_CLOUDWATCH_URL", this.urlCW);

        // Current PATH
        var path = this.getEnv("PATH");
        var sep = isWindows(navigator.platform) ? ";" : ":";

        // Update path to the command line tools
        var paths = ["ec2", "java", "iam", "ami", "cloudwatch", "autoscaling"];
        for(var i in paths) {
            var p = this.getStrPrefs("ew.path." + paths[i], "");
            if (p == "") {
                continue;
            }
            this.setEnv(paths[i].split(".").pop().toUpperCase(), p);
            path += sep + p + DirIO.sep + "bin";
        }
        debug(path)
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

        debug("launch: " + cmd + " " + args.join(" "));

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
        return true
    },

    // Select from the list
    // items are object to show
    // columns is list of propety names to show, otherwise convert object to string using toString
    // checked is list of initially selected item indexes
    promptList: function(title, msg, items, columns, width, multiple, checked)
    {
        var params = { session: ew_session, listItems: items, checkedItems: checked, selectedIndex: -1, selectedItems: [], selectedIndexes: [], columns: columns, width: width, multiple: multiple, title: title, msg: msg };
        window.openDialog("chrome://ew/content/dialogs/select.xul", null, "chrome,centerscreen,modal,resizable", params);
        return params.multiple ? params.selectedItems : params.selectedIndex;
    },

    // MultiInput dialog:
    // items is list of input field labels,
    // values are corresponding initial values for the input fields,
    // types are corresponding field types: textbox, checkbox, password
    promptInput: function(title, items, values, types)
    {
        var params = { session: ew_session, title: title, items: items || [ "" ], values: values || [], types: types || [] };
        window.openDialog("chrome://ew/content/dialogs/input.xul", null, "chrome,centerscreen,modal,resizable", params);
        return params.ok ? params.values : null;
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
        var rc = { ok: false,
                   text: String(tags),
                   title: "Tags (Key:Value, Key:Value...) ",
                   descr: "Predefined tags:\n - Name: for primary name" };
        openDialog('chrome://ew/content/dialogs/text.xul', null, 'chrome,centerscreen,modal,width=400,height=250', rc);
        return rc.ok ? (rc.text || '').replace(/(\n|\r)+/g, ' ').trim() : null;
    },

    promptForText: function(title, text, width, height)
    {
        var rc = { ok: false, text: text, title: title };
        openDialog('chrome://ew/content/dialogs/text.xul', null, 'chrome,centerscreen,modal,width=' + (width || 400) + ',height=' + (height || 240), rc);
        return rc.ok ? rc.text : null;
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

    // Set tags to the specified object(s).
    // objs an be an object, an id string or list of objects or list of ids
    // tags can be a string or list of tags
    setTags: function(objs, tags, callback)
    {
        log('setTags: id=' + objs + ", tags=" + tags)

        var me = this;
        var ntags = new Array();

        if (!(objs instanceof Array)) objs = [ objs ];
        tags = this.model.parseTags(tags);

        for (var i = 0; i < objs.length; i++) {
            var id = objs[i];
            if (typeof id == "object") id = obj.id;
            for (var j = 0; j < tags.length; j++) {
                ntags.push(new Tag(tags[j].name, tags[j].value, id));
            }
        }

        function wrap() {
            if (ntags.length > 0) {
                me.controller.createTags(ntags, callback);
            } else
            if (callback) {
                callback();
            }
        }

        // Get existing tags and delete them all, then create new tags if exist
        this.controller.describeTags(objs, function(described) {
            if (described.length) {
                me.controller.deleteTags(described, wrap);
            } else {
                wrap();
            }
        });
    },

    copyToClipboard: function(text)
    {
        var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
        str.data = text;

        var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", str, text.length * 2);

        var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
        clip.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
    },

    getAppName : function()
    {
        return this.NAME;
    },

    getAppUrl: function()
    {
        return this.URL
    },

    getUserAgent: function ()
    {
        return this.getAppName() + "/" + this.VERSION;
    },

    isGovCloud : function()
    {
        return String(this.urls.EC2).indexOf("us-gov") > -1;
    },

    isEnabled: function()
    {
        return this.getBoolPrefs("ew.http.enabled", true) && !this.disabled && this.accessKey != "" && this.secretKey != "";
    },

    checkForUpdates: function()
    {
        if (!this.isEnabled()) return null;

        ver = parseFloat(this.VERSION) + 0.01
        var url = this.getAppUrl()
        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return;
        }
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                var data = xmlhttp.responseText;
                var d = data.match(new RegExp(this.NAME + (isWindows(navigator.platform) ? "-win-" : "-osx-") + "([0-9]\.[0-9][0-9])\.zip"))
                if (d != null) {
                    debug(d);
                    if (parseFloat(d[1]) > parseFloat(this.VERSION)) {
                        alert("New version " + d[1] + "is available at " + url + d[0])
                        return;
                    }
                }
                alert("No new version available")
            }
        };
        xmlhttp.open("GET", url, true);
        xmlhttp.setRequestHeader("User-Agent", this.getUserAgent());
        xmlhttp.send(null);
    },

    getXmlHttp : function()
    {
        var xmlhttp = null;
        if (typeof XMLHttpRequest != 'undefined') {
            try {
                xmlhttp = new XMLHttpRequest();
            } catch (e) {
                debug(e)
            }
        }
        return xmlhttp;
    },

    queryEC2 : function (action, params, handlerObj, isSync, handlerMethod, callback, apiURL, apiVersion, sigVersion)
    {
        if (!this.isEnabled()) return null;

        //try {
            return this.queryEC2Impl(action, params, handlerObj, isSync, handlerMethod, callback, apiURL, apiVersion, sigVersion);
        //} catch (e) {
            //debug(e + ", " + JSON.stringify(arguments));
            //this.errorDialog("An error occurred while calling "+ action, { errString: e });
        //}
        return null;
    },

    queryELB : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.ELB, this.versions.ELB);
    },

    queryIAM : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.IAM, this.versions.IAM);
    },

    queryCloudWatch : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.CW, this.versions.CW);
    },

    querySTS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.STS, this.versions.STS);
    },

    downloadS3 : function (method, bucket, key, path, params, file, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        var req = this.queryS3Prepare(method, bucket, key, path, params, null);
        return this.download(req.url, req.headers, file, callback, progresscb);
    },

    uploadS3: function(bucket, key, path, params, filename, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        var file = FileIO.streamOpen(filename);
        if (!file) {
            alert('Cannot open ' + filename)
            return false;
        }
        var length = file[1].available();
        params["Content-Length"] = length;

        var req = this.queryS3Prepare("PUT", bucket, key, path, params, null);

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open(req.method, req.url, true);
        for (var p in req.headers) {
            xmlhttp.setRequestHeader(p, req.headers[p]);
        }
        xmlhttp.send(file[1]);

        var timer = setInterval(function() {
            try {
                var a = length - file[1].available();
                if (progresscb) progresscb(filename, Math.round(a / length * 100));
            }
            catch(e) {
                debug(e)
                this.errorDialog("Error uploading " + filename, { errString: e })
            }
        }, 300);

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState != 4) return;
            FileIO.streamClose(file);
            clearInterval(timer);
            if (xmlhttp.status >= 200 && xmlhttp.status < 300) {
                if (progresscb) progresscb(filename, 100);
                if (callback) callback(filename);
            } else {
                var rsp = this.createResponseError(xmlhttp);
                this.errorDialog("S3 responded with an error for "+ bucket + "/" + key + path, rsp);
            }
        };
        return true;
    },

    queryS3 : function (method, bucket, key, path, params, content, handlerObj, isSync, handlerMethod, callback)
    {
        if (!this.isEnabled()) return null;

        try {
            return this.queryS3Impl(method, bucket, key, path, params, content, handlerObj, isSync, handlerMethod, callback);
        } catch (e) {
            alert ("An error occurred while calling "+ method + " " + bucket + "/" + key + path + "\n" + e);
        }
        return null;
    },

    queryEC2Impl : function (action, params, handlerObj, isSync, handlerMethod, callback, apiURL, apiVersion, sigVersion)
    {
        var curTime = new Date();
        var formattedTime = curTime.strftime("%Y-%m-%dT%H:%M:%SZ", true);

        var url = apiURL ? apiURL : this.urls.EC2;
        var sigValues = new Array();
        sigValues.push(new Array("Action", action));
        sigValues.push(new Array("AWSAccessKeyId", this.accessKey));
        sigValues.push(new Array("SignatureVersion", sigVersion ? sigVersion : this.SIG_VERSION));
        sigValues.push(new Array("SignatureMethod", "HmacSHA1"));
        sigValues.push(new Array("Version", apiVersion ? apiVersion : this.versions.EC2));
        sigValues.push(new Array("Timestamp", formattedTime));
        if (this.securityToken != "") sigValues.push(new Array("SecurityToken", this.securityToken));

        // Mix in the additional parameters. params must be an Array of tuples as for sigValues above
        for (var i = 0; i < params.length; i++) {
            sigValues.push(params[i]);
        }

        var strSig = "";
        var queryParams = "";

        function encode(str) {
            str = encodeURIComponent(str);
            var efunc = function(m) { return m == '!' ? '%21' : m == "'" ? '%27' : m == '(' ? '%28' : m == ')' ? '%29' : m == '*' ? '%2A' : m; }
            return str.replace(/[!'()*~]/g, efunc);
        }

        if (this.sigVersion == "1") {
            function sigParamCmp(x, y) {
                if (x[0].toLowerCase() < y[0].toLowerCase ()) return -1;
                if (x[0].toLowerCase() > y[0].toLowerCase()) return 1;
                return 0;
            }
            sigValues.sort(sigParamCmp);
            for (var i = 0; i < sigValues.length; i++) {
                strSig += sigValues[i][0] + sigValues[i][1];
                queryParams += (i ? "&" : "") + sigValues[i][0] + "=" + encode(sigValues[i][1]);
            }
        }  else {
            sigValues.sort();
            strSig = "POST\n" + url.replace(/https?:\/\//,"") + "\n/\n";
            for (var i = 0; i < sigValues.length; i++) {
                var item = (i ? "&" : "") + sigValues[i][0] + "=" + encode(sigValues[i][1]);
                strSig += item
                queryParams += item
            }
        }
        queryParams += "&Signature="+encodeURIComponent(b64_hmac_sha1(this.secretKey, strSig));
        url += "/";

        log("URL ["+url+"?"+queryParams+"]");

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open("POST", url, !isSync);
        xmlhttp.setRequestHeader("User-Agent", this.getUserAgent());
        xmlhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xmlhttp.setRequestHeader("Content-Length", queryParams.length);
        xmlhttp.setRequestHeader("Connection", "close");

        return this.sendRequest(xmlhttp, url, queryParams, isSync, action, handlerMethod, handlerObj, callback, params);
    },

    queryS3Prepare : function(method, bucket, key, path, params, content)
    {
        var curTime = new Date().toUTCString();
        var url = this.getS3Protocol(this.region, bucket) + (bucket ? bucket + "." : "") + this.model.getS3Region(this.region || "").url;

        if (!params) params = {}

        // Required headers
        if (!params["x-amz-date"]) params["x-amz-date"] = curTime;
        if (!params["Content-Type"]) params["Content-Type"] = "binary/octet-stream; charset=UTF-8";
        if (!params["Content-Length"]) params["Content-Length"] = content ? content.length : 0;
        if (this.securityToken != "") params["x-amz-security-token"] = this.securityToken;

        // Construct the string to sign and query string
        var strSig = method + "\n" + (params['Content-MD5']  || "") + "\n" + (params['Content-Type'] || "") + "\n" + "\n";

        // Amazon canonical headers
        var headers = []
        for (var p in params) {
            if (/X-AMZ-/i.test(p)) {
                var value = params[p]
                if (value instanceof Array) {
                    value = value.join(',');
                }
                headers.push(p.toString().toLowerCase() + ':' + value);
            }
        }
        if (headers.length) {
            strSig += headers.sort().join('\n') + "\n"
        }

        // Split query string for subresources, supported are:
        var resources = ["acl", "lifecycle", "location", "logging", "notification", "partNumber", "policy", "requestPayment", "torrent",
                         "uploadId", "uploads", "versionId", "versioning", "versions", "website",
                         "delete",
                         "response-content-type", "response-content-language", "response-expires",
                         "response-cache-control", "response-content-disposition", "response-content-encoding" ]
        var rclist = []
        var query = parseQuery(path)
        for (var p in query) {
            p = p.toLowerCase();
            if (resources.indexOf(p) != -1) {
                rclist.push(p + (query[p] == true ? "" : "=" + query[p]))
            }
        }
        strSig += (bucket ? "/" + bucket : "") + "/" + key + (rclist.length ? "?" : "") + rclist.sort().join("&");

        params["Authorization"] = "AWS " + this.accessKey + ":" + b64_hmac_sha1(this.secretKey, strSig);
        params["User-Agent"] = this.getUserAgent();
        params["Connection"] = "close";

        debug("S3 [" + method + ":" + url + "/" + key + path + ":" + strSig.replace(/\n/g, "|") + " " + JSON.stringify(params) + "]")

        return { method: method, url: url + "/" + key + path, headers: params, sig: strSig, time: curTime }
    },

    queryS3Impl : function(method, bucket, key, path, params, content, handlerObj, isSync, handlerMethod, callback)
    {
        var req = this.queryS3Prepare(method, bucket, key, path, params, content);

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            debug("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open(req.method, req.url, !isSync);

        for (var p in req.headers) {
            xmlhttp.setRequestHeader(p, req.headers[p]);
        }

        return this.sendRequest(xmlhttp, req.url, content, isSync, method, handlerMethod, handlerObj, callback, [bucket, key, path]);
    },

    showBusy : function(fShow)
    {
        if (fShow) {
            this.httpCount++;
            window.setCursor("wait");
        } else {
            --this.httpCount;
            if (this.httpCount <= 0) {
                window.setCursor("auto");
            }
        }
    },

    sendRequest: function(xmlhttp, url, content, isSync, action, handlerMethod, handlerObj, callback, params)
    {
        debug('sendRequest: ' + action + '/' + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ', params=' + params);
        var me = this;

        var xhr = xmlhttp;
        // Generate random timer
        var timerKey = this.getTimerKey();
        this.startTimer(timerKey, function() { xhr.abort() });
        this.showBusy(true);

        if (isSync) {
            xmlhttp.onreadystatechange = function() {}
        } else {
            xmlhttp.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    me.showBusy(false);
                    me.stopTimer(timerKey);
                    me.handleResponse(xhr, url, isSync, action, handlerMethod, handlerObj, callback, params);
                }
            }
        }

        try {
            xmlhttp.send(content);
        } catch(e) {
            debug('xmlhttp error:' + url + ", " + e)
            this.showBusy(false);
            this.stopTimer(timerKey);
            this.handleResponse(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params);
            return false;
        }

        // In sync mode the result is always returned
        if (isSync) {
            this.showBusy(false);
            this.stopTimer(timerKey);
            return this.handleResponse(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params);
        }
        return true;
    },

    handleResponse : function(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params)
    {
        log(xmlhttp.responseText);

        var rc = xmlhttp && (xmlhttp.status >= 200 && xmlhttp.status < 300) ?
                 this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params) :
                 this.createResponseError(xmlhttp, url, isSync, action, handlerMethod, callback, params);

        // Response callback is called in all cases, some errors can be ignored
        if (handlerObj) {
            handlerObj.onResponseComplete(rc);
        }
        debug('handleResponse: ' + action + ", method=" + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ", status=" + rc.status + ', errorCount=' + this.errorCount + ', errCode=' + rc.errCode + ', errString=' + rc.errString);

        // Prevent from showing error dialog on every error until success, this happens in case of wrong credentials or endpoint and until all views not refreshed,
        // also ignore not supported but implemented API calls
        if (rc.hasErrors) {
            this.errorCount++;
            if (this.errorCount < this.errorMax) {
                if (this.actionIgnore.indexOf(rc.action) == -1) {
                    this.errorDialog("Server responded with an error for " + rc.action, rc)
                }
            }
        } else {
            this.errorCount = 0;
            // Pass the result or the whole response object if it is null
            if (callback) {
                callback(rc.result != null ? rc.result : rc);
            }
        }
        return rc.result;
    },

    // Extract standard AWS error code and message
    createResponseError : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        var rc = this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params);
        rc.errCode = "Unknown: " + (xmlhttp ? xmlhttp.status : 0);
        rc.errString = "An unknown error occurred, please check connectivity";
        rc.requestId = "";
        rc.hasErrors = true;

        if (xmlhttp) {
            var xmlDoc = xmlhttp.responseXML;
            if (xmlDoc) {
                rc.errCode = getNodeValue(xmlDoc, "Code");
                rc.errString = getNodeValue(xmlDoc, "Message");
                rc.requestId = getNodeValue(xmlDoc, "RequestID");
            }
            debug('response error: ' +  action + ", " + xmlhttp.responseText + ", " + rc.errString + ", " + url)
        }
        return rc;
    },

    createResponse : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        return { xmlhttp: xmlhttp,
                 xmlDoc: xmlhttp && xmlhttp.responseXML ? xmlhttp.responseXML : document.createElement('document'),
                 responseText: xmlhttp ? xmlhttp.responseText : '',
                 status : xmlhttp.status,
                 url: url,
                 action: action,
                 method: handlerMethod,
                 isSync: isSync,
                 hasErrors: false,
                 params: params,
                 callback: callback,
                 result: null,
                 errCode: "",
                 errString: "",
                 requestId: "" };
    },

    // Show non modal error popup
    errorDialog : function(msg, rsp)
    {
        if (!rsp) rsp = {};
        var rc = { value:null, action: rsp.action || "", errCode: rsp.errCode || "", errString: rsp.errString || "", requestId: rsp.requestId || "" };
        // Reuse the same window
        if (!this.winError || !this.winError.setup) {
            this.winError = window.openDialog("chrome://ew/content/dialogs/error.xul", null, "chrome,centerscreen,resizable", msg, rc);
        } else
        if (this.winError.setup) {
            this.winError.focus();
            this.winError.setup.call(this.winError, msg, rc);
        }
    },

    queryVpnConnectionStylesheets : function(stylesheet)
    {
        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return;
        }
        if (stylesheet == null) {
            stylesheet = "customer-gateway-config-formats.xml";
        }
        var url = this.VPN_CONFIG_PATH + '2009-07-15' + "/" + stylesheet;
        xmlhttp.open("GET", url, false);
        xmlhttp.setRequestHeader("User-Agent", this.getUserAgent());
        xmlhttp.overrideMimeType('text/xml');
        return this.sendRequest(xmlhttp, url, 'vpnConfig', null, true, stylesheet);
    },

    queryCheckIP : function(type, retVal)
    {
        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return;
        }
        var url = "http://checkip.amazonaws.com/" + type;
        xmlhttp.open("GET", url, false);
        xmlhttp.setRequestHeader("User-Agent", this.getUserAgent());
        xmlhttp.overrideMimeType('text/plain');
        return this.sendRequest(xmlhttp, url, 'checkIP', null, true, "checkip", null, function(obj) { retVal.ipAddress = obj.textBody; });
    },

    download: function(url, headers, filename, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        debug('download: ' + url + '| ' + JSON.stringify(headers) + '| ' + filename)

        try {
          FileIO.remove(filename);
          var file = FileIO.open(filename);
          if (!FileIO.create(file)) {
              alert('Cannot create ' + filename)
              return false;
          }

          var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(url, null, null);
          var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);
          persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
          persist.progressListener = {
            onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
                var percent = (aCurTotalProgress/aMaxTotalProgress) * 100;
                if (progresscb) progresscb(filename, percent);
            },
            onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
                debug("download: " + filename + " " + aStateFlags + " " + aStatus)
                if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
                    if (callback) callback(filename);
                }
            }
          }

          var hdrs = "";
          for (var p in headers) {
              hdrs += p + ":" + headers[p] + "\n";
          }
          persist.saveURI(io, null, null, null, hdrs, file);
          return true;

        } catch (e) {
          alert(e);
        }
        return false;
    },

    getTimerKey: function()
    {
        return String(Math.random()) + ":" + String(new Date().getTime());
    },

    startTimer : function(key, expr)
    {
        var timeout = this.getIntPrefs("ew.http.timeout", 15000, 5000, 3600000);
        var timer = window.setTimeout(expr, timeout);
        this.timers[key] = timer;
    },

    stopTimer : function(key, timeout)
    {
        if (this.timers[key]) {
            window.clearTimeout(this.timers[key]);
        }
        this.timers[key] = null;
        return true;
    },

    getDirSeparator : function()
    {
        return navigator.platform.toLowerCase().indexOf('win') > -1 ? '\\' : '/';
    },

    getAppPath : function()
    {
        return DirIO.get("CurProcD").path;
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
            path = ew_session.promptForDir(msg);
            if (!path) return 0;
            this.setStrPrefs("ew.key.home", path);
        }
        return 1
    },

    getCurrentUser : function()
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
        return this.getStrPrefs("ew.rdp.command", args);
    },

    getSSHCommand : function()
    {
        var cmd = '/usr/bin/xterm';
        if (isMacOS(navigator.platform)) {
            cmd = "/usr/bin/osascript";
        } else

        if (isWindows(navigator.platform)) {
            cmd = 'c:\\\Windows\\System32\\cmd.exe'
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
            args = "#!set HOME=" + this.getHome() + "#!" + quotepath(this.getAppPath() + '\\bin\\ssh.exe') + " -o \"ServerAliveInterval 5\" -i ${key} ${login}@${host}";
        }
        return this.getStrPrefs("ew.ssh.args", args);
    },

    getOpenSSLCommand : function()
    {
        var cmd = "/usr/bin/openssl";
        if (isWindows(navigator.platform)) {
            cmd = this.getAppPath() + "\\bin\\openssl.exe"
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
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "AWSCredential_${keyname}.txt", [ [ "keyname", sanitize(name ? name : this.getCurrentUser()) ] ]);
    },

    getPrivateKeyFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "PrivateKey_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getCurrentUser()) ] ]);
    },

    getPublicKeyFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "PublicKey_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getCurrentUser()) ] ]);
    },

    getCertificateFile : function(name)
    {
        return this.getTemplateProcessed(this.getKeyHome() + this.getDirSeparator() + "X509Certificate_${keyname}.pem", [ [ "keyname", sanitize(name ? name : this.getCurrentUser()) ] ]);
    },

    getTemplateProcessed : function(file, params)
    {
        var keyname = null
        // Custom variables
        for ( var i = 0; params && i < params.length; i++) {
            var val = params[i][1]
            if (file.indexOf("${" + params[i][0] + "}") > -1) {
                file = file.replace(new RegExp("\\${" + params[i][0] + "}", "g"), quotepath(val));
            }
            switch (params[i][0]) {
            case "keyname":
                keyname = val
                break;
            }
        }
        // Global variables
        if (file.indexOf("${login}") > -1) {
            var user = this.getSSHUser()
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
            file = file.replace(/\${user}/g, this.getCurrentUser());
        }
        if (file.indexOf("${key}") > -1) {
            file = file.replace(/\${key}/g, quotepath(this.getPrivateKeyFile(keyname)));
        }
        return file
    },

    getArgsProcessed: function(args, params, filename)
    {
        var idx = args.indexOf('#!');
        if (idx == -1) {
            return this.getTemplateProcessed(args, params);
        }

        // Batch file
        if (!this.makeKeyHome()) return null

        var batch = args.substr(idx + 2).replace(/\#\!/g, "\r\n") + "\r\n";
        batch = this.getTemplateProcessed(batch, params);

        var file = this.getKeyHome() + DirIO.sep + filename + (isWindows(navigator.platform) ? ".bat" : ".sh");
        args = this.getTemplateProcessed(args.substr(0, idx) + " " + quotepath(file), params);

        var fd = FileIO.open(file);
        FileIO.write(fd, batch);
        fd.permissions = 0700;

        debug("BATCH:" + file + "\n" + batch)
        return args;
    },

    getLastEC2PrivateKeyFile : function()
    {
        return this.getStrPrefs("ew.ec2.pkey." + this.getCurrentUser() + "." + this.getLastUsedEndpoint(), "");
    },

    setLastEC2PrivateKeyFile : function(value)
    {
        this.setStrPrefs("ew.ec2.pkey." + this.getCurrentUser() + "." + this.getLastUsedEndpoint(), value);
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

    getFileContents: function(path)
    {
        return FileIO.toString(path);
    },

    getBinaryFileContents: function(path, base64)
    {
        return FileIO.readBinary(FileIO.open(path), base64);
    },

    getEnv : function(name)
    {
        var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
        return env.exists(name) ? env.get(name) : "";
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

    setLastUsedEndpoint : function(value)
    {
        this.setStrPrefs("ew.active.endpoint", value);
    },

    getLastUsedEndpoint : function()
    {
        return this.getStrPrefs("ew.active.endpoint", "us-east-1");
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

};
