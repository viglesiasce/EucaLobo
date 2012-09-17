//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_DBSnapshotsTreeView = {
    model: [ "dbsnapshots"],
};

var ew_DBEventsTreeView = {
    model: [ "dbevents"],
};

var ew_DBEnginesTreeView = {
    model: [ "dbengines"],
};

var ew_DBSubnetGroupsTreeView = {
    model: [ "dbsubnets"],
};

var ew_DBSecurityGroupsTreeView = {
    model: [ "dbgroups"],
};

var ew_DBOptionGroupsTreeView = {
    model: [ "dboptions"],

    selectionChanged : function() {
        var item = this.getSelected();
        if (!item) return;
        ew_DBOptionGroupOptionsTreeView.display(item.options);
    },
};

var ew_DBOptionGroupOptionsTreeView = {
};

var ew_DBParameterGroupsTreeView = {
    model: [ "dbparameters"],

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
};

var ew_DBParameterGroupParametersTreeView = {
};

ew_DBOfferingsTreeView = {
    model : ["dbofferings"],

    purchaseOffering : function()
    {
        var item = this.getSelected();
        if (!item) return;
        var button = 0;
        // Calc total price handler
        var price = "rc.items[12].obj.value=parseInt(rc.items[11].obj.value)*" + item.fixedPrice;
        while (button == 0) {
            var values = this.core.promptInput('Purchase Instance', [{label:"Instance Details",type:"section"},
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
                                                                     {label:"Total one time payment, due now (US$)",type:"label",value:item.fixedPrice} ])
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

ew_ReservedDBInstancesTreeView = {
    model: ["dbreserved"],

    isRefreshable : function()
    {
        return this.treeList.some(function(x) { return x.state == "payment-pending"; });
    },

};

var ew_DBInstancesTreeView = {
    model: [ "dbinstances","dbengines","dboptions","dbparameters","dbsubnets","dbgroups",'availabilityZones'],

    isRefreshable : function()
    {
        return this.treeList.some(function(x) { return x.state == "deleting" || x.state == "creating"; });
    },

    putInstance: function(edit)
    {
        var me = this;

        function callback(idx, onstart) {
            var input = this;
            var item = this.rc.items[idx];
            switch (idx) {
            case 1: // Engine
                var engine = me.core.findModel('dbengines', item.obj.value, 'engine');
                input.rc.items[idx+1].obj.value = engine ? engine.version : '';
                var list = engine ? me.core.api.describeOrderableDBInstanceOptions(item.obj.value) : [];
                var dbclass = input.rc.items[idx+2].obj.value;
                buildListbox(input.rc.items[idx+2].obj, list, 'instanceClass');
                if (dbclass) input.rc.items[idx+2].obj.value = dbclass;
                buildListbox(input.rc.items[17].obj, engine ? engine.charsets : []);
                break;

            case 9: // Azone
                this.rc.items[idx+1].obj.checked = false;
                break;

            case 10: // MultiAZ
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
                      {label:"Engine",type:"menulist",list:engines,key:"engine",required:1,style:"max-width:350px"},
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
                      {label:"DB Subnet Group Name",type:"menulist",list:dbsubnets,key:'name',tooltiptext:"A DB Subnet Group to associate with this DB Instance.If there is no DB Subnet Group, then it is a non-VPC DB instance."},
                      {label:"Option Group Name",type:"menulist",list:options,key:'name',tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."},
                      {label:"DB Parameter Group Name",type:"menulist",list:dbparams,key:'name',tooltiptext:"The name of the DB Parameter Group to associate with this DB instance. If this argument is omitted, the default DBParameterGroup for the specified engine will be used.Constraints:Must be 1 to 255 alphanumeric characters,First character must be a letter,Cannot end with a hyphen or contain two consecutive hyphens"},
                      {label:"Character Set Name",type:"menulist"},
                      {label:"Backup Retention Period",type:"number",value:1,max:8,tooltiptext:"The number of days for which automated backups are retained. Setting this parameter to a positive number enables backups. Setting this parameter to 0 disables automated backups. Cannot be set to 0 if the DB Instance is a master instance with read replicas."},
                      {label:"Preferred Backup Window",tooltiptext:"The daily time range during which automated backups are created if automated backups are enabled, using the BackupRetentionPeriod parameter.Constraints: Must be in the format hh24:mi-hh24:mi. Times should be Universal Time Coordinated (UTC). Must not conflict with the preferred maintenance window. Must be at least 30 minutes."},
                      {label:"Preferred Maintenance Window",tooltiptext:"The weekly time range (in UTC) during which system maintenance can occur. Format: ddd:hh24:mi-ddd:hh24:mi Default: A 30-minute window selected at random from an 8-hour block of time per region, occurring on a random day of the week. The following list shows the time blocks for each region from which the default maintenance windows are assigned. US-East (Northern Virginia) Region: 03:00-11:00 UTC,  US-West (Northern California) Region: 06:00-14:00 UTC, EU (Ireland) Region: 22:00-06:00 UTC, Asia Pacific (Singapore) Region: 14:00-22:00, UTC,  AsiaPacific(Tokyo)Region:17:00-03:00UTC, Valid Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun, Constraints: Minimum 30-minute window."},
                      ];

        if (edit) {
            var item = this.getSelected();
            if (!item) return;
            inputs[0].value = item.id;
            inputs[0].readonly = true;
            inputs[1].value = item.engine;
            inputs[1].required = 0;
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
            inputs[17].value = item.charsetName;
            inputs[18].value = item.backupRetentionPeriod;
            inputs[19].value = item.preferredBackupWindow;
            inputs[20].value = item.preferredMaintenanceWindow;
        }
        var values = this.core.promptInput((edit ? "Modify" : " Create") + " DB Instance", inputs, false, callback);
        if (!values) return;

        var options = {};
        options.EngineVersion = values[2];
        for (var i = 0; i < inputs.length; i++) {
            if (values[i]) options[inputs[i].label.replace(" ", "")] = values[i];
        }
        if (edit) {
            this.core.api.modifyDBInstance(values[0],options,function() { me.refresh()});
        } else {
            this.core.api.createDBInstance(values[0],values[1],values[3],values[4],values[5],values[6],options,function() { me.refresh()});
        }
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
        if (check.value) snapshot = prompt('Please provide name for the final DB snapshot:');
        this.core.api.deleteDBInstance(item.id, snapshot, function() { me.refresh(); });
    },
};


