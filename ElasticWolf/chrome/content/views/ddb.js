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
        item.readCapacity = table.ProvisionedThroughput.ReadCapacityUnits;
        item.writeCapacity = table.ProvisionedThroughput.WriteCapacityUnits;
        item.hashKey = table.KeySchema.HashKeyElement.AttributeName;
        item.hashType = table.KeySchema.HashKeyElement.AttributeType;
        if (table.KeySchema.RangeKeyElement) {
            item.rangeKey = table.KeySchema.RangeKeyElement.AttributeName;
            item.rangeType = table.KeySchema.RangeKeyElement.AttributeType;
        }
    },

    isRefreshable: function()
    {
        return true;
    },

    // Update tables that are in progress of something
    onRefreshTimer: function()
    {
        for (var i in this.treeList) {
            if (!this.treeList[i].status || ["DELETING","CREATING","UPDATING"].indexOf(this.treeList[i].status) != -1) {
                this.refreshItem(this.treeList[i]);
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
                [ {label:"Table",type:"label",value:item.name},
                  {label:"Read Capacity Units",type:"number",value:item.readCapacity,required:true,tooltiptext:"Sets the minimum number of consistent ReadCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations.Eventually consistent read operations require less effort than a consistent read operation, so a setting of 50 consistent ReadCapacityUnits per second provides 100 eventually consistent ReadCapacityUnits per second."},
                  {label:"Write Capacity Units",type:"number",value:item.writeCapacity,required:true,tooltiptext:"Sets the minimum number of WriteCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations."} ]);
        if (!values) return;
        this.core.api.updateTable(item.name, values[1], values[2], function(table) { me.updateTable(item, table); });
    },
};
