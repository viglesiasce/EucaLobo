//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_MetricsTreeView = {
    model: [ "metrics", "alarms", "instances", "volumes"],

    menuChanged : function(event)
    {
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
            list[i].update();
            nlist.push(list[i])
        }
        return TreeView.filter.call(this, nlist);
    },

    modelChanged : function(name)
    {
        TreeView.modelChanged.call(this, name);
        this.fillMetrics();
    },

    fillMetrics: function()
    {
        // Show only live objects in the graphs page
        var map = {};
        var dm = $('ew.graphs.dimensions');
        dm.removeAllItems();
        dm.appendItem('Choose Metrics', '')
        dm.selectedIndex = 0;
        var list = this.core.getModel('metrics');
        for (var i in list) {
            list[i].update();
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
        openDialog('chrome://ew/content/dialogs/metric.xul', null, 'chrome,centerscreen,modeless', { core: this.core, name: item.name, namespace: item.namespace, dimensions: item.dimensions, statistics: statistics, period: period, interval: interval });
    },

};

var ew_MetricAlarmsTreeView = {
    model: ["alarms","topics","subscriptions","aspolicies","volumes","instances","metrics"],
    properties: ["stateValue"],
    refreshTimeout: 30000,

    isRefreshable: function() {
        return true;
    },

    chart: function() {
        var item = this.getSelected();
        if (!item) return;

        var statistics = $('ew.alarms.statistics').value;
        var period = $('ew.alarms.period').value;
        var interval = parseInt($('ew.alarms.time').value);
        openDialog('chrome://ew/content/dialogs/metric.xul', null, 'chrome,centerscreen,modeless', { core: this.core, name: item.metricName, namespace: item.namespace, dimensions: item.dimensions, statistics: statistics, period: period, interval: interval });
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

        function onaccept() {
            var dialog = this;
            var inputs = this.rc.items;
            var values = this.rc.values;
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
                    params.push([inputs[i].label, values[i]]);
                }
            }
            me.core.api.putMetricAlarm(values[0], values[2], values[3], values[5], values[6], values[7], values[8], values[9], params, function() {
                me.refresh();
                dialog.close();
            });
            return true;
        }

        function onchange(idx, onstart) {
            var item = this.rc.items[idx];
            switch (item.label) {
            case "Namespace":
                this.rc.metrics = this.rc.core.queryModel('metrics', 'namespace', item.obj.value);
                this.rc.core.sortObjects(this.rc.metrics, 'dimensions');
                buildListbox(this.rc.items[idx+1].obj, this.rc.metrics, 'name');
                // Preserve existig value
                if (onstart && edit) {
                    this.rc.items[idx+1].obj.value = this.rc.items[idx+1].value;
                    this.rc.items[idx+2].obj.value = this.rc.items[idx+2].value;
                }
                break;

            case "MetricName":
                if (onstart) break;
                var metric = this.rc.metrics[item.obj.selectedIndex];
                this.rc.items[idx+1].obj.value = '';
                if (!metric) break;
                for (var i in metric.dimensions) {
                    this.rc.items[idx+1].obj.value += metric.dimensions[i] + "\n";
                }
                break;

            case "AlarmActions Topics":
            case "InsufficientDataActions Topics":
            case "OKActions Topics":
                if (onstart) break;
                if (item.obj.value) {
                    if (this.rc.items[idx-1].obj.value) this.rc.items[idx-1].obj.value += "\n";
                    this.rc.items[idx-1].obj.value += item.obj.value;
                    item.obj.value = '';
                }
                break;
            }
        }

        var topics = this.core.queryModel('topics').concat(this.core.queryModel('aspolicies'));
        var inputs = [{label:"AlarmName",required:1},
                      {label:"AlarmDescription",maxlength:255},
                      {label:"Namespace",type:"menulist",list:this.core.getCloudWatchNamespaces(),required:1,key:"type"},
                      {label:"MetricName",type:"menulist",required:1,key:'name',style:"max-width:300px"},
                      {label:"Dimensions",multiline:true,cols:30,rows:3,wrap:'off',help:"One name:value pair per line"},
                      {label:"ComparisonOperator",type:"menulist",list:["GreaterThanOrEqualToThreshold","GreaterThanThreshold","LessThanThreshold","LessThanOrEqualToThreshold"],required:1,tooltiptext:"The arithmetic operation to use when comparing the specified Statistic and Threshold. The specified Statistic value is used as the first operand.Type: String.Valid Values:GreaterThanOrEqualToThreshold |GreaterThanThreshold |LessThanThreshold |LessThanOrEqualToThreshold"},
                      {label:"Threshold",type:"number",decimalplaces:2,size:10,required:1,tooltiptext:"The value against which the specified statistic is compared."},
                      {label:"Period",type:"number",required:1,help:"seconds",value:300,tooltiptext:"The period in seconds over which the specified statistic is applied."},
                      {label:"EvaluationPeriods",type:"number",required:1,value:1,tooltiptext:"The number of periods over which data is compared to the specified threshold."},
                      {label:"Statistic",type:"menulist",list:["Average","SampleCount","Sum","Minimum","Maximum"],required:1,tooltiptext:"The statistic to apply to the alarm's associated metric.Type: String. Valid Values: SampleCount | Average | Sum | Minimum | Maximum"},
                      {label:"Unit",type:"menulist",list:['Seconds','Microseconds','Milliseconds','Bytes','Kilobytes','Megabytes','Gigabytes','Terabytes','Bits','Kilobits','Megabits','Gigabits','Terabits','Percent','Count','Bytes/Second','Kilobytes/Second','Megabytes/Second','Gigabytes/Second','Terabytes/Second','Bits/Second','Kilobits/Second','Megabits/Second','Gigabits/Second','Terabits/Second','Count/Second']},
                      {label:"AlarmActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line",tooltiptext:"The list of actions to execute when this alarm transitions into an ALARM state from any other state. Each action is specified as an Amazon Resource Number (ARN). Currently the only action supported is publishing to an Amazon SNS topic or an Amazon Auto Scaling policy. Type: String list. Length constraints: Minimum of 0 item(s) in the list. Maximum of 5 item(s) in the list."},
                      {label:"AlarmActions Topics",type:"menulist",list:topics},
                      {label:"InsufficientDataActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line",tooltiptext:"The list of actions to execute when this alarm transitions into an INSUFFICIENT_DATA state from any other state. Each action is specified as an Amazon Resource Number (ARN). Currently the only action supported is publishing to an Amazon SNS topic or an Amazon Auto Scaling policy."},
                      {label:"InsufficientDataActions Topics",type:"menulist",list:topics},
                      {label:"OKActions",multiline:true,cols:40,rows:3,wrap:'off',help:"One ARN per line",tooltiptext:"The list of actions to execute when this alarm transitions into an OK state from any other state. Each action is specified as an Amazon Resource Number (ARN). Currently the only action supported is publishing to an Amazon SNS topic or an Amazon Auto Scaling policy."},
                      {label:"OKActions Topics",type:"menulist",list:topics},
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
            inputs[11].value = item.actions.join("\n");
            inputs[13].value = item.insufficientDataActions.join("\n");
            inputs[15].value = item.okActions.join("\n");
        }

        var values = this.core.promptInput("Put CloudWatch Alarm", inputs, {onchange:onchange,onaccept:onaccept});
        if(!values) return;
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
        // If called with this view active, refresh all models
        this.refresh()
    },

    refresh: function()
    {
        if (this.core.getModel('metrics') == null) {
            ew_MetricsTreeView.refresh();
        }
        if ($('ew.graphs.dimensions').itemCount <= 1) {
            ew_MetricsTreeView.fillMetrics();
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
        this.setDimensions($('ew.graphs.dimensions').label, $('ew.graphs.dimensions').value);
    },

    setDimensions: function(title, value, view)
    {
        var me = this;
        var page = $('ew.graphs.page');
        clearElement(page)

        this.metrics = [];
        this.dimensions = this.core.parseTags(value);
        $("ew.graphs.title").label = "Cloud Watch Graphs" + (this.dimensions.length ? ": " + title : "");
        if (!this.dimensions.length) return;

        var page = $('ew.graphs.page');
        this.core.api.listMetrics(null, null, this.dimensions, function(list) {
            me.metrics = list;
            for (var i = 0; i < list.length; i++) {
                if (i % 3 == 0) {
                    hbox = document.createElement('hbox');
                    hbox.setAttribute('style', 'padding:5px;');
                    page.appendChild(hbox);
                }
                vbox = document.createElement('vbox');
                vbox.appendChild(makeElement('label', 'control', 'ew.graphs.' + list[i].name, 'value', list[i].name));
                var canvas = makeCanvas(me.core);
                canvas.setAttribute('id', 'ew.graphs.' + list[i].name);
                canvas.setAttribute('width', '280');
                canvas.setAttribute('height', '240');
                vbox.appendChild(canvas);
                hbox.appendChild(vbox);

                var spacer = document.createElement('spacer');
                spacer.setAttribute('width', '25px');
                hbox.appendChild(spacer);
            }
            if (view) me.show();
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
        var me = this;
        var id = 'ew.graphs.' + name;
        if (!$(id)) return;
        var statistics = $('ew.graphs.statistics').value;
        var period = $('ew.graphs.period').value;
        var interval = parseInt($('ew.graphs.interval').value);
        var end = new Date();
        var start = new Date(end.getTime() - interval * 1000);

        this.core.api.getMetricStatistics(name, namespace, start.toISOString(), end.toISOString(), period, statistics, null, this.dimensions, function(list) {
            if (!list) list = [];
            graph = new Graph((list.length ? list[0].unit : "None"), id, "line", me.core);
            graph.options.xlabel = 'Time';
            for (var i = 0; i < list.length; i++) {
                graph.addPoint(i, list[i].value, list[i].timestamp.strftime(interval < 86400 ? '%H:%M' : '%Y-%m-%d %H:%M'));
            }
            graph.draw();
        });
    },

};
