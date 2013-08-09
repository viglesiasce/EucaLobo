//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_SQSTreeView = {
    model: "queues",

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.queues.contextmenu.delete').disabled = item == null;
        $('ew.queues.contextmenu.perm').disabled = !item;
        $('ew.queues.contextmenu.config').disabled = !item;
        $('ew.queues.contextmenu.send').disabled = !item;
        $('ew.queues.contextmenu.copy').disabled = !item;
    },

    selectionChanged: function()
    {
        ew_SQSMsgTreeView.update();
    },

    displayDetails: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        this.core.api.getQueueAttributes(item.url, function(list) {
            list.forEach(function(x) { item[x.name] = x.value; });
            TreeView.displayDetails.call(me);
        });
    },

    addQueue: function()
    {
        var me = this;

        var name = this.core.prompt('Create Queue');
        if (!name) return;
        this.core.api.createQueue(name, [], function(url) {
            me.core.addModel("queues", new Element('name', url.split('/').pop(), 'url', url));
            me.invalidate();
        });
    },

    deleteQueue: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Queue ' + item.id)) return;
        this.core.api.deleteQueue(item.url, function() { me.refresh(); });
    },

    addPermission: function()
    {
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
                actions.push({name:inputs[i].label,id:values[1]});
            }
        }
        this.core.api.addQueuePermission(item.url, values[0], actions, function(id) {});
    },

    sendMessage: function()
    {
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Message", [{label:"Text",multiline:true,rows:15,cols:50,required:true,scrollbars:true},
                                                       {label:"Delay Seconds",type:"number",max:900}]);
        if (!values) return;
        this.core.api.sendMessage(item.url, values[0], values[1], function(id) {});
    },

    configureQueue: function()
    {
        var fields = [ {label:"Visibility Timeout Seconds",type:"number",min:0,max:12*3600,name:"VisibilityTimeout"},
                       {label:"Maximum Message Size (bytes)",type:"number",name:"MaximumMessageSize"},
                       {label:"Message Retention Period Seconds",type:"number",value:345600,min:60,max:14*86400,name:"MessageRetentionPeriod"},
                       {label:"Delay Seconds",type:"number",min:0,max:900,name:"DelaySeconds"},
                       {label:"Receive Message Wait Time Seconds",type:"number",min:0,max:20,name:" ReceiveMessageWaitTimeSeconds"},
                       {label:"Policy",multiline:true,rows:12,flex:"2",width:"100%",name:"Policy"},
                       ];

        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.getQueueAttributes(item.url, function(list) {
            list.forEach(function(x) { item[x.name] = x.value; });

            var values = me.core.promptAttributes('Configure Queue', fields, list);
            for (var i in values) {
                me.core.api.setQueueAttributes(item.id, values[i].name, values[i].value);
                item[values[i].name] = values[i].value;
            }
        });
    },
};

var ew_SQSMsgTreeView = {
    name: "sqsmsg",

    displayDetails: function()
    {
        var item = this.getSelected();
        if (!item) return;

        this.core.promptInput("Message", [{label:"Id",readonly:true,value:item.id},
                                          {label:"MD5",readonly:true,value:item.md5},
                                          {label:"Handle",readonly:true,value:item.handle},
                                          {label:"SenderId",readonly:true,value:item.SenderId},
                                          {label:"SentTimestamp",type:"label",value:item.SentTimestamp},
                                          {label:"ApproximateReceiveCount",type:"label",value:item.ApproximateReceiveCount},
                                          {label:"ApproximateFirstReceiveTimestamp",type:"label",value:item.ApproximateFirstReceiveTimestamp},
                                          {label:"Text",multiline:true,rows:10,cols:50,readonly:true,scrollbars:true,wrap:'off',value:item.body}]);
    },

    refresh: function()
    {
        var queue = ew_SQSTreeView.getSelected();
        if (!queue) return;
        queue.messages = null;
        this.update();
    },

    update: function()
    {
        var me = this;
        var queue = ew_SQSTreeView.getSelected();
        if (!queue) return this.display([]);

        this.display(queue.messages || []);
        if (!queue.messages) {
            this.core.api.receiveMessage(queue.url, 10, 0, $('ew.messages.timeout').valueNumber, function(list) {
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

        this.core.api.receiveMessage(queue.url, 10, 0, $('ew.messages.timeout').valueNumber, function(list) {
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
        var queue = ew_SQSTreeView.getSelected();
        if (!queue) return;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete this message?')) return;
        this.core.api.deleteMessage(item.url, item.handle, function() {
            me.core.removeObject(queue.messages, item.id);
            me.update(queue);
        });
    },

};
