//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_DDBTreeView = {
    model: ["ddb"],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.ddb.contextmenu.delete').disabled = item == null;
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

};
