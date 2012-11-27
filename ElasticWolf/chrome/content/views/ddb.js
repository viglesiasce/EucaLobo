//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_DDBTreeView = {
    model: ["ddb"],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.ddb.contextmenu.delete').disabled = item == null;
    },

    // Update item with nw table info
    updateTable: function(item, table)
    {
        if (!item || !table) return;
        item.status = table.TableStatus;
        item.created = new Date(table.CreationDateTime*1000);
        item.size = table.TableSizeBytes;
        item.count = table.ItemCount;
        if (table.ProvisionedThroughput) {
            item.readCapacity = table.ProvisionedThroughput.ReadCapacityUnits;
            item.writeCapacity = table.ProvisionedThroughput.WriteCapacityUnits;
        }
        if (table.KeySchema) {
            item.hashKey = table.KeySchema.HashKeyElement.AttributeName;
            item.hashType = table.KeySchema.HashKeyElement.AttributeType;
            if (table.KeySchema.RangeKeyElement) {
                item.rangeKey = table.KeySchema.RangeKeyElement.AttributeName;
                item.rangeType = table.KeySchema.RangeKeyElement.AttributeType;
            }
        }
    },

    isRefreshable: function()
    {
        return true;
    },

    // Update tables that are in progress of something
    onRefreshTimer: function()
    {
        var me = this;
        for (var i in this.treeList) {
            var item = this.treeList[i];
            if (!item.status || ["CREATING","UPDATING"].indexOf(item.status) != -1) {
                this.refreshItem(this.treeList[i]);
            } else
            if (item.status == "DELETING") {
                this.core.api.listTables({}, function(list) {
                    if (list.indexOf(item.name) == -1) {
                        debug('deleting ' + item.name)
                        me.core.removeModel('ddb', item.name, 'name');
                        me.invalidate();
                    }
                });
            }
        }
    },

    // Update one table with properties
    refreshItem: function(item)
    {
        var me = this;
        this.core.api.describeTable(item.name, function(table) {
            me.updateTable(item, table);
        });
    },

    selectionChanged: function()
    {
        var me = this;
        item = this.getSelected();
        if (!item) return;
        if (!item.status) {
            this.refreshItem(item);
        }
    },

    addItem: function(instance)
    {
        var me = this;
        var values = this.core.promptInput("Create Table",
                [ {label:"Table",type:"column",min:3,max:255,tooltiptext:"he name of the table to create. Allowed characters are a-z, A-Z, 0-9, '_' (underscore), '-' (dash), and '.' (dot). Names can be between 3 and 255 characters long"},
                  {label:"Hash Primary Key",type:"column",required:true,min:1,max:255,tooltiptext:"The primary key (simple or composite) structure for the table. A name-value pair for the HashKeyElement is required, and a name-value pair for the RangeKeyElement is optional (only required for composite primary keys). Primary key element names can be between 1 and 255 characters long with no character restrictions."},
                  {label:"Hash Key Type",type:"menulist",list:["S","N","SS","NS"],required:true},
                  {label:"Range Key",type:"column",max:255},
                  {label:"Range Key Type",type:"menulist",list:["S","N","SS","NS"],required:true},
                  {label:"Read Capacity Units",type:"number",min:10,max:100000,required:true,tooltiptext:"Sets the minimum number of consistent ReadCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations.Eventually consistent read operations require less effort than a consistent read operation, so a setting of 50 consistent ReadCapacityUnits per second provides 100 eventually consistent ReadCapacityUnits per second."},
                  {label:"Write Capacity Units",type:"number",min:10,max:50000,required:true,tooltiptext:"Sets the minimum number of WriteCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations."} ]);
        if (!values) return;
        this.core.api.createTable(values[0], values[1], values[2], values[3], values[4], values[5], values[6], function(table) {
            table.name = table.TableName;
            table.status = "CREATING";
            me.core.appendModel('ddb', [table]);
        });
    },

    deleteSelected : function ()
    {
        var me = this;
        item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteTable(item.name, function(table) { me.updateTable(item, table); });
    },

    configure: function()
    {
        var me = this;
        item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Configure Table",
                [ {label:"Table",type:"label",value:item.name,required:true},
                  {label:"Read Capacity Units",type:"number",value:item.readCapacity,required:true,tooltiptext:"Sets the minimum number of consistent ReadCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations.Eventually consistent read operations require less effort than a consistent read operation, so a setting of 50 consistent ReadCapacityUnits per second provides 100 eventually consistent ReadCapacityUnits per second."},
                  {label:"Write Capacity Units",type:"number",value:item.writeCapacity,required:true,tooltiptext:"Sets the minimum number of WriteCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations."} ]);
        if (!values) return;
        this.core.api.updateTable(item.name, values[1], values[2], function(table) { me.updateTable(item, table); });
    },
};
