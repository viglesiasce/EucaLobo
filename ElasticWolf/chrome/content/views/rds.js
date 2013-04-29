//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_DBSnapshotsTreeView = {
    model: [ "dbsnapshots", "dbinstances","dbengines","dboptions","dbparameters","dbsubnets","dbgroups",'availabilityZones'],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.dbsnapshots.contextmenu.delete").disabled = !item;
        $("ew.dbsnapshots.contextmenu.restoreSnapshot").disabled = !item;
    },

    addItem: function(instance)
    {
        var me = this;
        var values = this.core.promptInput("Snapshot", [{label:"DB Instance",type:"menulist",list:this.core.queryModel("dbinstances"),required:1,value:instance ? instance.id : ""},
                                                        {label:"DB Snapshot Identifier",type:"name",required:1}]);
        if (!values) return;
        this.core.api.createDBSnapshot(values[0], values[1], function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteDBSnapshot(item.id, function() { me.refresh(); });
    },

    restoreSnapshot: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        // TODO: decide if the following unused variables should be used or deleted
        var snapshots = this.core.queryModel("dbsnapshots");
        var engines = this.core.queryModel("dbengines");
        var options = this.core.queryModel("dboptions");
        var dbparams = this.core.queryModel("dbparameters");
        var dbsubnets = this.core.queryModel("dbsubnets");
        var dbgroups = this.core.queryModel('dbgroups');

        function onaccept() {
            var options = {};
            var inputs = this.rc.items;
            var values = this.rc.values;
            for (var i = 0; i < inputs.length; i++) {
                if (values[i]) options[inputs[i].label.replace(" ", "")] = values[i];
            }
            me.core.api.restoreDBInstanceFromDBSnapshot(values[1], values[0], options, function() { me.refresh(); });
            return 1;
        }

        function onchange(idx, onstart) {
            // Validation
            var item = this.rc.items[idx];
            switch (item.label) {
            case 'Engine':
                var engine = me.core.findModel('dbengines', item.obj.value, 'name');
                var list = engine && engine.orderableOptions ? engine.orderableOptions : (engine ? me.core.api.describeOrderableDBInstanceOptions(engine.name) : []);
                var dbclass = input.rc.items[idx+1].obj.value;
                buildListbox(input.rc.items[idx+1].obj, list, 'instanceClass');
                if (dbclass) input.rc.items[idx+1].obj.value = dbclass;
                if (engine) engine.orderableOptions = list;
                break;

            case "Availability Zone":
                this.rc.items[idx+1].obj.checked = false;
                break;

            case "Multi AZ":
                if (item.obj.checked) this.rc.items[idx-1].obj.value = "";
                break;
            }
        }

        var inputs = [{label:"Snapshot",readonly:true,value:item.id},
                      {label:"DB Instance Identifier",required:1,tooltiptext:"The DB Instance identifier. This parameter is stored as a lowercase string."},
                      {label:"Engine",type:"menulist",list:engines,key:"name",required:1,style:"max-width:350px"},
                      {label:"DB Instance Class",type:"menulist",required:1,style:"max-width:350px"},
                      {label:"DB Name",tooltiptext:"The meaning of this parameter differs according to the database engine you use.MySQL: The name of the database to create when the DB Instance is created. If this parameter is not specified, no database is created in the DB Instance. Constraints: Must contain 1 to 64 alphanumeric characters, Cannot be a word reserved by the specified database engine.Oracle:The Oracle System ID (SID) of the created DB Instance.Default: ORCL Constraints: Cannot be longer than 8 characters, SQL Server: Not applicable. Must be null."},
                      {label:"Port",type:"number",tooltiptext:"The port number on which the database accepts connections."},
                      {label:"Availability Zone",type:"menulist",list:this.core.queryModel('availabilityZones')},
                      {label:"Multi AZ",type:"checkbox",tooltiptext:"Specifies if the DB Instance is a Multi-AZ deployment. For Microsoft SQL Server, must be set to false. You cannot set the AvailabilityZone parameter if the MultiAZ parameter is set to true."},
                      {label:"Auto Minor Version Upgrade", type:"checkbox",tooltiptext:"Indicates that minor engine upgrades will be applied automatically to the DB Instance during the maintenance window."},
                      {label:"License Model",type:"menulist",list:['license-included','bring-your-own-license','general-public-license']},
                      {label:"DB Subnet Group Name",type:"menulist",list:dbsubnets,key:'name',tooltiptext:"A DB Subnet Group to associate with this DB Instance.If there is no DB Subnet Group, then it is a non-VPC DB instance."},
                      {label:"Option Group Name",type:"menulist",list:options,key:'name',tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."},
                      ];

        var values = this.core.promptInput("Restore from Snapshot", inputs, { onchange: onchange, onaccept: onaccept });
        if (!values) return;
    },

};

