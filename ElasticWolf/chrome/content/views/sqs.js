//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_SQSTreeView = {
    model: "queues",

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
        this.core.api.createQueue(name, [], function(url) {
            me.core.addModel("queues", new Queue(url));
            me.invalidate();
        });
    },

    deleteQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Virtual MFA device ' + item.id)) return;
        this.core.api.deleteQueue(item.url, function(){ me.refresh() });
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

        var values = this.core.promptInput("Add Permission", inputs);
        if (!values) return;
        var actions = [];
        for (var i = 2; i < values.length; i++) {
            if (values[i]) {
                actions.push({name:inputs[i].label,id:values[1]})
            }
        }
        this.core.api.addQueuePermission(item.url, values[0], actions, function(id) {});

    },

    sendMessage: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Message", [{label:"Text",multiline:true,rows:10,required:1}, {label:"Delay Seconds",type:"number",max:900}]);
        if (!values) return;
        this.core.api.sendMessage(item.url, values[0], values[1], function(id) {});
    },

    configureQueue: function()
    {
        var fields = [ {label:"Visibility Timeout Seconds",type:"number",min:0,max:12*3600,name:"VisibilityTimeout"},
                       {label:"Maximum Message Size (bytes)",type:"number",name:"MaximumMessageSize"},
                       {label:"Message Retention Period Seconds",type:"number",value:345600,min:60,max:14*86400,name:"MessageRetentionPeriod"},
                       {label:"Delay Seconds",type:"number",min:0,max:900,name:"DelaySeconds"},
                       {label:"Policy",multiline:true,rows:12,flex:"2",width:"100%",name:"Policy"},
                       ];

        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.getQueueAttributes(item.url, function(list) {
            item.attributes = list;
            var values = me.core.promptAttributes('Configure Queue', fields, list);
            for (var i in values) {
                me.core.api.setQueueAttributes(item.id, values[i].name, values[i].value)
            }
        });
    },
};

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
            this.core.api.receiveMessage(queue.url, 0, 0, function(list) {
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

        this.core.api.receiveMessage(queue.url, 0, 0, function(list) {
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
        this.core.api.deleteMessage(item.url, item.handle, function() {
            me.remove(item);
        })
    },

};
