//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_MetricsTreeView = {
    model: [ "metrics", "alarms"],

    activate: function()
    {
        var nm = $('ew.metrics.namespace');
        nm.removeAllItems();
        nm.appendItem("All", "");
        var list = this.core.getCloudWatchNamespaces();
        for (var i in list) {
            nm.appendItem(list[i].name, list[i].type);
        }
        return TreeView.activate.call(this);
    },

    filter: function(list)
    {
        var nlist = [];

        var nm = $('ew.metrics.namespace').value;
        for (var i in list) {
            if (nm && list[i].namespace != nm) continue;
            nlist.push(list[i])
        }
        return TreeView.filter.call(this, nlist);
    },

};

var ew_MetricAlarmsTreeView = {
    model: [ "alarms", "metrics"],
    properties: ["stateValue"],

    menuChanged : function(event)
    {
        var item = this.getSelected();

        $("deleteAlarm").disabled = !item;
        $("displayHistory").disabled = !item;
        $("disableActions").disabled = !item;
        $("setState").disabled = !item;
    },

    addAlarm: function()
    {
        function callback(idx) {
            switch (idx) {
            case 1:
                buildListbox(this.rc.items[2].obj, this.rc.core.getCloudWatchMetrics(this.rc.items[1].obj.value, 'name'));
                break;
            }
        }
        var values = this.core.promptInput("Add Alarm",
                [{label:"AlarmName",required:1},
                 {label:"Namespace",type:"menulist",list:this.core.getCloudWatchNamespaces(),required:1,key:"type"},
                 {label:"MetricName",type:"menulist",required:1},
                 {label:"Period",type:"number",required:1,help:"seconds"},
                 {label:"EvaluationPeriods",type:"number",required:1},
                 {label:"ComparisonOperator",type:"menulist",list:["GreaterThanOrEqualToThreshold",
                                                                   "GreaterThanThreshold",
                                                                   "LessThanThreshold",
                                                                   "LessThanOrEqualToThreshold"],required:1},
                 {label:"Threshold",type:"number",decimalplaces:5,required:1},
                 {label:"Statistic",type:"menulist",list:["SampleCount","Average","Sum","Minimum","Maximum"],required:1},
                 {label:"Unit",type:"menulist",list:['Seconds','Microseconds','Milliseconds','Bytes','Kilobytes','Megabytes','Gigabytes','Terabytes','Bits','Kilobits','Megabits','Gigabits','Terabits','Percent','Count','Bytes/Second','Kilobytes/Second','Megabytes/Second','Gigabytes/Second','Terabytes/Second','Bits/Second','Kilobits/Second','Megabits/Second','Gigabits/Second','Terabits/Second','Count/Second']},
                 {label:"AlarmActions",multiline:true,cols:40,rows:2,help:"Comma separated ARNs"},
                 {label:"InsufficientDataActions",multiline:true,cols:40,rows:2,help:"Comma separated ARNs"},
                 {label:"OKActions",multiline:true,cols:40,rows:2,help:"Comma separated ARNs"},
                 {label:"Dimensions",multiline:true,cols:40,rows:2,help:"Name:Value pairs separated by comma"}
                 ], false, callback);
        if(!values) return;
    },

    deleteAlarm: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.deleteAlarms([item], function() { me.refresh() });
    },

    disableActions: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm((item.actionsEnabled ? "Disable" : "Enable") + " actions for " + item.name + "?")) return;
        if (item.actionsEnabled) {
            this.core.api.disableAlarmActions([item], function() { me.refresh() });
        } else {
            this.core.api.enableAlarmActions([item], function() { me.refresh() });
        }
    },

    setState: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Set Alarm State", [{label:"State",type:"menulist",list:["OK","ALARM","INSUFFICIENT_DATA"],required:1}, {label:"Reason",required:1}]);
        if (!values) return;
        this.core.api.setAlarmState(item.name, values[0], values[1], function() { me.refresh() });
    },

    displayHistory: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.describeAlarmHistory(item.name, function(list) {
            me.core.promptList("Alarm History", "", list, { rows: 25, width: 600 });
        });
    },
};


