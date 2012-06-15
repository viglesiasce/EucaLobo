var ew_UsersTreeView = {
    model: [ "users", "groups"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.users.contextmenu.delete").disabled = !item;
        $("ew.users.contextmenu.addGroup").disabled = !item;
        $("ew.users.contextmenu.addPassword").disabled = !item || (item.loginProfileDate && !ew_session.isGovCloud());
        $("ew.users.contextmenu.changePassword").disabled = !item || (!item.loginProfileDate && !ew_session.isGovCloud());
        $("ew.users.contextmenu.deletePassword").disabled = !item || (!item.loginProfileDate && !ew_session.isGovCloud());
        $("ew.users.contextmenu.createKey").disabled = !item;
        $("ew.users.contextmenu.deleteKey").disabled = !item || !item.keys || !item.keys.length;
        $("ew.users.contextmenu.createVMFA").disabled = !item;
        $("ew.users.contextmenu.enableMFA").disabled = !item;
        $("ew.users.contextmenu.resyncMFA").disabled = !item || !item.devices || item.devices.length;
        $("ew.users.contextmenu.deactivateMFA").disabled = !item || !item.devices || !item.devices.length;
        $("ew.users.contextmenu.addPolicy").disabled = !item;
        $("ew.users.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
        $("ew.users.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
    },

    makeKeypair: function(uploadCert)
    {
        var item = this.getSelected();
        if (!item) return;
        ew_KeypairTreeView.makeKeypair(uploadCert, item.name);
    },

    selectionChanged: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.updateUser(item);
    },

    updateUser: function(item)
    {
        var me = this;
        // GovCloud does not support this yet
        if (!item.loginProfileDate && !ew_session.isGovCloud()) {
            ew_session.controller.getLoginProfile(item.name, function(list) { me.menuChanged() })
        }
        if (!item.groups) {
            ew_session.controller.listGroupsForUser(item.name, function(list) { me.menuChanged() })
        }
        if (!item.policies) {
            ew_session.controller.listUserPolicies(item.name, function(list) { me.menuChanged() })
        }
        if (!item.keys) {
            ew_session.controller.listAccessKeys(item.name, function(list) { me.menuChanged() })
        }
        if (!item.devices) {
            ew_session.controller.listMFADevices(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var values = ew_session.promptInput('Create User', ["User Name", "Path"]);
        if (values) {
            ew_session.controller.createUser(values[0], values[1], function() { me.refresh() })
        }
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete user?")) return;
        ew_session.controller.deleteUser(item.name, function() { me.refresh() });
    },

    renameUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput('Rename User', ["New User Name", "New Path"], [ item.name, item.path ]);
        if (!values) return;
        ew_session.controller.updateUser(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() { me.refresh() })
    },

    setPassword: function(update)
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var pw = ew_session.promptForPassword("Password", "Enter password for " + item.name);
        if (!pw) return;
        if (update) {
            ew_session.controller.updateLoginProfile(item.name, pw, function() { me.refresh() })
        } else {
            ew_session.controller.createLoginProfile(item.name, pw, function() { me.refresh() })
        }
    },

    changePassword: function()
    {
        var values = ew_session.promptInput('Change Password', ["Old Password", "New Password", "Retype Password", "Check"], null, ["textbox", "password", "password", "checkbox"]);
        if (!values) return;
        if (values[1] != values[2]) {
            return alert('New entered passwords mismatch')
        }
        return
        ew_session.controller.changePassword(values[0], values[1], function() { alert("AWS Console password has been changed") })
    },

    deletePassword: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete password for user " + item.name + "?")) return;
        ew_session.controller.deleteLoginProfile(item.name, function() { me.refresh() });
    },

    addGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var list = ew_model.get('groups');
        var idx = ew_session.promptList("Group", "Select group to add this user to", list, ["name"]);
        if (idx < 0) return;
        ew_session.controller.addUserToGroup(item.name, list[idx].name, function() { me.refresh() });
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var name = prompt("Enter new policy name");
        if (!name) return;
        var text = '{\n "Statement": [\n  { "Effect": "",\n    "Action": [""],\n    "Resource": ""\n  }\n ]\n}';
        text = ew_session.promptForText('Enter policy permissions',text);
        if (text) {
            ew_session.controller.putUserPolicy(item.name, name, text);
        }
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to edit');
        }
        var idx = 0;

        if (item.policies.length > 1) {
            idx = ew_session.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        ew_session.controller.getUserPolicy(item.name, item.policies[idx], function(doc) {
            var text = ew_session.promptForText('Enter policy permissions', doc);
            if (text) {
                ew_session.controller.putUserPolicy(item.name, item.policies[idx], text);
            }
        });
    },

    deletePolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to delete');
        }
        var idx = 0;

        if (item.policies.length > 0) {
            idx = ew_session.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete policy ' + item.policies[idx] + '?')) return;
        }
        ew_session.controller.deleteUserPolicy(item.name, item.policies[idx], text, function() {
            item.policies = null;
            this.selectionChanged();
        });
    },

    createAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        ew_session.controller.createAccessKey(user, function(user, key, secret) {
            item.keys = null;
            this.selectionChanged();
            ew_AccessKeyTreeView.saveAccessKey(user, key, secret);
        });
    },

    deleteAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.keys || !item.keys.length) {
            return alert('No access keys');
        }
        var idx = 0;

        if (item.keys.length > 0) {
            idx = ew_session.promptList("Access Key", "Select access key to delete", item.keys);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete access key ' + item.keys[idx] + '?')) return;
        }
        ew_session.controller.deleteAccessKey(item.keys[idx].id, function() {
            item.keys = null;
            this.selectionChanged();
        });
    },

    createVMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput('Create Virtual MFA device', ["Serial Number", "Device Path", "Auth Code 1", "Auth Code 2"]);
        if (!values) return;
        ew_session.controller.createVirtualMFADevice(values[0], values[1], function() {
            ew_session.controller.enableMFADevice(item.name, values[0], values[2], values[3], function() { me.refresh() });
        });
    },

    enableMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput('Enable MFA device', ["Serial Number", "Auth Code 1", "Auth Code 2"]);
        if (!values) return;
        ew_session.controller.enableMFADevice(item.name, values[0], values[1], values[2], function() { me.refresh() });
    },

    resyncMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.devices || !item.devices.length) {
            return alert('No devices to resync');
        }
        var values = ew_session.promptInput('Resync MFA device', ["Serial Number", "Auth Code 1", "Auth Code 2"]);
        if (!values) return;
        ew_session.controller.resyncMFADevice(item.name, values[0], values[1], values[2], function() { me.refresh() });
    },

    deactivateMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.devices || !item.devices.length) {
            return alert('No device to delete');
        }

        if (item.keys.length > 0) {
            idx = ew_session.promptList("MFA Device", "Select device to deactivate", item.devices);
            if (idx < 0) return;
        } else {
            if (!confirm('Deactivate MFA device ' + item.devices[idx] + '?')) return;
        }
        ew_session.controller.deactivateMFADevice(item.name, item.devices[idx].id, function() {
            item.devices = null;
            this.selectionChanged();
        });
    },

};

