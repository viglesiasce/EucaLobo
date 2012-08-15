//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_MetricsTreeView = {
    model: [ "metrics", "alarms"],

    menuChanged : function(event)
    {
        var item = this.getSelected();
    },

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

    chart: function() {
        var item = this.getSelected();
        if (!item) return;

        var statistics = $('ew.metrics.statistics').value;
        var period = $('ew.metrics.period').value;
        var interval = parseInt($('ew.metrics.time').value);
        var end = new Date();
        var start = new Date(end.getTime() - interval * 1000);

        this.core.api.getMetricStatistics(item.name, item.namespace, start.toISOString(), end.toISOString(), period, statistics, null, item.dimensions, function(list) {
            openDialog('chrome://ew/content/dialogs/graph.xul', null, 'chrome,centerscreen,modeless', { core: this.core, title: item.name, statistics: statistics, interval: interval, start: start, end: end, list: list });
        });
    },

};

var ew_MetricAlarmsTreeView = {
    model: ["alarms","topics","volumes","instances","metrics"],
    properties: ["stateValue"],

    chart: function() {
        var item = this.getSelected();
        if (!item) return;

        var statistics = $('ew.metrics.statistics').value;
        var period = $('ew.metrics.period').value;
        var interval = parseInt($('ew.metrics.time').value);
        var end = new Date();
        var start = new Date(end.getTime() - interval * 1000);

        this.core.api.getMetricStatistics(item.metricName, item.namespace, start.toISOString(), end.toISOString(), period, statistics, null, item.dimensions, function(list) {
            openDialog('chrome://ew/content/dialogs/graph.xul', null, 'chrome,centerscreen,modeless', { core: this.core, title: item.name + " " + item.metricName, statistics: statistics, interval: interval, start: start, end: end, list: list });
        });
    },

    menuChanged : function(event)
    {
        var item = this.getSelected();

        $("editAlarm").disabled = !item;
        $("deleteAlarm").disabled = !item;
        $("displayHistory").disabled = !item;
        $("disableActions").disabled = !item;
        $("setState").disabled = !item;
    },

    putAlarm: function(edit)
    {
        var me = this;

        function callback(idx, onstart) {
            switch (this.rc.items[idx].label) {
            case "Namespace":
                this.rc.metrics = this.rc.core.queryModel('metrics', 'namespace', this.rc.items[idx].obj.value);
                this.rc.core.sortObjects(this.rc.metrics, 'dimensions');
                buildListbox(this.rc.items[idx+1].obj, this.rc.metrics, 'name');
                // Restore initial value for metric
                if (onstart && edit) this.rc.items[idx+1].obj.value = this.rc.items[idx+1].value;
                break;

            case "MetricName":
                var metric = this.rc.metrics[this.rc.items[idx].obj.selectedIndex];
                this.rc.items[idx+1].obj.value = '';
                if (!metric) break;
                for (var i in metric.dimensions) {
                    this.rc.items[idx+1].obj.value += metric.dimensions[i] + "\n";
                }
                break;

            case "AlarmActions Topics":
            case "InsufficientDataActions Topics":
            case "OKActions Topics":
                if (this.rc.items[idx].obj.value) {
                    if (this.rc.items[idx-1].obj.value) this.rc.items[idx-1].obj.value += "\n";
                    this.rc.items[idx-1].obj.value += this.rc.items[idx].obj.value;
                    this.rc.items[idx].obj.value = '';
                }
                break;
            }
        }
        var inputs = [{label:"AlarmName",required:1},
                      {label:"AlarmDescription"},
                      {label:"Namespace",type:"menulist",list:this.core.getCloudWatchNamespaces(),required:1,key:"type"},
                      {label:"MetricName",type:"menulist",required:1},
                      {label:"Dimensions",multiline:true,cols:30,rows:3,wrap:'off',help:"One name:value pair per line"},
                      {label:"ComparisonOperator",type:"menulist",list:["GreaterThanOrEqualToThreshold","GreaterThanThreshold","LessThanThreshold","LessThanOrEqualToThreshold"],required:1},
                      {label:"Threshold",type:"number",decimalplaces:2,size:10,required:1},
                      {label:"Period",type:"number",required:1,help:"seconds",value:300},
                      {label:"EvaluationPeriods",type:"number",required:1,value:1},
                      {label:"Statistic",type:"menulist",list:["Average","SampleCount","Sum","Minimum","Maximum"],required:1},
                      {label:"Unit",type:"menulist",list:['Seconds','Microseconds','Milliseconds','Bytes','Kilobytes','Megabytes','Gigabytes','Terabytes','Bits','Kilobits','Megabits','Gigabits','Terabits','Percent','Count','Bytes/Second','Kilobytes/Second','Megabytes/Second','Gigabytes/Second','Terabytes/Second','Bits/Second','Kilobits/Second','Megabits/Second','Gigabits/Second','Terabits/Second','Count/Second']},
                      {label:"AlarmActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line"},
                      {label:"AlarmActions Topics",type:"menulist",list:this.core.getModel('topics')},
                      {label:"InsufficientDataActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line"},
                      {label:"InsufficientDataActions Topics",type:"menulist",list:this.core.getModel('topics')},
                      {label:"OKActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line"},
                      {label:"OKActions Topics",type:"menulist",list:this.core.getModel('topics')},
                      ];

        // Modify existing alarm
        if (edit) {
            var item = this.getSelected();
            if (!item) return;
            inputs[0].value = item.name;
            inputs[1].value = item.descr;
            inputs[2].value = item.namespace;
            inputs[3].value = item.metricName;
            inputs[4].value = item.dimensions.join("\n");
            inputs[5].value = item.comparisonOperator;
            inputs[6].value = item.threshold;
            inputs[7].value = item.period;
            inputs[8].value = item.evaluationPeriods;
            inputs[9].value = item.statistic;
            inputs[10].value = item.unit;
            inputs[11].value = item.actions;
            inputs[13].value = item.insufficientDataActions;
            inputs[15].value = item.okActions;
        }

        var values = this.core.promptInput("Put CloudWatch Alarm", inputs, false, callback);
        if(!values) return;
        var params = [];
        for (var i in inputs) {
            if (inputs[i].required || !values[i]) continue;
            if (inputs[i].multiline) {
                var lines = values[i].split("\n");
                for (var j = 0; j < lines.length; j++) {
                    if (!lines[j]) continue;
                    if (inputs[i].label == "Dimensions") {
                        var pair = lines[j].split(":");
                        params.push([inputs[i].label + ".member." + (j + 1) + ".Name", pair[0]]);
                        params.push([inputs[i].label + ".member." + (j + 1) + ".Value", pair[1]]);
                    } else {
                        params.push([inputs[i].label + ".member." + (j + 1), lines[j]]);
                    }
                }
            } else {
                params.push([inputs[1].label, values[1]]);
            }
        }
        this.core.api.putMetricAlarm(values[0], values[2], values[3], values[5], values[6], values[7], values[8], values[9], params, function() { me.refresh() });
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


