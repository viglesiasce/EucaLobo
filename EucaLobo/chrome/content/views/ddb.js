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
        var item = this.getSelected();
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
                  {label:"Hash Key Type",type:"menulist",list:["S","N"],required:true},
                  {label:"Range Key",type:"column",max:255},
                  {label:"Range Key Type",type:"menulist",list:["S","N"],required:true},
                  {label:"Read Capacity Units",type:"number",min:1,max:100000,required:true,tooltiptext:"Sets the minimum number of consistent ReadCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations.Eventually consistent read operations require less effort than a consistent read operation, so a setting of 50 consistent ReadCapacityUnits per second provides 100 eventually consistent ReadCapacityUnits per second."},
                  {label:"Write Capacity Units",type:"number",min:1,max:50000,required:true,tooltiptext:"Sets the minimum number of WriteCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations."} ]);
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
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.deleteTable(item.name, function(table) { me.updateTable(item, table); });
    },

    configure: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Configure Table",
                [ {label:"Table",type:"label",value:item.name,required:true},
                  {label:"Read Capacity Units",type:"number",value:item.readCapacity,required:true,tooltiptext:"Sets the minimum number of consistent ReadCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations.Eventually consistent read operations require less effort than a consistent read operation, so a setting of 50 consistent ReadCapacityUnits per second provides 100 eventually consistent ReadCapacityUnits per second."},
                  {label:"Write Capacity Units",type:"number",value:item.writeCapacity,required:true,tooltiptext:"Sets the minimum number of WriteCapacityUnits consumed per second for the specified table before Amazon DynamoDB balances the load with other operations."} ]);
        if (!values) return;
        this.core.api.updateTable(item.name, values[1], values[2], function(table) { me.updateTable(item, table); });
    },
};

var ew_DDBItemsTreeView = {
    lastItem: null,

    addItem: function()
    {
        var me = this;
        var table = ew_DDBTreeView.getSelected();
        if (!table) return;
        var inputs = [ {label:"Table",type:"label",value:table.name } ];
        inputs.push({label:table.hashKey,type:table.hashType=="N"?"number":"textbox" })
        if (table.rangeKey) {
            inputs.push({label:table.rangeKey,type:table.rangeType=="N"?"number":"textbox" })
        }
        var values = this.core.promptInput("Add Item", inputs);
        if (!values) return;
        var item = {};
        for (var i = 1; i < inputs.length; i++) {
            item[inputs[i].label] = values[i];
        }
        this.core.api.putItem(table.name, item, {}, function() {
            item._hashKey = item[table._hashKey];
            if (table._rangeKey) item._rangeKey = item[table._rangeKey];
        });
    },

    putItem: function()
    {
        var me = this;
        var table = ew_DDBTreeView.getSelected();
        if (!table) return;
        var item = this.getSelected();
        if (!item) return;
        var inputs = [ {label:"Table",type:"label",value:table.name } ];
        for (var p in item) {
            if (p == '_hashKey' || p == '_rangeKey') continue;
            inputs.push({label:p,type:typeName(item[p])=="number"?"number":"textbox",value:item[p] })
        }
        var values = this.core.promptInput("Edit Item", inputs);
        if (!values) return;
        var obj = {};
        for (var i = 1; i < inputs.length; i++) {
            obj[inputs[i].label] = values[i];
            item[inputs[i].label] = values[i];
        }
        this.core.api.putItem(table.name, obj, {}, function(item) {
            me.replace(item);
        });
    },

    deleteSelected : function ()
    {
        var me = this;
        var table = ew_DDBTreeView.getSelected();
        if (!table) return;
        var item = this.getSelected();
        if (!item || !confirm('Delete ' + item.id + '?')) return;
        this.core.api.deleteItem(table.name, item._hashKey, item._rangeKey, {}, function(table) {
            me.remove(item);
        });
    },

    query: function() {
        var me = this;
        var table = ew_DDBTreeView.getSelected();
        if (!table) return;
        var key = $("ew.ddb.items.key").value;
        if (!key) return;
        if (table.hashType == 'N') key = parseFloat(key);
        var range1 = $("ew.ddb.items.range1").value;
        var range2 = $("ew.ddb.items.range2").value;
        var op = $("ew.ddb.items.op").value;
        var options = { limit: parseInt($("ew.ddb.items.limit").value) };
        if (op && range1) {
            if (table.rangeType == 'N') {
                range1 = parseFloat(range1);
                if (range2) range2 = parseFloat(range2);
            }
            options._rangeKeyCondition = {};
            options._rangeKeyCondition[op] = op == 'between' ? [ range1, range2] : range1;
        }

        this.core.api.queryTable(table.name, key, options, function(rc) {
            me.lastItem = rc.LastEvaluatedKey;
            var list = [];
            for (var i in rc.Items) {
                var item = fromDynamoDB(rc.Items[i]);
                item._hashKey = item[table._hashKey];
                if (table._rangeKey) item._rangeKey = item[table._rangeKey];
                list.push(item)
            }
            me.display(list);
        });
    },

    scan: function(params)
    {
        var me = this;
        var table = ew_DDBTreeView.getSelected();
        if (!table) return;
        if (!params) params = {};
        params.limit = parseInt($("ew.ddb.items.limit").value);

        this.core.api.scanTable(table.name, params, function(rc) {
            me.lastItem = fromDynamoDB(rc.LastEvaluatedKey);
            var list = [];
            for (var i in rc.Items) {
                var item = fromDynamoDB(rc.Items[i]);
                item._hashKey = item[table.hashKey];
                if (table.rangeKey) item._rangeKey = item[table.rangeKey];
                list.push(item)
            }
            me.display(list);
        });
    },

    nextPage: function()
    {
        var table = ew_DDBTreeView.getSelected();
        if (!table || !this.lastItem) return;
        this.scan({ exclusiveStartKey: this.lastItem });
    },

};