ew_UsersTreeView.__proto__ = TreeView;
ew_UsersTreeView.register();

var ew_GroupsTreeView = {
    model: ["groups","users"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.groups.contextmenu.delete").disabled = !item;
        $("ew.groups.contextmenu.rename").disabled = !item;
        $("ew.groups.contextmenu.addPolicy").disabled = !item;
        $("ew.groups.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
        $("ew.groups.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
    },

    selectionChanged: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        if (item.users) {
            ew_GroupUsersTreeView.display(item.users);
        } else {
            ew_session.controller.getGroup(item.name, function(list) { ew_GroupUsersTreeView.display(list); });
        }
        if (!item.policies) {
            ew_session.controller.listGroupPolicies(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var users = ew_model.get('users');
        var list = [];
        for (var i in users) {
            var found = false
            for (var j in item.users) {
                if (users[i].name == item.users[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found) list.push(users[i]);
        }
        var idx = ew_session.promptList("User name", "Select user to add to " + item.name, list);
        if (idx < 0) return;
        ew_session.controller.addUserToGroup(users[idx].name, item.name, function() { me.refresh() });
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var user = ew_GroupUsersTreeView.getSelected()
        if (!user) return;
        if (!confirm("Remove user " + user.name + " from group " + item.name + "?")) return;
        ew_session.controller.removeUserFromGroup(user.name, item.name, function() { me.refresh() });
    },

    addGroup: function()
    {
        var me = this;
        var values = ew_session.promptInput('Create Group', ["Group Name", "Path"]);
        if (values) {
            ew_session.controller.createGroup(values[0], values[1], function() { me.refresh() })
        }
    },

    deleteGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete group?")) return;
        ew_session.controller.deleteGroup(item.name, function() { me.refresh() });
    },

    renameGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput('Rename Group', ["New Group Name", "New Path"], [ item.name, item.path ]);
        if (!values) return;
        ew_session.controller.updateGroup(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() { me.refresh() })
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var name = prompt("Enter new policy name");
        if (!name) return;
        var text = '{\n "Statement": [\n  { "Effect": "",\n    "Action": [""],\n    "Resource": ""\n  }\n ]\n}';
        text = ew_session.promptForText('Enter policy permissions',text);
        if (text) {
            ew_session.controller.putGroupPolicy(item.name, name, text);
        }
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policied to edit');
        }
        var idx = 0;
        if (item.policies.length > 1) {
            idx = ew_session.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        ew_session.controller.getGroupPolicy(item.name, item.policies[idx], function(doc) {
            var text = ew_session.promptForText('Enter policy permissions', doc);
            if (text) {
                ew_session.controller.putGroupPolicy(item.name, item.policies[idx], text);
            }
        });
    },

    deletePolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to delete');
        }
        var idx = 0;

        if (item.policies.length > 1) {
            idx = ew_session.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else
        if (!confirm('Delete policy ' + item.policies[idx])) return;

        ew_session.controller.deleteGroupPolicy(item.name, item.policies[idx], text, function() { item.policies = null; });
    },
};

ew_GroupsTreeView.__proto__ = TreeView;
ew_GroupsTreeView.register();

var ew_GroupUsersTreeView = {
    name: "groupUsers",

    selectionChanged: function()
    {
        var item = this.getSelected();
        if (!item) return;
        // Non visible views do not get updates so if we never show users list we need to updte manually
        if (ew_UsersTreeView.rowCount > 0) {
            ew_UsersTreeView.select(item);
        } else {
            var user = ew_model.find('users', item.id);
            if (user) {
                ew_UsersTreeView.updateUser(user);
            }
        }

        // Replace with actual users from the model to show all properties
        for (var i in this.treeList) {
            var user = ew_model.find('users', this.treeList[i].id);
            if (user) this.treeList[i] = user;
        }
    },
};
ew_GroupUsersTreeView.__proto__ = TreeView;

var ew_VMFATreeView = {
    model: ["vmfas", "users"],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.vmfas.contextmenu.delete').disabled = item == null;
        $('ew.vmfas.contextmenu.assign').disabled = !item || !item.userName;
        $('ew.vmfas.contextmenu.unassign').disabled = !item || item.userName;
    },

    addDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput('Create Virtual MFA device', ["Serial Number", "Device Path"]);
        if (!values) return;
        ew_session.controller.createVirtualMFADevice(values[0], values[1], function(){ me.refresh() });
    },

    deleteDevice: function()
    {
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Virtual MFA device ' + item.id)) return;
        ew_session.controller.deleteVirtualMFADevice(item.id, function(){ me.refresh() });
    },

    assignDevice: function()
    {
        var item = this.getSelected();
        if (!item || item.userName) return;
        var users = ew_model.get('users');
        var idx = ew_session.promptList("User name", "Select user to assign this device to", users);
        if (idx < 0) return;
        var values = ew_session.promptInput('Assign MFA device', ["Auth Code 1", "Auth Code 2"]);
        if (!values) return;
        ew_session.controller.enableMFADevice(users[idx].name, item.id, values[0], values[1], function() { me.refresh() });
    },

    unassignDevice: function()
    {
        var item = this.getSelected();
        if (!item || !item.userName) return;
        if (!confirm('Deactivate MFA device from user ' + item.userName)) return;
        ew_session.controller.deactivateMFADevice(item.userName, item.id, function() { me.refresh() });
    },
};
ew_VMFATreeView.__proto__ = TreeView;
ew_VMFATreeView.register();


