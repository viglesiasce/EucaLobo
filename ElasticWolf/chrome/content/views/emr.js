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
        $('ew.jobflows.contextmenu.addgroup').disabled = item == null;
        $('ew.jobflows.contextmenu.modgroup').disabled = item == null;
        $('ew.jobflows.contextmenu.addstep').disabled = item == null;
    },

    addItem: function(instance)
    {
        var me = this;
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

    addGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Add Instance Group",
                [{label:"Name",tooltiptext:"Friendly name given to the instance group",required:true},
                 {label:"InstanceCount",type:"number",min:1,tooltiptext:"Target number of instances for the instance group."},
                 {label:"InstanceRole",type:"menulist",list:["MASTER","CORE","TASK"],required:true},
                 {label:"InstanceType",type:"menulist",list:this.core.getInstanceTypes(),required:true,tooltiptext:"The Amazon EC2 instance type for all instances in the instance group"},
                 {label:"Market",type:"menulist",list:["ON_DEMAND","SPOT"],required:true,tooltiptext:"Market type of the Amazon EC2 instances used to create a cluster node."},
                 {label:"BidPrice",type:"number",min:0,tooltiptext:"Bid price for each Amazon EC2 instance in the instance group when launching nodes as Spot Instances, expressed in USD."}]);
        if (!values) return;
        var group = {}
        group.Name = values[0];
        group.InstanceCount = values[1];
        group.InstanceRole = values[2];
        group.InstanceType = values[3];
        group.Market = values[4];
        group.BidPrice = values[5];
        this.core.api.addInstanceGroups(item.id, group, function() { me.refresh() });
    },

    modifyGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var groups = item.instanceGroups;
        if (!groups.length) return  alert("There are no groups to modify");

        var values = this.core.promptInput("Modify Instance Group",
                [{label:"Select group to modify", type:"menulist", list:groups,required:true,actual:true,style:"max-width:300px"},
                 {label:"Number of instance in the group:",type:"number",min:0,}]);
        if (!values) return;
        values[0].InstanceCount = values[1];
        this.core.api.modifyInstanceGroups(values[0], function() { me.refresh() });
    },

    addFlowStep: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Add Job Flow Step",
                [{label:"Name",tooltiptext:"Friendly name given to the job flow step",required:true},
                 {label:"ActionOnFailure",type:"menulist",list:["TERMINATE_JOB_FLOW","CANCEL_AND_WAIT","CONTINUE"],required:true},
                 {label:"Jar",tooltiptext:"A path to a JAR file run during the step."},
                 {label:"MainClass",tooltiptext:"The name of the main class in the specified Java file. If not specified, the JAR file should specify a Main-Class in its manifest file."},
                 {label:"Args",multiline:true,rows:3,cols:60,tooltiptext:"A list of command line arguments passed to the JAR file's main function when executed"},
                 {label:"Propertis",multiline:true,rows:3,cols:60,tooltiptext:"A list of Java properties that are set when the step runs.You can use these properties to pass key value pairs to your main function.Format is: key=value"}
                 ]);
        if (!values) return;
        var step = {}
        step.Name = values[0]
        step.ActionOnFailure = values[1]
        step.Jar = values[2];
        step.MainClass = values[3];
        step.Args = values[4] ? values[4].split(" ") : "";
        step.Properties = this.core.parseTags(values[5]);
        this.core.api.addJobFlowSteps(item.id, step, function() { me.refresh() });
    },

};
