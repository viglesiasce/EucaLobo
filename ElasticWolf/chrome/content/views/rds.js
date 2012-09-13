//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_DBEnginesTreeView = {
    model: [ "dbengines"],
};

var ew_DBInstancesTreeView = {
    model: [ "dbinstances","dbengines","subnets",'availabilityZones'],

    addInstance: function()
    {
        var me = this;

        function callback(idx, onstart) {
            var input = this;
            var item = this.rc.items[idx];
            switch (idx) {
            case 1: // Instance
                me.core.api.describeOrderableDBInstanceOptions(item.obj.value, function(list) {
                    buildListbox(input.rc.items[idx+1].obj, list, 'instanceClass');
                    var engine = me.core.findModel('dbengines', item.obj.value, 'engine');
                    buildListbox(input.rc.items[18].obj, engine ? engine.charsets : []);
                });
                break;

            case 8: // Azone
                this.rc.items[idx+1].obj.checked = false;
                break;

            case 9: // MultiAZ
                if (item.obj.checked) this.rc.items[idx-1].obj.value = "";
                break;
            }
        }

        var values = this.core.promptInput("Create DB Instance",
                [{label:"DB Identifier",required:1,tooltiptext:"The DB Instance identifier. This parameter is stored as a lowercase string."},
                 {label:"Engine",type:"menulist",list:this.core.queryModel("dbengines"),key:"engine",required:1,style:"max-width:350px"},
                 {label:"Instance Class",type:"menulist",required:1,style:"max-width:350px"},
                 {label:"Allocated Storage(Gb)",type:"number",required:1,min:5,max:1024,tooltiptext:"The amount of storage (in gigabytes) to be initially allocated for the database instance.MySQL: from 5 to 1024. Oracle: from 10 to 1024. SQL Server from 200 to 1024 (Standard Edition and Enterprise Edition) or from 30 to 1024 (Express Edition and Web Edition)"},
                 {label:"Master Username",required:1,tooltiptext:"The name of master user for the client DB Instance"},
                 {label:"Master Password",required:1,tooltiptext:"The password for the master database user."},
                 {label:"DB Name",tooltiptext:"The meaning of this parameter differs according to the database engine you use.MySQL: The name of the database to create when the DB Instance is created. If this parameter is not specified, no database is created in the DB Instance. Constraints: Must contain 1 to 64 alphanumeric characters, Cannot be a word reserved by the specified database engine.Oracle:The Oracle System ID (SID) of the created DB Instance.Default: ORCL Constraints: Cannot be longer than 8 characters, SQL Server: Not applicable. Must be null."},
                 {label:"DB Port",type:"number",tooltiptext:"The port number on which the database accepts connections."},
                 {label:"Availability Zone",type:"menulist",list:this.core.queryModel('availabilityZones')},
                 {label:"MultiAZ",type:"checkbox",tooltiptext:"Specifies if the DB Instance is a Multi-AZ deployment. For Microsoft SQL Server, must be set to false. You cannot set the AvailabilityZone parameter if the MultiAZ parameter is set to true."},
                 {label:"Auto Minor Version Upgrade", type:"checkbox",tooltiptext:"Indicates that minor engine upgrades will be applied automatically to the DB Instance during the maintenance window."},
                 {label:"Security Groups",type:"listview",list:this.core.queryModel('securityGroups'),flex:1,rows:5,tooltiptext:"The names of the security groups with which to associate Amazon EC2 or Amazon VPC instances. Specify Amazon EC2 security groups using security group names, such as websrv. Specify Amazon VPC security groups using security group IDs, such as sg-12345678.Cannot combine VPC and non-VPC security groups."},
                 {label:"Preferred Backup Window",tooltiptext:"The daily time range during which automated backups are created if automated backups are enabled, using the BackupRetentionPeriod parameter.Constraints: Must be in the format hh24:mi-hh24:mi. Times should be Universal Time Coordinated (UTC). Must not conflict with the preferred maintenance window. Must be at least 30 minutes."},
                 {label:"Preferred Maintenance Window",tooltiptext:"The weekly time range (in UTC) during which system maintenance can occur. Format: ddd:hh24:mi-ddd:hh24:mi Default: A 30-minute window selected at random from an 8-hour block of time per region, occurring on a random day of the week. The following list shows the time blocks for each region from which the default maintenance windows are assigned. US-East (Northern Virginia) Region: 03:00-11:00 UTC,  US-West (Northern California) Region: 06:00-14:00 UTC, EU (Ireland) Region: 22:00-06:00 UTC, Asia Pacific (Singapore) Region: 14:00-22:00, UTC,  AsiaPacific(Tokyo)Region:17:00-03:00UTC, Valid Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun, Constraints: Minimum 30-minute window."},
                 {label:"Option Group Name",tooltiptext:"Indicates that the DB Instance should be associated with the specified option group."},
                 {label:"License Model",type:"menulist",list:['license-included','bring-your-own-license','general-public-license']},
                 {label:"Subnet Group Name",type:"menulist",list:this.core.queryModel("subnets"),tooltiptext:"A DB Subnet Group to associate with this DB Instance.If there is no DB Subnet Group, then it is a non-VPC DB instance."},
                 {label:"Parameter Group Name",tooltiptext:"The name of the DB Parameter Group to associate with this DB instance. If this argument is omitted, the default DBParameterGroup for the specified engine will be used.Constraints:Must be 1 to 255 alphanumeric characters,First character must be a letter,Cannot end with a hyphen or contain two consecutive hyphens"},
                 {label:"Character Set Name",type:"menulist"},
                 {label:"Backup Retention Period",type:"number",value:1,max:8,tooltiptext:"The number of days for which automated backups are retained. Setting this parameter to a positive number enables backups. Setting this parameter to 0 disables automated backups. Cannot be set to 0 if the DB Instance is a master instance with read replicas."},
                 ], false, callback);
        if (!values) return;
        var options = {};
        this.core.api.createDBInstance(values[0],values[1],values[2],values[3],values[4],values[5],options,function() { me.refresh()});

    },

    rebootInstance: function() {
        var me = this;
        var item = this.getSelected();
        var check = {value: false};
        if (!this.core.promptConfirm("Reboot DB instance", "Reboot " + item.name + "?", "Force failover", check)) return;
        this.core.api.rebootDBInstance(item.id, check.value, function() { me.refresh(); });
    },

    deleteInstance: function() {
        var me = this;
        var item = this.getSelected();
        var check = {value: false};
        var snapshot = null;
        if (!this.core.promptConfirm("Delete DB instance", "Delete " + item.name + "?", "Create final snapshot", check)) return;
        if (check.value) snapshot = prompt('Please provide name for the final DB snapshot:');
        this.api.deleteDBInstance(item.id, snapshot, function() { me.refresh(); });
    },
};