var ew_KeypairTreeView = {
    model: ["keypairs"],

    createKeypair : function ()
    {
        if (ew_session.isGovCloud()) {
            alert("This function is disabled in GovCloud region")
            return
        }
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        var wrap = function(name, key) {
            // Save key in the file
            var file = ew_session.getPrivateKeyFile(name)
            var fp = FileIO.open(file)
            FileIO.write(fp, key + "\n\n", "");
            me.refresh();
            me.select({name: name});
        }
        ew_session.controller.createKeypair(name, wrap);
    },

    importKeypair : function ()
    {
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        var wrap = function(name) {
            me.refresh();
            me.select({name: name});
        }
        // Create new private key file using openssl and return key value
        var file = ew_session.promptForFile("Select the public key file to upload:")
        if (file) {
            var body = readPublicKey(file)
            if (body == '') {
                return alert('Unable to read public key file ' + file);
            }
            ew_session.controller.importKeypair(name, body, wrap);
        }
    },

    // If user is specified we create cet/keypair on behalf of that user, for keypair it does not matter,
    // they go by name but for ceetificate we need valid user name
    makeKeypair: function(uploadCert, user)
    {
        var name = prompt("Please provide a new keypair name:", user || "");
        if (name == null) return;
        name = name.trim();
        var me = this;

        var file = this.promptForDir("Choose where to store keys and certificate or Cancel to use " + ew_session.getKeyHome(), true)
        if (file) {
            this.setStrPrefs("ew.key.home", file);
        }

        // Create new certificate file using openssl and return cert value
        var body = ew_session.generateCertificate(name);
        if (!body) {
            return alert("Could not create certificate and key pair files");
        }
        // For signing in command line tools we need at least one certificate
        if (uploadCert) {
            ew_CertTreeView.upload(body, user);
        }

        // Import new public key as new keypair
        var file = ew_session.getPublicKeyFile(name);
        var pubkey = readPublicKey(file);
        if (pubkey == '') {
            return alert('Unable to read public key file ' + file);
        }
        ew_session.controller.importKeypair(name, pubkey, function() {me.refresh();});
    },

    deleteSelected  : function ()
    {
        var keypair = this.getSelected();
        if (keypair == null) return;
        if (!confirm("Delete key pair "+keypair.name+"?")) return;
        var me = this;
        ew_session.controller.deleteKeypair(keypair.name, function() {me.refresh();});
    },
};