var ew_DBEventsTreeView = {
    model: [ "dbevents"],
};

var ew_DBEnginesTreeView = {
    model: [ "dbengines"],
};

var ew_DBSubnetGroupsTreeView = {
    model: [ "dbsubnets", "subnets", "vpcs"],

    addItem: function() {
        var me = this;
        var subnets = this.core.queryModel("subnets");
        this.core.sortObjects(subnets, ["vpcId", "cidrIp"]);
        var values = this.core.promptInput("Create Subnet Group",
                            [{label:"Group Name",required:1},
                             {label:"Description",required:1},
                             {label:"Subnet",type:"listview",list:subnets } ]);
        if (!values) return;
        this.core.api.createDBSubnetGroup(values[0],values[1],values[2],function() { me.refresh(); });
    },

    editItem: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var checked = [];
        item.subnets.forEach(function(x) { checked.push(me.core.findModel('subnets',x)); });
        var subnets = this.core.queryModel("subnets");
        this.core.sortObjects(subnets, ["vpcId", "cidrIp"]);
        var values = this.core.promptInput("Edit Subnet Group",
                            [{label:"Group Name",type:"label",value:item.name},
                             {label:"Description",required:1,value:item.descr},
                             {label:"Subnet",type:"listview",list:subnets,checkedItems: checked } ]);
        if (!values) return;
        this.core.api.modifyDBSubnetGroup(values[0],values[1],values[2],function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteDBSubnetGroup(item.name,function() { me.refresh(); });
    },
};

var ew_DBSecurityGroupsTreeView = {
    model: [ "dbgroups", "vpcs", "securityGroups"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.dbgroups.contextmenu.delete").disabled = !item;
        $("ew.dbgroups.contextmenu.addGroup").disabled = !item;
        $("ew.dbgroups.contextmenu.addCidr").disabled = !item;
        $("ew.dbgroups.contextmenu.deleteGroup").disabled = !item || !item.groups.length;
        $("ew.dbgroups.contextmenu.deleteCidr").disabled = !item || !item.ipRanges.length;
    },

    addItem: function() {
        var me = this;
        var vpcs = this.core.queryModel("vpcs");
        var values = this.core.promptInput("Create Security Group",
                            [{label:"Group Name",required:1},
                             {label:"Description",required:1},
                             {label:"VPC",type:"menulist",list:vpcs } ]);
        if (!values) return;
        this.core.api.createDBSecurityGroup(values[0],values[1],values[2],function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteDBSecurityGroup(item.name,function() { me.refresh(); });
    },

    authorizeCidr: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var cidr = this.core.prompt("Please enter CIDR:");
        if (!cidr) return;
        this.core.api.authorizeDBSecurityGroupIngress(item.name, null, cidr, function() { me.refresh(); });
    },

    revokeCidr: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.ipRanges.length) return;
        var idx = this.core.promptList("CIDR", "Select CIDR to delete", item.ipRanges);
        if (idx < 0) return;
        this.core.api.revokeDBSecurityGroupIngress(item.name, null, item.ipRanges[idx].CIDRIP, function() { me.refresh(); });
    },

    authorizeGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var groups = this.core.queryModel('securityGroups').filter(function(x) { return (item.vpcId && item.vpcId == x.vpcId) || (!item.vpcId && !x.vpcId); });
        var idx = this.core.promptList("CIDR", "Select Group to authorize", groups);
        if (idx < 0) return;
        var group = item.vpcId ? { id: groups[idx].id } : groups[idx];
        this.core.api.authorizeDBSecurityGroupIngress(item.name, group, null, function() { me.refresh(); });
    },

    revokeGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.groups.length) return;
        var idx = this.core.promptList("Groups", "Select group to delete", item.groups);
        if (idx < 0) return;
        // RDS uses lowercase for security groups, we use case sensitive match
        var group = this.core.queryModel('securityGroups').filter(function(x) { return x.name.toLowerCase() == item.groups[idx].EC2SecurityGroupName; });
        if (!group.length) return alert('Could not find group ' + item.groups[idx]);
        group = item.vpcId ? { id: group[0].id } : group[0];
        this.core.api.revokeDBSecurityGroupIngress(item.name, group, null, function() { me.refresh(); });
    },
};

