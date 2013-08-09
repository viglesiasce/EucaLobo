//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_SNSTopicsTreeView = {
    model: "topics",

    selectionChanged: function()
    {
        TreeView.selectionChanged.call(this);
        ew_SNSSubscriptionsTreeView.invalidate();
    },

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.topics.contextmenu.delete').disabled = item == null;
        $('ew.topics.contextmenu.perm').disabled = !item;
        $('ew.topics.contextmenu.config').disabled = !item;
        $('ew.topics.contextmenu.confirmsub').disabled = !item;
        $('ew.topics.contextmenu.subscribe').disabled = !item;
        $('ew.topics.contextmenu.publish').disabled = !item;
    },

    createTopic: function()
    {
        var me = this;

        var name = this.core.prompt('Create Topic');
        if (!name) return;
        this.core.api.createTopic(name, function(arn) {
            me.refresh();
        });
    },

    deleteTopic: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Topic ' + item.name)) return;
        this.core.api.deleteTopic(item.id, function(){ me.refresh(); });
    },

    addPermission: function()
    {
        var item = this.getSelected();
        if (!item) return;

        function addPermissionOnAccept() {
            var countchecked = 0;
            var values = this.rc.values;

            for (var i = 2; i < values.length; i++) {
                if (values[i]) {
                    countchecked++;
                }
            }

            if (countchecked > 0) {
                this.close();
                return false;
            } else {
                alert("At least one action must be checked.");
                return true;
            }
        }

        var inputs = [{label:"Label",required:1},
                      {label:"AWS Account ID",required:1},
                      {label:"CreateTopic",type:"checkbox"},
                      {label:"DeleteTopic",type:"checkbox"},
                      {label:"Subscribe",type:"checkbox"},
                      {label:"Unsubscribe",type:"checkbox"},
                      {label:"ListTopics",type:"checkbox"},
                      {label:"ListSubscriptions",type:"checkbox"},
                      {label:"Publish",type:"checkbox"},
                      ];

        var values = this.core.promptInput("Add Permission", inputs, {onaccept:addPermissionOnAccept});

        if (!values) return;
        var actions = [];
        for (var i = 2; i < values.length; i++) {
            if (values[i]) {
                actions.push({name:inputs[i].label,id:values[1]});
            }
        }
        this.core.api.addTopicPermission(item.url, values[0], actions, function(id) {});

    },

    subscribe: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        var protos = [{id:"http", name:"Delivery of JSON-encoded message via HTTP POST"},
                      {id:"https", name:"Delivery of JSON-encoded message via HTTPS POST"},
                      {id:"email", name:"Delivery of message via SMTP"},
                      {id:"email-json", name: "Delivery of JSON-encoded message via SMTP"},
                      {id: "sms", name:"Delivery of message via SMS"},
                      {id: "sqs", name: "Delivery of JSON-encoded message to an Amazon SQS queue"} ];

        var inputs = [{label:"Topic",type:"label",value:item.name},
                      {label:"Endpoint",required:1},
                      {label:"Protocols",type:"menulist",list:protos,style:"width:350px;max-width:350px"}, ];

        var values = this.core.promptInput("Subscribe", inputs);
        if (!values) return;
        this.core.api.subscribe(item.id, values[1], values[2], function(id) { me.core.refreshModel('subscriptions'); });
    },

    confirmsub: function()
    {
        var item = this.getSelected();
        if (!item) return;

        var inputs = [{label:"Topic",type:"label",value:item.name},
                      {label:"Token",required:1},
                      {label:"Authenticate On Unsubscribe",type:"checkbox" }];

        var values = this.core.promptInput("Confirm Subscription", inputs);
        if (!values) return;
        this.core.api.subscribe(item.id, values[1], values[2], function(id) {});
    },

    publish: function()
    {
        var item = this.getSelected();
        if (!item) return;
        var json = '{\n"default" : "some message",\n"email" : "some email message",\n"email-json" : "some email-json message",\n"http" : "some http message",\n"https" : "some https message",\n"sqs" : "some sqs message"\n }';
        var inputs = [{label:"Subject",},
                      {label:"Text",multiline:true,rows:15,cols:50,required:1,data:json},
                      {label:"Send As JSON",type:"checkbox",oncommand:"document.getElementById('item1').value=document.getElementById('item2').checked?rc.items[1].data:''",},
                      ];
        var values = this.core.promptInput("Publish", inputs);
        if (!values) return;
        this.core.api.publish(item.id, values[0], values[1], values[2], function(id) {});
    },

    configureTopic: function()
    {
        var fields = [ {label:"Delivery Policy",multiline:true,rows:5,cols:50,name:"DeliveryPolicy"},
                       {label:"Policy",multiline:true,rows:5,cols:50,name:"Policy"},
                       {label:"Effective Delivery Policy",multiline:true,rows:5,cols:50,readonly:true,name:"EffectiveDeliveryPolicy"},
                       {label:"Display Name",name:"DisplayName"},
                       ];

        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.getTopicAttributes(item.id, function(list) {
            item.attributes = list;
            var values = me.core.promptAttributes('Configure Topic', fields, list);
            for (var i in values) {
                me.core.api.setTopicAttributes(item.id, values[i].name, values[i].value);
            }
        });
    },
};

var ew_SNSSubscriptionsTreeView = {
    model: "subscriptions",

    filter: function(list)
    {
        var nlist = [];
        var topic = ew_SNSTopicsTreeView.getSelected();
        for (var i in list) {
            if (!topic || list[i].topicArn == topic.id) nlist.push(list[i]);
        }
        return nlist;
    },

    unsubscribe: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Remove this subscription?')) return;
        this.core.api.unsubscribe(item.id, function() {
            me.remove(item);
        });
    },

    configure: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (item.id == 'PendingConfirmation') {
            alert("This subscription is still pending confirmation.");
            return;
        }

        var fields = [ {label:"Delivery Policy",multiline:true,rows:5,cols:50,name:"DeliveryPolicy",tooltiptext:"The new value for the attribute in JSON format."}, ];

        this.core.api.getSubscriptionAttributes(item.id, function(list) {
            item.attributes = list;
            var values = me.core.promptAttributes('Configure Subscription', fields, list);
            for (var i in values) {
                me.core.api.setSubscriptionAttributes(item.id, values[i].name, values[i].value);
            }
        });
    },
};