ew_KeypairTreeView.__proto__ = TreeView;
ew_KeypairTreeView.register();

var ew_AccessKeyTreeView = {
    name: ["accesskeys"],
    properties: ["state"],

    runShell: function()
    {
        var accesskey = this.getSelected();
        if (accesskey) {
            accesskey.secret = this.getAccessKeySecret(accesskey.id);
            if (!accesskey.secret) alert('Cannot get secret for the access key, AWS command line tools will not work');
        }
        // Use currently selected keypair
        var keypair = ew_KeypairTreeView.getSelected();
        ew_session.launchShell(keypair, accesskey);
    },

    refresh: function()
    {
        var me = this;
        ew_session.controller.listAccessKeys(null, function(list) { me.display(list); })
    },

    saveAccessKey: function(user, key, secret, save)
    {
        if (save || this.getBoolPrefs("ew.accesskey.save", true)) {
            ew_session.savePassword('AccessKey:' + key, secret);
        }
        alert('Access Key is ready:\nAccessKeyId: ' + key + '\nAccessSecretKey: ' + secret);
    },

    createAccessKey : function () {
        var me = this;
        ew_session.controller.createAccessKey(null, function(user, key, secret) {
            me.refresh()
            // Alwayse save my own access keys
            me.saveAccessKey(user, key, secret, true);
        });
    },

    getAccessKeySecret : function(key) {
        var secret = ew_session.getPassword('AccessKey:' + key)
        if (secret == "" && key == ew_session.accessCode) {
            secret = ew_session.secretKey
        }
        return secret
    },

    deleteSelected  : function () {
        var key = this.getSelected();
        if (key == null) return;
        if (key.current) {
            alert("You cannot delete current access key")
            return;
        }
        if (!ew_session.promptYesNo("Confirm", "Delete access key "+key.id+"?")) return;

        var me = this;
        var wrap = function() {
            ew_session.deletePassword('AccessKey:' + key.id)
            me.refresh();
        }
        ew_session.controller.deleteAccessKey(key.name, wrap);
    },

    exportSelected  : function () {
        var key = this.getSelected();
        if (key == null) return;
        key.secret = this.getAccessKeySecret(key.id)
        if (key.secret == "") {
            alert("No secret key available for this access key")
            return
        }
        var path = ew_session.promptForFile("Choose file where to export this access key", true)
        if (path) {
            FileIO.write(FileIO.open(path), "AWSAccessKeyId=" + key.id + "\nAWSSecretKey=" + key.secret + "\n")
        }
    },

    switchCredentials  : function () {
        var key = this.getSelected();
        if (key == null) return;
        key.secret = this.getAccessKeySecret(key.id)
        if (key.secret == "") {
            alert("Access key " + key.id + " does not have secret code available, cannot use this key");
            return;
        }

        if (!ew_session.promptYesNo("Confirm", "Use access key "+key.id+" for authentication for user " + key.useName + "?, current access key/secret will be discarded.")) return;
        ew_session.setCredentials(key.id, key.secret);
        ew_session.updateCredentials(ew_session.getActiveCredentials(), key.id, key.secret);
        this.refresh();
    },
};
ew_AccessKeyTreeView.__proto__ = TreeView;
ew_AccessKeyTreeView.register();

