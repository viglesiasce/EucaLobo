var ew_CredentialsTreeView = {
    name: "credentials",
    properties: ["status"],

    activate : function()
    {
        this.refresh();
        TreeView.activate.call(this);
        this.select(this.core.getActiveCredentials());
    },

    deactivate: function()
    {
        if (this.core.getActiveCredentials() == null) {
            this.switchCredentials();
        }
        TreeView.activate.call(this);
    },

    getList: function()
    {
        return this.core.getCredentials()
    },

    addCredentials : function()
    {
        var values = this.core.promptInput('Credentials', [{label:"Credentials Name:",required:1,size:45}, {label:"AWS Access Key:",required:1,size:45}, {label:"AWS Secret Access Key:",type:'password',required:1,size:45}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.core.getEndpoints(),key:'url'}, {label:"Security Token:",multiline:true,rows:3,cols:45}]);
        if (!values) return;
        var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
        this.core.saveCredentials(cred);
        this.display(this.core.getCredentials());
    },

    editCredentials : function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        var values = this.core.promptInput('Credentials', [{label:"Credentials Name:",required:1,value:cred.name,size:45}, {label:"AWS Access Key:",required:1,value:cred.accessKey,size:45}, {label:"AWS Secret Access Key:",type:'password',required:1,value:cred.secretKey,size:45}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.core.getEndpoints(),key:'url',value:cred.url}, {label:"Security Token:",multiline:true,rows:3,cols:45,value:cred.securityToken}]);
        if (!values) return;
        this.core.removeCredentials(cred);
        var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
        this.core.saveCredentials(cred);
        this.display(this.core.getCredentials());
    },

    deleteCredentials : function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        if (!confirm("Delete credentials " + cred.name)) return;
        this.core.removeCredentials(cred)
        this.display(this.core.getCredentials());
    },

    filter: function(list)
    {
        for (var i in list) {
            list[i].status = list[i].accessKey == this.core.api.accessKey ? "Active" : "";
        }
        return TreeView.filter.call(this, list);
    },

    switchCredentials: function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        this.core.switchCredentials(cred);
        this.invalidate();
        ew_EndpointsTreeView.invalidate();
    },
};
ew_CredentialsTreeView.__proto__ = TreeView;

var ew_EndpointsTreeView = {
   name: "endpoints",
   properties: ["status"],

   activate : function()
   {
       TreeView.activate.call(this);
       this.select(this.core.getActiveEndpoint());
   },

   refresh: function()
   {
       this.core.refreshEndpoints();
       this.invalidate();
   },

   getList: function()
   {
       return this.core.getEndpoints();
   },

   switchEndpoint : function() {
       var item = this.getSelected();
       if (!item) return;
       var active = this.core.getActiveEndpoint();

       if (item.url != active.url) {
           if (this.core.isGovCloud()) {
               return this.core.alertDialog("Credential Error", 'Cannot use non-Govcloud credentials in GovCloud.');
           }
           if (this.core.isGovCloud(item.url)) {
               return this.core.alertDialog("Credential Error", 'Cannot use GovCloud credentials in commercial regions.');
           }
       }
       this.core.switchEndpoints(item.name);
       this.invalidate();
   },

   deleteEndpoint : function() {
       var item = this.getSelected();
       if (!item) return;
       if (!confirm('Delete endpoint ' + item.name)) return;
       this.core.deleteEndpoint(item.name);
       this.refresh();
   },

   addEndpoint: function(name, url) {
       var url = prompt("Enter endpoint URL:");
       if (!url) return;
       var endpoint = new Endpoint(null, url)
       this.core.addEndpoint(endpoint.name, endpoint);
       this.refresh();
   },

   filter: function(list)
   {
       for (var i in list) {
           list[i].status = list[i].url == this.core.api.urls.EC2 ? "Active" : "";
       }
       return TreeView.filter.call(this, list);
   },
}

ew_EndpointsTreeView.__proto__ = TreeView;
