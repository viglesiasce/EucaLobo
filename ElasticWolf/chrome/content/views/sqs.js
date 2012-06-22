var ew_SQSTreeView = {
    model: "queues",
    inputs: [ {label:"Visibility Timeout Seconds",type:"number",min:0,max:12*3600,name:"VisibilityTimeout"},
              {label:"Maximum Message Size (bytes)",type:"number",name:"MaximumMessageSize"},
              {label:"Message Retention Period Seconds",type:"number",value:345600,min:60,max:14*86400,name:"MessageRetentionPeriod"},
              {label:"Delay Seconds",type:"number",min:0,max:900,name:"DelaySeconds"},
              {label:"Policy",multiline:true,rows:12,flex:"2",width:"100%",name:"Policy"},],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.sqs.contextmenu.delete').disabled = item == null;
        $('ew.sqs.contextmenu.perm').disabled = !item;
        $('ew.sqs.contextmenu.config').disabled = !item;
    },

    selectionChanged: function()
    {
        var me = this;
        var item = this.getSelected();
        ew_SQSMsgTreeView.update(item);
    },

    addQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        var name = prompt('Create Queue');
        if (!name) return;
        this.session.api.createQueue(name, [], function(url) {
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
        this.session.api.deleteQueue(item.url, function(){ me.refresh() });
    },

    addPermission: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        var inputs = [{label:"Label",required:1},
                      {label:"AWS Account",required:1,type:"number"},
                      {label:"ReceiveMessage",type:"checkbox"},
                      {label:"DeleteMessage",type:"checkbox"},
                      {label:"ChangeMessageVisibility",type:"checkbox"},
                      {label:"GetQueueAttributes",type:"checkbox"},
                      {label:"GetQueueUrl",type:"checkbox"}];

        var values = ew_session.promptInput("Add Permission", inputs);
        if (!values) return;
        var actions = [];
        for (var i = 2; i < values.length; i++) {
            if (values[i]) {
                actions.push({name:inputs[i].label,id:values[1]})
            }
        }
        this.session.api.addPermission(item.url, values[0], actions, function(id) {});

    },

    sendMessage: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = ew_session.promptInput("Message", [{label:"Text",multiline:true,rows:10,required:1}, {label:"Delay Seconds",type:"number",max:900}]);
        if (!values) return;
        this.session.api.sendMessage(item.url, values[0], values[1], function(id) {});
    },

    configureQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.session.api.getQueueAttributes(item.url, function(list) {
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
                // Nice help hints about the numbers
                if(input.label.indexOf("Seconds") > 0) {
                    input.help = formatDuration(parseInt(input.value));
                }
                if(input.label.indexOf("Size") > 0) {
                    input.help = formatSize(parseInt(input.value));
                }
                if (input.label == "Policy" && input.value != "") {
                    try {
                        input.value = formatJSON(JSON.parse(input.value));
                    }
                    catch(e) { debug(e) }
                }
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

var ew_SQSMsgTreeView = {
    name: "sqsmsg",

    refresh: function()
    {
        var queue = ew_SQSTreeView.getSelected();
        if (!queue) return;
        queue.messages = null;
        ew_SQSTreeView.selectionChanged();
    },

    update: function(queue)
    {
        var me = this;
        if (!queue) {
            display([]);
            return;
        }
        this.display(queue.messages);
        if (!queue.messages) {
            this.session.api.receiveMessage(queue.url, 0, 0, function(list) {
               queue.messages = list;
               me.display(queue.messages);
            });
        }
    },

    append: function()
    {
        var me = this;
        var queue = ew_SQSTreeView.getSelected();
        if (!queue) return;

        this.session.api.receiveMessage(queue.url, 0, 0, function(list) {
            for (var i = 0; i < list.length; i++) {
                if (!me.find(list[i])) {
                    queue.messages.push(list[i]);
                }
            }
            me.display(queue.messages);
         });
    },

    deleteMessage: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete this message?')) return;
        this.session.api.deleteMessage(item.url, item.handle, function() {
            me.remove(item);
        })
    },

};
ew_SQSMsgTreeView.__proto__ = TreeView;