var ew_CertsTreeView = {
    searchElement: "ew.certs.search",

    refresh: function()
    {
        var me = this;
        ew_session.controller.listSigningCertificates(null, function(list) { me.display(list); })
    },

    createCert : function () {
        var me = this;
        var body = ew_session.generateCertificate();
        if (body) {
            this.upload(body);
        } else {
            alert("Could not generate new X509 certificate")
        }
    },

    upload: function(body, user)
    {
        // Delay to avoid "not valid yet" error due to clock drift
        var me = this;
        setTimeout(function() { ew_session.controller.uploadSigningCertificate(user, body, function() { me.refresh();}); }, 30000);
    },

    uploadCert : function (user) {
        var me = this;
        var file = ew_session.promptForFile("Select the certificate file to upload:")
        if (file) {
            var body = FileIO.toString(file);
            ew_session.controller.uploadSigningCertificate(user, body, function() { me.refresh(); });
        }
    },

    deleteSelected  : function () {
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete certificate "+item.id+"?")) return;

        var me = this;
        ew_session.controller.deleteSigningCertificate(item.id, function() { me.refresh(); });
    },
};
ew_CertsTreeView.__proto__ = TreeView;
ew_CertsTreeView.register();

var ew_PasswordPolicyView = {
    obj: null,
    rowCount: 0,

    refresh: function() {
    },

    activate: function() {
        var me = this;
        ew_session.controller.getAccountPasswordPolicy(function(obj) {
            me.obj = obj;
            for (var p in obj) {
                var e = $('ew.' + p)
                if (!e) continue;
                if (e.tagName == 'textbox') e.value = obj[p]; else e.checked = obj[p];
            }
        });
    },

    deactivate: function() {
        this.refresh();
    },

    display: function() {
    },

    invalidate: function() {
    },

    save: function() {
        for (var p in this.obj) {
            var e = $('ew.' + p)
            if (!e) continue;
            this.obj[p] = e.tagName == 'textbox' ? e.value : e.checked;
            ew_session.controller.updateAccountPasswordPolicy(function() { alert('Password policy has been updated') });
        }
    },
};
