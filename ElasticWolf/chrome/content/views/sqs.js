var ew_SQSTreeView = {
    model: "queues",
    inputs: [ {label:"Visibility Timeout Seconds",type:"number",min:0,max:12*3600,name:"VisibilityTimeout"},
              {label:"Maximum Message Size (bytes)",type:"number",name:"MaximumMessageSize"},
              {label:"Message Retention Period Seconds",type:"number",value:345600,min:60,max:14*86400,name:"MessageRetentionPeriod"},
              {label:"Delay Seconds",type:"number",min:0,max:900,name:"DelaySeconds"},
              {label:"Policy",multiline:true,rows:10,name:"Policy"},],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.sqs.contextmenu.delete').disabled = item == null;
        $('ew.sqs.contextmenu.perm').disabled = !item;
        $('ew.sqs.contextmenu.config').disabled = !item;
    },

    addQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        var name = prompt('Create Queue');
        if (!name) return;
        ew_session.controller.createQueue(name, [], function(url) {
            ew_model.add("queues", new Queue(url));
            me.invalidate();
        });
    },

    deleteQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Virtual MFA device ' + item.id)) return;
        ew_session.controller.deleteQueue(item.url, function(){ me.refresh() });
    },

    addPermission: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
    },

    sendMessage: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput("Message", [{label:"Text",multiline:true,rows:10,required:1}, {label:"Delay Seconds",type:"number",max:900}]);
        if (!values) return;
        ew_session.controller.sendMessage(item.url, values[0], values[1], function(id) {});
    },

    configureQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        ew_session.controller.getQueueAttributes(item.url, function(list) {
            item.attributes = list;
            var inputs = [];
            // Reset
            for (var j in me.inputs) {
                me.inputs[j].value = "";
                me.inputs[j].found = false;
            }

            for (var i in list) {
                var input = {label: list[i].name, type: 'label'};
                for (var j in me.inputs) {
                    if (me.inputs[j].name == list[i].name) {
                        input = me.inputs[j];
                        input.found = true;
                        break;
                    }
                }
                if (list[i].name.indexOf("Timestamp") > 0) {
                    list[i].value = new Date(list[i].value * 1000);
                }
                input.value = list[i].value;
                if (input.found) inputs.splice(0, 0, input); else inputs.push(input);
            }
            // Add missing entries
            for (var j in me.inputs) {
                if (!me.inputs[j].found) {
                    inputs.splice(0, 0, me.inputs[j]);
                }
            }
            var values = ew_session.promptInput('Configure Queue', inputs);
            if (!values) return;
        });
    },
};
ew_SQSTreeView.__proto__ = TreeView;
ew_SQSTreeView.register();

var ew_SQSMsgTreeView = {
    name: "sqsmsg",

    deleteMessage: function()
    {
        var item = this.getSelected();
        if (!item) return;
    },

};
ew_SQSMsgTreeView.__proto__ = TreeView;
