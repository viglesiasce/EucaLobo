
var ew_UsersTreeView = {
    model: [ "users", "groups"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.users.contextmenu.delete").disabled = !item;
        $("ew.users.contextmenu.addGroup").disabled = !item;
        $("ew.users.contextmenu.addPassword").disabled = !item || (item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.changePassword").disabled = !item || (!item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.deletePassword").disabled = !item || (!item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.createKey").disabled = !item;
        $("ew.users.contextmenu.genKey").disabled = !item;
        $("ew.users.contextmenu.makeKey").disabled = !item;
        $("ew.users.contextmenu.createTemp").disabled = !item;
        $("ew.users.contextmenu.deleteKey").disabled = !item || !item.accessKeys || !item.accessKeys.length;
        $("ew.users.contextmenu.enableVMFA").disabled = !item;
        $("ew.users.contextmenu.enableMFA").disabled = !item;
        $("ew.users.contextmenu.resyncMFA").disabled = !item || !item.mfaDevices || !item.mfaDevices.length;
        $("ew.users.contextmenu.deactivateMFA").disabled = !item || !item.mfaDevices || !item.mfaDevices.length;
        $("ew.users.contextmenu.addPolicy").disabled = !item;
        $("ew.users.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
        $("ew.users.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
    },

    makeKeypair: function(uploadCert)
    {
        var item = this.getSelected();
        if (!item) return;
        ew_KeypairsTreeView.makeKeypair(uploadCert, item.name);
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
        if (!item.loginProfileDate) {
            this.core.api.getLoginProfile(item.name, function(date) { me.menuChanged() })
        }
        if (!item.groups) {
            this.core.api.listGroupsForUser(item.name, function(list) { me.menuChanged() })
        }
        if (!item.policies) {
            this.core.api.listUserPolicies(item.name, function(list) { me.menuChanged() })
        }
        if (!item.accessKeys) {
            this.core.api.listAccessKeys(item.name, function(list) { me.menuChanged() })
        }
        if (!item.mfaDevices) {
            this.core.api.listMFADevices(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var values = this.core.promptInput('Create User', [{ label: "User Name",required:1}, { label: "Path"} ]);
        if (values) {
            this.core.api.createUser(values[0], values[1], function(user) {
                me.core.addModel('users', user);
                me.invalidate();
                me.select(user)
            })
        }
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete user?")) return;
        if (item.loginProfileDate) {
            this.core.api.deleteLoginProfile(item.name);
        }
        if (item.policies) {
            for (var i in item.policies) {
                this.core.api.deleteUserPolicy(item.name, item.policies[i]);
            }
            sleep(1000)
        }
        if (item.accessKeys) {
            for (var i in item.accessKeys) {
                this.core.api.deleteAccessKey(item.accessKeys[i].id, item.name);
            }
            sleep(1000)
        }
        if (item.groups) {
            for (var i in item.groups) {
                this.core.api.removeUserFromGroup(item.name, item.groups[i].name);
            }
            sleep(1000)
        }
        this.core.api.deleteUser(item.name, function() {
            if (me.core.removeModel('users', item.name, 'name')) me.invalidate(); else me.refresh();
        });
    },

    renameUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Rename User', [{label: "New User Name", value: item.name} , {label: "New Path", value: item.path} ]);
        if (!values) return;
        this.core.api.updateUser(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() {
            me.core.updateModel('users', item.name, 'name', values[0], 'path', values[1]);
            me.invalidate();
        })
    },

    setPassword: function(update)
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Set Password', [{ label: "New Password", type: "password" }, { label: "Retype Password", type: "password" }]);
        if (!values) return;
        if (values[0] != values[1]) {
            return alert('New entered passwords mismatch')
        }
        if (update) {
            this.core.api.updateLoginProfile(item.name, values[0], function() { })
        } else {
            this.core.api.createLoginProfile(item.name, values[0], function() { item.loginProfileDate = new Date(); })
        }
    },

    changePassword: function()
    {
        var values = this.core.promptInput('Change AWS Console Password',
                                [{ label: "Old Password", type: "password" },
                                 { label: "New Password", type: "password" },
                                 { label: "Retype Password", type: "password" }]);
        if (!values) return;
        if (values[1] != values[2]) {
            return alert('New entered passwords mismatch')
        }
        return
        this.core.api.changePassword(values[0], values[1], function() { alert("AWS Console password has been changed") })
    },

    deletePassword: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete password for user " + item.name + "?")) return;
        this.core.api.deleteLoginProfile(item.name, function() {
            item.loginProfileDate = null;
        });
    },

    addGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var list = this.core.queryModel('groups');
        var idx = this.core.promptList("Group", "Select group to add this user to", list, {columns: ["name"] });
        if (idx < 0) return;
        this.core.api.addUserToGroup(item.name, list[idx].name, function() {
            item.groups = null;
            me.selectionChanged();
        });
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Add Policy', [{label:"Policy name",type:"name",required:1},
                                                          {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1},
                                                          {label:"Policy Types",type:"menulist",list:this.core.getPolicyTypes(),required:1,onselect:"rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
        if (!values) return;
        this.core.api.putUserPolicy(item.name, values[0], values[1], function() {
            item.policies = null;
            me.selectionChanged();
        });
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return this.addPolicy();
        }
        var idx = 0;

        if (item.policies.length > 1) {
            idx = this.core.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        this.core.api.getUserPolicy(item.name, item.policies[idx], function(doc) {
            var values = me.core.promptInput('Edit Policy', [{label:"Policy name",type:"label",required:1,value:item.name},
                                                             {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1,value:doc},
                                                             {label:"Policy Types",type:"menulist",list:me.core.getPolicyTypes(),onselect:"if(rc.items[2].obj.value)rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
             if (!values) return;
             me.core.api.putUserPolicy(item.name, item.policies[idx], values[1]);
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
            idx = this.core.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete policy ' + item.policies[idx] + '?')) return;
        }
        this.core.api.deleteUserPolicy(item.name, item.policies[idx], function() {
            item.policies = null;
            me.selectionChanged();
        });
    },

    createAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.createAccessKey(item.name, function(key) {
            item.accessKeys = null;
            me.selectionChanged();
            ew_AccessKeysTreeView.showAccessKey(key.id, key.secret);
        });
    },

    deleteAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.accessKeys || !item.accessKeys.length) {
            return alert('No access keys');
        }
        var idx = 0;

        if (item.accessKeys.length > 0) {
            idx = this.core.promptList("Access Key", "Select access key to delete", item.accessKeys);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete access key ' + item.accessKeys[idx] + '?')) return;
        }
        this.core.api.deleteAccessKey(item.accessKeys[idx].id, item.name, function() {
            item.accessKeys = null;
            me.selectionChanged();
        });
    },

    createCredentials: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (item.accessKeys && item.accessKeys.length >= 2) {
            return alert(item.name + ' already have ' + item.accessKeys.length + ' regular Access Keys, Please delete one key in order to create new credentials.');
        }
        var inputs = [ {label:"Credentials name",type:"name",required:1,value:item.name} ];
        var values = this.core.promptInput('Create Credentials', inputs);
        if (!values) return;

        me.core.api.createAccessKey(item.name, function(key) {
            me.core.createCredentials(values[0], key);
        });
    },

    createTempCredentials: function()
    {
        var item = this.getSelected();
        this.core.createTempCredentials(item);
    },

    createVMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var mfa = this.core.findModel('vmfas', item.name, 'name');
        if (mfa) {
            this.enableMFA(mfa.id);
        }

        this.core.api.createVirtualMFADevice(item.name, null, function(obj) {
            var png = "data:image/png;base64," + obj.qrcode;
            values = me.core.promptInput('Activate MFA device', [{label:"Serial",value:obj.id,type:'label'}, {label:"QRCode",value:png,type:'image',fixed:true,minheight:300,maxheight:300,minwidth:300,maxwidth:300,height:300,width:300}, {label:"Secret Key",value:obj.seed,type:'label'}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
            if (!values) return;
            me.core.api.enableMFADevice(item.name, obj.id, values[3], values[4], function() {
                item.mfaDevices = null;
                me.selectionChanged();
            });
        });
    },

    enableMFA: function(serial)
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Activate MFA device', [{label:"Serial Number",value:serial || "",required:1}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.enableMFADevice(item.name, values[0], values[1], values[2], function() {
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

    resyncMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.mfaDevices || !item.mfaDevices.length) {
            return alert('No devices to resync');
        }
        var values = this.core.promptInput('Resync MFA device', [{label:"Serial Number",required:1}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.resyncMFADevice(item.name, values[0], values[1], values[2], function() {
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

    deactivateMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.mfaDevices || !item.mfaDevices.length) {
            return alert('No device to delete');
        }

        if (item.mfaDevices.length > 0) {
            idx = this.core.promptList("MFA Device", "Select device to deactivate", item.mfaDevices);
            if (idx < 0) return;
        } else {
            if (!confirm('Deactivate MFA device ' + item.mfaDevices[idx] + '?')) return;
        }
        this.core.api.deactivateMFADevice(item.name, item.mfaDevices[idx].id, function() {
            // Remove Virtual MFA device
            if (item.mfaDevices[idx].id.indexOf('arn:aws') == 0) {
                me.core.api.deleteVirtualMFADevice(item.mfaDevices[idx].id);
            }
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

};


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
            this.core.api.getGroup(item.name, function(group) { ew_GroupUsersTreeView.display(group.users); });
        }
        if (!item.policies) {
            this.core.api.listGroupPolicies(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var users = this.core.queryModel('users');
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
        var idx = this.core.promptList("User name", "Select user to add to " + item.name, list);
        if (idx < 0) return;
        this.core.api.addUserToGroup(users[idx].name, item.name, function() {
            item.users = null;
            users[idx].groups = null;
            me.invalidate();
        });
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var user = ew_GroupUsersTreeView.getSelected()
        if (!user) return;
        if (!confirm("Remove user " + user.name + " from group " + item.name + "?")) return;
        this.core.api.removeUserFromGroup(user.name, item.name, function() {
            item.users = null;
            user.groups = null;
            me.invalidate();
        });
    },

    addGroup: function()
    {
        var me = this;
        var values = this.core.promptInput('Create Group', [{label:"Group Name",required:1}, {label:"Path"}]);
        if (values) {
            this.core.api.createGroup(values[0], values[1], function(group) {
                me.core.addModel('groups', group);
                me.invalidate();
                me.select(group);
            })
        }
    },

    deleteGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete group?")) return;
        this.core.api.deleteGroup(item.name, function() {
            me.core.removeModel('groups', item.name, 'name');
            me.invalidate();
        });
    },

    renameGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Rename Group', [{label:"New Group Name"}, {label:"New Path"}], [ item.name, item.path ]);
        if (!values) return;
        this.core.api.updateGroup(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() {
            me.core.updateModel('groups', item.name, 'name', values[0], 'path', values[1]);
            me.invalidate();
        })
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Add Policy', [{label:"Policy name",type:"name",required:1},
                                                          {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1},
                                                          {label:"Policy Types",type:"menulist",list:this.core.getPolicyTypes(),required:1,onselect:"rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
        if (!values) return;
        this.core.api.putGroupPolicy(item.name, values[0], values[1], function() {
            item.policies = null;
            me.invalidate();
        });
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return this.addPolicy();
        }
        var idx = 0;
        if (item.policies.length > 1) {
            idx = this.core.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        this.core.api.getGroupPolicy(item.name, item.policies[idx], function(doc) {
            var values = me.core.promptInput('Edit Policy', [{label:"Policy name",type:"label",required:1,value:item.name},
                                                             {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1,value:doc},
                                                             {label:"Policy Types",type:"menulist",list:me.core.getPolicyTypes(),onselect:"if(rc.items[2].obj.value)rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
             if (!values) return;
             me.core.api.putGroupPolicy(item.name, item.policies[idx], values[1]);
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
            idx = this.core.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else
        if (!confirm('Delete policy ' + item.policies[idx])) return;

        this.core.api.deleteGroupPolicy(item.name, item.policies[idx], function() {
            item.policies = null;
            me.selectionChanged();
        });
    },
};


var ew_GroupUsersTreeView = {
    name: "groupUsers",

    selectionChanged: function()
    {
        var item = this.getSelected();
        if (!item) return;
        // Non visible views do not get updates so if we never show users list we need to update manually
        if (ew_UsersTreeView.rowCount > 0) {
            ew_UsersTreeView.select(item);
        } else {
            var user = this.core.findModel('users', item.id);
            if (user) {
                ew_UsersTreeView.updateUser(user);
            }
        }
    },
};

var ew_RolesTreeView = {
   model: [ "roles", "instanceProfiles" ],

   menuChanged: function() {
       var item = this.getSelected();
       $("ew.roles.contextmenu.delete").disabled = !item;
       $("ew.roles.contextmenu.addPolicy").disabled = !item;
       $("ew.roles.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
       $("ew.roles.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
   },

   selectionChanged: function()
   {
       var me = this;
       var item = this.getSelected();
       if (!item) return;

       if (!item.policies) {
           this.core.api.listRolePolicies(item.name, function(list) { me.menuChanged() })
       }
       if (!item.instanceProfiles) {
           this.core.api.listInstanceProfilesForRole(item.name, function(list) { me.menuChanged() })
       }
   },

   addRole: function()
   {
       var me = this;
       var policy = formatJSON('{"Statement":[{"Principal":{"Service":["ec2.amazonaws.com"]},"Effect":"Allow","Action":["sts:AssumeRole"]}]}');
       var values = this.core.promptInput('Create Role', [{label: "Role Name",required:1},
                                                          {label: "Path"},
                                                          {label:"Assumed Role Policy",multiline:true,rows:10,cols:50,required:1,value:policy} ]);
       if (values) {
           this.core.api.createRole(values[0], values[1], values[2], function(role) {
               me.core.api.createInstanceProfile(values[0], "", function(profile) {
                   me.core.api.addRoleToInstanceProfile(profile.name, role.name, function() {
                       me.refresh();
                   });
               });
           })
       }
   },

   deleteRole: function()
   {
       var me = this;
       var item = this.getSelected();
       if (!item) return;
       if (!confirm("Delete role?")) return;
       if (item.instanceProfiles) {
           for (var i in item.instanceProfiles) {
               this.core.api.removeRoleFromInstanceProfile(item.instanceProfiles[i].name, item.name, function() {
                   me.core.api.deleteInstanceProfile(item.instanceProfiles[i].name);
               });
           }
           sleep(1000)
       }
       if (item.policies) {
           for (var i in item.policies) {
               this.core.api.deleteRolePolicy(item.name, item.policies[i]);
           }
           sleep(1000)
       }
       this.core.api.deleteRole(item.name, function() {
           if (me.core.removeModel('roles', item.id)) me.invalidate(); else me.refresh();
       });
   },

   addPolicy: function()
   {
       var me = this;
       var item = this.getSelected();
       if (!item) return;
       var values = this.core.promptInput('Add Policy', [{label:"Policy name",type:"name",required:1},
                                                         {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1},
                                                         {label:"Policy Types",type:"menulist",list:this.core.getPolicyTypes(),required:1,onselect:"rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
       if (!values) return;
       this.core.api.putRolePolicy(item.name, values[0], values[1], function() {
           item.policies = null;
           me.selectionChanged();
       });
   },

   editPolicy: function()
   {
       var me = this;
       var item = this.getSelected();
       if (!item || !item.policies || !item.policies.length) {
           return this.addPolicy();
       }
       var idx = 0;

       if (item.policies.length > 1) {
           idx = this.core.promptList("Policy", "Select policy to edit", item.policies);
           if (idx < 0) return;
       }

       this.core.api.getRolePolicy(item.name, item.policies[idx], function(doc) {
           var values = me.core.promptInput('Edit Policy', [{label:"Policy name",type:"label",required:1,value:item.name},
                                                           {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1,value:doc},
                                                           {label:"Policy Types",type:"menulist",list:me.core.getPolicyTypes(),onselect:"if(rc.items[2].obj.value)rc.items[1].obj.value=formatJSON(rc.items[2].obj.value)"}]);
           if (!values) return;
           me.core.api.putRolePolicy(item.name, item.policies[idx], values[1]);
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
           idx = this.core.promptList("Policy", "Select policy to delete", item.policies);
           if (idx < 0) return;
       } else {
           if (!confirm('Delete policy ' + item.policies[idx] + '?')) return;
       }
       this.core.api.deleteRolePolicy(item.name, item.policies[idx], function() {
           item.policies = null;
           me.selectionChanged();
       });
   },

};

var ew_KeypairsTreeView = {
    model: ["keypairs", "mfas"],

    createKeypair : function ()
    {
        if (this.core.isGovCloud()) {
            alert("This function is disabled in GovCloud region")
            return
        }
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        this.core.api.createKeypair(name, function(keypair) {
            // Save key in the file
            var file = me.core.getPrivateKeyFile(name);
            var fp = FileIO.open(file)
            FileIO.write(fp, keypair.material + "\n\n", "");
            me.refresh();
            me.core.alertDialog('Keypair Created', 'KeyPair ' + name + ' is saved in the ' + file);
        });
    },

    importKeypair : function ()
    {
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        // Create new private key file using openssl and return key value
        var file = this.core.promptForFile("Select the public key file to upload:")
        if (file) {
            var body = readPublicKey(file)
            if (body == '') {
                return alert('Unable to read public key file ' + file);
            }
            this.core.api.importKeypair(name, body, function() { me.refresh() });
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

        if (!this.core.getKeyHome()) {
            var file = this.core.promptForDir("Choose where to store keys and certificate or Cancel to use " + this.core.getKeyHome(), true)
            if (file) {
                this.setStrPrefs("ew.key.home", file);
            }
        }

        // Create new certificate file using openssl and return cert value
        var body = this.core.generateCertificate(name);
        if (!body) {
            return alert("Could not create certificate and key pair files");
        }
        // For signing in command line tools we need at least one certificate
        if (uploadCert) {
            ew_CertsTreeView.upload(body, user);
        }

        // Import new public key as new keypair
        var file = this.core.getPublicKeyFile(name);
        var pubkey = readPublicKey(file);
        if (pubkey == '') {
            return alert('Unable to read public key file ' + file);
        }
        this.core.api.importKeypair(name, pubkey, function() {me.refresh();});
    },

    deleteSelected  : function ()
    {
        var keypair = this.getSelected();
        if (keypair == null) return;
        if (!confirm("Delete key pair "+keypair.name+"?")) return;
        var me = this;
        this.core.api.deleteKeypair(keypair.name, function() {me.refresh();});
    },

};


var ew_AccessKeysTreeView = {
    model: ["accesskeys", "mfas"],
    properties: ["state"],

    activate: function()
    {
        TreeView.activate.call(this);
        this.select({ id: this.core.accessKey });
    },

    isEmpty: function()
    {
        var count = 0;
        for (var i in this.treeList) count += this.treeList[i].status == "" ? 1 : 0;
        return count == 0;
    },

    filter: function(list)
    {
        list = list.concat(this.core.getTempKeys());

        var nlist = [];
        var now = new Date();
        for (var i in list) {
            list[i].state = this.core.api.accessKey == list[i].id ? "Current" : "";
            if (list[i].status == "Temporary" && list[i].expire < now) {
                list[i].state = "Expired";
                if (now.getTime() - list[i].expire.getTime() > 86400 * 1000) {
                    this.core.deleteTempKey(list[i]);
                    continue;
                }
            }
            nlist.push(list[i]);
        }
        return TreeView.filter.call(this, nlist);
    },

    createTemp: function()
    {
        var me = this;
        var script= "rc.items[3].obj.disabled=rc.items[4].obj.disabled=(rc.items[0].obj.value=='Session');"
        var inputs = [ {label:"Type",type:"menulist",list:["Session","Federation"],required:1,oncommand:script},
                       {label:"Duration(sec)",type:"number",min:3600,max:3600*36},
                       {label:"Federation user",type:"section"},
                       {label:"User name",type:"name",disabled:true},
                       {label:"Policy",multiline:true,cols:50,rows:10,disabled:true}, ];

        var mfas = this.core.queryModel("mfas");
        if (mfas && mfas.length) {
            script += "rc.items[6].obj.disabled=rc.items[7].obj.disabled=(rc.items[0].obj.value!='Session');"
            inputs.push({label:"Session token with MFA access",type:"section"});
            inputs.push({label:"MFA Device",type:"menulist",list:mfas});
            inputs.push({label:"MFA Auth Code"});
        }

        var values = this.core.promptInput('Create Temporary Security Token', inputs);
        if (!values) return;
        switch (values[0]) {
        case 'Session':
            this.core.api.getSessionToken(values[1], values[6], values[7], null, function(key) {
                me.core.saveTempKeys(me.core.getTempKeys().concat([ key ]));
                me.refresh();
            });
            break;

        case 'Federation':
            this.core.api.getFederationToken(values[1], values[3], values[4], function(key) {
                me.core.saveTempKeys(me.core.getTempKeys().concat([ key ]));
                me.refresh();
            });
            break;
        }
    },

    selectionChanged: function()
    {
        var key = this.getSelected();
        if (key == null || key.secret) return;
        TreeView.selectionChanged.call(this);
    },

    showAccessKey: function(key, secret)
    {
        var values = this.core.promptInput("Access Key", [{label:"Access Key Id",readonly:true,value:key},
                                                          {label:"Access Secret Key",readonly:true,value:secret},
                                                          {label:"Actions",type:"section"},
                                                          {label:"Save to file:",type:"checkbox"},
                                                          {label:"Temporary use as current credentials",type:"checkbox"},
                                                          {label:"Save as current credentials",type:"checkbox"}]);
        if (!values) return;
        if (values[3]) {
            var file = this.core.promptForFile("File to save the access key", true, "AWSCredentials.txt");
            if (file) this.core.saveAccessKey(file, { id: key, secret: secret });
        }
        if (values[4]) {
            this.core.api.setCredentials(key, secret);
        }
        if (values[5]) {
            this.core.updateCredentials(this.core.getActiveCredentials(), key, secret);
        }
    },

    createAccessKey : function () {
        var me = this;
        this.core.api.createAccessKey(null, function(key) {
            me.refresh()
            me.showAccessKey(key.id, key.secret);
        });
    },

    deleteSelected  : function () {
        var key = this.getSelected();
        if (!key) return;
        if (this.core.api.accessKey == key.id) {
            alert("You cannot delete current access key")
            return;
        }
        if (!this.core.promptYesNo("Confirm", "Delete access key "+key.id+"?")) return;

        if (key.status == "Temporary") {
            this.core.deleteTempKey(key);
            this.refresh();
            return;
        }

        var me = this;
        this.core.api.deleteAccessKey(key.id, null, function() {
            me.core.deletePassword('AccessKey:' + key.id)
            me.refresh();
        });
    },

};

var ew_CertsTreeView = {
    model: "certs",

    createCert : function () {
        var me = this;
        var body = this.core.generateCertificate();
        if (body) {
            this.upload(body);
            alert('The certificate has been generated and will be uploaded shortly...')
        } else {
            alert("Could not generate new X509 certificate")
        }
    },

    upload: function(body, user)
    {
        // Delay to avoid "not valid yet" error due to clock drift
        var me = this;
        setTimeout(function() { me.core.api.uploadSigningCertificate(user, body, function() { me.refresh();}); }, 30000);
    },

    uploadCert : function (user) {
        var me = this;
        var file = this.core.promptForFile("Select the certificate file to upload:")
        if (file) {
            var body = FileIO.toString(file);
            this.core.api.uploadSigningCertificate(user, body, function() { me.refresh(); });
        }
    },

    saveCert : function () {
        var item = this.getSelected();
        if (item == null) return;
        var file = this.core.promptForFile("Select the file to save certificate to:", true, DirIO.fileName(this.core.getCertificateFile(item.userName)))
        if (file) {
            FileIO.write(FileIO.open(file), item.body);
        }
    },

    deleteCert  : function () {
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete certificate "+item.id+"?")) return;

        var me = this;
        this.core.api.deleteSigningCertificate(item.id, function() { me.refresh(); });
    },
};

var ew_ServerCertsTreeView = {
    model: "serverCerts",

    createCert : function () {
        var me = this;
        var values = this.core.promptInput("Server Certificate", [{label:"Certificate Name (must be unique):",required:1},{label:"Path"}]);
        if (!values) return;
        var body = this.core.generateCertificate(values[0]);
        if (!body) return alert("Could not generate new X509 certificate");
        var pkey = FileIO.toString(this.getPrivateKeyFile(values[0]));
        if (!pkey) return alert("Could not read provate key file");
        alert('The server certificate ' + values[0] + ' was created and will be uploaded within 30 seconds to avoid errors related to difference between AWS server and your computer clocks...');

        setTimeout(function() { this.core.api.uploadServerCertificate(values[0], body, pkey, values[1], null, function() { me.refresh() }); }, 30000);
    },

    uploadCert : function (user) {
        var me = this;
        var values = this.core.promptInput("Server Certificate", [{label:"Certificate Name (must be unique):",required:1},{label:"Path"},{label:"Certificate PEM file",type:"file",required:1},{label:"Private Key PEM file:",type:"file",required:1},{label:"Certificate chain PEM file:",type:"file"}]);
        if (!values) return;
        var body = FileIO.toString(values[2]);
        var pkey = FileIO.toString(values[3]);
        var chain = FileIO.toString(values[4]);
        this.core.api.uploadServerCertificate(values[0], body, pkey, values[1], chain, function() { me.refresh(); });
    },

    saveCert : function () {
        var item = this.getSelected();
        if (item == null) return;
        var file = this.core.promptForFile("Select the file to save certificate to:", true, item.name + ".pem");
        if (file) {
            this.core.api.getServerCertificate(item.name, function(obj) {
                FileIO.write(FileIO.open(file), obj.body);
            });
        }
    },

    deleteCert  : function () {
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete certificate "+item.id+"?")) return;

        var me = this;
        this.core.api.deleteServerCertificate(item.name, function() { me.refresh(); });
    },
};

var ew_VMFATreeView = {
    model: ["vmfas", "users"],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.vmfas.contextmenu.delete').disabled = item == null;
        $('ew.vmfas.contextmenu.assign').disabled = !item || item.userName;
        $('ew.vmfas.contextmenu.unassign').disabled = !item || !item.userName;
    },

    addDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Create Virtual MFA device', [{label:"Device Name",required:1}, {label:"Device Path"}]);
        if (!values) return;
        this.core.api.createVirtualMFADevice(values[0], values[1], function(obj) {
            me.refresh()
            var png = "data:image/png;base64," + obj.qrcode;
            me.core.promptInput('New Virtual MFA device', [{label:"Serial",value:obj.id,type:'label'}, {label:"QRCode",value:png,type:'image',fixed:true,minheight:300,maxheight:300,minwidth:300,maxwidth:300,height:300,width:300}, {label:"Secret Key",value:obj.seed,type:'label'}]);
        });
    },

    deleteDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Virtual MFA device ' + item.id)) return;
        this.core.api.deleteVirtualMFADevice(item.id, function(){ me.refresh() });
    },

    assignDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || item.userName) return;
        var users = this.core.queryModel('users');
        var idx = this.core.promptList("User name", "Select user to assign this device to", users);
        if (idx < 0) return;
        var values = this.core.promptInput('Assign MFA device', [{label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.enableMFADevice(users[idx].name, item.id, values[0], values[1], function() { me.refresh() });
    },

    unassignDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.userName) return;
        if (!confirm('Deactivate MFA device from user ' + item.userName)) return;
        this.core.api.deactivateMFADevice(item.userName, item.id, function() { me.refresh() });
    },
};

var ew_PasswordPolicyView = {
    obj: null,
    rowCount: 0,

    activate: function() {
        this.refresh();
    },

    refresh: function() {
        var me = this;
        this.core.api.getAccountPasswordPolicy(function(obj) {
            me.obj = obj;
            for (var p in obj) {
                var e = $('ew.' + p);
                if (!e) continue;
                if (e.tagName == 'textbox') e.value = obj[p]; else e.checked = obj[p] == "true";
            }
            $("ew.DisableAccountPasswordPolicy").hidden = obj.disabled;
            $("ew.SaveAccountPasswordPolicy").setAttribute('label', obj.disabled ? "Enable and Save" : "Save");
        });
    },

    deactivate: function() {
    },

    display: function() {
    },

    invalidate: function() {
    },

    disable: function()
    {
        var me = this;
        if (!confirm('Disable account password policy?')) return;
        this.core.api.deleteAccountPasswordPolicy(function() { me.refresh() });
    },

    save: function() {
        for (var p in this.obj) {
            var e = $('ew.' + p)
            if (!e) continue;
            this.obj[p] = e.tagName == 'textbox' ? e.value : e.checked;
        }
        this.core.api.updateAccountPasswordPolicy(this.obj, function() { alert('Password policy has been updated') });
    },
};

var ew_AccountSummaryView = {
    rowCount: 0,

    activate: function() {
        this.refresh();
    },

    refresh: function() {
        var me = this;
        var e = $('ew.iam.accountId').value = this.core.user.accountId || "";
        this.core.api.listAccountAliases(function(alias) {
            $('ew.iam.alias').value = alias || "Not set";
            $('ew.iam.alias.create').label = alias == "" ? "Create Alias" : "Change Alias";
            $('ew.iam.alias.create').hidden = false;
            $('ew.iam.alias.delete').hidden = alias == "";
            $('ew.iam.console').value = alias != "" ? "https://" + alias + ".signin.aws.amazon.com/console" : "Not Set";
            $('ew.iam.console').setAttribute("style", alias != "" ? "color:blue" : "color:black");
        });
        this.core.api.getAccountSummary(function(list) {
            for (var i in list) {
                var e = $('ew.iam.' + list[i].key);
                if (!e) continue;
                switch (list[i].key) {
                case "AccountMFAEnabled":
                    list[i].value = list[i].value == "1" ? "Yes" : "No";
                    break;
                }
                e.value = list[i].value;
            }
        });
    },

    deactivate: function() {
    },

    display: function() {
    },

    invalidate: function() {
    },

    showConsole: function()
    {
        var url = $('ew.iam.console').value;
        if (url.indexOf("https://") == 0) this.core.displayUrl(url);
    },

    createAlias: function()
    {
        var name = prompt('Account alias:');
        if (!name) return;
        this.core.api.createAccountAlias(name, function() { me.refresh() });
    },

    deleteAlias: function()
    {
        var me = this;
        if (!confirm('Delete account alias?')) return;
        this.core.api.deleteAccountAlias(('ew.iam.alias').value, function() { me.refresh() });
    },

};

var ew_CredentialsTreeView = {
     name: "credentials",
     properties: ["status"],

     activate : function()
     {
         this.refresh();
         TreeView.activate.call(this);
         this.select(this.core.getActiveCredentials());
         // Manually retrieve thses models
         this.core.queryModel('mfas');
         this.core.queryModel('accesskeys');
     },

     deactivate: function()
     {
         if (this.core.getActiveCredentials() == null) {
             this.switchCredentials();
         }
         TreeView.activate.call(this);
     },

     getList: function()
     {
         return this.core.getCredentials()
     },

     createTempCredentials: function()
     {
         // No keys retrieved yet, wait a little
         for (var i = 0; this.core.getModel('accesskeys') == null && i < 3; i++) {
             sleep(1000);
         }
         var item = { name: null, mfaDevices: this.core.getModel('mfas'), accessKeys: this.core.getModel('accesskeys') };
         this.core.createTempCredentials(item);
     },

     addCredentials : function()
     {
         var user = this.core.getEnv("USER", this.core.getEnv("USERNAME"));
         var values = this.core.promptInput('Create new access credentials', [{label:"Name:",required:1,size:45,value:user}, {label:"AWS Access Key:",required:1,size:45}, {label:"AWS Secret Access Key:",type:'password',required:1,size:45}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.core.getEndpoints(),key:'url'}, {label:"Security Token:",multiline:true,rows:3,cols:45}]);
         if (!values) return;
         var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
         this.core.saveCredentials(cred);
         this.invalidate();
     },

     editCredentials : function()
     {
         var cred = this.getSelected();
         if (!cred) return;
         var values = this.core.promptInput('Credentials', [{label:"Credentials Name:",required:1,value:cred.name,size:45}, {label:"AWS Access Key:",required:1,value:cred.accessKey,size:45}, {label:"AWS Secret Access Key:",type:'password',required:1,value:cred.secretKey,size:45}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.core.getEndpoints(),key:'url',value:cred.url}, {label:"Security Token:",multiline:true,rows:3,cols:45,value:cred.securityToken}]);
         if (!values) return;
         this.core.removeCredentials(cred);
         var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
         this.core.saveCredentials(cred);
         this.invalidate();
     },

     deleteCredentials : function()
     {
         var cred = this.getSelected();
         if (!cred) return;
         if (!confirm("Delete credentials " + cred.name)) return;
         this.core.removeCredentials(cred)
         this.invalidate();
     },

     filter: function(list)
     {
         var now = (new Date()).getTime();
         for (var i in list) {
             list[i].status = list[i].accessKey == this.core.api.accessKey ? "Active" : "";
             if (list[i].type == "Temporary") {
                 if (list[i].expire < now) list[i].status = "Expired";
             }
         }
         return TreeView.filter.call(this, list);
     },

     switchCredentials: function()
     {
         var cred = this.getSelected();
         if (!cred) return;
         this.core.switchCredentials(cred);
         this.invalidate();
         ew_EndpointsTreeView.invalidate();
     },

     runShell: function()
     {
         var cred = this.getSelected();
         this.core.launchShell(cred);
     },
};

var ew_EndpointsTreeView = {
     name: "endpoints",
     properties: ["status"],

     activate : function()
     {
         TreeView.activate.call(this);
         this.select(this.core.getActiveEndpoint());
     },

     refresh: function()
     {
         this.core.refreshEndpoints();
         this.invalidate();
     },

     getList: function()
     {
         return this.core.getEndpoints();
     },

     switchEndpoint : function() {
         var item = this.getSelected();
         if (!item) return;
         var active = this.core.getActiveEndpoint();

         if (item.url != active.url) {
             if (this.core.isGovCloud()) {
                 return this.core.alertDialog("Credential Error", 'Cannot use GovCloud credentials in commercial regions.');
             }
             if (this.core.isGovCloud(item.url)) {
                 return this.core.alertDialog("Credential Error", 'Cannot use non-Govcloud credentials in GovCloud.');
             }
         }
         this.core.switchEndpoints(item.name);
         this.invalidate();
     },

     deleteEndpoint : function() {
         var item = this.getSelected();
         if (!item) return;
         if (!confirm('Delete endpoint ' + item.name)) return;
         this.core.deleteEndpoint(item.name);
         this.refresh();
     },

     addEndpoint: function(name, url) {
         var url = prompt("Enter endpoint URL:");
         if (!url) return;
         var endpoint = new Endpoint(null, url)
         this.core.addEndpoint(endpoint.name, endpoint);
         this.refresh();
     },

     filter: function(list)
     {
         for (var i in list) {
             list[i].status = list[i].url == this.core.api.urls.EC2 ? "Active" : "";
         }
         return TreeView.filter.call(this, list);
     },
}


