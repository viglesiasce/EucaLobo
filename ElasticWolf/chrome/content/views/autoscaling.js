//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_ASGroupsTreeView = {
    model: [ "asgroups", "asconfigs"],

    addGroup: function()
    {

    },

    deleteGroup : function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var check = {value: false};
        if (!this.core.promptConfirm("Delete AutoScaling Group", "Delete " + item.name + "?", "Force Delete", check)) return;
        this.core.api.deleteAutoScalingGroup(item.name, check.value, function() { me.refresh(); });
    },

};

var ew_ASConfigsTreeView = {
    model: ["asconfigs", "asgroups", "snapshots", "images", "instanceProfiles", "keypairs", "securityGroups", "vpcs", "subnets"],

    addConfig: function()
    {
        var me = this;
        function callback(idx, onstart) {
            var input = this;
            var item = this.rc.items[idx];
            switch (idx) {
            case 2:
                var images = me.core.getImagesByType(me.core.getModel('images'), item.obj.value);
                var amiList = this.rc.items[idx+1].obj;
                amiList.removeAllItems();
                for (var i in images) {
                    amiList.appendItem(images[i].toString(), images[i].id)
                }
                amiList.selectedIndex = 0;
                break;
            }
        }

        var values = this.core.promptInput("Create Launch Configuration",
                [{label:"Name",required:1},
                 {label:"InstanceType",type:"menulist",list:this.core.getInstanceTypes(),required:1,style:"max-width:500px"},
                 {label:"Images",type:"menulist",list:this.core.getImageFilters(),key:"value",required:1},
                 {label:"Instance Image",type:"menulist",list:[],required:1,style:"max-width:500px"},
                 {label:"Kernel"},
                 {label:"Ramdisk"},
                 {label:"IAM Profile",type:"menulist",list:this.core.queryModel("instanceProfiles")},
                 {label:"Keypair Name",type:"menulist",list:this.core.queryModel("keypairs")},
                 {label:"Spot Instance Price",type:"number"},
                 {label:"User Data"},
                 {label:"Monitoring",type:"checkbox"},
                 {label:"Security Groups",type:"listbox",list:this.core.queryModel('securityGroups'),seltype:'multiple',flex:1,rows:5}
                 ], false, callback);
        if (!values) return;
    },

    deleteConfig : function ()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete configuration ' + item.name + '?')) return;
        this.core.api.deleteLaunchConfiguration(item.name, function() { me.refresh(); });
    },

};

