//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_JobFlowsTreeView = {
    model: ["jobflows", "availabilityZones", "subnets", "keypairs"],

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

        // Warning: the labels used in this dialog must match the parameter names to the EMR API,
        // for example the label "Log Uri" is converted to "LogUri" and used on the EMR API.  Also,
        // these may be prefixed if necesary - to do that, add a prefix:"myprefix" property.
        var inputs = [{label:'EMR',type:'tabs',list:['General','Instance Group','Bootstrap','Steps']},
                      {label:'General',type:'tabpanel'},
                      {label:"Name",tooltiptext:"Friendly name given to the job flow",required:true},
                      {label:"Instance Count",type:"number",min:1,tooltiptext:"Number of instances for the job flow."},
                      {label:"Master Instance Type",type:"menulist",prefix:"Instances.",list:this.core.getInstanceTypes(),required:true,style:"max-width:350px;",tooltiptext:"The Amazon EC2 instance type for master nodes"},
                      {label:"Slave Instance Type",type:"menulist",prefix:"Instances.",list:this.core.getInstanceTypes(),required:true,style:"max-width:350px;",tooltiptext:"The Amazon EC2 instance type for slave nodes"},
                      {label:"Termination Protection", type:"checkbox",prefix:"Instances.",tooltiptext:"A Boolean that indicates whether to protect the job flow and prevent the Amazon EC2 instances in the cluster from shutting down due to API calls, user intervention, or job-flow error."},
                      {label:"Availability Zone",type:"menulist",prefix:"Instances.Placement.",list:this.core.queryModel('availabilityZones'),tooltiptext:"Specifies the Availability Zone the job flow will run in."},
                      {label:"Keep Job Flow Alive When No Steps",type:"checkbox",prefix:"Instances.",tooltiptext:"Specifies whether the job flow should terminate after completing all steps."},
                      {label:"EC2 Key Name",type:"menulist",prefix:"Instances.",list:this.core.queryModel("keypairs"),key:'name',tooltiptext:"Specifies the name of the Amazon EC2 key pair that can be used to ssh to the master node as the user called hadoop."},
                      {label:"EC2 Subnet ID",type:"menulist",prefix:"Instances.",list:this.core.queryModel("subnets"),style:"max-width:350px;",tooltiptext:"To launch the job flow in Amazon Virtual Private Cloud (Amazon VPC), set this parameter to the identifier of the Amazon VPC subnet where you want the job flow to launch. If you do not specify this value, the job flow is launched in the normal Amazon Web Services cloud, outside of an Amazon VPC. Amazon VPC currently does not support cluster compute quadruple extra large (cc1.4xlarge) instances. Thus you cannot specify the cc1.4xlarge instance type for nodes of a job flow launched in a Amazon VPC."},
                      {label:"Hadoop Version",type:"menulist",prefix:"Instances.",list:["0.18", "0.20", "0.20.205"],required:true},
                      {label:"AMI Version",type:"menulist",list:["1.0", "2.0", "latest"],tooltiptext:"The version of the Amazon Machine Image (AMI) to use when launching Amazon EC2 instances in the job flow. The following values ane valid: latest (latest AMI version; currently AMI 2.0, Hadoop 0.20.205), 2.0 (AMI 2.0, Hadoop 0.20.205), 1.0 (AMI 1.0, Hadoop 0.18), If this value is not specified, the job flow uses the default of (AMI 1.0, Hadoop 0.18)."},
                      {label:"Log URI",tooltiptext:"Specifies the location in Amazon S3 to write the log files of the job flow. If a value is not provided, logs are not created."},
                      {label:"Job Flow Role",tooltiptext:"An IAM role for the job flow. The EC2 instances of the job flow assume this role. The default role is EMRJobflowDefault. In order to use the default role, you must have already created it using the CLI."},
                      {label:"Supported Products",type:"listview",rows:3,headers:["","Product"],list:["karmasphere-enterprise-utility","mapr-m3","mapr-m5"],toltiptext:"A list of strings that indicates third-party software to use with the job flow."},
                      {label:"Instance Group",type:"tabpanel"},
                      {label:"Name",tooltiptext:"Friendly name given to the instance group"},
                      {label:"Instance Count",type:"number",prefix:'Instances.InstanceGroup.',min:1,tooltiptext:"Target number of instances for the instance group."},
                      {label:"Instance Type",type:"menulist",prefix:"Instances.InstanceGroup.",list:this.core.getInstanceTypes(),style:"max-width:350px;",tooltiptext:"The Amazon EC2 instance type for instance group instances"},
                      {label:"Instance Role",type:"menulist",prefix:'Instances.InstanceGroup.',list:['MASTER','CORE','TASK'],toltiptext:"The role of the instance group in the cluster."},
                      {label:"Bid Price",type:'number',tooltiptext:"Bid price for each Amazon EC2 instance in the instance group when launching nodes as Spot Instances, expressed in USD."},
                      {label:"Market",type:'menulist',list:['ON_DEMAND','SPOT'],tooltiptext:"Market type of the Amazon EC2 instances used to create a cluster node."},
                      {label:"Bootstrap",type:"tabpanel"},
                      {label:"Action1",prefix:"BootstrapActions.member.1.",multiline:true,cols:60,rows:2,tooltiptext:"Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system. Specify full path for the command and arguments separated by spaces"},
                      {label:"Action2",prefix:"BootstrapActions.member.2.",multiline:true,cols:60,rows:2,tooltiptext:"Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system. Specify full path to the command and arguments separated by spaces"},
                      {label:"Action3",prefix:"BootstrapActions.member.3.",multiline:true,cols:60,rows:2,tooltiptext:"Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system. Specify full path to the command and arguments separated by spaces"},
                      {label:"Action4",prefix:"BootstrapActions.member.4.",multiline:true,cols:60,rows:2,tooltiptext:"Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system. Specify full path to the command and arguments separated by spaces"},
                      {label:"Action5",prefix:"BootstrapActions.member.5.",multiline:true,cols:60,rows:2,tooltiptext:"Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system. Specify full path to the command and arguments separated by spaces"},
                      {label:"Steps",type:"tabpanel"},
                      {label:"Step1",prefix:"Steps.member.1.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step2",prefix:"Steps.member.2.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step3",prefix:"Steps.member.3.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step4",prefix:"Steps.member.4.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step5",prefix:"Steps.member.5.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step6",prefix:"Steps.member.6.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      {label:"Step7",prefix:"Steps.member.7.",multiline:true,cols:60,rows:2,tooltiptext:"Separated by spaces: A path to a JAR file. Then name of the main class in the specified Java file. Then a list of command line arguments passed to the JAR file's main function when executed"},
                      ];
        var values = this.core.promptInput("Create Job Flow", inputs);
        if (!values) return;
        var opts = {};
        for (var i = 3; i < inputs.length; i++) {
            if (!values[i]) continue;
            var label = (inputs[i].prefix || "") + inputs[i].label.replace(/ /g, "");
            switch (inputs[i].type) {
            case "listview":
                for (var j = 0; j < values[i].length; j++) {
                    opts[label + ".member." + (j + 1)] = values[i][j];
                }
                break;

            default:
                switch (inputs[i].label) {
                case "Action1":
                case "Action2":
                case "Action3":
                case "Action4":
                case "Action5":
                    var list = values[i].split(" ");
                    if (!list.length) break;
                    opts[inputs[i].prefix + "Name"] = list[0];
                    opts[inputs[i].prefix + "ScriptBootstrapAction.Path"] = list[0];
                    if (list.length > 1) opts[inputs[i].prefix + "ScriptBootstrapAction.Args"] = list.slice(1).join(",");
                    break;

                case "Step1":
                case "Step2":
                case "Step3":
                case "Step4":
                case "Step5":
                case "Step6":
                case "Step7":
                case "Step8":
                case "Step9":
                    var list = values[i].replace(/[\t\r\n]+/g,' ').split(" ");
                    if (list.length < 2) break;
                    opts[inputs[i].prefix + "Name"] = list[0];
                    opts[inputs[i].prefix + "HadoopJarStep.Jar"] = list[0];
                    opts[inputs[i].prefix + "HadoopJarStep.MainClass"] = list[1];
                    if (list.length > 2) opts[inputs[i].prefix + "HadoopJarStep.Args"] = list.slice(2).join(",");
                    break;

                default:
                    opts[label] = values[i];
                }
            }
        }
        this.core.api.runJobFlow(values[2], values[3], opts, function() { me.refresh(); });
    },

    deleteSelected : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!TreeView.deleteSelected.call(this)) return;
        this.core.api.terminateJobFlows(item.id, function() { me.refresh(); });
    },

    setTerminationProtection: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput("Set Termination Protection",
                        [{label:"Termination Protection", type:"checkbox",tooltiptext:"A Boolean that indicates whether to protect the job flow and prevent the Amazon EC2 instances in the cluster from shutting down due to API calls, user intervention, or job-flow error."}]);
        this.core.api.setTerminationProtection(item.id, values[0], function() { me.refresh(); });
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
        var group = {};
        group.Name = values[0];
        group.InstanceCount = values[1];
        group.InstanceRole = values[2];
        group.InstanceType = values[3];
        group.Market = values[4];
        group.BidPrice = values[5];
        this.core.api.addInstanceGroups(item.id, group, function() { me.refresh(); });
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
        this.core.api.modifyInstanceGroups(values[0], function() { me.refresh(); });
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
                 {label:"Properties",multiline:true,rows:3,cols:60,tooltiptext:"A list of Java properties that are set when the step runs.You can use these properties to pass key value pairs to your main function.Format is: key=value"}
                 ]);
        if (!values) return;
        var step = {};
        step.Name = values[0];
        step.ActionOnFailure = values[1];
        step.Jar = values[2];
        step.MainClass = values[3];
        step.Args = values[4] ? values[4].split(" ") : "";
        step.Properties = this.core.parseTags(values[5]);
        this.core.api.addJobFlowSteps(item.id, step, function() { me.refresh(); });
    },

};
