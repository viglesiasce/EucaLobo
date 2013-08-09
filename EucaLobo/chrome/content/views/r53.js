//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//


var ew_HostedZonesTreeView = {
    model: [ "hostedZones", "loadBalancers"],

    selectionChanged: function()
    {
        ew_HostedRecordsTreeView.display([]);

        var item = this.getSelected();
        if (!item) return;
        if (!item.nameServers) {
            this.core.api.getHostedZone(item.id, function(obj) { item.nameServers = obj.nameServers; });
        }
        if (!item.records) {
            this.core.api.listResourceRecordSets(item.id, function(list) { ew_HostedRecordsTreeView.display(list); });
        } else {
            ew_HostedRecordsTreeView.display(item.records);
        }
    },

    create: function()
    {
        var values = this.core.promptInput('Create Hosted Zone', [{label:'Doman Name',type:'name',required:1},
                                                                  {label:'Unique Reference Id',required:1,value:this.core.getAccountName() + (new Date()).getTime()},
                                                                  {label:"Comment"}]);
        if (!values) return;
        var me = this;
        this.core.api.createHostedZone(values[0], values[1], values[2], function(obj) {
            me.core.addModel('hostedZones', obj);
            me.invalidate();
        });
    },

    deleteSelected: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Zone?')) return;
        this.core.api.deleteHostedZone(item.id, function() { me.refresh(); });
    },

};


var ew_HostedRecordsTreeView = {
    name: "hostedRecords",

    create: function()
    {
        var zone = ew_HostedZonesTreeView.getSelected();
        if (!zone) return;
        var dnsnames = [];
        for (var i in zone.records) {
            dnsnames.push(zone.records[i].name);
        }
        var elbs = this.core.queryModel('loadBalancers');
        for (var i in elbs) {
            dnsnames.push(elbs[i].DNSName);
        }

        var types = {A: "IPv4 address like 192.0.2.1",
                     AAAA: "IPv6 address like 2001:0db8:85a3:0:0:8a2e:0370:7334",
                     CNAME: "Host name, cannot be used for top domains, only subdomains and hosts",
                     MX: "Priority of the MX record, and the domain name of a mail host, like 10 mail.example.com",
                     NS: "Host name",
                     PTR: "Host name",
                     SOA: "Seven fields: primary authority for the zone, contact details, zone serial number, refresh time, retry time, expire time, and TTL, like ns-2048.awsdns-64.net hostmaster.awsdns.com 1 1 1 1 60",
                     SPF: "Space separated list of double-quoted strings, like \"v=spf1 ip4:192.168.0.1/16 -all\"",
                     SRV: "Priority, weight, port, domain name, like 10 5 80 hostname.example.com",
                     TXT: "Space separated list of double-quoted strings, like \"item 1\" \"item 2\"",
                     Simple: ["A", "AAAA", "CNAME", "TXT" ] };

        var inputs = [{label:'Name',type:'name',required:1},
                      {label:'Type',required:1,type:"menulist",list:["A", "AAAA", "CNAME", "MX", "NS", "PTR", "SOA", "SPF", "SRV", "TXT"]},
                      {label:"",style:"-moz-appearance:none;border:0;background-color:transparent;",cols:45,rows:2,readonly:true,multiline:true,value:types.A},
                      {label:"Value"},
                      {label:"TTL (sec)",type:"number",min:0,value:"3600"},
                      {label:"",type:"section"},
                      {label:"ALias Record",type:"radio",list:["No", "Yes"]},
                      {label:"Host Zone",type:"label"},
                      {label:"DNS Name",type:"menulist",list:dnsnames,disabled:true},
                      {label:"",type:"section"},
                      {label:"Routing Policy",type:"radio",list:["Simple", "Weighted", "Latency"]},
                      {label:"Weight",disabled:true},
                      {label:"Region",type:"menulist",list:this.core.api.getRoute53Regions(),disabled:true},
                      {label:"Set Id",disabled:true}];

        // Handler for input fields
        function onchange(idx) {
            this.rc.items[2].obj.value = types[this.rc.items[1].obj.value];
            switch (this.rc.items[6].obj.value) {
            case "No":
                this.rc.items[4].obj.value = "3600";
                this.rc.items[7].obj.value = "";
                this.rc.items[8].obj.value = "";
                this.rc.items[8].obj.disabled = true;
                break;
            case "Yes":
                if (this.rc.items[1].obj.value != "A" && this.rc.items[1].obj.value != "AAAA") {
                    this.rc.items[6].obj.value = "No";
                    break;
                }
                this.rc.items[3].obj.value = "";
                this.rc.items[4].obj.value = "";
                this.rc.items[7].obj.value = zone.toString();
                this.rc.items[8].obj.disabled = false;
                break;
            }
            if (this.rc.items[10].obj.value != "Simple" && types.Simple.indexOf(this.rc.items[1].obj.value) == -1) {
                this.rc.items[10].obj.value = "Simple";
            }

            switch (this.rc.items[10].obj.value) {
            case "Simple":
                this.rc.items[11].obj.disabled = true;
                this.rc.items[12].obj.disabled = true;
                this.rc.items[12].obj.value = "";
                this.rc.items[13].obj.disabled = true;
                break;
            case "Weighted":
                this.rc.items[11].obj.disabled = false;
                this.rc.items[12].obj.disabled = true;
                this.rc.items[12].obj.value = "";
                this.rc.items[13].obj.disabled = false;
                break;
            case "Latency":
                this.rc.items[11].obj.disabled = true;
                this.rc.items[12].obj.disabled = false;
                this.rc.items[13].obj.disabled = false;
                break;
            }
        }

        var values = this.core.promptInput('Create Record', inputs, {onchange:onchange});
        if (!values) return;
        var item = {};
        item.comment = this.core.getAccountName();
        item.name = values[0];
        item.type = values[1];
        item.ttl = values[4];
        item.values = [ values[3] ];
        item.hostedZoneId = values[7];
        item.dnsName = values[8];
        item.weight = values[11];
        item.region = values[12];
        item.setId = values[13];
        this.core.api.changeResourceRecordSets('CREATE', zone.id, item, function() { ew_HostedZonesTreeView.refresh(); });
    },

    deleteSelected: function()
    {
        var zone = ew_HostedZonesTreeView.getSelected();
        if (!zone) return;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Zone Record?')) return;
        this.core.api.changeResourceRecordSets('DELETE', zone.id, item, function() { ew_HostedZonesTreeView.refresh(); });
    },
};
