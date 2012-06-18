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

    deleteCredentials : function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        if (!confirm("Delete credentials " + cred.name)) return;
        ew_session.removeCredentials(cred)
        this.display(ew_session.getCredentials());
    },

    addCredentials : function()
    {
        var rc = { ok: null, endpoints: ew_session.getEndpoints() };
        window.openDialog("chrome://ew/content/dialogs/create_credentials.xul", null, "chrome,centerscreen, modal, resizable", rc);
        if (rc.ok) {
            var cred = new Credential(rc.name, rc.accessKey, rc.secretKey, rc.endpoint);
            ew_session.saveCredentials(cred);
            this.display(ew_session.getCredentials());
        }
    },

    filter: function(list)
    {
        var cred = ew_session.getActiveCredentials();
        for (var i in list) {
            list[i].status = cred && list[i].name == cred.name ? "Current" : "";
        }
        return TreeView.filter.call(this, list);
    },

    switchCredentials: function()
    {
        var cred = this.getSelected();
        if (!cred) return;
        ew_session.switchCredentials(cred);
        this.invalidate();
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
           list[i].status = endpoint && list[i].url == endpoint.url ? "Current" : "";
       }
       return TreeView.filter.call(this, list);
   },
}

ew_EndpointsTreeView.__proto__ = TreeView;
