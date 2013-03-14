//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_SWFDomainsTreeView = {
    model: [ "swfdomains", ],

    selectionChanged: function()
    {
        var item = this.getSelected();
        if (!item) return;
        if (item.activityTypes) {
            ew_SWFActivityTypesTreeView.display(item.activityTypes);
        } else {
            this.core.api.listActivityTypes(item.name, function(list) {
                ew_SWFActivityTypesTreeView.display(list);
            });
        }
    },

    addItem: function()
    {

    },

    deleteSelected: function()
    {

    },

};

var ew_SWFActivityTypesTreeView = {

    display: function(list)
    {
        for (var i in list) {
            list[i].name = list[i].activityType.name;
            list[i].version = list[i].activityType.version;
        }
        TreeView.display.call(this, list);
    },

    addItem: function()
    {

    },

    deleteSelected: function()
    {

    },

};
