var ew_CredentialsTreeView = {
    name: "credentials",
    properties: ["status"],

    activate : function()
    {
        this.refresh();
        TreeView.activate.call(this);
        this.select(ew_session.getActiveCredentials());
    },

    deactivate: function()
    {
        if (ew_session.getActiveCredentials() == null) {
            this.switchCredentials();
        }
        TreeView.activate.call(this);
    },

    getList: function()
    {
        return ew_session.getCredentials()
    },

    addCredentials : function()
    {
        var values = this.session.promptInput('Credentials', [{label:"Credentials Name:",required:1}, {label:"AWS Access Key:",required:1}, {label:"AWS Secret Access Key:",type:'password',required:1}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.session.getEndpoints(),key:'url'}, {label:"Security Token:",multiline:true,rows:3}]);
        if (!values) return;
        var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
        ew_session.saveCredentials(cred);
        this.display(ew_session.getCredentials());
    },

    editCredentials : function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        var values = this.session.promptInput('Credentials', [{label:"Credentials Name:",required:1,value:cred.name}, {label:"AWS Access Key:",required:1,value:cred.accessKey}, {label:"AWS Secret Access Key:",type:'password',required:1,value:cred.secretKey}, {label:"Default Endpoint:",type:'menulist',empty:1,list:this.session.getEndpoints(),key:'url',value:cred.url}, {label:"Security Token:",multiline:true,rows:3,value:cred.securityToken}]);
        if (!values) return;
        ew_session.removeCredentials(cred);
        var cred = new Credential(values[0], values[1], values[2], values[3], values[4]);
        ew_session.saveCredentials(cred);
        this.display(ew_session.getCredentials());
    },

    deleteCredentials : function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        if (!confirm("Delete credentials " + cred.name)) return;
        ew_session.removeCredentials(cred)
        this.display(ew_session.getCredentials());
    },

    filter: function(list)
    {
        for (var i in list) {
            list[i].status = list[i].accessKey == ew_session.accessKey ? "Active" : "";
        }
        return TreeView.filter.call(this, list);
    },

    switchCredentials: function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        ew_session.switchCredentials(cred);
        this.invalidate();
        ew_EndpointsTreeView.invalidate();
    },
};
ew_CredentialsTreeView.__proto__ = TreeView;

var ew_EndpointsTreeView = {
   name: "endpoints",
   properties: ["status"],

   activate : function() {
       TreeView.activate.call(this);
       this.select(ew_session.getActiveEndpoint());
   },

   refresh: function() {
       ew_session.refreshEndpoints();
       this.invalidate();
   },

   getList: function() {
       return ew_session.getEndpoints();
   },

   switchEndpoint : function() {
       var item = this.getSelected();
       if (!item) return;
       var active = ew_session.getActiveEndpoint();

       if (item.url != active.url) {
           if (this.session.isGovCloud()) {
               return alert('Cannot change endpoints in GovCloud region');
           }
           if (this.session.isGovCloud(item.url)) {
               return alert('Cannot use this credentials in GovCloud region');
           }
       }
       ew_session.switchEndpoints(item.name);
       this.invalidate();
   },

   deleteEndpoint : function() {
       var item = this.getSelected();
       if (!item) return;
       if (!confirm('Delete endpoint ' + item.name)) return;
       ew_session.deleteEndpoint(item.name);
       this.refresh();
   },

   addEndpoint: function(name, url) {
       var url = prompt("Enter endpoint URL:");
       if (!url) return;
       var endpoint = new Endpoint(null, url)
       ew_session.addEndpoint(endpoint.name, endpoint);
       this.refresh();
   },

   filter: function(list)
   {
       var endpoint = ew_session.getActiveEndpoint();
       for (var i in list) {
           list[i].status = endpoint && list[i].url == endpoint.url ? "Active" : "";
       }
       return TreeView.filter.call(this, list);
   },
}

ew_EndpointsTreeView.__proto__ = TreeView;
