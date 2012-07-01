//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_HostedZonesTreeView = {
    model: [ "hostedZones"],

    selectionChanged: function()
    {
        var item = this.getSelected();
        if (!item) return;
        if (!item.nameServers) {
            this.core.api.getHostedZone(item.id, function(obj) { item.nameServers = obj.nameServers; })
        }
        if (!item.records) {
            this.core.api.listResourceRecordSets(item.id, function(list) { ew_HostedRecordsTreeView.display(list); })
        } else {
            ew_HostedRecordsTreeView.display(item.records);
        }
    },

    create: function()
    {
        var values = this.core.promptInput('Create Hosted Zone', [{label:'Doman Name',type:'name',required:1},
                                                                  {label:'Unique Reference Id',required:1,value:this.core.getCurrentUser() + (new Date()).getTime()},
                                                                  {label:"Comment"}]);
        if (!values) return;
        var me = this;
        this.core.api.createHostedZone(values[0], values[1], values[2], function(obj) {
            me.addModel('hostedZones', obj);
            me.invalidate();
        })
    },

    deleteSelected: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Zone?')) return;
        this.core.api.deleteHostedZone(item.id, function() { me.refresh()})
    },

};


var ew_HostedRecordsTreeView = {
    name: "hostedRecords",

    create: function()
    {
    },

    deleteSelected: function()
    {
        var me = this;
        var zone = ew_HostedZonesTreeView.getSelected();
        if (!zone) return;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Zone Record?')) return;
        this.core.api.changeResourceRecordSets('DELETE', zone.id, item, function() { me.refresh()})
    },
};
