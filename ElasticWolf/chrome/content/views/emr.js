//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_JobFlowsTreeView = {
    model: "jobflows",

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.jobflows.contextmenu.delete').disabled = item == null;
        $('ew.jobflows.contextmenu.protect').disabled = item == null;
    },

    addItem: function(instance)
    {
        var me = this;
        var values = this.core.promptInput("Snapshot", [{label:"DB Instance",type:"menulist",list:this.core.queryModel("dbinstances"),required:1,value:instance ? instance.id : ""},
                                                        {label:"DB Snapshot Identifier",type:"name",required:1}]);
        if (!values) return;
        this.core.api.createDBSnapshot(values[0], values[1], function() { me.refresh() });
    },

    deleteSelected : function ()
    {
        var me = this;
        item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.terminateJobFlows(item.id, function() { me.refresh() });
    },

    setTerminationProtection: function()
    {
        var me = this;
        item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Set Termination Protection", [{label:"Termination Protection", type:"checkbox",tooltiptext:"A Boolean that indicates whether to protect the job flow and prevent the Amazon EC2 instances in the cluster from shutting down due to API calls, user intervention, or job-flow error."}]);
        this.core.api.setTerminationProtection(item.id, values[0], function() { me.refresh() });
    },

};