var ew_DBOptionGroupsTreeView = {
    model: [ "dboptions", "dbengines", "dbgroups"],

    selectionChanged : function() {
        var item = this.getSelected();
        if (!item) return;
        ew_DBOptionGroupOptionsTreeView.display(item.options);
    },

    addItem: function()
    {
        var me = this;
        var engines = this.core.queryModel("dbengines");
        var values = this.core.promptInput("Create Option Group",
                                    [{label:"Group Name",required:1},
                                     {label:"Description",required:1},
                                     {label:"Engine",type:"menulist",list:engines,key:"name",required:1,style:"max-width:350px" } ]);
        if (!values) return;
        var engine = this.core.findModel('dbengines', values[2], 'engine');
        if (!engine) return;
        // Take major version as first octets
        var ver = engine.version.split(".").slice(0,2).join(".");
        this.core.api.createOptionGroup(values[0],values[1],engine.name,ver,function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteOptionGroup(item.name, function() { me.refresh(); });
    },
};

var ew_DBOptionGroupOptionsTreeView = {

    addItem: function()
    {
        var me = this;
        var group = ew_DBOptionGroupsTreeView.getSelected();
        if (!group) return;
        var engine = this.core.findModel('dbengines', group.engine, 'engine');
        var dbgroups = this.core.queryModel('dbgroups');
        var inputs = [ {label:"Options",type:"menulist",list:[],key:"name",required:1,callback: function(item, idx) {
                                var o = me.core.findObject(engine.options, item.obj.value, 'name') || {};
                                this.rc.items[idx+2].required = o.portRequired ? true : false;
                                this.rc.items[idx+2].obj.disabled = o.portRequired ? false : true;
                                this.rc.items[idx+2].obj.value = o.portRequired ? o.defaultPort : 0;
                            }
                        },
                       {label:"Apply immediately",type:"checkbox"},
                       {label:"Port:",type:"number",disabled:true},
                       {label:"DB Security Groups",type:"listview",list:dbgroups,flex:1,rows:5}];

        function addOption(list) {
            if (list) engine.options = list;
            if (!engine.options.length) return alert("No options available for " + engine);
            inputs[0].list = engine.options;
            var values = me.core.promptInput('Add an option', inputs);
            if (!values) return;
            var opt = { name: values[0], port: values[2], groups: values[3] };
            me.core.api.modifyOptionGroup(group.name, values[1], [opt], [], function() {
                group.options = null;
                ew_DBOptionGroupsTreeView.refresh();
            });
        }

        if (!engine.options) {
            this.core.api.describeOptionGroupOptions(group.engine, function(list) { addOption(list); });
        } else {
            addOption();
        }
    },

    deleteSelected : function()
    {
        var group = ew_DBOptionGroupsTreeView.getSelected();
        var item = this.getSelected();
        if (!item || !group) return;
        var check = {value: false};
        if (!this.core.promptConfirm("Delete option", "Delete " + item.name + " from " + group.name + "?", "Apply immediatley", check)) return;
        this.core.api.modifyOptionGroup(item.name, check.value, [], [item.name], function() { ew_DBOptionGroupsTreeView.refresh(); });
    },
};

var ew_DBParameterGroupsTreeView = {
    model: [ "dbparameters","dbengines"],

    selectionChanged : function() {
        var item = this.getSelected();
        if (!item) return;
        if (!item.parameters) {
            this.core.api.describeDBParameters(item.name, function(list) {
               item.parameters = list;
               ew_DBParameterGroupParametersTreeView.display(item.parameters);
            });
        } else {
            ew_DBParameterGroupParametersTreeView.display(item.parameters);
        }
    },

    addItem: function()
    {
        var me = this;
        var family = uniqueList(plainList(this.core.queryModel("dbengines"), "family"));
        var values = this.core.promptInput("Create Option Group",
                                    [{label:"Family",type:"menulist",list:family,required:1 } ,
                                     {label:"Group Name",required:1},
                                     {label:"Description",required:1} ]);
        if (!values) return;
        this.core.api.createDBParameterGroup(values[0],values[1],values[2],function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteDBParameterGroup(item.name, function() { me.refresh(); });
    },
};

var ew_DBParameterGroupParametersTreeView = {

    editItem: function() {
        var item = this.getSelected();
        var group = ew_DBParameterGroupsTreeView.getSelected();
        if (!item || !group) return;
        if (!item.isModifiable) return;
        var value = {label:"Value",value:item.value,required:1 };

        var inputs = [{label:"Name",type:"label",value:item.name },
                      {label:"Descr",type:"description",value:item.descr,width:350 },
                      {label:"Type",type:"label",value:item.type },
                      {label:"Min Version",type:"label",value:item.minVersion },
                      {label:"Apply Type",type:"label",value:item.applyType },
                      {label:"Allowed Values",type:"description",value:item.allowedValues },
                      {type:"separator"},
                      value];

        switch (item.type) {
        case "integer":
            value.type = "number";
            var d = item.allowedValues.match(/([0-9]+)-([0-9]+)/);
            if (d) {
                value.min = parseInt(d[1]);
                value.max = parseInt(d[2]);
            }
            break;
        case "boolean":
            value.type = "menulist";
            value.list = [0,1];
            inputs.splice(5, 1);
            break;
        case "string":
            if (item.allowedValues) {
                value.type = "menulist";
                value.list = item.allowedValues.split(",");
                inputs.splice(5, 1);
            }
            break;
        }

        var values = this.core.promptInput("Modify Parameter", inputs);
        if (!values) return;
        var params = [ { name: item.name, value: values[7], applyMethod: item.applyType == "dynamic" ? "immediate" : "pending-reboot"}];
        this.core.api.modifyDBParameterGroup(group.name, params, function() { ew_DBParameterGroupsTreeView.refresh(); });
    },

};

var ew_DBOfferingsTreeView = {
    model : ["dbofferings"],

    purchaseOffering : function()
    {
        var item = this.getSelected();
        if (!item) return;
        var button = 0;
        // Calc total price handler
        var price = "rc.items[12].obj.value=parseInt(rc.items[11].obj.value)*" + item.fixedPrice;
        while (button == 0) {
            var values = this.core.promptInput({ title: 'Purchase Instance', buttons: { accept: 'Next' } },
                    [{label:"Instance Details",type:"section"},
                     {label:"Offer ID",type:"label",value:item.id},
                     {label:"Instance Type",type:"label",value:item.dbInstanceClass},
                     {label:"Duration(years)",type:"label",value:item.duration},
                     {label:"Multi AZ",type:"label",value:item.multiAZ},
                     {label:"Offering Type",type:"label",value:item.offeringType},
                     {label:"Usage Price(US$)",type:"label",value:item.usagePrice},
                     {label:"Recuring Charges(US$)",type:"label",value:item.recurringCharges},
                     {label:"Product Description",type:"label",value:item.productDescription},
                     {label:"One Time Payment",type:"section"},
                     {label:"One time payment/Instance(US$)",type:"label",value:item.fixedPrice},
                     {label:"Number of instances",type:"number",size:6,required:1,min:0,oninput:price,onchange:price},
                     {label:"Total one time payment, due now (US$)",type:"label",value:item.fixedPrice} ]);

            if (!values || !parseInt(values[12])) return;
            // Ensure that the user actually wants to purchase this offering
            var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
            var flags = prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_0 + prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_1 + prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_2 + prompts.BUTTON_POS_0_DEFAULT;
            var msg = "You are about to purchase " + values[11] + " " + item.productDescription + " Reserved Instance(s) for $" + values[11] * parseInt(item.fixedPrice);
            msg = msg + ". Are you sure?\n\nAn email will be sent to you shortly after we receive your order.";
            button = prompts.confirmEx(window, "Confirm Reserved Instances Offering Purchase", msg, flags, "Edit Order", "Place Order", "", null, {});

            // Edit: 0, Purchase: 1, Cancel: 2
            if (button == 1) {
                this.core.api.purchaseReservedDBInstancesOffering(item.id, values[11], function(id) { ew_ReservedInstancesTreeView.refresh(); });
            }
        }
    },
};

var ew_ReservedDBInstancesTreeView = {
    model: ["dbreserved"],

    isRefreshable : function()
    {
        return this.treeList.some(function(x) { return x.state == "payment-pending"; });
    },

};

var ew_DBInstancesTreeView = {
    model: [ "dbinstances","dbengines","dbsnapshots","dboptions","dbparameters","dbsubnets","dbgroups",'availabilityZones'],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.dbinstances.contextmenu.delete").disabled = !item;
        $("ew.dbinstances.contextmenu.edit").disabled = !item;
        $("ew.dbinstances.contextmenu.reboot").disabled = !item;
        $("ew.dbinstances.contextmenu.snapshot").disabled = !item;
        $("ew.dbinstances.contextmenu.restoreTime").disabled = !item;
        $("ew.dbinstances.contextmenu.replica").disabled = !item;
    },

    isRefreshable : function()
    {
        return this.treeList.some(function(x) { return x.status == "modifying" || x.status == "deleting" || x.status == "creating" | x.status == "backing-up"; });
    },

    putInstance: function(edit)
    {
        var me = this;

        function onaccept() {
            var dialog = this;
            var options = {};
            var inputs = this.rc.items;
            var values = this.rc.values;
            var engine = me.core.findModel('dbengines', values[1], 'versionDescr');

            options.EngineVersion = values[2];
            for (var i = 0; i < inputs.length; i++) {
                if (values[i]) options[inputs[i].label.replace(/ /g, "")] = values[i];
            }
            if (edit) {
                me.core.api.modifyDBInstance(values[0],options,function() {
                    me.refresh();
                    dialog.close();
                });
            } else {
                me.core.api.createDBInstance(values[0],engine.name,values[3],values[4],values[5],values[6],options,function() {
                    me.refresh();
                    dialog.close();
                });
            }
            return true;
        }

        function onchange(idx, onstart) {
            var input = this;
            // Validation
            var item = this.rc.items[idx];
            switch (item.label) {
            case "Engine":
                var engine = me.core.findModel('dbengines', item.obj.value, 'versionDescr');
                debug(item.obj.value + ", " + engine);
                input.rc.items[idx+1].obj.value = engine ? engine.version : '';
                var list = engine && engine.orderableOptions ? engine.orderableOptions : (engine ? me.core.api.describeOrderableDBInstanceOptions(engine.name) : []);
                var dbclass = input.rc.items[idx+2].obj.value;
                buildListbox(input.rc.items[idx+2].obj, list, 'instanceClass');
                if (dbclass) input.rc.items[idx+2].obj.value = dbclass;
                buildListbox(input.rc.items[17].obj, engine ? engine.charsets : []);
                input.rc.items[17].obj.value = input.rc.items[17].value;
                if (engine) engine.orderableOptions = list;
                break;

            case "Availability Zone":
                this.rc.items[idx+1].obj.checked = false;
                break;

            case "Multi AZ":
                if (item.obj.checked) this.rc.items[idx-1].obj.value = "";
                break;
            }
        }
        var engines = this.core.queryModel("dbengines");
        var options = this.core.queryModel("dboptions");
        var dbparams = this.core.queryModel("dbparameters");
        var dbsubnets = this.core.queryModel("dbsubnets");
        var dbgroups = this.core.queryModel('dbgroups');

        var inputs = [{label:"DB Instance Identifier",required:1,tooltiptext:"The DB Instance identifier. This parameter is stored as a lowercase string."},
                      {label:"Engine",type:"menulist",list:engines,key:"versionDescr",required:1,style:"max-width:350px"},
                      {label:"Engine Version",readonly:true},
                      {label:"DB Instance Class",type:"menulist",required:1,style:"max-width:350px"},
                      {label:"Allocated Storage",type:"number",required:1,help:"GB",min:5,max:1024,tooltiptext:"The amount of storage (in gigabytes) to be initially allocated for the database instance.MySQL: from 5 to 1024. Oracle: from 10 to 1024. SQL Server from 200 to 1024 (Standard Edition and Enterprise Edition) or from 30 to 1024 (Express Edition and Web Edition)"},
                      {label:"Master User Name",required:1,tooltiptext:"The name of master user for the client DB Instance"},
                      {label:"Master Password",required:1,tooltiptext:"The password for the master database user."},
                      {label:"DB Name",tooltiptext:"The meaning of this parameter differs according to the database engine you use.MySQL: The name of the database to create when the DB Instance is created. If this parameter is not specified, no database is created in the DB Instance. Constraints: Must contain 1 to 64 alphanumeric characters, Cannot be a word reserved by the specified database engine.Oracle:The Oracle System ID (SID) of the created DB Instance.Default: ORCL Constraints: Cannot be longer than 8 characters, SQL Server: Not applicable. Must be null."},
                      {label:"Port",type:"number",tooltiptext:"The port number on which the database accepts connections."},
                      {label:"Availability Zone",type:"menulist",list:this.core.queryModel('availabilityZones')},
                      {label:"Multi AZ",type:"checkbox",tooltiptext:"Specifies if the DB Instance is a Multi-AZ deployment. For Microsoft SQL Server, must be set to false. You cannot set the AvailabilityZone parameter if the MultiAZ parameter is set to true."},
                      {label:"Auto Minor Version Upgrade", type:"checkbox",tooltiptext:"Indicates that minor engine upgrades will be applied automatically to the DB Instance during the maintenance window."},
                      {label:"DB Security Groups",type:"listview",list:dbgroups,flex:1,rows:5,tooltiptext:"The names of the security groups with which to associate Amazon EC2 or Amazon VPC instances. Specify Amazon EC2 security groups using security group names, such as websrv. Specify Amazon VPC security groups using security group IDs, such as sg-12345678.Cannot combine VPC and non-VPC security groups."},
                      {label:"License Model",type:"menulist",list:['license-included','bring-your-own-license','general-public-license']},
                      {label:"DB Subnet Group Name",type:"menulist",list:dbsubnets,key:'name',style:"max-width:350px;",tooltiptext:"A DB Subnet Group to associate with this DB Instance.If there is no DB Subnet Group, then it is a non-VPC DB instance."},
                      {label:"Option Group Name",type:"menulist",list:options,key:'name',tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."},
                      {label:"DB Parameter Group Name",type:"menulist",list:dbparams,key:'name',tooltiptext:"The name of the DB Parameter Group to associate with this DB instance. If this argument is omitted, the default DBParameterGroup for the specified engine will be used.Constraints:Must be 1 to 255 alphanumeric characters,First character must be a letter,Cannot end with a hyphen or contain two consecutive hyphens"},
                      {label:"Character Set Name",type:"menulist"},
                      {label:"Backup Retention Period",type:"number",value:1,min:0,max:35,tooltiptext:"The number of days for which automated backups are retained. Setting this parameter to a positive number enables backups. Setting this parameter to 0 disables automated backups. Cannot be set to 0 if the DB Instance is a master instance with read replicas."},
                      {label:"Preferred Backup Window",tooltiptext:"The daily time range during which automated backups are created if automated backups are enabled, using the BackupRetentionPeriod parameter.Constraints: Must be in the format hh24:mi-hh24:mi. Times should be Universal Time Coordinated (UTC). Must not conflict with the preferred maintenance window. Must be at least 30 minutes."},
                      {label:"Preferred Maintenance Window",tooltiptext:"The weekly time range (in UTC) during which system maintenance can occur. Format: ddd:hh24:mi-ddd:hh24:mi Default: A 30-minute window selected at random from an 8-hour block of time per region, occurring on a random day of the week. The following list shows the time blocks for each region from which the default maintenance windows are assigned. US-East (Northern Virginia) Region: 03:00-11:00 UTC,  US-West (Northern California) Region: 06:00-14:00 UTC, EU (Ireland) Region: 22:00-06:00 UTC, Asia Pacific (Singapore) Region: 14:00-22:00, UTC,  AsiaPacific(Tokyo)Region:17:00-03:00UTC, Valid Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun, Constraints: Minimum 30-minute window."},
                      {label:"IOPS",type:"number",min:0,max:10000,tooltiptext:"The amount of Provisioned IOPS (input/output operations per second) to be initially allocated for the DB Instance."},
                      ];

        if (edit) {
            var item = this.getSelected();
            if (!item) return;
            engines = this.core.queryModel("dbengines", "name", item.engine);
            var engine = this.core.getObjects(engines, [ "name", item.engine, "version", item.version]);
            if (engine.length) item.versionDescr = engine[0].versionDescr;
            inputs[0].value = item.id;
            inputs[0].readonly = true;
            inputs[1].value = item.versionDescr;
            inputs[1].list = engines;
            inputs[2].value = item.version;
            inputs[3].value = item.instanceClass;
            inputs[3].reuired = 0;
            inputs[4].value = item.allocatedStorage;
            inputs[4].required = 0;
            inputs[5].value = item.masterUsername;
            inputs[5].required = 0;
            inputs[6].required = 0;
            inputs[7].value = item.name;
            inputs[8].value = item.port;
            inputs[9].value = item.availabilityZone;
            inputs[10].value = inputs[10].checked = item.multiAZ;
            inputs[11].value = inputs[11].checked = item.autoMinorVersionUpgrade;
            inputs[12].checkedItems = [];
            item.securityGroups.forEach(function(x) { inputs[12].checkedItems.push(me.core.findModel('dbgroups',x)); });
            inputs[13].value = item.licenseModel;
            inputs[14].value = item.subnetGroupName;
            inputs[15].value = item.optionGroupName;
            inputs[16].value = item.parameterGroups.length ? item.parameterGroups[0].name : "";
            inputs[17].value = item.characterSetName;
            inputs[18].value = item.backupRetentionPeriod;
            inputs[19].value = item.preferredBackupWindow;
            inputs[20].value = item.preferredMaintenanceWindow;
            inputs[21].value = item.iops;
            inputs.push({label:"Apply Immediately",type:"checkbox",tooltiptext:" Specifies whether or not the modifications in this request and any pending modifications are asynchronously applied as soon as possible, regardless of the PreferredMaintenanceWindow setting for the DB Instance. If this parameter is passed as false, changes to the DB Instance are applied on the next call to RebootDBInstance, the next maintenance reboot, or the next failure reboot, whichever occurs first."});
        }
        var values = this.core.promptInput((edit ? "Modify" : " Create") + " DB Instance", inputs, { onchange: onchange, onaccept: onaccept });
        if (!values) return;
    },

    rebootInstance: function() {
        var me = this;
        var item = this.getSelected();
        var check = {value: false};
        if (!this.core.promptConfirm("Reboot DB instance", "Reboot " + item.id + "?", "Force failover", check)) return;
        this.core.api.rebootDBInstance(item.id, check.value, function() { me.refresh(); });
    },

    deleteInstance: function() {
        var me = this;
        var item = this.getSelected();
        var check = {value: false};
        var snapshot = null;
        if (!this.core.promptConfirm("Delete DB instance", "Delete " + item.id + "?", "Create final snapshot", check)) return;
        if (check.value) snapshot = this.core.prompt('Please provide name for the final DB snapshot:');
        this.core.api.deleteDBInstance(item.id, snapshot, function() { me.refresh(); });
    },

    createSnapshot: function()
    {
        var item = this.getSelected();
        if (!item) return;
        ew_DBSnapshotsTreeView.addItem(item);
    },

    restoreTime: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        
        // TODO: decide if the following unused variables should be used or deleted
        var snapshots = this.core.queryModel("dbsnapshots");
        var engines = this.core.queryModel("dbengines");
        var options = this.core.queryModel("dboptions");
        var dbparams = this.core.queryModel("dbparameters");
        var dbsubnets = this.core.queryModel("dbsubnets");
        var dbgroups = this.core.queryModel('dbgroups');

        function onaccept() {
            var options = {};
            var inputs = this.rc.items;
            var values = this.rc.values;
            for (var i = 0; i < inputs.length; i++) {
                if (values[i]) options[inputs[i].label.replace(" ", "")] = values[i];
            }
            me.core.api.restoreDBInstanceToPointInTime(values[0], values[1], options, function() { me.refresh(); });
            return 1;
        }

        function onchange(idx, onstart) {
            // Validation
            var item = this.rc.items[idx];
            switch (item.label) {
            case 'Engine':
                var engine = me.core.findModel('dbengines', item.obj.value, 'name');
                var list = engine && engine.orderableOptions ? engine.orderableOptions : (engine ? me.core.api.describeOrderableDBInstanceOptions(engine.name) : []);
                var dbclass = input.rc.items[idx+1].obj.value;
                buildListbox(input.rc.items[idx+1].obj, list, 'instanceClass');
                if (dbclass) input.rc.items[idx+1].obj.value = dbclass;
                if (engine) engine.orderableOptions = list;
                break;

            case "Availability Zone":
                this.rc.items[idx+1].obj.checked = false;
                break;

            case "Multi AZ":
                if (item.obj.checked) this.rc.items[idx-1].obj.value = "";
                break;

            case "Restore Time":
                this.rc.items[idx+1].obj.checked = false;
                break;

            case "Use Latest Restorable Time":
                if (item.obj.checked) this.rc.items[idx-1].obj.value = "";
                break;
            }
        }

        var inputs = [{label:"Source DB Instance Identifier",readonly:true,value:item.id,tooltiptext:"The identifier of the source DB Instance from which to restore."},
                      {label:"Target DB Instance Identifier",required:1,tooltiptext:"The name of the new database instance to be created."},
                      {label:"Engine",type:"menulist",list:engines,key:"name",required:1,style:"max-width:350px"},
                      {label:"DB Instance Class",type:"menulist",required:1,style:"max-width:350px"},
                      {label:"DB Name",tooltiptext:"The meaning of this parameter differs according to the database engine you use.MySQL: The name of the database to create when the DB Instance is created. If this parameter is not specified, no database is created in the DB Instance. Constraints: Must contain 1 to 64 alphanumeric characters, Cannot be a word reserved by the specified database engine.Oracle:The Oracle System ID (SID) of the created DB Instance.Default: ORCL Constraints: Cannot be longer than 8 characters, SQL Server: Not applicable. Must be null."},
                      {label:"Port",type:"number",tooltiptext:"The port number on which the database accepts connections."},
                      {label:"Availability Zone",type:"menulist",list:this.core.queryModel('availabilityZones')},
                      {label:"Multi AZ",type:"checkbox",tooltiptext:"Specifies if the DB Instance is a Multi-AZ deployment. For Microsoft SQL Server, must be set to false. You cannot set the AvailabilityZone parameter if the MultiAZ parameter is set to true."},
                      {label:"Auto Minor Version Upgrade", type:"checkbox",tooltiptext:"Indicates that minor engine upgrades will be applied automatically to the DB Instance during the maintenance window."},
                      {label:"License Model",type:"menulist",list:['license-included','bring-your-own-license','general-public-license']},
                      {label:"DB Subnet Group Name",type:"menulist",list:dbsubnets,key:'name',tooltiptext:"A DB Subnet Group to associate with this DB Instance.If there is no DB Subnet Group, then it is a non-VPC DB instance."},
                      {label:"Option Group Name",type:"menulist",list:options,key:'name',tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."},
                      {label:"Restore Time",tooltiptext:"The date and time to restore from. Valid Values: Value must be a UTC time. Constraints: Must be before the latest restorable time for the DB Instance.  CannotbespecifiedifUseLatestRestorableTime parameter is true"},
                      {label:"Use Latest Restorable Time",type:"checkbox",tooltiptext:"Specifies whether (true) or not (false) the DB Instance is restored from the latest backup time."},];

        var values = this.core.promptInput("Restore to Point in Time", inputs, { onchange: onchange, onaccept: onaccept });
        if (!values) return;
    },

    createReplica: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        var options = this.core.queryModel("dboptions");
        var engine = me.core.findModel('dbengines', item.engine, 'name');
        var list = engine.orderableOptions || me.core.api.describeOrderableDBInstanceOptions(engine.name);

        var inputs = [{label:"Source DB Instance Identifier",readonly:true,value:item.id,tooltiptext:"The identifier of the DB Instance that will act as the source for the Read Replica. Each DB Instance can have up to five Read Replicas."},
                      {label:"DB Instance Identifier",required:1,tooltiptext:"The DB Instance identifier of the Read Replica. This is the unique key that identifies a DB Instance."},
                      {label:"DB Instance Class",type:"menulist",list:list,required:1,style:"max-width:350px"},
                      {label:"Port",type:"number",tooltiptext:"The port number on which the database accepts connections."},
                      {label:"Availability Zone",type:"menulist",list:this.core.queryModel('availabilityZones')},
                      {label:"Auto Minor Version Upgrade", type:"checkbox",tooltiptext:"Indicates that minor engine upgrades will be applied automatically to the DB Instance during the maintenance window."},
                      {label:"Option Group Name",type:"menulist",list:options,key:'name',tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."}];

        var values = this.core.promptInput("Create DB Read Replica", inputs);
        if (!values) return;
        this.core.api.createDBInstanceReadReplica(values[1],values[0], function() { me.refresh(); });
    },

};

