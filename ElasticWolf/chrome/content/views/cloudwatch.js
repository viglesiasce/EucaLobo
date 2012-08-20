//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_MetricsTreeView = {
    model: [ "metrics", "alarms", "instances", "volumes"],

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
            if (list[i].dimensions.length == 1 && list[i].info == "") {
                list[i].info = this.core.modelValue(list[i].dimensions[0].name, list[i].dimensions[0].value, true);
                if (list[i].info == list[i].dimensions) list[i].info = "";
            }
            nlist.push(list[i])
        }
        return TreeView.filter.call(this, nlist);
    },

    modelChanged : function(name)
    {
        TreeView.modelChanged.call(this);

        // Show only live objects in the graphs page
        var map = {};
        var dm = $('ew.graphs.dimensions');
        dm.removeAllItems();
        dm.appendItem('Choose Metrics', '')
        dm.selectedIndex = 0;
        var list = this.core.getModel('metrics');
        for (var i in list) {
            if (list[i].info && !map[list[i].info]) {
                dm.appendItem(list[i].info, list[i].dimensions);
                map[list[i].info] = true;
            }
        }
    },

    chart: function() {
        var item = this.getSelected();
        if (!item) return;

        var statistics = $('ew.metrics.statistics').value;
        var period = $('ew.metrics.period').value;
        var interval = parseInt($('ew.metrics.time').value);
        openDialog('chrome://ew/content/dialogs/graph.xul', null, 'chrome,centerscreen,modeless', { core: this.core, name: item.name, namespace: item.namespace, dimensions: item.dimensions, statistics: statistics, period: period, interval: interval });
    },

};

var ew_MetricAlarmsTreeView = {
    model: ["alarms","topics","volumes","instances","metrics"],
    properties: ["stateValue"],

    chart: function() {
        var item = this.getSelected();
        if (!item) return;

        var statistics = $('ew.alarms.statistics').value;
        var period = $('ew.alarms.period').value;
        var interval = parseInt($('ew.alarms.time').value);
        openDialog('chrome://ew/content/dialogs/graph.xul', null, 'chrome,centerscreen,modeless', { core: this.core, name: item.metricName, namespace: item.namespace, dimensions: item.dimensions, statistics: statistics, period: period, interval: interval });
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
        if (!confirm('Delete alarm ' + item.name + "?")) return;
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

var ew_GraphsView = {
    dimensions: [],
    metrics: [],
    rowCount: 0,

    activate: function()
    {
        jsgraph_leftSpace = 35;
        jsgraph_rightSpace = 20;
        jsgraph_fontsize = 9;
        // If called with this view active, refresh all models
        this.refresh()
    },

    refresh: function()
    {
        if (this.core.getModel('metrics') == null) {
            ew_MetricsTreeView.refresh();
        }
    },

    deactivate: function()
    {
    },

    display: function()
    {
    },

    invalidate: function()
    {
    },

    onChange: function()
    {
        this.setDimensions($('ew.graphs.dimensions').value);
    },

    setDimensions: function(value)
    {
        var me = this;
        var page = $('ew.graphs.page');
        while (page.firstChild) {
            page.removeChild(page.firstChild);
        }
        this.metrics = [];
        this.dimensions = this.core.parseTags(value);
        if (!this.dimensions.length) return;

        var page = $('ew.graphs.page');
        this.core.api.listMetrics(null, null, this.dimensions, function(list) {
            me.metrics = list;
            for (var i = 0; i < list.length; i++) {
                if (i % 3 == 0) {
                    hbox = document.createElement('hbox');
                    hbox.setAttribute('pack', 'center');
                    hbox.setAttribute('style', 'padding:5px;');
                    page.appendChild(hbox);
                }
                var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
                canvas.setAttribute('id', 'ew.graphs.' + list[i].name);
                canvas.setAttribute('class', 'graph');
                hbox.appendChild(canvas);
                var spacer = document.createElement('spacer');
                spacer.setAttribute('flex', '1');
                hbox.appendChild(spacer);
            }
        });
    },

    show: function()
    {
        for (var i = 0; i < this.metrics.length; i++) {
            this.render(this.metrics[i].name, this.metrics[i].namespace);
        }
    },

    // Render graph into canvas by id for specific metric and dimensions
    render: function(name, namespace)
    {
        var id = 'ew.graphs.' + name;
        var statistics = $('ew.graphs.statistics').value;
        var period = $('ew.graphs.period').value;
        var interval = parseInt($('ew.graphs.interval').value);
        var end = new Date();
        var start = new Date(end.getTime() - interval * 1000);

        this.core.api.getMetricStatistics(name, namespace, start.toISOString(), end.toISOString(), period, statistics, null, this.dimensions, function(list) {
            if (!list || !list.length) return;
            graph = new Graph(name + " : " + list[0].unit, id, "line");
            for (var i = 0; i < list.length; i++) {
                graph.addPoint(i, list[i].value, list[i].timestamp.strftime(interval < 86400 ? '%H:%M' : '%Y-%m-%d %H:%M'));
            }
            graph.draw();
        });
    },

};
