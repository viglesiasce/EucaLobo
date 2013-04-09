//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_api = {
    EC2_API_VERSION: '2012-12-01',
    ELB_API_VERSION: '2012-06-01',
    IAM_API_VERSION: '2010-05-08',
    CW_API_VERSION: '2010-08-01',
    STS_API_VERSION: '2011-06-15',
    SQS_API_VERSION: '2012-11-05',
    SNS_API_VERSION: '2010-03-31',
    RDS_API_VERSION: '2012-09-17',
    R53_API_VERSION: '2012-02-29',
    AS_API_VERSION: '2011-01-01',
    EMR_API_VERSION: '2009-03-31',
    DDB_API_VERSION: '2011-12-05',
    SWF_API_VERSION: '2012-01-25',

    core: null,
    timers: {},
    cache: {},
    urls: {},
    versions: {},
    signatures: {},
    region: "",
    accessKey: "",
    secretKey: "",
    securityToken: "",
    httpCount: 0,
    actionIgnore: [],
    actionVersion: {},
    errorList: [],
    errorIgnore: /(is not enabled in this region|is not supported in your requested Availability Zone)/,

    isEnabled: function()
    {
        return this.core.isEnabled();
    },

    showBusy : function(fShow)
    {
        if (fShow) {
            this.httpCount++;
            if (window.setCursor) window.setCursor("wait");
        } else {
            --this.httpCount;
            if (this.httpCount <= 0) {
                if (window.setCursor) window.setCursor("auto");
            }
        }
    },

    displayError: function(msg, response)
    {
        if (this.core.getBoolPrefs("ew.errors.show", true)) {
            if (this.actionIgnore.indexOf(response.action) == -1 && !msg.match(this.errorIgnore)) {
                this.core.errorDialog("Server responded with an error for " + response.action, response);
            }
        } else {
            this.core.errorMessage(msg);
        }
        // Add to the error list
        this.errorList.push((new Date()).strftime("%Y-%m-%d %H:%M:%S: ") + msg);
        if (this.errorList.length > 500) this.errorList.splice(0, 1);
    },

    setCredentials : function (accessKey, secretKey, securityToken)
    {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.securityToken = typeof securityToken == "string" ? securityToken : "";
        this.sessionkey = null;
        debug('setCreds: ' + this.accessKey + ", " + this.secretKey + ", " + this.securityToken)
    },

    setEndpoint : function (endpoint)
    {
        if (!endpoint) return;
        this.region = endpoint.name;
        this.urls.EC2 = endpoint.url + "/services/Eucalyptus";
        this.versions.EC2 = endpoint.version || this.EC2_API_VERSION;
        this.signatures.EC2 = endpoint.signature;
        this.urls.ELB = endpoint.url + "/services/LoadBalancing";//endpoint.urlELB || "https://elasticloadbalancing." + this.region + ".amazonaws.com";
        this.versions.ELB = endpoint.versionELB || this.ELB_API_VERSION;
        this.signatures.ELB = endpoint.signatureELB;
        this.urls.CW = endpoint.url + "/services/CloudWatch";//endpoint.urlCW || "https://monitoring." + this.region + ".amazonaws.com";
        this.versions.CW = endpoint.versionCW || this.CW_API_VERSION;
        this.signatures.CW = endpoint.signatureCW;
        this.urls.SQS = endpoint.urlSQS || 'https://sqs.' + this.region + '.amazonaws.com';
        this.versions.SQS = endpoint.versionSQS || this.SQS_API_VERSION;
        this.signatures.SQS = endpoint.signatureSQS;
        this.urls.SNS = endpoint.urlSNS || 'https://sns.' + this.region + '.amazonaws.com';
        this.versions.SNS = endpoint.versionSNS || this.SNS_API_VERSION;
        this.signatures.SNS = endpoint.signatureSNS;
        this.urls.RDS = endpoint.urlRDS || 'https://rds.' + this.region + '.amazonaws.com';
        this.versions.RDS = endpoint.versionRDS || this.RDS_API_VERSION;
        this.signatures.RDS = endpoint.signatureRDS;
        this.urls.R53 = endpoint.urlR53 || 'https://route53.amazonaws.com';
        this.versions.R53 = endpoint.versionR53 || this.R53_API_VERSION;
        this.signatures.R53 = endpoint.signatureR53;
        this.urls.AS = endpoint.url + "/services/AutoScaling";//endpoint.urlAS || "https://autoscaling.amazonaws.com";
        this.versions.AS = endpoint.versionAS || this.AS_API_VERSION;
        this.signatures.AS = endpoint.signatureAS;
        this.urls.IAM = endpoint.url + "/services/Euare";//endpoint.urlIAM || 'https://iam.amazonaws.com';
        this.versions.IAM = endpoint.versionIAM || this.IAM_API_VERSION;
        this.signatures.IAM = endpoint.signatureIAM;
        this.urls.EMR = endpoint.urlEMR || 'https://elasticmapreduce.amazonaws.com';
        this.versions.EMR = endpoint.versionEMR || this.EMR_API_VERSION;
        this.signatures.EMR = endpoint.signatureEMR;
        this.urls.DDB = endpoint.urlDDB || 'https://dynamodb.' + this.region + '.amazonaws.com';
        this.versions.DDB = endpoint.versionDDB || this.DDB_API_VERSION;
        this.signatures.DDB = endpoint.signatureDDB;
        this.urls.STS = endpoint.url + "/services/Tokens";//endpoint.urlSTS || 'https://sts.amazonaws.com';
        this.versions.STS = endpoint.versionSTS || this.STS_API_VERSION;
        this.signatures.STS = endpoint.signatureSTS;
        this.urls.SWF = endpoint.urlSWF || 'https://swf.' + this.region + '.amazonaws.com';
        this.versions.SWF = endpoint.versionSWF || this.SWF_API_VERSION;
        this.signatures.SWF = endpoint.signatureSWF;
        this.actionIgnore = endpoint.actionIgnore || [];
        this.actionVersion = endpoint.actionVersion || {};

        debug('setEndpoint: ' + this.region + ", " + JSON.stringify(this.urls) + ", " + JSON.stringify(this.versions) + ", " + this.actionIgnore + ", " + JSON.stringify(this.actionVersion) + ", " + JSON.stringify(this.signatures));
    },

    getEC2Regions: function()
    {
        return [ { name: 'us-east-1',      url: 'https://ec2.us-east-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'us-west-1',      url: 'https://ec2.us-west-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'us-west-2',      url: 'https://ec2.us-west-2.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'eu-west-1',      url: 'https://ec2.eu-west-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'ap-southeast-1', url: 'https://ec2.ap-southeast-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'ap-southeast-2', url: 'https://ec2.ap-southeast-2.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'ap-northeast-1', url: 'https://ec2.ap-northeast-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'sa-east-1',      url: 'https://ec2.sa-east-1.amazonaws.com', toString: function() { return this.name; } },
                 { name: 'us-gov-west-1',  url: 'https://ec2.us-gov-west-1.amazonaws.com', toString: function() { return this.name; },
                   urlIAM: 'https://iam.us-gov.amazonaws.com',
                   urlSTS: 'https://sts.us-gov-west-1.amazonaws.com',
                   urlAS: 'https://autoscaling.us-gov-west-1.amazonaws.com',
                   urlSWF: 'https://swf.us-gov-west-1.amazonaws.com',
                   actionIgnore: [ "hostedzone", "DescribePlacementGroups" ],
                   signatureDDB: 4,
                 },
            ];
    },

    getS3Regions: function()
    {
        return [ { name: "US Standard",                   url: "s3.amazonaws.com",                region: "" },
                 { name: "US West (Oregon)",              url: "s3-us-west-2.amazonaws.com",      region: "us-west-2" },
                 { name: "US West (Northern California)", url: "s3-us-west-1.amazonaws.com",      region: "us-west-1" },
                 { name: "EU (Ireland)",                  url: "s3-eu-west-1.amazonaws.com",      region: "EU" },
                 { name: "Asia Pacific (Singapore)",      url: "s3-ap-southeast-1.amazonaws.com", region: "ap-southeast-1" },
                 { name: "Asia Pacific (Sydney)",         url: "s3-ap-southeast-2.amazonaws.com", region: "ap-southeast-1" },
                 { name: "Asia Pacific (Tokyo)",          url: "s3-ap-northeast-1.amazonaws.com", region: "ap-northeast-1" },
                 { name: "South America (Sao Paulo)",     url: "s3-sa-east-1.amazonaws.com",      region: "sa-east-1" },
                 { name: "GovCloud",                      url: "s3-us-gov-west-1.amazonaws.com",  region: 'us-gov-west-1' },
               ]
    },

    getRoute53Regions: function()
    {
        return [ {name: "Asia Pacific (Tokyo)",          id: "ap-northeast-1", toString: function() { return this.name; } },
                 {name: "Asia Pacific (Singapore)",      id: "ap-southeast-1", toString: function() { return this.name; } },
                 {name: "Asia Pacific (Sydney)",         id: "ap-southeast-2", toString: function() { return this.name; } },
                 {name: "EU (Ireland)",                  id: "eu-west-1", toString: function() { return this.name; } },
                 {name: "South America (Sao Paulo)",     id: "sa-east-1", toString: function() { return this.name; } },
                 {name: "US East (Northern Virginia)",   id: "us-east-1", toString: function() { return this.name; } },
                 {name: "US West (Northern California)", id: "us-west-1", toString: function() { return this.name; } },
                 {name: "US West (Oregon)",              id: "us-west-2", toString: function() { return this.name; } },
                 ];
    },

    getTimerKey: function()
    {
        return String(Math.random()) + ":" + String(new Date().getTime());
    },

    startTimer : function(key, expr)
    {
        var timeout = this.core.getIntPrefs("ew.http.timeout", 30000, 5000, 3600000);
        var timer = window.setTimeout(expr, timeout);
        this.timers[key] = timer;
    },

    stopTimer : function(key, timeout)
    {
        if (this.timers[key]) {
            window.clearTimeout(this.timers[key]);
        }
        this.timers[key] = null;
        return true;
    },

    getXmlHttp : function()
    {
        var xmlhttp = null;
        if (typeof XMLHttpRequest != 'undefined') {
            try {
                xmlhttp = new XMLHttpRequest();
            } catch (e) {
                debug('Error: ' + e);
            }
        }
        return xmlhttp;
    },

    queryELB : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.ELB, this.versions.ELB, this.signatures.ELB);
    },

    queryAS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.AS, this.versions.AS, this.signatures.AS);
    },

    queryIAM : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.IAM, this.versions.IAM, this.signatures.IAM);
    },

    queryCloudWatch : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.CW, this.versions.CW, this.signatures.CW);
    },

    querySTS : function (action, params, handlerObj, isSync, handlerMethod, callback, accessKey)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.STS, this.versions.STS, this.signatures.STS, accessKey);
    },

    querySQS : function (url, action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, url || this.urls.SQS, this.versions.SQS, this.signatures.SQS);
    },

    queryEMR : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.EMR, this.versions.EMR, this.signatures.EMR);
    },

    querySNS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.SNS, this.versions.SNS, this.signatures.SNS);
    },

    queryRDS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.RDS, this.versions.RDS, this.signatures.RDS);
    },

    signatureV4: function(host, method, path, body, headers, accessKey)
    {
        var now = new Date();
        var date = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        var datetime = date.substr(0, 8);
        if (!accessKey) {
            accessKey = { id: this.accessKey, secret: this.secretKey, securityToken: this.securityToken || "" };
        }
        var d = host.match(/^([^\.]+)\.?([^\.]*)\.amazonaws\.com$/);
        var hostParts = (d || []).slice(1, 3);
        var service = hostParts[0] || '';
        var region = hostParts[1] || 'us-east-1';
        // IAM at least is not consistent
        if (region == "us-gov") region = "us-gov-west-1";

        headers['Host'] = host;
        headers['X-Amz-Date'] = date;
        if (body && !headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';
        if (body && !headers['content-length']) headers['content-length'] = body.length;
        if (accessKey.securityToken != "") headers['X-Amz-Security-Token'] = accessKey.securityToken;

        var credString = [ datetime, region, service, 'aws4_request' ].join('/');
        var pathParts = path.split('?', 2);
        var signedHeaders = Object.keys(headers).map(function(key) { return key.toLowerCase() }).sort().join(';');
        var canonHeaders = Object.keys(headers).sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1 }).map(function(key) { return key.toLowerCase() + ':' + String(headers[key]).trimAll() }).join('\n');
        var canonString = [ method, pathParts[0] || '/', pathParts[1] || '', canonHeaders + '\n', signedHeaders, hex_sha256(body || '')].join('\n');

        var strToSign = [ 'AWS4-HMAC-SHA256', date, credString, hex_sha256(canonString) ].join('\n');
        var kDate = str_hmac_sha256('AWS4' + accessKey.secret, datetime);
        var kRegion = str_hmac_sha256(kDate, region);
        var kService = str_hmac_sha256(kRegion, service);
        var kCredentials = str_hmac_sha256(kService, 'aws4_request');
        var sig = hex_hmac_sha256(kCredentials, strToSign);
        headers['Authorization'] = [ 'AWS4-HMAC-SHA256 Credential=' + accessKey.id + '/' + credString, 'SignedHeaders=' + signedHeaders, 'Signature=' + sig ].join(', ');
    },

    queryEC2 : function (action, params, handlerObj, isSync, handlerMethod, callback, apiURL, apiVersion, sigVersion, accessKey)
    {
        if (!this.isEnabled()) return null;

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) return null;

        var curTime = new Date();
        var formattedTime = curTime.strftime("%Y-%m-%dT%H:%M:%SZ", true);
        if (!accessKey) {
            accessKey = { id: this.accessKey, secret: this.secretKey, securityToken: this.securityToken || "" };
        }

        var url = apiURL ? apiURL : this.urls.EC2;
        var version = this.actionVersion[action] || apiVersion || this.versions.EC2;
        var sig = sigVersion || this.signatures.EC2;

        // Parse the url
        var io = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
        var uri = io.newURI(url, null, null);
        var queryParams = "";

        // Required request parameters
        var sigValues = new Array();
        sigValues.push(new Array("Action", action));
        sigValues.push(new Array("Version", version));

        // Mix in the additional parameters. params must be an Array of tuples as for sigValues above
        for (var i = 0; i < params.length; i++) {
            sigValues.push(params[i]);
        }
        xmlhttp.open("POST", url, !isSync);

        function encode(str) {
            str = encodeURIComponent(str);
            var efunc = function(m) { return m == '!' ? '%21' : m == "'" ? '%27' : m == '(' ? '%28' : m == ')' ? '%29' : m == '*' ? '%2A' : m; }
            return str.replace(/[!'()*~]/g, efunc);
        }

        // Signature version 4
        switch (String(sig)) {
        case '4':
            var headers = {};
            sigValues.sort();
            for (var i = 0; i < sigValues.length; i++) {
                queryParams += (i ? "&" : "") + encode(sigValues[i][0]) + "=" + encode(sigValues[i][1]);
            }
            this.signatureV4(uri.host, "POST", uri.path, queryParams, headers);
            for (var h in headers) xmlhttp.setRequestHeader(h, headers[h]);
            break;

        default:
            sigValues.push(new Array("AWSAccessKeyId", accessKey.id));
            sigValues.push(new Array("SignatureVersion", "2"));
            sigValues.push(new Array("SignatureMethod", "HmacSHA1"));
            sigValues.push(new Array("Timestamp", formattedTime));
            if (accessKey.securityToken != "") {
                sigValues.push(new Array("SecurityToken", accessKey.securityToken));
            }

            sigValues.sort();
            var strSign = "POST\n" + uri.host + "\n" + uri.path + "\n";
            for (var i = 0; i < sigValues.length; i++) {
                var item = (i ? "&" : "") + sigValues[i][0] + "=" + encode(sigValues[i][1]);
                strSign += item;
                queryParams += item;
            }
            queryParams += "&Signature="+encodeURIComponent(b64_hmac_sha1(accessKey.secret, strSign));
            log("EC2: url=" + url + "?" + queryParams + ', sig=' + strSign);

            xmlhttp.setRequestHeader("Content-Length", queryParams.length);
            xmlhttp.setRequestHeader("User-Agent", this.core.getUserAgent());
            xmlhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
            xmlhttp.setRequestHeader("Connection", "close");
        }
        return this.sendRequest(xmlhttp, url, queryParams, isSync, action, version, handlerMethod, handlerObj, callback, params);
    },

    queryDDB : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        var me = this;
        if (!this.isEnabled()) return null;

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) return null;

        var url = this.urls.DDB;
        var version = this.versions.DDB;
        var curTime = new Date();
        var utcTime = curTime.toUTCString();
        var target = 'DynamoDB_' + version.replace(/\-/g,'') + '.' + action;
        var host = url.replace(/https?:\/\//, "");
        url += '/';

        var json = JSON.stringify(params);
        var headers = { 'content-type': 'application/x-amz-json-1.0; charset=utf-8',
                        'x-amz-target': target };

        if (this.signatures.DDB == 4) {
            this.signatureV4(host, "POST", "/", json, headers);
        } else {
            // Generate new session key
            if (!me.sessionkey || me.sessionkey.expires <= curTime) {
                me.sessionkey = null;
                var keys = me.core.getTempKeys();
                keys.forEach(function(x) {
                    if (!me.sessionkey && x.userName == me.core.user.name && x.region == me.region) me.sessionkey = x;
                });

                if (!me.sessionkey) {
                    debug('requesting new session token...')
                    me.getSessionToken(null, null, null, null, function(key) {
                        me.core.saveTempKeys(me.core.getTempKeys().concat([ key ]));
                        me.sessionkey = key;
                        me.queryDDB(action, params, handlerObj, isSync, handlerMethod, callback);
                    });
                    return;
                }
                debug('using session token: ' + me.sessionkey.id)
            }

            var key = this.sessionkey;
            var strSign = "POST\n/\n\nhost:" + host + "\nx-amz-date:" + utcTime + "\nx-amz-security-token:" + key.securityToken + "\nx-amz-target:" + target + "\n\n" + json;
            var sig = b64_hmac_sha256(key.secret, str_sha256(strSign));
            var auth = 'AWS3 AWSAccessKeyId=' + key.id + ',Algorithm=HmacSHA256,SignedHeaders=host;x-amz-date;x-amz-security-token;x-amz-target,Signature=' + sig;
            headers = { 'user-agent': this.core.getUserAgent(),
                        'host': host,
                        'x-amzn-authorization': auth,
                        'x-amz-date': utcTime,
                        'x-amz-security-token': key.securityToken,
                        'x-amz-target': target,
                        'content-type': 'application/x-amz-json-1.0; charset=UTF-8',
                        'content-length': json.length };
        }

        xmlhttp.open("POST", url, !isSync);
        xmlhttp.overrideMimeType('application/x-amz-json-1.0');
        for (var h in headers) xmlhttp.setRequestHeader(h, headers[h]);

        return this.sendRequest(xmlhttp, url, json, isSync, action, version, handlerMethod, handlerObj, callback, params);
    },

    querySWF : function (target, params, handlerObj, isSync, handlerMethod, callback)
    {
        var me = this;
        if (!this.isEnabled()) return null;

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) return null;

        var key = { id: me.accessKey, secret: me.secretKey, securityToken: me.securityToken || "" };
        var url = this.urls.SWF;
        var curTime = (new Date()).toGMTString();
        var host = url.replace(/https?:\/\//, "");
        url += '/';

        var json = JSON.stringify(params);
        var headers = { 'content-type': 'application/x-amz-json-1.0; charset=utf-8',
                        'content-encoding': 'amz-1.0',
                        'x-amz-target': target };

        if (this.signatures.SWF == 4) {
            this.signatureV4(host, "POST", "/", json, headers);
        } else {
            var strSign = "POST\n/\n\nhost:" + host + "\nx-amz-date:" + curTime + "\nx-amz-target:" + target + "\n\n" + json;
            var sig = b64_hmac_sha256(key.secret, str_sha256(strSign));
            var auth = 'AWS3 AWSAccessKeyId=' + key.id + ',Algorithm=HmacSHA256,SignedHeaders=host;x-amz-date;x-amz-target,Signature=' + sig;
            headers['user-agent'] = this.core.getUserAgent()
            headers['host'] = host;
            headers['x-amzn-authorization'] = auth;
            headers['x-amz-date'] = curTime;
            headers['content-length'] = json.length;
        }

        xmlhttp.open("POST", url, !isSync);
        xmlhttp.overrideMimeType('application/x-amz-json-1.0');
        for (var h in headers) xmlhttp.setRequestHeader(h, headers[h]);

        return this.sendRequest(xmlhttp, url, json, isSync, target, this.versions.SWF, handlerMethod, handlerObj, callback, params);
    },

    queryRoute53 : function(method, action, content, params, handlerObj, isSync, handlerMethod, callback)
    {
        var curTime = new Date().toUTCString();

        var url = this.urls.R53 + "/" + this.versions.R53 + "/" + action.substr(action[0] == '/' ? 1 : 0);

        if (!params) params = {}

        // Required headers
        params["x-amz-date"] = curTime;
        params["Content-Type"] = "text/xml; charset=UTF-8";
        params["Content-Length"] = content ? content.length : 0;

        // Construct the string to sign and query string
        var strSign = curTime;

        params["X-Amzn-Authorization"] = "AWS3-HTTPS AWSAccessKeyId=" + this.accessKey + ",Algorithm=HmacSHA1,Signature=" + b64_hmac_sha1(this.secretKey, strSign);
        params["User-Agent"] = this.core.getUserAgent();
        params["Connection"] = "close";

        log("R53 [" + method + ":" + url + ":" + strSign.replace(/\n/g, "|") + " " + JSON.stringify(params) + "]")

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            debug("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open(method, url, !isSync);

        for (var p in params) {
            xmlhttp.setRequestHeader(p, params[p]);
        }

        return this.sendRequest(xmlhttp, url, content, isSync, action, this.versions.R53, handlerMethod, handlerObj, callback);
    },

    queryS3Prepare : function(method, bucket, key, path, params, content, expires)
    {
        var regions = this.getS3Regions();

        function getS3Region(region) {
            for (var i in regions) {
                if (regions[i].region == region) return regions[i];
            }
            return regions[0];
        }

        var curTime = new Date().toUTCString();
        var url = this.core.getS3Protocol(this.region, bucket) + (bucket ? bucket + "." : "") + getS3Region(this.region || "").url;

        if (!params) params = {}
        if (!expires) expires = "";

        // Required headers
        if (!params["x-amz-date"]) params["x-amz-date"] = curTime;
        if (!params["Content-Type"]) params["Content-Type"] = "binary/octet-stream; charset=UTF-8";
        if (!params["Content-Length"]) params["Content-Length"] = content ? content.length : 0;
        if (this.securityToken != "") params["x-amz-security-token"] = this.securityToken;

        // Without media type mozilla changes encoding and signatures do not match
        if (params["Content-Type"] && params["Content-Type"].indexOf("charset=") == -1) {
            params["Content-Type"] += "; charset=UTF-8";
        }

        // Construct the string to sign and query string
        var strSign = method + "\n" + (params['Content-MD5']  || "") + "\n" + (params['Content-Type'] || "") + "\n" + expires + "\n";

        // Amazon canonical headers
        var headers = []
        for (var p in params) {
            if (/X-AMZ-/i.test(p)) {
                var value = params[p]
                if (value instanceof Array) {
                    value = value.join(',');
                }
                headers.push(p.toString().toLowerCase() + ':' + value);
            }
        }
        if (headers.length) {
            strSign += headers.sort().join('\n') + "\n"
        }

        // Split query string for subresources, supported are:
        var resources = ["acl", "lifecycle", "location", "logging", "notification", "partNumber", "policy", "requestPayment", "torrent",
                         "uploadId", "uploads", "versionId", "versioning", "versions", "website", "cors",
                         "delete",
                         "response-content-type", "response-content-language", "response-expires",
                         "response-cache-control", "response-content-disposition", "response-content-encoding" ]
        var rclist = []
        var query = parseQuery(path);
        for (var p in query) {
            p = p.toLowerCase();
            if (resources.indexOf(p) != -1) {
                rclist.push(p + (query[p] == true ? "" : "=" + query[p]))
            }
        }
        strSign += (bucket ? "/" + bucket : "").toLowerCase() + (key[0] != "/" ? "/" : "") + encodeURI(key) + (rclist.length ? "?" : "") + rclist.sort().join("&");
        var signature = b64_hmac_sha1(this.secretKey, strSign);

        params["Authorization"] = "AWS " + this.accessKey + ":" + signature;
        params["User-Agent"] = this.core.getUserAgent();
        params["Connection"] = "close";

        log("S3 [" + method + ":" + url + "/" + key + path + ":" + strSign.replace(/\n/g, "|") + " " + JSON.stringify(params) + "]")

        var rc = { method: method, url: url + (key[0] != "/" ? "/" : "") + key + path, headers: params, signature: signature, str: strSign, time: curTime, expires: expires };

        // Build REST auth url if expies is given
        if (expires) {
            rc.authUrl = rc.url + (rc.url.indexOf("?") == -1 ? "?" : "") + '&AWSAccessKeyId=' + this.accessKey + "&Expires=" + expires + "&Signature=" + encodeURIComponent(signature);
        }
        return rc;
    },

    downloadS3 : function (method, bucket, key, path, params, file, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        var req = this.queryS3Prepare(method, bucket, key, path, params, null);
        return this.download(req.url, req.headers, file, callback, progresscb);
    },

    uploadS3: function(bucket, key, path, params, filename, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        var me = this;
        var file = FileIO.streamOpen(filename);
        if (!file) {
            alert('Cannot open ' + filename)
            return false;
        }
        var length = file[1].available();
        params["Content-Length"] = length;

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return null;
        }

        var req = this.queryS3Prepare("PUT", bucket, key, path, params, null);
        xmlhttp.open(req.method, req.url, true);
        for (var p in req.headers) {
            xmlhttp.setRequestHeader(p, req.headers[p]);
        }
        xmlhttp.send(file[1]);

        var timer = setInterval(function() {
            try {
                var a = length - file[1].available();
                if (progresscb) progresscb(filename, Math.round(a / length * 100));
            }
            catch(e) {
                debug('Error: ' + e);
                me.core.alertDialog("S3 Error", "Error uploading " + filename + "\n" + e)
            }
        }, 300);

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState != 4) return;
            FileIO.streamClose(file);
            clearInterval(timer);
            if (xmlhttp.status >= 200 && xmlhttp.status < 300) {
                if (progresscb) progresscb(filename, 100);
                if (callback) callback(filename);
            } else {
                me.handleResponse(xmlhttp, req.url, false, "upload", null, me, callback, [bucket, key, path]);
            }
        };
        return true;
    },

    queryS3 : function(method, bucket, key, path, params, content, handlerObj, isSync, handlerMethod, callback)
    {
        if (!this.isEnabled()) return null;

        var opts = cloneObject(params);
        var req = this.queryS3Prepare(method, bucket, key, path, params, content);

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            debug("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open(req.method, req.url, !isSync);

        for (var p in req.headers) {
            xmlhttp.setRequestHeader(p, req.headers[p]);
        }

        return this.sendRequest(xmlhttp, req.url, content, isSync, method, this.versions.S3, handlerMethod, handlerObj, callback, { bucket: bucket, key: key, path: path, params: opts });
    },

    updateS3Acl: function(item, callback)
    {
        function grant(obj, perm) {
            var content = '<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="' + obj.type + '">';
            switch (obj.type) {
            case 'CanonicalUser':
                content += '<ID>' + obj.id + '</ID>';
                break;

            case 'AmazonCustomerByEmail':
                content += '<EmailAddress>' + obj.id + '</EmailAddress>';
                break;

            case 'Group':
                content += '<URI>' + obj.id + '</URI>';
                break;
            }
            return content + '</Grantee><Permission>' + obj.permission + '</Permission></Grant>';
        }

        var content = '<AccessControlPolicy><Owner><ID>' +  item.owner  + '</ID></Owner><AccessControlList>';
        for (var i in item.acls) {
            content += grant(item.acls[i]);
        }
        content += '</AccessControlList></AccessControlPolicy>';
        debug(content)

        if (item.bucket) {
            this.setS3BucketKeyAcl(item.bucket, item.name, content, callback)
        } else {
            this.setS3BucketAcl(item.name, content, callback)
        }
    },

    queryVpnConnectionStylesheets : function(stylesheet, config)
    {
        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return;
        }
        if (!stylesheet) stylesheet = "customer-gateway-config-formats.xml";
        var url = 'https://ec2-downloads.s3.amazonaws.com/2009-07-15/' + stylesheet;
        xmlhttp.open("GET", url, false);
        xmlhttp.setRequestHeader("User-Agent", this.core.getUserAgent());
        xmlhttp.overrideMimeType('text/xml');
        return this.sendRequest(xmlhttp, url, null, true, stylesheet, this.versions.EC2, "onCompleteCustomerGatewayConfigFormats", this, null, config || "");
    },

    queryCheckIP : function(type)
    {
        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return;
        }
        var url = "http://checkip.amazonaws.com/" + (type || "");
        xmlhttp.open("GET", url, false);
        xmlhttp.setRequestHeader("User-Agent", this.core.getUserAgent());
        xmlhttp.overrideMimeType('text/plain');
        return this.sendRequest(xmlhttp, url, null, true, "checkip", this.versions.EC2, "onCompleteResponseText", this);
    },

    download: function(url, headers, filename, callback, progresscb)
    {
        if (!this.isEnabled()) return null;

        debug('download: ' + url + '| ' + JSON.stringify(headers) + '| ' + filename)

        try {
          FileIO.remove(filename);
          var file = FileIO.open(filename);
          if (!file || !FileIO.create(file)) {
              alert('Cannot create ' + filename)
              return false;
          }
          var me = this;
          var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(url, null, null);
          var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);
          persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES | Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION;
          persist.progressListener = {
            onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
                var percent = (aCurTotalProgress/aMaxTotalProgress) * 100;
                if (progresscb) progresscb(filename, percent);
            },
            onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
                var chan = aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
                debug("download: " + filename + " " + aStateFlags + " " + aStatus + " " + persist.currentState + " " + chan.responseStatus + " " + chan.responseStatusText)
                if (persist.currentState == persist.PERSIST_STATE_FINISHED) {
                    if (chan.responseStatus == 200) {
                        if (callback) callback(filename);
                    } else {
                        FileIO.remove(filename);
                        me.displayError(chan.responseStatus + " " + chan.responseStatusText);
                    }
                }
            }
          }

          var hdrs = "";
          for (var p in headers) {
              hdrs += p + ":" + headers[p] + "\r\n";
          }
          persist.saveURI(io, null, null, null, hdrs, file);
          return true;

        } catch (e) {
          alert(e);
        }
        return false;
    },

    sendRequest: function(xmlhttp, url, content, isSync, action, version, handlerMethod, handlerObj, callback, params)
    {
        var me = this;
        this.core.writeAccessLog('sendRequest: ' + url + ', key=' + this.accessKey + ', action=' + action + '/' + version + '/' + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ', params=' + (Array.isArray(params) ? params : JSON.stringify(params)));

        var xhr = xmlhttp;
        // Generate random timer
        var timerKey = this.getTimerKey();
        this.startTimer(timerKey, function() {
            debug('TIMEOUT: ' + url + ', action=' + action + '/' + handlerMethod + ', params=' + params);
            xhr.abort();
        });
        this.showBusy(true);

        if (isSync) {
            xmlhttp.onreadystatechange = function() {}
        } else {
            xmlhttp.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    me.showBusy(false);
                    me.stopTimer(timerKey);
                    me.handleResponse(xhr, url, isSync, action, handlerMethod, handlerObj, callback, params);
                }
            }
        }

        try {
            xmlhttp.send(content);
        } catch(e) {
            debug('xmlhttp error:' + url + ", " + e)
            this.showBusy(false);
            this.stopTimer(timerKey);
            this.handleResponse(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params);
            return false;
        }

        // In sync mode the result is always returned
        if (isSync) {
            this.showBusy(false);
            this.stopTimer(timerKey);
            return me.handleResponse(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params);
        }
        return true;
    },

    handleResponse : function(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params)
    {
        log(xmlhttp.responseText);

        var rc = xmlhttp && (xmlhttp.status >= 200 && xmlhttp.status < 300) ?
                 this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params) :
                 this.createResponseError(xmlhttp, url, isSync, action, handlerMethod, callback, params);

        // Response callback is called in all cases, some errors can be ignored
        if (handlerObj) {
            var res = handlerObj.onResponseComplete(rc);
            if (rc.isSync) rc.result = res;
        }
        this.core.writeAccessLog('handleResponse: ' + action + ', key=' + this.accessKey + ", method=" + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ", status=" + rc.status + '/' + rc.contentType + ', error=' + rc.hasErrors + "/" + rc.errCode + ' ' + rc.errString + ', length=' + rc.responseText.length + ", results=" + (rc.result && rc.result.length ? rc.result.length : 0));

        if (rc.hasErrors) {
            this.displayError(rc.action + ": " + rc.errCode + ": " + rc.errString + ': ' + (params || ""), rc);
            // Call error handler if passed as an object
            if (callback && !rc.skipCallback) {
                if (typeof callback == "object" && callback.error) {
                    callback.error(rc);
                }
            }
        } else {
            // Pass the result and the whole response object if it is null
            if (callback && !rc.skipCallback) {
                if (typeof callback == "function") {
                    callback(rc.result, rc);
                } else
                if (typeof callback == "object" && callback.success) {
                    callback.success(rc.result, rc);
                }
            }
        }
        return rc.result;
    },

    // Extract standard AWS error code and message
    createResponseError : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        var rc = this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params);
        rc.requestId = "";
        rc.hasErrors = true;

        if (rc.contentType == 'application/x-amz-json-1.0') {
            var json = {};
            try { json = JSON.parse(rc.responseText) } catch(e) { json.message = e; debug(rc.responseText) }
            rc.errString = action + ' [' + rc.status + ']: ' + (json.message || json['__type']);
        } else {
            var xml = rc.responseXML;
            // EC2 common error reponse format
            if (!getNodeValue(xml, "Message")) {
                try { xml = new DOMParser().parseFromString(rc.responseText, "text/xml"); } catch(e) { debug(e) }
            }
            rc.errCode = getNodeValue(xml, "Code");
            rc.errString = getNodeValue(xml, "Message");
            rc.requestId = getNodeValue(xml, "RequestID");

            // Route53 error messages
            if (!rc.errString) {
                rc.errString = this.getItems(rc.responseXML, 'InvalidChangeBatch', 'Messages', [ 'Message' ], function(obj) { return obj.Message });
                if (rc.errString.length) rc.errCode = "InvalidChangeBatch"; else rc.errString = "";
            }
        }
        debug('response error: ' +  action + ", " + rc.status + ", " + rc.responseText + ", " + rc.errString + ", " + url);

        if (!rc.errCode) rc.errCode = "Unknown: " + rc.status;
        if (!rc.errString) rc.errString = "An unknown error occurred, please check connectivity and/or try to increase HTTTP timeout in the Preferences if this happens often";
        return rc;
    },

    createResponse : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        var type = xmlhttp ? xmlhttp.getResponseHeader('Content-Type') : "";
        var xmldoc = xmlhttp ? xmlhttp.responseXML : null;

        var response = {
            xmlhttp: xmlhttp,
            contentType : type || "",
            responseXML: xmldoc || document.createElement('document'),
            responseText: xmlhttp ? xmlhttp.responseText : '',
            status : xmlhttp ? xmlhttp.status : 0,
            url  : url,
            action:     action,
            method: handlerMethod,
            isSync: isSync,
            hasErrors: false,
            skipCallback: false,
            params: params || {},
            callback: callback,
            result: null,
            json: null,
            errCode: "",
            errString: "",
            requestId: ""
        };

        if (response.responseText && response.contentType == 'application/x-amz-json-1.0') {
            try {
                response.json = JSON.parse(response.responseText);
            } catch(e) {
                response.hasErrors = true
                response.errString = e;
            }
        }
        return response;
    },

    // Main callback on request complete, if callback specified in the form onComplete:id,
    // then response will put value of the node 'id' in the result
    onResponseComplete : function(response)
    {
        var id = null, item = null;
        var method = response.method;
        if (!method) return;

        // Return value in response
        if (method.indexOf(":") > 0) {
            var m = method.split(":");
            method = m[0];
            id = m[1];
            item = m[2];
        }

        if (this[method]) {
            return this[method](response, id, item);
        } else {
           alert('Error calling handler ' + response.method + ' for ' + response.action);
        }
    },

    // Common response callback when there is no need to parse result but only to call user callback
    onComplete : function(response, id, item)
    {
        if (id && item && response.responseXML) {
            response.result = this.getItems(response.responseXML, id, item, "");
        } else

        if (id && response.responseXML) {
            response.result = getNodeValue(response.responseXML, id);
        }
        return response.result;
    },

    // Common response callback when there is no need to parse result but only to call user callback
    onCompleteJson : function(response, id, item)
    {
        if (id && item && response.json && response.json[id] && response.json[i][item]) {
            response.result = response.json[id][item];
        } else

        if (id && response.json && response.json[id]) {
            response.result = response.json[id];
        } else

        if (response.json) {
            response.result = response.json;
        }
        return response.result;
    },

    onCompleteResponseText : function(response, id)
    {
        response.result = response.responseText.trim();
        return response.result;
    },

    // Iterate through all pages while NextToken is present, collect all items in the model
    getNext: function(response, method, list)
    {
        var me = this;
        var xmlDoc = response.responseXML;

        // Collect all items into temporary cache list
        var model = response.action + ":" + response.params.filter(function(x) { return x[0] != "Marker" && x[0] != "NextToken"; });
        if (!this.cache[model]) this.cache[model] = [];
        this.cache[model] = this.cache[model].concat(list || []);
        response.model = model;

        // Collected result will be returned by the last call only
        var marker = getNodeValue(xmlDoc, "Marker");
        var nextToken = getNodeValue(xmlDoc, "NextToken");
        if (!nextToken) nextToken = getNodeValue(xmlDoc, "nextToken");

        log('getNext: ' + model + ", token=" + (marker || nextToken) + ", rc=" + this.cache[model].length);

        if (nextToken || marker) {
            var params = cloneObject(response.params);
            if (marker) setParam(params, "Marker", marker);
            if (nextToken) setParam(params, "NextToken", nextToken);
            response.skipCallback = true;

            // In sync mode keep spinning until we collect evrything
            if (response.isSync) {
                return method.call(me, response.action, params, me, true, response.method, response.callback);
            }

            // Schedule another request
            setTimeout(function() { method.call(me, response.action, params, me, false, response.method, response.callback); }, 100);
        } else {
            response.result = this.cache[model];
            this.cache[model] = null;
        }
        return response.result;
    },

    // Parse XML node parentNode and extract all items by itemNode tag name, if item node has multiple fields, columns may be used to restrict which
    // fields needs to be extracted and put into Javascript object as properties. If callback specified, the final object will be passed through the
    // callback as parameters which should return valid object or value to be included in the list
    getItems : function(item, parentNode, itemsNode, columns, callback)
    {
        var list = [];
        var tagSet = item.getElementsByTagName(parentNode)[0];
        if (tagSet) {
            var items = itemsNode ? tagSet.getElementsByTagName(itemsNode) : tagSet.childNodes;
            for (var i = 0; i < items.length; i++) {
                if (items[i].parentNode && items[i].parentNode.tagName != parentNode) continue;
                if (columns != null) {
                    if (columns instanceof Array) {
                        var obj = new Element();
                        // Return object with given set of properties
                        if (columns.length) {
                            for (var j in columns) {
                                var val = getNodeValue(items[i], columns[j]);
                                if (val) obj[columns[j]] = val;
                            }
                        } else {
                            // Empty columns means take all tags
                            var props = items[i].childNodes;
                            for (var j = 0; j < props.length; j++) {
                                var val = props[j].firstChild ? props[j].firstChild.nodeValue : props[j].nodeValue;
                                if (val && props[j].tagName) obj[props[j].tagName] = val;
                            }
                        }
                        if (Object.keys(obj).length) list.push(callback ? callback(obj) : obj);
                    } else {
                        // List of values for one column only
                        var val = columns == "" ? items[i].firstChild.nodeValue : getNodeValue(items[i], columns);
                        if (val) list.push(callback ? callback(val) : val);
                    }
                } else {
                    // Return DOM element as is
                    var item = callback ? callback(items[i]) : items[i];
                    if (item) list.push(item);
                }
            }
        }
        return list;
    },

    // Retrieve all tags from the response XML structure
    getTags : function(item)
    {
        return this.getItems(item, "tagSet", "item", ["key", "value"], function(obj) { return new Tag(obj.key, obj.value)});
    },

    getGroups : function(item)
    {
        return this.getItems(item, "groupSet", "item", ["groupId", "groupName"], function(obj) { return new Element('id', obj.groupId, 'name', obj.groupName, 'owner', '', 'status', '')});
    },

    registerImageInRegion : function(manifestPath, region, callback)
    {
        // The image's region is the same as the active region
        if (this.core.region == region) {
            return this.registerImage(manifestPath, callback);
        }

        var endpoint = this.core.getEndpoint(region)
        if (!endpoint) {
            return alert('Cannot determine endpoint url for ' + region);
        }
        this.queryEC2InRegion(region, "RegisterImage", [ [ "ImageLocation", manifestPath ] ], this, false, "onComplete", callback, endpoint.url);
    },

    registerImage : function(manifestPath, callback)
    {
        this.queryEC2("RegisterImage", [ [ "ImageLocation", manifestPath ] ], this, false, "onComplete", callback);
    },

    registerImageFromSnapshot : function(snapshotId, amiName, amiDescription, architecture, kernelId, ramdiskId, deviceName, deleteOnTermination, callback)
    {
        var params = [];

        params.push([ 'Name', amiName ]);
        amiDescription && params.push([ 'Description', amiDescription ]);
        params.push([ 'Architecture', architecture ]);
        kernelId && params.push([ 'KernelId', kernelId ]);
        ramdiskId && params.push([ 'RamdiskId', ramdiskId ]);
        params.push([ 'RootDeviceName', deviceName ]);
        params.push([ 'BlockDeviceMapping.1.DeviceName', deviceName ]);
        params.push([ 'BlockDeviceMapping.1.Ebs.SnapshotId', snapshotId ]);
        params.push([ 'BlockDeviceMapping.1.Ebs.DeleteOnTermination', deleteOnTermination ]);

        this.queryEC2("RegisterImage", params, this, false, "onComplete:imageId", callback);
    },

    deregisterImage : function(imageId, callback)
    {
        this.queryEC2("DeregisterImage", [ [ "ImageId", imageId ] ], this, false, "onComplete", callback);
    },

    createSnapshot : function(volumeId, descr, callback)
    {
        var params = [ [ "VolumeId", volumeId ] ];
        if (descr) params.push(["Description", descr]);
        this.queryEC2("CreateSnapshot", params, this, false, "onComplete:snapshotId", callback);
    },

    deleteSnapshot : function(snapshotId, callback)
    {
        this.queryEC2("DeleteSnapshot", [ [ "SnapshotId", snapshotId ] ], this, false, "onComplete", callback);
    },

    copySnapshot : function(region, snapshotId, descr, callback)
    {
        var params = [];
        params.push(["SourceRegion", region]);
        params.push([ "SourceSnapshotId", snapshotId ]);
        if (descr) params.push(["Description", descr])
        this.queryEC2("CopySnapshot", params, this, false, "onComplete", callback);
    },

    attachVolume : function(volumeId, instanceId, device, callback)
    {
        var params = []
        if (volumeId != null) params.push([ "VolumeId", volumeId ]);
        if (instanceId != null) params.push([ "InstanceId", instanceId ]);
        if (device != null) params.push([ "Device", device ]);
        this.queryEC2("AttachVolume", params, this, false, "onComplete", callback);
    },

    createVolume : function(size, snapshotId, zone, params, callback)
    {
        if (!params) params = []
        if (size) params.push([ "Size", size ]);
        if (snapshotId) params.push([ "SnapshotId", snapshotId ]);
        if (zone) params.push([ "AvailabilityZone", zone ]);
        this.queryEC2("CreateVolume", params, this, false, "onComplete:volumeId", callback);
    },

    deleteVolume : function(volumeId, callback)
    {
        this.queryEC2("DeleteVolume", [ [ "VolumeId", volumeId ] ], this, false, "onComplete", callback);
    },

    detachVolume : function(volumeId, callback)
    {
        this.queryEC2("DetachVolume", [ [ "VolumeId", volumeId ] ], this, false, "onComplete", callback);
    },

    forceDetachVolume : function(volumeId, callback)
    {
        this.queryEC2("DetachVolume", [ [ "VolumeId", volumeId ], [ "Force", true ] ], this, false, "onComplete", callback);
    },

    describeVolumes : function(callback)
    {
        this.queryEC2("DescribeVolumes", [], this, false, "onCompleteDescribeVolumes", callback);
    },

    onCompleteDescribeVolumes : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "volumeSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.status + fieldSeparator + this.type + (this.type == "io1" ? "/" + this.iops : "") + fieldSeparator +
                        this.device + fieldSeparator + this.size + "GB" + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") + fieldSeparator + this.attachStatus +
                       (this.instanceId ? " to (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
            }
            obj.id = getNodeValue(item, "volumeId");
            obj.type = getNodeValue(item, "volumeType");
            obj.size = getNodeValue(item, "size");
            obj.iops = getNodeValue(item, "iops");
            obj.snapshotId = getNodeValue(item, "snapshotId");
            obj.availabilityZone = getNodeValue(item, "availabilityZone");
            obj.status = getNodeValue(item, "status");
            obj.createTime = new Date(getNodeValue(item, "createTime"));
            // Zero out the values for attachment
            var aitem = this.getItems(item, "attachmentSet", "item");
            obj.instanceId = getNodeValue(aitem[0], "instanceId");
            obj.device = getNodeValue(aitem[0], "device");
            obj.attachStatus = getNodeValue(aitem[0], "status");
            if (obj.attachStatus) obj.attachTime = new Date(getNodeValue(aitem[0], "attachTime"));
            obj.deleteOnTermination = getNodeValue(aitem[0], "deleteOnTermination");
            obj.tags = this.getTags(item);
            ew_core.processTags(obj);
            list.push(obj);
        }

        this.core.setModel('volumes', list);
        response.result = list;
    },

    enableVolumeIO : function (id, callback) {
        this.queryEC2("EnableVolumeIO", [["VolumeId", id]], this, false, "onComplete", callback);
    },

    describeVolumeStatus : function (id, callback) {
        var params = [];
        if (id) params.push(["VolumeId.1", id]);
        this.queryEC2("DescribeVolumeStatus", params, this, false, "onCompleteDescribeVolumeStatus", callback);
    },

    onCompleteDescribeVolumeStatus : function (response) {
        var xmlDoc = response.responseXML;
        var list = new Array();

        var items = this.getItems(xmlDoc, "volumeStatusSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.volumeId + fieldSeparator + this.status + fieldSeparator + this.availabilityZone +
                       (this.eventType ? fieldSeparator + this.eventType + fieldSeparator + this.eventDescr : "") +
                       (this.action ? fieldSeparator + this.action + fieldSeparator + this.actionDescr : "");
            }
            obj.volumeId = getNodeValue(item, "volumeId");
            obj.availabilityZone = getNodeValue(item, "availabilityZone");
            obj.status = getNodeValue(item, "status");
            var vitems = this.getItems(item, "eventSet", "item");
            obj.eventId = vitems.length ? getNodeValue(vitems[0], "eventId") : "";
            obj.eventType = vitems.length ? getNodeValue(vitems[0], "eventType") : "";
            obj.eventDescr = vitems.length ? getNodeValue(vitems[0], "description") : "";
            obj.startTime = vitems.length ? getNodeValue(vitems[0], "notBefore") : "";
            obj.endTime = vitems.length ? getNodeValue(vitems[0], "notAfter") : "";
            var aitems = this.getItems(item, "actionSet", "item");
            obj.action = aitems.length ? getNodeValue(aitems[0], "code") : "";
            obj.actionDescr = aitems.length ? getNodeValue(aitems[0], "description") : "";
            list.push(obj);
        }

        response.result = list;
    },

    describeSnapshots : function(callback)
    {
        this.queryEC2("DescribeSnapshots", [], this, false, "onCompleteDescribeSnapshots", callback);
    },

    onCompleteDescribeSnapshots : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "snapshotSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return (this.description ? this.description + fieldSeparator : this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator +
                       (this.status != "completed" ? this.status + fieldSeparator : "") +
                       (this.progress != "100%" ? this.progress : this.volumeSize + "GB");
            }
            obj.id = getNodeValue(item, "snapshotId");
            obj.volumeId = getNodeValue(item, "volumeId");
            obj.status = getNodeValue(item, "status");
            obj.startTime = new Date(getNodeValue(item, "startTime"));
            obj.progress = getNodeValue(item, "progress");
            if (obj.progress && obj.progress.indexOf('%') == -1) obj.progress += '%';
            obj.volumeSize = getNodeValue(item, "volumeSize");
            obj.description = getNodeValue(item, "description");
            obj.ownerId = getNodeValue(item, "ownerId")
            obj.ownerAlias = getNodeValue(item, "ownerAlias")
            obj.tags = this.getTags(item);
            ew_core.processTags(obj);
            list.push(obj);
        }

        this.core.setModel('snapshots', list);
        response.result = list;
    },

    describeSnapshotAttribute: function(id, callback) {
        this.queryEC2("DescribeSnapshotAttribute", [ ["SnapshotId", id], ["Attribute", "createVolumePermission"] ], this, false, "onCompleteDescribeSnapshotAttribute", callback);
    },

    onCompleteDescribeSnapshotAttribute : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var id = getNodeValue(xmlDoc, "snapshotId");

        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var group = getNodeValue(items[i], "group");
            var user = getNodeValue(items[i], "userId");
            if (group != '') {
                list.push({ id: group, type: 'Group', snapshotId: id })
            } else
            if (user != '') {
                list.push({ id: user, type: 'UserId', snapshotId: id })
            }
        }

        response.result = list;
    },

    modifySnapshotAttribute: function(id, add, remove, callback) {
        var params = [ ["SnapshotId", id]]

        // Params are lists in format: [ { "UserId": user} ], [ { "Group": "all" }]
        if (add) {
            for (var i = 0; i < add.length; i++) {
                params.push(["CreateVolumePermission.Add." + (i + 1) + "." + add[i][0], add[i][1] ])
            }
        }
        if (remove) {
            for (var i = 0; i < remove.length; i++) {
                params.push(["CreateVolumePermission.Remove." + (i + 1) + "." + remove[i][0], remove[i][1] ])
            }
        }
        this.queryEC2("ModifySnapshotAttribute", params, this, false, "onComplete", callback);
    },

    describeVpcs : function(callback)
    {
        this.queryEC2("DescribeVpcs", [], this, false, "onCompleteDescribeVpcs", callback);
    },

    onCompleteDescribeVpcs : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "vpcSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var vpc = new Element();
            vpc.toString = function() {
                return this.cidr + fieldSeparator + (this.name ? this.name + fieldSeparator : "") + this.id + (this.instanceTenancy == "dedicated" ? fieldSeparator + "dedicated" : "");
            }
            vpc.id = getNodeValue(item, "vpcId");
            vpc.cidr = getNodeValue(item, "cidrBlock");
            vpc.state = getNodeValue(item, "state");
            vpc.dhcpOptionsId = getNodeValue(item, "dhcpOptionsId");
            vpc.instanceTenancy = getNodeValue(item, "instanceTenancy");
            vpc.tags = this.getTags(item);
            ew_core.processTags(vpc)
            list.push(vpc);
        }
        this.core.setModel('vpcs', list);
        response.result = list;
    },

    createVpc : function(cidr, tenancy, callback)
    {
        var params = [ [ "CidrBlock", cidr ] ];
        if (tenancy) params.push([ "InstanceTenancy", tenancy ]);
        this.queryEC2("CreateVpc", params, this, false, "onComplete:vpcId", callback);
    },

    deleteVpc : function(id, callback)
    {
        this.queryEC2("DeleteVpc", [ [ "VpcId", id ] ], this, false, "onComplete", callback);
    },

    describeSubnets : function(callback)
    {
        this.queryEC2("DescribeSubnets", [], this, false, "onCompleteDescribeSubnets", callback);
    },

    onCompleteDescribeSubnets : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "subnetSet", "item");
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var sub = new Element()
            sub.toString = function() {
                return this.cidr + fieldSeparator + this.availabilityZone + fieldSeparator + this.vpcId + fieldSeparator + this.id + (this.name ? fieldSeparator + this.name : "");
            }
            sub.id = getNodeValue(item, "subnetId");
            sub.vpcId = getNodeValue(item, "vpcId");
            sub.cidr = getNodeValue(item, "cidrBlock");
            sub.state = getNodeValue(item, "state");
            sub.availableIp = getNodeValue(item, "availableIpAddressCount");
            sub.availabilityZone = getNodeValue(item, "availabilityZone");
            sub.tags = this.getTags(item);
            ew_core.processTags(sub)
            list.push(sub);
        }
        this.core.setModel('subnets', list);
        response.result = list;
    },

    createSubnet : function(vpcId, cidr, az, callback)
    {
        this.queryEC2("CreateSubnet", [ [ "CidrBlock", cidr ], [ "VpcId", vpcId ], [ "AvailabilityZone", az ] ], this, false, "onComplete:subnetId", callback);
    },

    deleteSubnet : function(id, callback)
    {
        this.queryEC2("DeleteSubnet", [ [ "SubnetId", id ] ], this, false, "onComplete", callback);
    },

    describeDhcpOptions : function(callback)
    {
        this.queryEC2("DescribeDhcpOptions", [], this, false, "onCompleteDescribeDhcpOptions", callback);
    },

    onCompleteDescribeDhcpOptions : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "dhcpOptionsSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "dhcpOptionsId");
            var options = new Array();

            var optTags = item.getElementsByTagName("dhcpConfigurationSet")[0];
            var optItems = optTags.childNodes;
            log("Parsing DHCP Options: " + optItems.length + " option sets");

            for ( var j = 0; j < optItems.length; j++) {
                if (optItems.item(j).nodeName == '#text') continue;
                var key = getNodeValue(optItems.item(j), "key");
                var values = new Array();

                var valtags = optItems.item(j).getElementsByTagName("valueSet")[0];
                var valItems = valtags.childNodes;
                log("Parsing DHCP Option " + key + ": " + valItems.length + " values");

                for ( var k = 0; k < valItems.length; k++) {
                    if (valItems.item(k).nodeName == '#text') continue;
                    values.push(getNodeValue(valItems.item(k), "value"));
                }
                options.push(key + " = " + values.join(","))
            }
            var dhcp = new Element('id', id, 'options', options.join("; "))
            dhcp.toString = function() {
                return this.options + fieldSeparator + this.id;
            }
            dhcp.tags = this.getTags(item);
            ew_core.processTags(dhcp)
            list.push(dhcp);
        }
        this.core.setModel('dhcpOptions', list);
        response.result = list;
    },

    associateDhcpOptions : function(dhcpOptionsId, vpcId, callback)
    {
        this.queryEC2("AssociateDhcpOptions", [ [ "DhcpOptionsId", dhcpOptionsId ], [ "VpcId", vpcId ] ], this, false, "onComplete", callback);
    },

    createDhcpOptions : function(opts, callback)
    {
        var params = new Array();
        var i = 1;
        for (var p in opts) {
            params.push([ "DhcpConfiguration." + i + ".Key", p ]);
            if (opts[p] instanceof Array) {
                var j = 1;
                for (var d in opts[p]) {
                    var val = String(opts[p][d]).trim();
                    if (val == "") continue;
                    params.push([ "DhcpConfiguration." + i + ".Value." + j, val ]);
                    j++
                }
            } else {
                var val = String(opts[p]).trim();
                if (val == "") continue;
                params.push([ "DhcpConfiguration." + i + ".Value.1", val ]);
            }
            i++;
        }

        this.queryEC2("CreateDhcpOptions", params, this, false, "onComplete", callback);
    },

    deleteDhcpOptions : function(id, callback)
    {
        this.queryEC2("DeleteDhcpOptions", [ [ "DhcpOptionsId", id ] ], this, false, "onComplete", callback);
    },

    createNetworkAclEntry : function(aclId, num, proto, action, egress, cidr, var1, var2, callback)
    {
        var params = [ [ "NetworkAclId", aclId ] ];
        params.push([ "RuleNumber", num ]);
        params.push([ "Protocol", proto ]);
        params.push([ "RuleAction", action ]);
        params.push([ "Egress", egress ]);
        params.push([ "CidrBlock", cidr ]);

        switch (proto) {
        case "1":
            params.push([ "Icmp.Code", var1])
            params.push([ "Icmp.Type", var2])
            break;
        case "6":
        case "17":
            params.push(["PortRange.From", var1])
            params.push(["PortRange.To", var2])
            break;
        }
        this.queryEC2("CreateNetworkAclEntry", params, this, false, "onComplete", callback);
    },

    deleteNetworkAclEntry : function(aclId, num, egress, callback)
    {
        this.queryEC2("DeleteNetworkAclEntry", [ [ "NetworkAclId", aclId ], ["RuleNumber", num], ["Egress", egress] ], this, false, "onComplete", callback);
    },

    ReplaceNetworkAclAssociation: function(assocId, aclId, callback)
    {
        this.queryEC2("ReplaceNetworkAclAssociation", [ [ "AssociationId", assocId ], ["NetworkAclId", aclId] ], this, false, "onComplete", callback);
    },

    createNetworkAcl : function(vpcId, callback)
    {
        this.queryEC2("CreateNetworkAcl", [ [ "VpcId", vpcId ] ], this, false, "onComplete:networkAclId", callback);
    },

    deleteNetworkAcl : function(id, callback)
    {
        this.queryEC2("DeleteNetworkAcl", [ [ "NetworkAclId", id ] ], this, false, "onComplete", callback);
    },

    describeNetworkAcls : function(callback)
    {
        this.queryEC2("DescribeNetworkAcls", [], this, false, "onCompleteDescribeNetworkAcls", callback);
    },

    onCompleteDescribeNetworkAcls : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();

        var items = this.getItems(xmlDoc, "networkAclSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.id + fieldSeparator + (this.dflt ? "default" : "") + " (" + ew_core.modelValue("vpcId", this.vpcId) + ")";
            }
            obj.rules = [];
            obj.associations = [];
            obj.id = getNodeValue(item, "networkAclId");
            obj.vpcId = getNodeValue(item, "vpcId");
            obj.dflt = getNodeValue(item, "default");

            var entries = item.getElementsByTagName("entrySet")[0].getElementsByTagName("item");
            for ( var j = 0; j < entries.length; j++) {
                var acl = new Element();
                acl.toString = function() {
                    return this.id + fieldSeparator + this.proto + fieldSeparator + this.action + fieldSeparator + (this.egress ? "Egress" + fieldSeparator : "") + this.cidr;
                }
                acl.aclId = obj.id;
                acl.num = getNodeValue(entries[j], "ruleNumber");
                acl.id = acl.num == 32767 ? "*" : acl.num;
                acl.proto = getNodeValue(entries[j], "protocol");
                acl.action = getNodeValue(entries[j], "ruleAction");
                acl.egress = getNodeValue(entries[j], "egress");
                acl.cidr = getNodeValue(entries[j], "cidrBlock");
                acl.icmp = [], acl.ports = []
                var code = getNodeValue(entries[j], "code");
                var type = getNodeValue(entries[j], "type");
                if (code != "" && type != "") {
                    acl.icmp.push([code, type])
                }
                var from = getNodeValue(entries[j], "from");
                var to = getNodeValue(entries[j], "to");
                if (from != "" && to != "") {
                    acl.ports.push([from, to])
                }
                obj.rules.push(acl)
            }

            var assoc = item.getElementsByTagName("associationSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < assoc.length; j++) {
                var o = new Element();
                o.toString = function() { return this.id + fieldSeparator + ew_core.modelValue("subnetId", this.subnetId); }
                o.id = getNodeValue(assoc[j], "networkAclAssociationId");
                o.aclId = getNodeValue(assoc[j], "networkAclId");
                o.subnetId = getNodeValue(assoc[j], "subnetId");
                obj.associations.push(o)
            }
            obj.tags = this.getTags(item);
            ew_core.processTags(obj);
            list.push(obj);
        }

        this.core.setModel('networkAcls', list);
        response.result = list;
    },

    describeVpnGateways : function(callback)
    {
        this.queryEC2("DescribeVpnGateways", [], this, false, "onCompleteDescribeVpnGateways", callback);
    },

    onCompleteDescribeVpnGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "vpnGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var vgw = new Element();
            vgw.toString = function() {
                var text = (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state
                for (var i in this.attachments) {
                    text += ", " + this.attachments[i].toString();
                }
                return text;
            }

            vgw.id = getNodeValue(item, "vpnGatewayId");
            vgw.availabilityZone = getNodeValue(item, "availabilityZone");
            vgw.type = getNodeValue(item, "type");
            vgw.state = getNodeValue(item, "state");
            vgw.attachments = this.getItems(item, "attachments", "item", []);
            if (vgw.attachments.length) {
                vgw.vpcId = vgw.attachments[0].vpcId;
            }
            vgw.tags = this.getTags(item);
            ew_core.processTags(vgw)
            list.push(vgw);
        }
        this.core.setModel('vpnGateways', list);
        response.result = list;
    },

    createVpnGateway : function(type, callback)
    {
        this.queryEC2("CreateVpnGateway", [ [ "Type", type ] ], this, false, "onComplete:vpnGatewayId", callback);
    },

    attachVpnGatewayToVpc : function(vgwid, vpcid, callback)
    {
        this.queryEC2("AttachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    detachVpnGatewayFromVpc : function(vgwid, vpcid, callback)
    {
        this.queryEC2("DetachVpnGateway", [ [ "VpnGatewayId", vgwid ], [ "VpcId", vpcid ] ], this, false, "onComplete", callback);
    },

    deleteVpnGateway : function(id, callback)
    {
        this.queryEC2("DeleteVpnGateway", [ [ "VpnGatewayId", id ] ], this, false, "onComplete", callback);
    },

    enableVgwRoutePropagation: function(vgwid, route, callback)
    {
        this.queryEC2("EnableVgwRoutePropagation", [ [ "GatewayId", vgwid ], ["RouteTableId", route] ], this, false, "onComplete", callback);
    },

    disableVgwRoutePropagation: function(vgwid, route, callback)
    {
        this.queryEC2("DisableVgwRoutePropagation", [ [ "GatewayId", vgwid ], ["RouteTableId", route] ], this, false, "onComplete", callback);
    },

    describeCustomerGateways : function(callback)
    {
        this.queryEC2("DescribeCustomerGateways", [], this, false, "onCompleteDescribeCustomerGateways", callback);
    },

    onCompleteDescribeCustomerGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "customerGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var cgw = new Element();
            cgw.toString = function() {
                return this.ipAddress + fieldSeparator + this.bgpAsn + (this.name ? fieldSeparator + this.name : "");
            }
            cgw.id = getNodeValue(item, "customerGatewayId");
            cgw.type = getNodeValue(item, "type");
            cgw.state = getNodeValue(item, "state");
            cgw.ipAddress = getNodeValue(item, "ipAddress");
            cgw.bgpAsn = getNodeValue(item, "bgpAsn");
            cgw.tags = this.getTags(item);
            ew_core.processTags(cgw)
            list.push(cgw);
        }
        this.core.setModel('customerGateways', list);
        response.result = list;
    },

    createCustomerGateway : function(type, ip, asn, callback)
    {
        this.queryEC2("CreateCustomerGateway", [ [ "Type", type ], [ "IpAddress", ip ], [ "BgpAsn", asn ] ], this, false, "onComplete:customerGatewayId", callback);
    },

    deleteCustomerGateway : function(id, callback)
    {
        this.queryEC2("DeleteCustomerGateway", [ [ "CustomerGatewayId", id ] ], this, false, "onComplete", callback);
    },

    describeInternetGateways : function(callback)
    {
        this.queryEC2("DescribeInternetGateways", [], this, false, "onCompleteDescribeInternetGateways", callback);
    },

    onCompleteDescribeInternetGateways : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "internetGatewaySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var igw = new Element();
            igw.toString = function() {
                return this.id + fieldSeparator + ew_core.modelValue("vpcId", this.vpcId);
            }

            igw.id = getNodeValue(item, "internetGatewayId");
            igw.vpcId = getNodeValue(item, "vpcId");
            igw.tags = this.getTags(item);
            ew_core.processTags(igw)
            list.push(igw);
        }
        this.core.setModel('internetGateways', list);
        response.result = list;
    },

    createInternetGateway : function(callback)
    {
        this.queryEC2("CreateInternetGateway", [], this, false, "onComplete:internetGatewayId", callback);
    },

    deleteInternetGateway : function(id, callback)
    {
        this.queryEC2("DeleteInternetGateway", [ [ "InternetGatewayId", id ] ], this, false, "onComplete", callback);
    },

    attachInternetGateway : function(igwid, vpcid, callback)
    {
        this.queryEC2("AttachInternetGateway", [["InternetGatewayId", igwid], ["VpcId", vpcid]], this, false, "onComplete", callback);
    },

    detachInternetGateway : function(igwid, vpcid, callback)
    {
        this.queryEC2("DetachInternetGateway", [["InternetGatewayId", igwid], ["VpcId", vpcid]], this, false, "onComplete", callback);
    },

    describeVpnConnections : function(callback)
    {
        this.queryEC2("DescribeVpnConnections", [], this, false, "onCompleteDescribeVpnConnections", callback);
    },

    onCompleteDescribeVpnConnections : function(response)
    {
        var xmlDoc = response.responseXML;

        // required due to the size of the customer gateway config
        // being very close to or in excess of 4096 bytes
        xmlDoc.normalize();

        var list = new Array();
        var items = this.getItems(xmlDoc, "vpnConnectionSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var vpn = new Element();
            vpn.toString = function() {
                return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state + fieldSeparator +
                        ew_core.modelValue("vgwId", this.vgwId) + fieldSeparator + ew_core.modelValue('cgwId', this.cgwId);
            }

            vpn.id = getNodeValue(item, "vpnConnectionId");
            vpn.cgwId = getNodeValue(item, "customerGatewayId");
            vpn.vgwId = getNodeValue(item, "vpnGatewayId");
            vpn.type = getNodeValue(item, "type");
            vpn.state = getNodeValue(item, "state");
            vpn.staticRoutesOnly = getNodeValue(item, "options", "staticRoutesOnly");
            vpn.attributes = getNodeValue(item, "vpn_connection_attributes");

            // Required since Firefox limits nodeValue to 4096 bytes
            var cgwtag = item.getElementsByTagName("customerGatewayConfiguration")
            if (cgwtag[0]) {
                vpn.config = cgwtag[0].textContent;
            }
            vpn.telemetry = this.getItems(item, "vgwTelemetry", "item", ["status", "outsideIpAddress","lastStatusChange","statusMessage","acceptedRouteCount"]);
            vpn.routes = this.getItems(item, "routes", "item", ["state", "source","destinationCidrBlock"]);
            vpn.tags = this.getTags(item);
            this.core.processTags(vpn)
            list.push(vpn);
        }
        this.core.setModel('vpnConnections', list);
        response.result = list;
    },

    createVpnConnection : function(type, cgwid, vgwid, staticOnly, callback)
    {
        var params = [ [ "Type", type ] ];
        params.push([ "CustomerGatewayId", cgwid ]);
        params.push([ "VpnGatewayId", vgwid ] );
        if (staticOnly) params.push([ "Options.StaticRoutesOnly", "true" ])
        this.queryEC2("CreateVpnConnection", params, this, false, "onComplete:vpnConnectionId", callback);
    },

    deleteVpnConnection : function(id, callback)
    {
        this.queryEC2("DeleteVpnConnection", [ [ "VpnConnectionId", id ] ], this, false, "onComplete", callback);
    },

    createVpnConnectionRoute: function(id, cidr, callback)
    {
        this.queryEC2("CreateVpnConnectionRoute", [ [ "VpnConnectionId", id ], ["DestinationCidrBlock", cidr] ], this, false, "onComplete", callback);
    },

    deleteVpnConnectionRoute: function(id, cidr, callback)
    {
        this.queryEC2("DeleteVpnConnectionRoute", [ [ "VpnConnectionId", id ], ["DestinationCidrBlock", cidr] ], this, false, "onComplete", callback);
    },

    unpackImage: function(item)
    {
        if (!item) return null;
        var obj = new Element();
        obj.toString = function() {
            return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.state + fieldSeparator + this.status + fieldSeparator + this.rootDeviceType;
        }
        obj.id = getNodeValue(item, "imageId");
        obj.location = getNodeValue(item, "imageLocation");
        obj.state = getNodeValue(item, "imageState");
        obj.ownerId = getNodeValue(item, "imageOwnerId");
        obj.status = getNodeValue(item, "isPublic") == "true" ? "public" : "private";
        obj.platform = getNodeValue(item, "platform");
        obj.aki = getNodeValue(item, "kernelId");
        obj.ari = getNodeValue(item, "ramdiskId");
        obj.rootDeviceType = getNodeValue(item, "rootDeviceType");
        obj.rootDeviceName = getNodeValue(item, "rootDeviceName");
        obj.ownerAlias = getNodeValue(item, "imageOwnerAlias");
        obj.productCodes = this.getItems(item, "productCodes", "item", []);
        obj.name = getNodeValue(item, "name");
        obj.description = getNodeValue(item, "description");
        obj.snapshotId = getNodeValue(item, "snapshotId");
        obj.volumes = [];
        var objs = this.getItems(item, "blockDeviceMapping", "item");
        for (var i = 0; i < objs.length; i++) {
            var dev = new Element();
            dev.toString = function() {
                return this.deviceName +
                       (this.virtualName ? fieldSeparator + this.virtualName : "") + (this.volumeSize ? fieldSeparator + this.volumeSize + "GB" : "") +
                       (this.snapshotId ? fieldSeparator + this.snapshotId : "") + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
                       (this.noDevice ? fieldSeparator + "noDevice" : "");
            }
            dev.deviceName = getNodeValue(objs[i], "deviceName");
            dev.virtualName = getNodeValue(objs[i], "virtualName");
            dev.snapshotId = getNodeValue(objs[i], "ebs", "snapshotId");
            dev.volumeSize = getNodeValue(objs[i], "ebs", "volumeSize");
            dev.volumeType = getNodeValue(objs[i], "ebs", "volumeType");
            dev.deleteOnTermination = toBool(getNodeValue(objs[i], "ebs", "deleteOnTermination"))
            dev.noDevice = objs[i].getElementsByTagName("noDevice").length ? true : false;
            obj.volumes.push(dev);
        }
        obj.virtualizationType = getNodeValue(item, 'virtualizationType');
        obj.hypervisor = getNodeValue(item, 'hypervisor');
        obj.arch = getNodeValue(item, 'architecture');
        obj.tags = this.getTags(item);
        ew_core.processTags(obj)
        return obj;
    },

    describeImage : function(imageId, callback)
    {
        this.queryEC2("DescribeImages", [ [ "ImageId", imageId ] ], this, false, "onCompleteDescribeImage", callback);
    },

    onCompleteDescribeImage : function(response)
    {
        var xmlDoc = response.responseXML;
        var items = this.getItems(xmlDoc, "imagesSet", "item");
        response.result = this.unpackImage(items[0]);
    },

    createImage : function(instanceId, amiName, amiDescription, noReboot, callback)
    {
        var noRebootVal = noReboot ? "true" : "false";

        this.queryEC2("CreateImage", [ [ "InstanceId", instanceId ], [ "Name", amiName ], [ "Description", amiDescription ], [ "NoReboot", noRebootVal ] ], this, false, "onCompleteCreateImage", callback);
    },

    onCompleteCreateImage: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "imageId");
    },

    describeImages : function(owners, execBy, callback)
    {
        var params = [];
        if (owners) {
            if (owners instanceof Array) {
                owners.forEach(function (x, i) { params.push(["Owner." + (i + 1), x])})
            } else {
                params.push(["Owner.1", owners])
            }
	    debug(owners);
        }
        if (execBy) {
            if (execBy instanceof Array) {
                execBy.forEach(function (x, i) { params.push(["ExecutableBy." + (i + 1), x])})
            } else {
                params.push(["ExecutableBy.1", execBy])
            }
        }
        this.queryEC2("DescribeImages", params, this, false, "onCompleteDescribeImages", callback);
    },

    onCompleteDescribeImages : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "imagesSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var ami = this.unpackImage(item);
            if (ami) list.push(ami);
        }
        this.core.setModel('images', list);
        response.result = list;
    },

    describeReservedInstancesOfferings : function(params, callback)
    {
        if (!params) params = [];
        this.queryEC2("DescribeReservedInstancesOfferings", params, this, false, "onCompleteDescribeReservedInstancesOfferings", callback);
    },

    onCompleteDescribeReservedInstancesOfferings : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "reservedInstancesOfferingsSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.id + fieldSeparator + this.instanceType
            }
            obj.id = getNodeValue(item, "reservedInstancesOfferingId");
            obj.instanceType = getNodeValue(item, "instanceType");
            obj.azone = getNodeValue(item, "availabilityZone");
            obj.duration = secondsToYears(getNodeValue(item, "duration"));
            obj.fixedPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            obj.usagePrice = getNodeValue(item, "usagePrice");
            obj.productDescription = getNodeValue(item, "productDescription");
            obj.offeringType = getNodeValue(item, "offeringType");
            obj.tenancy = getNodeValue(item, "instanceTenancy");
            obj.marketPlace = toBool(getNodeValue(item, "marketplace"));
            obj.recurringPrices = this.getItems(item, "recurringCharges", "item", []);
            obj.marketPrices = this.getItems(item, "pricingDetailsSet", "item", ["price","count"], function(oo) {
                var o = new Element('price', oo.price, 'count', oo.count)
                o.toString = function() {
                    return '$' + this.price + fieldSeparator + this.count + ' available';
                }
                return o;
            });
            list.push(obj);
        }
        return this.getNext(response, this.queryEC2, list);
    },

    createInstanceExportTask: function(id, targetEnv, bucket, descr, prefix, diskFormat, containerFormat, callback)
    {
        var params = [];
        params.push(["InstanceId", id])
        params.push(["TargetEnvironment", targetEnv]);
        params.push(["ExportToS3.S3Bucket", bucket]);
        if (descr) params.push(["Description", descr]);
        if (diskFormat) params.push(["ExportToS3.DiskImageFormat", diskFormat]);
        if (containerFormat) params.push(["ExportToS3.ContainerFormat", containerFormat]);
        if (prefix) params.push(["ExportToS3.S3prefix", prefix]);
        this.queryEC2("CreateInstanceExportTask", params, this, false, "onComplete:exportTaskId", callback);
    },

    cancelExportTask: function(id, callback)
    {
        this.queryEC2("CancelExportTask", [["ExportTaskId", id]], this, false, "onComplete", callback);
    },

    describeExportTasks: function(callback)
    {
        this.queryEC2("DescribeExportTasks", [], this, false, "onCompleteDescribeExportTasks", callback);
    },

    onCompleteDescribeExportTasks : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "exportTaskSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.id + fieldSeparator + this.state + fieldSeparator + this.descr + fieldSeparator + ew_core.modelValue('instanceId',this.instanceId) +
                                 fieldSeparator + this.statusMessage + fieldSeparator + this.bucket + this.prefix;
            }

            obj.id = getNodeValue(item, "exportTaskId");
            obj.state = getNodeValue(item, "state");
            obj.statusMessage = getNodeValue(item, "statusMessage");
            obj.descr = getNodeValue(item, "description");
            obj.instanceId = getNodeValue(item, "instanceExport", "instanceId");
            obj.targetEnvironment = getNodeValue(item, "instanceExport", "targetEnvironment");
            obj.diskImageFormat = getNodeValue(item, "exportToS3", "diskImageFormat");
            obj.containerFormat = getNodeValue(item, "exportToS3", "containerFormat");
            obj.bucket = getNodeValue(item, "exportToS3", "s3Bucket");
            obj.prefix = getNodeValue(item, "exportToS3", "s3Key");
            list.push(obj)
        }
        this.core.setModel('exportTasks', list);
        response.result = list;
    },

    cancelConversionTask: function(id, callback)
    {
        this.queryEC2("CancelConversionTask", [["ConversionTaskId", id]], this, false, "onComplete", callback);
    },

    describeConversionTasks: function(callback)
    {
        this.queryEC2("DescribeConversionTasks", [], this, false, "onCompleteDescribeConversionTasks", callback);
    },

    onCompleteDescribeConversionTasks : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "conversionTasks", "item");
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "conversionTaskId");
            var state = getNodeValue(item, "state");
            var statusMsg = getNodeValue(item, "statusMessage");
            var expire = new Date(getNodeValue(item, "expirationTime"));

            var vols = item.getElementsByTagName("importVolume")[0];
            if (vols) {
                var vol = new Element('id', id, 'expire', expire, 'state', state, 'statusMessage', statusMsg);
                vol.toString = function() {
                    return this.volumeId + fieldSeparator + this.bytesConverted + "/" + this.volumeSize + fieldSeparator + this.imageFormat + fieldSeparator + this.state;
                }
                vol.bytesConverted = getNodeValue(vols, "bytesConverted");
                vol.availabilityZone = getNodeValue(vols, "avilabilityZone");
                vol.vdescr = getNodeValue(vols, "description");
                vol.imageFormat = getNodeValue(vols, "image", "format");
                vol.imagesize = getNodeValue(vols, "image", "size");
                vol.imageUrl = getNodeValue(vols, "image", "importManifestUrl");
                vol.imageChecksum = getNodeValue(vols, "image", "checksum");
                vol.volumeSize = getNodeValue(vols, "volume", "size");
                vol.volumeId = getNodeValue(vols, "volume", "id");
                list.push(vol);
            }

            var instance = item.getElementsByTagName("importInstance")[0];
            if (instance) {
                var obj = new Element('id', id, 'expire', expire, 'state', state, 'statusMessage', statusMsg);
                obj.toString = function() {
                    return this.instanceId + fieldSeparator + this.state + fieldSeparator + this.platform + fieldSeparator + this.volumes;
                }
                obj.instanceId = getNodeValue(instance, "instanceId");
                obj.platform = getNodeValue(instance, "platform");
                obj.descr = getNodeValue(instance, "description");
                obj.volumes = [];
                var vols = this.getItems(instance, "volumes", "item");
                for (var j = 0; j < vols.length; j++) {
                    var vol = new Element('id', id, 'expire', expire)
                    vol.toString = function() {
                        return this.volumeId + fieldSeparator + this.bytesConverted + "/" + this.volumeSize + fieldSeparator + this.imageFormat + fieldSeparator + this.state;
                    }
                    vol.state = getNodeValue(vols[j], "status");
                    vol.statusMessage = getNodeValue(vols[j], "statusMessage");
                    vol.bytesConverted = getNodeValue(vols[j], "bytesConverted");
                    vol.availabilityZone = getNodeValue(vols[j], "avilabilityZone");
                    vol.vdescr = getNodeValue(vols[j], "description");
                    vol.imageFormat = getNodeValue(vols[j], "image", "format");
                    vol.imagesize = getNodeValue(vols[j], "image", "size");
                    vol.imageUrl = getNodeValue(vols[j], "image", "importManifestUrl");
                    vol.imageChecksum = getNodeValue(vols[j], "image", "checksum");
                    vol.volumeSize = getNodeValue(vols[j], "volume", "size");
                    vol.volumeId = getNodeValue(vols[j], "volume", "id");
                    obj.volumes.push(vol)
                }
                obj.bytesConverted = obj.volumes.length ? obj.volumes[0].bytesConverted : 0;
                list.push(obj)
            }
        }
        this.core.setModel('conversionTasks', list);
        response.result = list;
    },

    describeReservedInstances : function(callback)
    {
        this.queryEC2("DescribeReservedInstances", [], this, false, "onCompleteDescribeReservedInstances", callback);
    },

    onCompleteDescribeReservedInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "reservedInstancesSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            function ReservedInstance(id, type, az, start, duration, fPrice, uPrice, rPrices, count, desc, state, tenancy)
            {
                this.id = id;
                this.instanceType = type;
                this.azone = az;
                this.startTime = start;
                this.start = start.strftime('%Y-%m-%d %H:%M:%S');
                this.duration = duration;
                this.fixedPrice = fPrice;
                this.usagePrice = uPrice;
                this.recurringCharges = rPrices;
                this.count = count;
                this.productDescription = desc;
                this.state = state;
                this.tenancy = tenancy

            }

            var obj = new Element();
            obj.toString = function() {
                return this.instanceType  + fieldSeparator + this.fixedPrice + fieldSeparator +  this.recurringCharges + fieldSeparator + this.id;
            }
            obj.id = getNodeValue(item, "reservedInstancesId");
            obj.instanceType = getNodeValue(item, "instanceType");
            obj.azone = getNodeValue(item, "availabilityZone");
            obj.startTime = new Date(getNodeValue(item, "start"));
            obj.start = obj.startTime.strftime('%Y-%m-%d %H:%M:%S');
            obj.duration = secondsToYears(getNodeValue(item, "duration"));
            obj.fixedPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            obj.usagePrice = getNodeValue(item, "usagePrice");
            obj.count = getNodeValue(item, "instanceCount");
            obj.productDescription = getNodeValue(item, "productDescription");
            obj.state = getNodeValue(item, "state");
            obj.tenancy = getNodeValue(item, "instanceTenancy");
            obj.recurringPrices = this.getItems(item, "recurringCharges", "item", []);
            list.push(obj);
        }

        this.core.setModel('reservedInstances', list);
        response.result = list;
    },

    purchaseReservedInstancesOffering : function(id, count, limit, callback)
    {
        var params = [];
        params.push([ "ReservedInstancesOfferingId", id ]);
        params.push([ "InstanceCount", count ]);
        if (limit) params.push(["LimitPrice.Amount", limit]);

        this.queryEC2("PurchaseReservedInstancesOffering", params, this, false, "onComplete", callback);
    },

    describeLaunchPermissions : function(imageId, callback)
    {
        this.queryEC2("DescribeImageAttribute", [ [ "ImageId", imageId ], [ "Attribute", "launchPermission" ] ], this, false, "onCompleteDescribeLaunchPermissions", callback);
    },

    onCompleteDescribeLaunchPermissions : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            if (items[i].getElementsByTagName("group")[0]) {
                list.push(getNodeValue(items[i], "group"));
            }
            if (items[i].getElementsByTagName("userId")[0]) {
                list.push(getNodeValue(items[i], "userId"));
            }
        }

        response.result = list;
    },

    addLaunchPermission : function(imageId, name, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        params.push([ "OperationType", "add" ]);
        if (name == "all") {
            params.push([ "UserGroup.1", name ]);
        } else {
            params.push([ "UserId.1", name ]);
        }
        this.queryEC2("ModifyImageAttribute", params, this, false, "onComplete", callback);
    },

    revokeLaunchPermission : function(imageId, name, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        params.push([ "OperationType", "remove" ]);
        if (name == "all") {
            params.push([ "UserGroup.1", name ]);
        } else {
            params.push([ "UserId.1", name ]);
        }
        this.queryEC2("ModifyImageAttribute", params, this, false, "onComplete", callback);
    },

    resetLaunchPermissions : function(imageId, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "Attribute", "launchPermission" ]);
        this.queryEC2("ResetImageAttribute", params, this, false, "onComplete", callback);
    },

    describeSpotPriceHistory : function(start, end, instanceType, product, availaZone, callback)
    {
        var params = [];
        if (start) params.push(["StartTime", start])
        if (end) params.push(["EndTime", end])
        if (instanceType) params.push(["InstanceType", instanceType])
        if (product) params.push(["ProductDescription", product])
        if (availaZone) params.push(["AvailabilityZone", availaZone])
        this.queryEC2("DescribeSpotPriceHistory", params, this, false, "onCompleteDescribeSpotPriceHistory", callback);
    },

    onCompleteDescribeSpotPriceHistory : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "spotPriceHistorySet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element()
            obj.toString = function() {
                return this.instanceType + fieldSeparator + this.price;
            }
            obj.instanceType = getNodeValue(item, "instanceType");
            obj.availabilityZone = getNodeValue(item, "availabilityZone");
            obj.date = new Date(getNodeValue(item, "timestamp"));
            obj.productDescription = getNodeValue(item, "productDescription");
            obj.price = getNodeValue(item, "spotPrice");
            list.push(obj);
        }
        return this.getNext(response, this.queryEC2, list);
    },

    createSpotDatafeedSubscription : function(bucket, prefix, callback)
    {
        var params = [ [ "Bucket", bucket]]
        if (prefix) params.push(["Prefix", prefix]);
        this.queryEC2("CreateSpotDatafeedSubscription", params, this, false, "onCompleteDescribeSpotDatafeedSubscription", callback);
    },

    deleteSpotDatafeedSubscription : function(callback)
    {
        this.queryEC2("DeleteSpotDatafeedSubscription", [], this, false, "onComplete", callback);
    },

    describeSpotDatafeedSubscription : function(callback)
    {
        this.queryEC2("DescribeSpotDatafeedSubscription", [], this, false, "onCompleteDescribeSpotDatafeedSubscription", callback);
    },

    onCompleteDescribeSpotDatafeedSubscription : function(response)
    {
        response.hasErrors = false;
        var xmlDoc = response.responseXML;
        var obj = {};
        obj.owner = getNodeValue(xmlDoc, "spotDatafeedSubscription", "ownerId");
        obj.bucket = getNodeValue(xmlDoc, "spotDatafeedSubscription", "bucket");
        obj.prefix = getNodeValue(xmlDoc, "spotDatafeedSubscription", "prefix");
        obj.state = getNodeValue(xmlDoc, "spotDatafeedSubscription", "state");
        response.result = obj;
    },

    describeSpotInstanceRequests : function(callback)
    {
        this.queryEC2("DescribeSpotInstanceRequests", [], this, false, "onCompleteDescribeSpotInstanceRequests", callback);
    },

    onCompleteDescribeSpotInstanceRequests : function(response)
    {
        response.hasErrors = false;
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "spotInstanceRequestSet", "item");
        for ( var k = 0; k < items.length; k++) {
            var item = items[k];
            var obj = new Element()
            obj.toString = function() {
                return this.instanceType + fieldSeparator + this.product + fieldSeparator + this.price + fieldSeparator + this.type;
            }

            obj.id = getNodeValue(item, "spotInstanceRequestId");
            obj.price = getNodeValue(item, "spotPrice");
            obj.type = getNodeValue(item, "type");
            obj.state = getNodeValue(item, "state");
            obj.instanceId = getNodeValue(item, "instanceId");
            obj.date = new Date(getNodeValue(item, "createTime"));
            obj.productDescription = getNodeValue(item, "productDescription");
            obj.availabilityZone = getNodeValue(item, "launchedAvailabilityZone");
            obj.imageId = getNodeValue(item, "launchSpecification", "imageId");
            obj.instanceType = getNodeValue(item, "launchSpecification", "instanceType");
            obj.faultMessage = getNodeValue(item, "fault", "message");
            obj.tags = this.getTags(item);
            ew_core.processTags(obj);
            list.push(obj);
        }

        this.core.setModel('spotInstanceRequests', list);
        response.result = list;
    },

    requestSpotInstances: function(price, count, type, validFrom, validUntil, launchGroup, availZoneGroup, imageId, instanceType, options, callback)
    {
        var params = this.createLaunchParams(options, "LaunchSpecification.");

        params.push([ "LaunchSpecification.ImageId", imageId ]);
        params.push([ "LaunchSpecification.InstanceType", instanceType ]);
        params.push(["SpotPrice", price]);

        if (count) params.push(["InstanceCount", count]);
        if (type) params.push(["Type", type]);
        if (validFrom) params.push(["ValidFrom", validFrom]);
        if (validUntil) params.push(["ValidUntil", validUntil]);
        if (launchGroup) params.push(["LaunchGroup", launchGroup]);
        if (availZoneGroup) params.push(["AvailabilityZoneGroup", availZoneGroup]);

        this.queryEC2("RequestSpotInstances", params, this, false, "onCompleteRequestSpotInstances", callback);
    },

    onCompleteRequestSpotInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "spotInstanceRequestSet", "item", "spotInstanceRequestId");
        response.result = list;
    },

    cancelSpotInstanceRequests: function(id, callback)
    {
        var params = [];
        if (id instanceof Array) {
            for (var i = 0;i < id.length; i++) {
                params.push(["SpotInstanceRequestId." + (i + 1), id[i]])
            }
        } else {
            params.push(["SpotInstanceRequestId.1", id])
        }
        this.queryEC2("CancelSpotInstanceRequests", params, this, false, "onComplete", callback);
    },

    describeInstances : function(callback)
    {
        this.queryEC2("DescribeInstances", [], this, false, "onCompleteDescribeInstances", callback);
    },

    onCompleteDescribeInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "reservationSet", "item");
        for ( var k = 0; k < items.length; k++) {
            var item = items[k];
            var reservationId = getNodeValue(item, "reservationId");
            var ownerId = getNodeValue(item, "ownerId");
            var requesterId = getNodeValue(item, "requesterId");
            var groups = this.getItems(item, "groupSet", "item", ["groupId", "groupName"], function(obj) { return new Element('id', obj.groupId, 'name', obj.groupName, 'owner', '', 'status', '')});
            var instancesSet = item.getElementsByTagName("instancesSet")[0];
            var instanceItems = instancesSet.childNodes;
            if (instanceItems) {
                for (var j = 0; j < instanceItems.length; j++) {
                    if (instanceItems[j].nodeName == '#text') continue;
                    var instance = instanceItems[j];
                    var iobj = new Element('className', 'Instance', 'name', '');
                    iobj.toString = function() {
                        return (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + this.instanceType + fieldSeparator + this.state + (this.elasticIp ? fieldSeparator + this.elasticIp : "");
                    }
                    iobj.validate = function() {
                        if (!this.ipAddress && this.dnsName) {
                            var parts = this.dnsName.split('-');
                            this.ipAddress = parts[1] + "." + parts[2] + "." + parts[3] + "." + parseInt(parts[4]);
                        }
                        if (!this.elasticIp) {
                            var eip = ew_core.queryModel('addresses', 'instanceId', this.id);
                            this.elasticIp = eip && eip.length ? eip[0].publicIp : '';
                        }
                    }
                    iobj.id = getNodeValue(instance, "instanceId");
                    iobj.imageId = getNodeValue(instance, "imageId");
                    iobj.state = getNodeValue(instance, "instanceState", "name");
                    iobj.productCodes = this.getItems(instance, "productCodes", "item", []);
                    iobj.securityGroups = uniqueList(groups.concat(this.getGroups(instance)), 'id');
                    iobj.dnsName = getNodeValue(instance, "dnsName");
                    iobj.privateDnsName = getNodeValue(instance, "privateDnsName");
                    iobj.privateIpAddress = getNodeValue(instance, "privateIpAddress");
                    iobj.vpcId = getNodeValue(instance, "vpcId");
                    iobj.subnetId = getNodeValue(instance, "subnetId");
                    iobj.keyName = getNodeValue(instance, "keyName");
                    iobj.reason = getNodeValue(instance, "reason");
                    iobj.amiLaunchIdx = getNodeValue(instance, "amiLaunchIndex");
                    iobj.instanceType = getNodeValue(instance, "instanceType");
                    iobj.launchTime = new Date(getNodeValue(instance, "launchTime"));
                    iobj.availabilityZone = getNodeValue(instance, "placement", "availabilityZone");
                    iobj.tenancy = getNodeValue(instance, "placement", "tenancy");
                    iobj.monitoringEnabled = toBool(getNodeValue(instance, "monitoring", "state"));
                    iobj.stateReason = getNodeValue(instance, "stateReason", "code");
                    iobj.platform = getNodeValue(instance, "platform");
                    iobj.kernelId = getNodeValue(instance, "kernelId");
                    iobj.ramdiskId = getNodeValue(instance, "ramdiskId");
                    iobj.rootDeviceType = getNodeValue(instance, "rootDeviceType");
                    iobj.rootDeviceName = getNodeValue(instance, "rootDeviceName");
                    iobj.virtualizationType = getNodeValue(instance, 'virtualizationType');
                    iobj.hypervisor = getNodeValue(instance, 'hypervisor');
                    iobj.ipAddress = getNodeValue(instance, "ipAddress");
                    iobj.sourceDestCheck = toBool(getNodeValue(instance, 'sourceDestCheck'));
                    iobj.architecture = getNodeValue(instance, "architecture");
                    iobj.instanceLifecycle = getNodeValue(instance, "instanceLifecycle")
                    iobj.clientToken = getNodeValue(instance, "clientToken")
                    iobj.spotInstanceRequestId = getNodeValue(instance ,"spotInstanceRequestId");
                    iobj.instanceProfile = getNodeValue(instance, "iamInstanceProfile", "id");
                    iobj.ebsOptimized = toBool(getNodeValue(instance, "ebsOptimized"));
                    iobj.volumes = [];
                    var objs = this.getItems(instance, "blockDeviceMapping", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var dev = new Element();
                        dev.toString = function() {
                            var vol = ew_core.modelValue("volumeId", this.volumeId);
                            return vol != this.voluemId ? vol : this.deviceName + fieldSeparator + this.status + fieldSeparator + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "");
                        }
                        dev.deviceName = getNodeValue(objs[i], "deviceName");
                        dev.volumeId = getNodeValue(objs[i], "ebs", "volumeId");
                        dev.status = getNodeValue(objs[i], "ebs", "status");
                        dev.attachTime = new Date(getNodeValue(objs[i], "ebs", "attachTime"));
                        dev.deleteOnTermination = getNodeValue(objs[i], "ebs", "deleteOnTermination");
                        iobj.volumes.push(dev);
                    }
                    iobj.networkInterfaces = [];
                    var objs = this.getItems(instance, "networkInterfaceSet", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var eni = new Element();
                        eni.toString = function() {
                            return (this.descr ? this.descr + fieldSeparator : "") +
                                    this.status + fieldSeparator + 'eth' + this.deviceIndex + fieldSeparator +
                                    (this.privateIpAddresses.length ? this.privateIpAddresses : this.privateIp + (this.publicIp ? "/" + this.publicIp : ""));
                        }
                        eni.id = getNodeValue(objs[i], "networkInterfaceId");
                        eni.status = getNodeValue(objs[i], "status");
                        eni.descr = getNodeValue(objs[i], "description");
                        eni.subnetId = getNodeValue(objs[i], "subnetId");
                        eni.vpcId = getNodeValue(objs[i], "vpcId");
                        eni.ownerId = getNodeValue(objs[i], "ownerId");
                        eni.privateIp = getNodeValue(objs[i], "privateIpAddress");
                        eni.publicIp = getNodeValue(objs[i], "association", "publicIp");
                        eni.dnsName = getNodeValue(objs[i], "privateDnsName");
                        eni.sourceDestCheck = getNodeValue(objs[i], "sourceDestCheck");
                        eni.attachmentId = getNodeValue(objs[i], "attachment", "attachmentId");
                        eni.deviceIndex = getNodeValue(objs[i], "attachment", "deviceIndex");
                        eni.attachmentStatus = getNodeValue(objs[i], "attachment", "status");
                        eni.deleteOnTermination = getNodeValue(objs[i], "attachment", "deleteOnTermination");
                        eni.privateIpAddresses = [];
                        var objs = this.getItems(instance, "privateIpAddressesSet", "item");
                        for (var i = 0; i < objs.length; i++) {
                            var pip = new Element();
                            pip.toString = function() {
                                return this.privateIp + (this.publicIp ? "/" + this.publicIp : "") + fieldSeparator + (this.primary ? "Primary" : "Secondary");
                            }
                            pip.privateIp = getNodeValue(objs[i], "privateIpAddress");
                            pip.primary = toBool(getNodeValue(objs[i], "primary"));
                            pip.publicIp = getNodeValue(objs[i], "association", "publicIp");
                            eni.privateIpAddresses.push(pip);
                        }
                        iobj.networkInterfaces.push(eni);
                    }
                    iobj.tags = this.getTags(instance);
                    ew_core.processTags(iobj);
                    list.push(iobj);
                }
            }
        }

        this.core.setModel('instances', list);
        response.result = list;
    },

    runMoreInstances: function(instance, count, callback)
    {
        var me = this;
        var params = cloneObject(instance)
        this.describeInstanceAttribute(instance.id, "userData", function(data) {
            params.userData = data;
            params.privateIpAddress = null;
            me.runInstances(instance.imageId, instance.instanceType, count, count, params, callback);
        });
    },

    importInstance: function(instanceType, arch, diskFmt, diskBytes, diskUrl, diskSize, options, callback)
    {
        var params = this.createLaunchParams(options, "LaunchSpecification.");
        //params.push(["Platform", "Windows"])
        params.push(["LaunchSpecification.InstanceType", instanceType])
        params.push(["LaunchSpecification.Architecture", arch])
        params.push(["DiskImage.1.Image.Format", diskFmt]);
        params.push(["DiskImage.1.Image.Bytes", diskBytes]);
        params.push(["DiskImage.1.Image.ImportManifestUrl", diskUrl]);
        params.push(["DiskImage.1.Volume.Size", diskSize]);
        if (options.platform) params.push(["Platform", options.platform]);
        if (options.description) params.push(["Description", options.description]);
        if (options.diskDescription) params.push(["DiskImage.1.Image.Description", options.diskDescription]);

        this.queryEC2("ImportInstance", params, this, false, "onComplete", callback);
    },

    //
    // TODO: This method is not called, plus it has errors (the variables callback
    // TODO: and params are undeclared) so need to fix, or remove this code.
    //
    importVolume: function()
    {
        //var params = [];
        //this.queryEC2("ImportVolume", params, this, false, "onComplete", callback);
    },

    createLaunchParams: function(options, prefix)
    {
        if (!prefix) prefix = '';

        var params = [];
        if (options.kernelId) {
            params.push([ prefix + "KernelId", options.kernelId ]);
        }
        if (options.ramdiskId) {
            params.push([ prefix + "RamdiskId", options.ramdiskId ]);
        }
        if (options.keyName) {
            params.push([ prefix + "KeyName", options.keyName ]);
        }
        if (options.instanceProfile) {
            params.push([prefix + "IamInstanceProfile.Name", options.instanceProfile])
        }
        if (options.securityGroupNames) {
            params.push([ prefix + "groupId", typeof options.securityGroupNames[0] == "object" ? options.securityGroupNames[0].name : options.securityGroupNames[0] ]);
        }
        if (options.userData) {
            var b64str = "Base64:";
            if (options.userData.indexOf(b64str) != 0) {
                // This data needs to be encoded
                options.userData = Base64.encode(options.userData);
            } else {
                options.userData = options.userData.substring(b64str.length);
            }
            params.push([ prefix + "UserData", options.userData ]);
        }
        if (options.additionalInfo) {
            params.push([ prefix + "AdditionalInfo", options.additionalInfo ]);
        }
        if (options.clientToken) {
            params.push([ prefix + "ClientToken", options.clientToken])
        }
        if (options.ebsOptimized) {
            params.push([prefix + "EbsOptimized", "true"]);
        }
        if (options.monitoringEnabled) {
            params.push([ prefix + "Monitoring.Enabled", "true"]);
        }
        if (options.disableApiTermination) {
            params.push([ prefix + "DisableApiTermination", "true"]);
        }
        if (options.instanceInitiatedShutdownBehaviour) {
            params.push([ prefix + "InstanceInitiatedShutdownBehavior", options.instanceInitiatedShutdownBehaviour]);
        }
        if (options.availabilityZone) {
            params.push([ prefix + "Placement.AvailabilityZone", options.availabilityZone ]);
        }
        //if (options.placementGroup) {
        //    params.push([ prefix + "Placement.GroupName", options.placementGroup ]);
        //}
        //if (options.tenancy) {
        //    params.push([ prefix + "Placement.Tenancy", options.tenancy ]);
        //}
        if (options.subnetId) {
            params.push([ prefix + "SubnetId", options.subnetId ]);
            if (options.privateIpAddress) {
                params.push([ prefix + "PrivateIpAddress", options.privateIpAddress ]);
            }
        }
        if (options.blockDeviceMapping) {
            params.push([ prefix + 'BlockDeviceMapping.1.DeviceName', options.blockDeviceMapping.deviceName ]);
            if (options.blockDeviceMapping.virtualName) {
                params.push([ prefix + 'BlockDeviceMapping.1.VirtualName', options.blockDeviceMapping.virtualName ]);
            } else
            if (options.blockDeviceMapping.snapshotId) {
                params.push([ prefix + 'BlockDeviceMapping.1.Ebs.SnapshotId', options.blockDeviceMapping.snapshotId ]);
                params.push([ prefix + 'BlockDeviceMapping.1.Ebs.DeleteOnTermination', options.blockDeviceMapping.deleteOnTermination ? true : false ]);
            } else
            if (options.blockDeviceMapping.volumeSize) {
                params.push([ prefix + 'BlockDeviceMapping.1.Ebs.VolumeSize', options.blockDeviceMapping.volumeSize ]);
            }
        }
        if (options.networkInterface) {
            params.push([ prefix + "NetworkInterface.0.DeviceIndex", options.networkInterface.deviceIndex])
            if (options.networkInterface.eniId) {
                params.push([ prefix + "NetworkInterface.0.NetworkInterfaceId", options.networkInterface.eniId])
            }
            if (options.networkInterface.subnetId) {
                params.push([ prefix + "NetworkInterface.0.SubnetId", options.networkInterface.subnetId])
            }
            if (options.networkInterface.description) {
                params.push([ prefix + "NetworkInterface.0.Description", options.networkInterface.description])
            }
            if (options.networkInterface.privateIpAddress) {
                params.push([ prefix + "NetworkInterface.0.PrivateIpAddresses.0.Primary", "true"]);
                params.push([ prefix + "NetworkInterface.0.PrivateIpAddresses.0.PrivateIpAddress", options.networkInterface.privateIpAddress]);
            }
            for (var i in options.networkInterface.secondaryIpAddresses) {
                params.push([ prefix + "NetworkInterface.0.PrivateIpAddresses." + (parseInt(i) + 1) + ".Primary", "false"])
                params.push([ prefix + "NetworkInterface.0.PrivateIpAddresses." + (parseInt(i) + 1) + ".PrivateIpAddress", options.networkInterface.secondaryIpAddresses[i]])
            }
            for (var i in options.networkInterface.securityGroups) {
                params.push([ prefix + "NetworkInterface.0.SecurityGroupId." + parseInt(i), options.networkInterface.securityGroups[i]])
            }
        }
        return params;
    },

    runInstances : function(imageId, instanceType, minCount, maxCount, options, callback)
    {
        var params = this.createLaunchParams(options);
        params.push([ "MinCount", minCount ]);
        params.push([ "MaxCount", maxCount ]);
        params.push([ "ImageId", imageId ]);
        params.push([ "InstanceType", instanceType ]);
        this.queryEC2("RunInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    onCompleteRunInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "instancesSet", "item", "instanceId");

        response.result = list;
    },

    describeInstanceAttribute : function(instanceId, attribute, callback)
    {
        this.queryEC2("DescribeInstanceAttribute", [[ "InstanceId", instanceId ], [ "Attribute", attribute ]], this, false, "onCompleteDescribeInstanceAttribute", callback);
    },

    onCompleteDescribeInstanceAttribute : function(response)
    {
        var xmlDoc = response.responseXML;
        var value = getNodeValue(xmlDoc, "value");

        response.result = value;
    },

    modifyInstanceAttribute : function(instanceId, name, value, callback)
    {
        this.queryEC2("ModifyInstanceAttribute", [ [ "InstanceId", instanceId ], [ name + ".Value", value ] ], this, false, "onComplete", callback);
    },

    modifyInstanceAttributes : function(instanceId, params, callback)
    {
        params.push([ "InstanceId", instanceId ]);

        this.queryEC2("ModifyInstanceAttribute", params, this, false, "onComplete", callback);
    },

    describeInstanceStatus : function (id, all, callback)
    {
        var params = [];
        if (id) params.push(["InstanceId", id])
        if (all) params.push(["IncludeAllInstances", true])

        this.queryEC2("DescribeInstanceStatus", params, this, false, "onCompleteDescribeInstanceStatus", callback);
    },

    onCompleteDescribeInstanceStatus : function (response)
    {
        function InstanceStatusEvent(type, instanceId, availabilityZone, status, code, description, startTime, endTime)
        {
            this.type = type;
            this.instanceId = instanceId;
            this.availabilityZone = availabilityZone;
            this.status = status;
            this.code = code;
            this.description = description;
            this.startTime = startTime;
            this.endTime = endTime;
            this.toString = function() {
                return this.type + fieldSeparator + this.instanceId + (this.status ? fieldSeparator + this.status : "") + fieldSeparator +
                       this.description + fieldSeparator + this.code + (this.startTime ? fieldSeparator + this.startTime : "");
            }
        }

        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "instanceStatusSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var instanceId = getNodeValue(item, "instanceId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            list = [];

            var objs = item.getElementsByTagName("systemStatus");
            for (var j = 0; j < objs.length; j++) {
                var status = getNodeValue(objs[j], "status");
                var details = this.getItems(objs[j], "details", "item");
                for (var k = 0; k < details.length; k++) {
                    var name = getNodeValue(details[k], "name");
                    var code = getNodeValue(details[k], "status");
                    var date = getNodeValue(details[k], "impairedSince");
                    list.push(new InstanceStatusEvent("SystemStatus", instanceId, availabilityZone, status, code, name, date, ""));
                }
            }

            var objs = item.getElementsByTagName("instanceStatus");
            for (var j = 0; j < objs.length; j++) {
                var status = getNodeValue(objs[j], "status");
                var details = this.getItems(objs[j], "details", "item");
                for (var k = 0; k < details.length; k++) {
                    var name = getNodeValue(details[k], "name");
                    var code = getNodeValue(details[k], "status");
                    var date = getNodeValue(details[k], "impairedSince");
                    list.push(new InstanceStatusEvent("InstanceStatus", instanceId, availabilityZone, status, code, name, date, ""));
                }
            }

            var objs = this.getItems(item, "eventsSet", "items");
            for (var j = 0; j < objs.length; j++) {
                var code = getNodeValue(objs[j], "code");
                var description = getNodeValue(objs[j], "description");
                var startTime = getNodeValue(objs[j], "notBefore");
                var endTime = getNodeValue(objs[j], "notAfter");
                list.push(new InstanceStatusEvent("Event", instanceId, availabilityZone, "", code, description, startTime, endTime));
            }

            var instance = this.core.findModel('instances', instanceId);
            if (instance) instance.events = list;
        }
        response.result = list;
    },

    terminateInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (parseInt(i) + 1), instances[i].id ]);
        }
        this.queryEC2("TerminateInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    stopInstances : function(instances, force, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        if (force == true) {
            params.push([ "Force", "true" ]);
        }
        this.queryEC2("StopInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    startInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        this.queryEC2("StartInstances", params, this, false, "onCompleteRunInstances", callback);
    },

    monitorInstances: function(instances, callback)
    {
        var params = [];
        for ( var i in instances) {
            params.push( [ "InstanceId." + (i + 1), instances[i].id ]);
        }
        this.queryEC2("MonitorInstances", params, this, false, "onComplete", callback);
    },

    unmonitorInstances: function(instances, callback)
    {
        var params = [];
        for ( var i in instances) {
            params.push( [ "InstanceId." + (i + 1), instances[i].id ]);
        }
        this.queryEC2("UnmonitorInstances", params, this, false, "onComplete", callback);
    },

    bundleInstance : function(instanceId, bucket, prefix, activeCred, callback)
    {
        // Generate the S3 policy string using the bucket and prefix
        var validHours = 24;
        var expiry = new Date();
        expiry.setTime(expiry.getTime() + validHours * 60 * 60 * 1000);
        var s3policy = '{' + '"expiration": "' + expiry.toISOString(5) + '",' + '"conditions": [' + '{"bucket": "' + bucket + '"},' + '{"acl": "ec2-bundle-read"},' + '["starts-with", "$key", "' + prefix + '"]' + ']}';
        var s3polb64 = Base64.encode(s3policy);
        // Sign the generated policy with the secret key
        var policySig = b64_hmac_sha1(activeCred.secretKey, s3polb64);

        var params = []
        params.push([ "InstanceId", instanceId ]);
        params.push([ "Storage.S3.Bucket", bucket ]);
        params.push([ "Storage.S3.Prefix", prefix ]);
        params.push([ "Storage.S3.AWSAccessKeyId", activeCred.accessKey ]);
        params.push([ "Storage.S3.UploadPolicy", s3polb64 ]);
        params.push([ "Storage.S3.UploadPolicySignature", policySig ]);

        this.queryEC2("BundleInstance", params, this, false, "onCompleteBundleInstance", callback);
    },

    onCompleteBundleInstance : function(response)
    {
        var xmlDoc = response.responseXML;

        var item = xmlDoc.getElementsByTagName("bundleInstanceTask")[0];
        if (!item) return;
        response.result = this.unpackBundleTask(item);
    },

    cancelBundleTask : function(id, callback)
    {
        var params = []
        params.push([ "BundleId", id ]);

        this.queryEC2("CancelBundleTask", params, this, false, "onComplete", callback);
    },

    unpackBundleTask : function(item)
    {
        var obj = new Element();
        obj.toString = function() { return this.id };
        obj.instanceId = getNodeValue(item, "instanceId");
        obj.id = getNodeValue(item, "bundleId");
        obj.state = getNodeValue(item, "state");
        obj.startTime = new Date(getNodeValue(item, "startTime"));
        obj.updateTime = new Date(getNodeValue(item, "updateTime"));
        var storage = item.getElementsByTagName("storage")[0];
        obj.s3bucket = getNodeValue(storage, "bucket");
        obj.s3prefix = getNodeValue(storage, "prefix");
        var error = item.getElementsByTagName("error")[0];
        obj.errorMsg = "";
        if (error) {
            obj.errorMsg = getNodeValue(error, "message");
        }
        var progress = getNodeValue(item, "progress");
        if (progress.length > 0) {
            obj.state += " " + progress;
        }
        return obj;
    },

    describeBundleTasks : function(callback)
    {
        this.queryEC2("DescribeBundleTasks", [], this, false, "onCompleteDescribeBundleTasks", callback);
    },

    onCompleteDescribeBundleTasks : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "bundleInstanceTasksSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            list.push(this.unpackBundleTask(item));
        }

        this.core.setModel('bundleTasks', list);
        response.result = list;
    },

    createS3Bucket : function(bucket, region, params, callback)
    {
        var content = (region) ? "<CreateBucketConstraint><LocationConstraint>" + region + "</LocationConstraint></CreateBucketConstraint>" : "";
        this.queryS3("PUT", bucket, "", "", params, content, this, false, "onComplete", callback);
    },

    listS3Buckets : function(callback)
    {
        var content = "";
        this.queryS3("GET", "", "", "", {}, content, this, false, "onCompleteListS3Buckets", callback);
    },

    onCompleteListS3Buckets : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var owner = getNodeValue(xmlDoc, "Owner", "ID")
        var ownerName = getNodeValue(xmlDoc, "Owner", "DisplayName")
        var items = xmlDoc.getElementsByTagName("Bucket");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "Name");
            var date = new Date(getNodeValue(items[i], "CreationDate"));
            list.push(new S3Bucket(name, date, owner, ownerName));
        }
        this.core.setModel('s3Buckets', list);

        response.result = list;
    },

    getS3BucketPolicy : function(bucket, callback)
    {
        var content = "";
        return this.queryS3("GET", bucket, "", "?policy", {}, content, this, callback ? false : true, "onCompleteGetS3BucketPoilicy", callback);
    },

    onCompleteGetS3BucketPoilicy : function(response)
    {
        if (response.hasErrors) {
            if (response.errCode == "NoSuchBucketPolicy") {
                response.hasErrors = false;
            }
        } else {
            response.result = formatJSON(response.responseText);
        }
        return response.result;
    },

    setS3BucketPolicy : function(bucket, policy, callback)
    {
        var params = {}
        params["Content-Type"] = "application/xml; charset=UTF-8";
        this.queryS3("PUT", bucket, "", "?policy", params, policy, this, false, "onComplete", callback);
    },

    getS3BucketCORS : function(bucket, callback)
    {
        var content = "";
        return this.queryS3("GET", bucket, "", "?cors", {}, content, this, callback ? false : true, "onCompleteGetS3BucketCORS", callback);
    },

    onCompleteGetS3BucketCORS : function(response)
    {
        if (response.hasErrors) {
            if (response.errCode == "NoSuchCORSConfiguration") {
                response.hasErrors = false;
            }
        } else {
            response.result = response.responseText;
        }
        return response.result;
    },

    setS3BucketCORS : function(bucket, policy, callback)
    {
        var params = {}
        params["Content-Type"] = "application/xml; charset=UTF-8";
        params['Content-MD5'] = b64_md5(policy);
        this.queryS3("PUT", bucket, "", "?cors", params, policy, this, false, "onComplete", callback);
    },

    deleteS3BucketCORS : function(bucket, callback)
    {
        var content = "";
        this.queryS3("DELETE", bucket, "", "?cors", {}, content, this, false, "onComplete", callback);
    },

    getS3BucketAcl : function(bucket, callback)
    {
        var content = "";
        this.queryS3("GET", bucket, "", "?acl", {}, content, this, false, "onCompleteGetS3BucketAcl", callback);
    },

    onCompleteGetS3BucketAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("Grant");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "ID");
            var type = items[i].getElementsByTagName("Grantee")[0].getAttribute("xsi:type");
            var uri = getNodeValue(items[i], "URI");
            var email = getNodeValue(items[i], "EmailAddress");
            var name = getNodeValue(items[i], "DisplayName");
            var permission = getNodeValue(items[i], "Permission");
            switch (type) {
            case "CanonicalUser":
                break;

            case "AmazonCustomerByEmail":
                id = email
                name = email
                break;

            case "Group":
                id = uri
                name = uri.split("/").pop()
                break;
            }
            list.push(new S3BucketAcl(id, type, name, permission));
        }
        var obj = this.core.getS3Bucket(bucket)
        if (obj) obj.acls = list; else obj = { acls: list };

        response.result = list;
    },

    setS3BucketAcl : function(bucket, content, callback)
    {
        var params = {}
        params["Content-Type"] = "application/xml; charset=UTF-8";
        this.queryS3("PUT", bucket, "", "?acl", params, content, this, false, "onCompleteSetS3BucketAcl", callback);
    },

    onCompleteSetS3BucketAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;
        var obj = this.core.getS3Bucket(bucket);
        if (obj) obj.acls = null;

        response.result = obj;
    },

    // Without callback it uses sync mode and returns region
    getS3BucketLocation : function(bucket, callback)
    {
        return this.queryS3("GET", bucket, "", "?location", {}, null, this, callback ? false : true, "onCompleteGetS3BucketLocation", callback);
    },

    onCompleteGetS3BucketLocation : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;

        var region = getNodeValue(xmlDoc, "LocationConstraint");
        var obj = this.core.getS3Bucket(bucket)
        if (obj) obj.region = region;
        response.result = region;
        return response.result;
    },

    // Return list in sync mode
    listS3BucketKeys : function(bucket, path, params, callback)
    {
        this.queryS3("GET", bucket, "", path || "", params, null, this, callback ? false : true, "onCompleteListS3BucketKeys", callback);
    },

    onCompleteListS3BucketKeys : function(response)
    {
        var me = this;
        var xmlDoc = response.responseXML;

        var list = new Array();
        var bucket = getNodeValue(xmlDoc, "Name");
        var trunc = getNodeValue(xmlDoc, "IsTruncated");
        var items = xmlDoc.getElementsByTagName("Contents");
        for (var i = 0; i < items.length; i++) {
            var key = new Element('bucket', bucket);
            key.toString = function() { return this.bucket + "/" + this.name; }
            key.name = getNodeValue(items[i], "Key");
            key.size = getNodeValue(items[i], "Size");
            key.type = getNodeValue(items[i], "StorageClass");
            key.etag = getNodeValue(items[i], "ETag");
            key.mtime = new Date(getNodeValue(items[i], "LastModified"));
            key.owner = getNodeValue(items[i], "ID")
            list.push(key);
        }
        var obj = this.core.getS3Bucket(bucket);
        if (obj) {
            obj.keys = obj.keys.concat(list);
            this.core.notifyComponents('s3buckets');
        } else {
            obj = new S3Bucket(bucket);
            obj.keys = list;
            this.core.appendModel('s3buckets', [ obj ]);
        }
        // Continue to retrieve records in the background
        if (trunc == "true") {
            var path = "?marker=" + encodeURIComponent(list[list.length - 1].name);
            // In sync mode keep spinning until we collect evrything
            if (response.isSync) {
                response.skipCallback = true;
                return this.queryS3("GET", bucket, "", path, response.params.params, null, this, true, "onCompleteListS3BucketKeys", response.callback);
            }

            // Schedule another request
            setTimeout(function() {
                me.queryS3("GET", bucket, "", path, response.params.params, null, me, false, "onCompleteListS3BucketKeys", response.callback);
            }, 100);
        }
        response.result = obj;
        return response.result;
    },

    deleteS3Bucket : function(bucket, params, callback)
    {
        this.queryS3("DELETE", bucket, "", "", params, null, this, callback ? false : true, "onComplete", callback);
    },

    createS3BucketKey : function(bucket, key, params, data, callback)
    {
        this.queryS3("PUT", bucket, key, "", params, data, this, callback ? false : true, "onComplete", callback);
    },

    deleteS3BucketKey : function(bucket, key, params, callback)
    {
        this.queryS3("DELETE", bucket, key, "", params, null, this, callback ? false : true, "onComplete", callback);
    },

    getS3BucketKey : function(bucket, key, path, params, file, callback, progresscb)
    {
        this.downloadS3("GET", bucket, key, path, params, file, callback, progresscb);
    },

    readS3BucketKey : function(bucket, key, path, params, callback)
    {
        this.queryS3("GET", bucket, key, path, {}, null, this, callback ? false : true, "onCompleteReadS3BucketKey", callback);
    },

    onCompleteReadS3BucketKey : function(response)
    {
        response.result = response.responseText;
        return response.result;
    },

    putS3BucketKey : function(bucket, key, path, params, text, callback)
    {
        if (!params["Content-Type"]) params["Content-Type"] = this.core.getMimeType(key);
        this.queryS3("PUT", bucket, key, path, params, text, this, false, "onComplete", callback);
    },

    initS3BucketKeyUpload : function(bucket, key, params, callback)
    {
        this.queryS3("POST", bucket, key, "?uploads", params, null, this, false, "onCompleteInitS3BucketKeyUpload", callback);
    },

    onCompleteInitS3BucketKeyUpload : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "UploadId");
    },

    uploadS3BucketFile : function(bucket, key, path, params, file, callback, progresscb)
    {
        if (!params["Content-Type"]) params["Content-Type"] = this.core.getMimeType(key);
        this.uploadS3(bucket, key, path, params, file, callback, progresscb);
    },

    getS3BucketKeyAcl : function(bucket, key, callback)
    {
        this.queryS3("GET", bucket, key, "?acl", {}, null, this, callback ? false : true, "onCompleteGetS3BucketKeyAcl", callback);
    },

    onCompleteGetS3BucketKeyAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;
        var key = response.params.key;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("Grant");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "ID");
            var type = items[i].getElementsByTagName("Grantee")[0].getAttribute("xsi:type");
            var uri = getNodeValue(items[i], "URI");
            var email = getNodeValue(items[i], "EmailAddress");
            var name = getNodeValue(items[i], "DisplayName");
            var perms = getNodeValue(items[i], "Permission");
            switch (type) {
            case "CanonicalUser":
                break;

            case "AmazonCustomerByEmail":
                id = email
                name = email
                break;

            case "Group":
                id = uri
                name = uri.split("/").pop()
                break;
            }
            list.push(new S3BucketAcl(id, type, name, perms));
        }
        var obj = this.core.getS3BucketKey(bucket, key)
        if (obj) obj.acls = list;

        response.result = obj;
        return response.result;
    },

    setS3BucketKeyAcl : function(bucket, key, content, callback)
    {
        var params = {}
        params["Content-Type"] = "application/xml; charset=UTF-8";
        this.queryS3("PUT", bucket, key, "?acl", params, content, this, callback ? false : true, "onCompleteSetS3BucketKeyAcl", callback);
    },

    onCompleteSetS3BucketKeyAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;
        var key = response.params.key;

        var obj = this.core.getS3BucketKey(bucket, key)
        if (obj) obj.acls = null;

        response.result = obj;
        return response.result;
    },

    getS3BucketWebsite : function(bucket, callback)
    {
        this.queryS3("GET", bucket, "", "?website", {}, null, this, callback ? false : true, "onCompleteGetS3BucketWebsite", callback);
    },

    onCompleteGetS3BucketWebsite : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params.bucket;
        var obj = this.core.getS3Bucket(bucket);
        if (!obj) obj = {};

        if (response.hasErrors) {
            // Ignore no website error
            if (response.errCode == "NoSuchWebsiteConfiguration") {
                response.hasErrors = false;
            }
        } else {
            var doc = xmlDoc.getElementsByTagName("IndexDocument");
            obj.indexSuffix = getNodeValue(doc[0], "Suffix");
            var doc = xmlDoc.getElementsByTagName("ErrorDocument");
            obj.errorKey = getNodeValue(doc[0], "Key");
        }
        response.result = obj;
        return response.result;
    },

    setS3BucketWebsite : function(bucket, index, error, callback)
    {
        var content = '<WebsiteConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
        if (index) {
            content += '<IndexDocument><Suffix>' + index + '</Suffix></IndexDocument>';
        }
        if (error) {
            content += '<ErrorDocument><Key>' + error + '</Key></ErrorDocument>';
        }
        content += '</WebsiteConfiguration>';
        this.queryS3("PUT", bucket, "", "?website", {}, content, this, false, "onComplete", callback);
    },

    deleteS3BucketWebsite : function(bucket, callback)
    {
        var content = "";
        this.queryS3("DELETE", bucket, "", "?website", {}, content, this, false, "onComplete", callback);
    },

    describeKeypairs : function(callback)
    {
        this.queryEC2("DescribeKeyPairs", [], this, false, "onCompleteDescribeKeypairs", callback);
    },

    onCompleteDescribeKeypairs : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var key = new Element();
            key.toString = function() { return this.name; }
            key.name = getNodeValue(items[i], "keyName");
            key.fingerprint = getNodeValue(items[i], "keyFingerprint");
            list.push(key);
        }

        this.core.setModel('keypairs', list);
        response.result = list;
    },

    createKeypair : function(name, callback)
    {
        this.queryEC2("CreateKeyPair", [ [ "KeyName", name ] ], this, false, "onCompleteCreateKeyPair", callback);
    },

    onCompleteCreateKeyPair : function(response)
    {
        var xmlDoc = response.responseXML;

        var key = new Element();
        key.toString = function() { return this.name; }
        key.name = getNodeValue(xmlDoc, "keyName");
        key.fingerprint = getNodeValue(xmlDoc, "keyFingerprint");
        key.material = getNodeValue(xmlDoc, "keyMaterial");

        response.result = key;
    },

    deleteKeypair : function(name, callback)
    {
        this.queryEC2("DeleteKeyPair", [ [ "KeyName", name ] ], this, false, "onComplete", callback);
    },

    describeRouteTables : function(callback)
    {
        this.queryEC2("DescribeRouteTables", [], this, false, "onCompleteDescribeRouteTables", callback);
    },

    onCompleteDescribeRouteTables : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "routeTableSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var table = new Element();
            table.toString = function() {
                var str = (this.name ? this.name + fieldSeparator : "") + this.id + fieldSeparator + ew_core.modelValue("vpcId", this.vpcId);
                if (this.routes && this.routes.length > 0) {
                    str += " ("
                    for (var i in this.routes) {
                        str += (i > 0 ? ", " : "") + this.routes[i].cidr + "/" + this.routes[i].gatewayId;
                    }
                    str += ")"
                }
                return str;
            }

            table.id = getNodeValue(item, "routeTableId");
            table.vpcId = getNodeValue(item, "vpcId");
            table.main = getNodeValue(item, "main");
            table.routes = [];
            var routes = this.getItems(item, "routeSet", "item");
            for ( var j = 0; j < routes.length; j++) {
                var route = new Element();
                route.toString = function() {
                    return this.cidr + fieldSeparator + ew_core.modelValue("gatewayId", this.gatewayId);
                }
                route.tableId = table.id;
                route.cidr = getNodeValue(routes[j], "destinationCidrBlock");
                route.gatewayId = getNodeValue(routes[j], "gatewayId");
                route.instanceId = getNodeValue(routes[j], "instanceId");
                route.instanceOwnerId = getNodeValue(routes[j], "instanceOwnerId");
                route.eniId = getNodeValue(routes[j], "networkInterfaceId");
                route.state = getNodeValue(routes[j], "state");
                route.origin = getNodeValue(routes[j], "origin");
                table.routes.push(route);
            }
            table.associations = this.getItems(item, "associationSet", "item", [], function(obj) { return new Element('id', obj.routeTableAssociationId, 'tableId', obj.routeTableId, 'subnetId', obj.subnetId) } );
            table.propagations = this.getItems(item, "propagatingVgwSet", "item", []);
            table.tags = this.getTags(item);
            ew_core.processTags(table);
            list.push(table);
        }
        this.core.setModel('routeTables', list);
        response.result = list;
    },

    createRouteTable : function(vpcId, callback)
    {
        this.queryEC2("CreateRouteTable", [["VpcId", vpcId]], this, false, "onComplete:routeTableId", callback);
    },

    deleteRouteTable : function(tableId, callback)
    {
        this.queryEC2("DeleteRouteTable", [["RouteTableId", tableId]], this, false, "onComplete", callback);
    },

    createRoute : function(tableId, cidr, gatewayId, instanceId, networkInterfaceId, callback)
    {
        var params = [];
        params.push(["RouteTableId", tableId]);
        params.push(["DestinationCidrBlock", cidr]);
        if (gatewayId) {
            params.push(["GatewayId", gatewayId]);
        }
        if (instanceId) {
            params.push(["InstanceId", instanceId]);
        }
        if (networkInterfaceId) {
            params.push(["NetworkInterfaceId", networkInterfaceId]);
        }
        this.queryEC2("CreateRoute", params, this, false, "onComplete", callback);
    },

    deleteRoute : function(tableId, cidr, callback)
    {
        this.queryEC2("DeleteRoute", [["RouteTableId", tableId], ["DestinationCidrBlock", cidr]], this, false, "onComplete", callback);
    },

    associateRouteTable : function(tableId, subnetId, callback)
    {
        this.queryEC2("AssociateRouteTable", [["RouteTableId", tableId], ["SubnetId", subnetId]], this, false, "onComplete:associationId", callback);
    },

    disassociateRouteTable : function(assocId, callback)
    {
        this.queryEC2("DisassociateRouteTable", [["AssociationId", assocId]], this, false, "onComplete", callback);
    },

    createPlacementGroup : function(name, strategy, callback)
    {
        var params = [["GroupName", name]];
        params.push( ["Strategy", strategy ])
        this.queryEC2("CreatePlacementGroup", params, this, false, "onComplete", callback);
    },

    deletePlacementGroup : function(name, callback)
    {
        var params = [["GroupName", name]];
        this.queryEC2("DeletePlacementGroup", params, this, false, "onComplete", callback);
    },

    describePlacementGroups : function(callback)
    {
        //NOT implemented in Euca
        //this.queryEC2("DescribePlacementGroups", [], this, false, "onCompleteDescribePlacementGroups", callback);
    },

    onCompleteDescribePlacementGroups : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "placementGroupSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.strategy + fieldSeparator + this.state;
            }

            obj.name = getNodeValue(item, "groupName");
            obj.strategy = getNodeValue(item, "strategy");
            obj.state = getNodeValue(item, "state");
            list.push(obj)
        }
        this.core.setModel('placementGroups', list);
        response.result = list;
    },

    createNetworkInterface : function(subnetId, ip, descr, groups, callback)
    {
        var params = [["SubnetId", subnetId]];
        if (ip) {
            params.push( ["PrivateIpAddress", ip ])
        }
        if (descr) {
            params.push([ "Description", descr])
        }
        if (groups) {
            for (var i = 0; i < groups.length; i++) {
                params.push(["SecurityGroupId."+(i+1), typeof groups[i] == "object" ? groups[i].id : groups[i]]);
            }
        }
        this.queryEC2("CreateNetworkInterface", params, this, false, "onComplete:networkInterfaceId", callback);
    },

    deleteNetworkInterface : function(id, callback)
    {
        this.queryEC2("DeleteNetworkInterface", [["NetworkInterfaceId", id]], this, false, "onComplete", callback);
    },

    modifyNetworkInterfaceAttribute : function (id, name, value, callback)
    {
        this.queryEC2("ModifyNetworkInterfaceAttribute", [ ["NetworkInterfaceId", id], [name + ".Value", value] ], this, false, "onComplete", callback);
    },

    modifyNetworkInterfaceAttributes : function (id, attributes, callback)
    {
        var params = [ ["NetworkInterfaceId", id] ];
        for (var i in attributes) {
            params.push(attributes[i]);
        }

        this.queryEC2("ModifyNetworkInterfaceAttribute", params, this, false, "onComplete", callback);
    },

    attachNetworkInterface : function (id, instanceId, deviceIndex, callback)
    {
        this.queryEC2("AttachNetworkInterface", [["NetworkInterfaceId", id], ["InstanceId", instanceId], ["DeviceIndex", deviceIndex]], this, false, "onComplete", callback);
    },

    detachNetworkInterface : function (attachmentId, force, callback)
    {
        var params = [ ['AttachmentId', attachmentId] ];

        if (force) {
            params.push(['Force', force]);
        }

        this.queryEC2("DetachNetworkInterface", params, this, false, "onComplete", callback);
    },

    describeNetworkInterfaces : function(callback)
    {
        //Not implemented in Euca
        //this.queryEC2("DescribeNetworkInterfaces", [], this, false, "onCompleteDescribeNetworkInterfaces", callback);
    },

    onCompleteDescribeNetworkInterfaces : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "networkInterfaceSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var intf = new Element('className', 'ENI');
            intf.toString = function() {
                return this.privateIpAddress + fieldSeparator + this.status + fieldSeparator + this.id + fieldSeparator +  this.descr +
                       " (" + ew_core.modelValue("subnetId", this.subnetId) + ")";
            }
            intf.id = getNodeValue(item, "networkInterfaceId");
            intf.subnetId = getNodeValue(item, "subnetId");
            intf.vpcId = getNodeValue(item, "vpcId");
            intf.descr = getNodeValue(item, "description");
            intf.status = getNodeValue(item, "status");
            intf.macAddress = getNodeValue(item, "macAddress");
            intf.privateIpAddress = getNodeValue(item, "privateIpAddress");
            intf.sourceDestCheck = toBool(getNodeValue(item, "sourceDestCheck"));
            intf.availabilityZone = getNodeValue(item, "availabilityZone");
            intf.attachment = null;
            intf.association = null;

            var aitem = item.getElementsByTagName("attachment")[0];
            if (aitem) {
                intf.attachment = new Element();
                intf.attachment.toString = function() {
                    return this.deviceIndex + fieldSeparator + this.status + fieldSeparator + this.id + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
                           (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
                }
                intf.attachment.id = getNodeValue(aitem, "attachmentId");
                intf.attachment.instanceId = getNodeValue(aitem, "instanceId");
                intf.attachment.instanceOwnerId = getNodeValue(aitem, "instanceOwnerId");
                intf.attachment.deviceIndex = getNodeValue(aitem, "deviceIndex");
                intf.attachment.status = getNodeValue(aitem, "status");
                intf.attachmentattachTime = getNodeValue(aitem, "attachTime");
                intf.attachment.deleteOnTermination = getNodeValue(aitem, "deleteOnTermination");
            }

            aitem = item.getElementsByTagName("association")[0];
            if (aitem) {
                intf.association = new Element();
                intf.association.toString = function() {
                    return this.publicIp + fieldSeparator + this.id + (this.instanceId ? " (" + ew_core.modelValue("instanceId", this.instanceId) + ")" : "");
                }
                intf.association.id = getNodeValue(aitem, "associationId");
                intf.association.publicIp = getNodeValue(aitem, "publicIp");
                intf.association.ipOwnerId = getNodeValue(aitem, "ipOwnerId");
                intf.association.instanceId = getNodeValue(aitem, "instanceID");
                intf.association.attachmentId = getNodeValue(aitem, "attachmentID");
            }
            intf.privateIpAddresses = [];
            var objs = this.getItems(item, "privateIpAddressesSet", "item");
            for (var j = 0; j < objs.length; j++) {
                var ip = new Element();
                ip.toString = function() {
                    return this.privateIp + (this.publicIp ? "/" + this.publicIp : "") + fieldSeparator + (this.primary ? "Primary" : "Secondary")
                }
                ip.privateIp = getNodeValue(objs[j], "privateIpAddress");
                ip.primary = toBool(getNodeValue(objs[j], "primary"));
                ip.publicIp = getNodeValue(objs[j], "association", "publicIp");
                ip.associationId = getNodeValue(objs[j], "association", "associationId");
                intf.privateIpAddresses.push(ip)
            }
            intf.groups = this.getGroups(item);
            intf.tags = this.getTags(item);
            ew_core.processTags(intf, "descr")
            list.push(intf);
        }

        this.core.setModel('networkInterfaces', list);
        response.result = list;
    },

    assignPrivateIpAddresses : function(networkInterfaceId, privateIpList, privateIpCount, reassign, callback)
    {
        var params = [];
        params.push([ 'NetworkInterfaceId', networkInterfaceId ])

        if (privateIpList && privateIpList.length) {
            for (var i = 0 ; i < privateIpList.length; i++) {
                params.push([ 'PrivateIpAddress.' + i,  typeof privateIpList[i] == "object" ? privateIpList[i].privateIp : privateIpList[i] ])
            }
        } else
        if (privateIpCount) {
            params.push([ 'SecondaryPrivateIpAddressCount', privateIpCount ])
        }
        if (reassign) {
            params.push([ 'AllowReassignment', "true" ])
        }
        this.queryEC2("AssignPrivateIpAddresses", params, this, false, "onComplete", callback);
    },

    unassignPrivateIpAddresses : function(networkInterfaceId, privateIpList, callback)
    {
        var params = [];
        params.push([ 'NetworkInterfaceId', networkInterfaceId ])

        for (var i = 0 ; i < privateIpList.length; i++) {
            params.push([ 'PrivateIpAddress.' + i,  typeof privateIpList[i] == "object" ? privateIpList[i].privateIp : privateIpList[i] ])
        }
        this.queryEC2("UnassignPrivateIpAddresses", params, this, false, "onComplete", callback);
    },

    describeSecurityGroups : function(callback)
    {
        this.queryEC2("DescribeSecurityGroups", [], this, false, "onCompleteDescribeSecurityGroups", callback);
    },

    parsePermissions: function(type, list, items)
    {
        function Permission(type, protocol, fromPort, toPort, srcGroup, cidrIp)
        {
            this.type = type
            this.protocol = protocol;
            this.fromPort = fromPort;
            this.toPort = toPort;
            this.srcGroup = srcGroup;
            if (srcGroup) {
                this.srcGroup.toString = function() { return ew_core.modelValue('groupId', srcGroup.id); }
            }
            this.cidrIp = cidrIp;
            this.toString = function() {
                return this.type + fieldSeparator + this.protocol + fieldSeparator + this.fromPort + ":" + this.toPort + fieldSeparator + (this.cidrIp ? this.cidrIp : this.srcGroup ? this.srcGroup.toString() : "");
            }
        }

        if (items) {
            for ( var j = 0; j < items.length; j++) {
                if (items.item(j).nodeName == '#text') continue;
                var ipProtocol = getNodeValue(items.item(j), "ipProtocol");
                var fromPort = getNodeValue(items.item(j), "fromPort");
                var toPort = getNodeValue(items.item(j), "toPort");
                log("Group ipp [" + ipProtocol + ":" + fromPort + "-" + toPort + "]");

                var groups = items[j].getElementsByTagName("groups")[0];
                if (groups) {
                    var groupsItems = groups.childNodes;
                    for ( var k = 0; k < groupsItems.length; k++) {
                        if (groupsItems.item(k).nodeName == '#text') continue;
                        var srcGrp = { ownerId : getNodeValue(groupsItems[k], "userId"), id : getNodeValue(groupsItems[k], "groupId"), name : getNodeValue(groupsItems[k], "groupName") }
                        list.push(new Permission(type, ipProtocol, fromPort, toPort, srcGrp));
                    }
                }
                var ipRanges = items[j].getElementsByTagName("ipRanges")[0];
                if (ipRanges) {
                    var ipRangesItems = ipRanges.childNodes;
                    for ( var k = 0; k < ipRangesItems.length; k++) {
                        if (ipRangesItems.item(k).nodeName == '#text') continue;
                        var cidrIp = getNodeValue(ipRangesItems[k], "cidrIp");
                        list.push(new Permission(type, ipProtocol, fromPort, toPort, null, cidrIp));
                    }
                }
            }
        }
        return list
    },

    onCompleteDescribeSecurityGroups : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "securityGroupInfo", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.id + (this.vpcId ? " (" + ew_core.modelValue("vpcId", this.vpcId) + ")" : "");
            }
            obj.id = getNodeValue(item, "groupId");
            obj.ownerId = getNodeValue(item, "ownerId");
            obj.name = getNodeValue(item, "groupName");
            obj.description = getNodeValue(item, "groupDescription");
            obj.vpcId = getNodeValue(item, "vpcId");
            var ipPermissions = item.getElementsByTagName("ipPermissions")[0];
            var ipPermissionsList = this.parsePermissions('Ingress', [], ipPermissions.childNodes);
	    ipPermissions = item.getElementsByTagName("ipPermissionsEgress")[0];
            // Comment out egress rules for Eucalyptus
	    //obj.permissions = this.parsePermissions('Egress', ipPermissionsList, ipPermissions.childNodes);
            obj.tags = this.getTags(item);
            ew_core.processTags(obj)
            list.push(obj);
        }

        this.core.setModel('securityGroups', list);
        response.result = list;
    },

    createSecurityGroup : function(name, desc, vpcId, callback)
    {
        var params = [];
        params.push([ "GroupName", name ]);
        params.push([ "GroupDescription", desc ]);
        if (vpcId && vpcId != "") {
            params.push([ "VpcId", vpcId ])
        }
        this.queryEC2("CreateSecurityGroup", params, this, false, "onComplete:groupId", callback, null);
    },

    deleteSecurityGroup : function(group, callback)
    {
	debug("Delete Group: " + group.name)
        var params = [ [ "GroupName", group.name ] ];
        this.queryEC2("DeleteSecurityGroup", params, this, false, "onComplete", callback);
    },

    authorizeSourceCIDR : function(type, group, ipProtocol, fromPort, toPort, cidrIp, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        params.push([ "IpPermissions.1.IpRanges.1.CidrIp", cidrIp ]);
        this.queryEC2("AuthorizeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    revokeSourceCIDR : function(type, group, ipProtocol, fromPort, toPort, cidrIp, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        params.push([ "IpPermissions.1.IpRanges.1.CidrIp", cidrIp ]);
        this.queryEC2("RevokeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    authorizeSourceGroup : function(type, group, ipProtocol, fromPort, toPort, srcGroup, callback)
    {
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        if (group.vpcId && group.vpcId != "") {
            params.push([ "IpPermissions.1.Groups.1.GroupId", srcGroup.id ]);
        } else {
            params.push([ "IpPermissions.1.Groups.1.GroupName", srcGroup.name ]);
            params.push([ "IpPermissions.1.Groups.1.UserId", srcGroup.ownerId ]);
        }
        this.queryEC2("AuthorizeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    revokeSourceGroup : function(type, group, ipProtocol, fromPort, toPort, srcGroup, callback)
    {
        var params = group.id && group.id != "" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group.name ] ]
        params.push([ "IpPermissions.1.IpProtocol", ipProtocol ]);
        params.push([ "IpPermissions.1.FromPort", fromPort ]);
        params.push([ "IpPermissions.1.ToPort", toPort ]);
        if (group.vpcId && group.vpcId != "") {
            params.push([ "IpPermissions.1.Groups.1.GroupId", srcGroup.id ]);
        } else {
            params.push([ "IpPermissions.1.Groups.1.GroupName", srcGroup.name ]);
            params.push([ "IpPermissions.1.Groups.1.UserId", srcGroup.ownerId ]);
        }
        this.queryEC2("RevokeSecurityGroup" + type, params, this, false, "onComplete", callback);
    },

    rebootInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
        }
        this.queryEC2("RebootInstances", params, this, false, "onComplete", callback);
    },

    // Without callback the request will be sync and the result will be cnsole output
    getConsoleOutput : function(instanceId, callback)
    {
        return this.queryEC2("GetConsoleOutput", [ [ "InstanceId", instanceId ] ], this, callback ? false : true, "onCompleteGetConsoleOutput", callback);
    },

    onCompleteGetConsoleOutput : function(response)
    {
        var xmlDoc = response.responseXML;
        var instanceId = getNodeValue(xmlDoc, "instanceId");
        var timestamp = getNodeValue(xmlDoc, "timestamp");
        var output = xmlDoc.getElementsByTagName("output")[0];
        if (output && output.textContent) {
            output = Base64.decode(output.textContent);
            output = output.replace(/\x1b/mg, "\n").replace(/\r/mg, "").replace(/\n+/mg, "\n");
        } else {
            output = '';
        }
        response.result = output;
        return response.result;
    },

    describeAvailabilityZones : function(callback)
    {
        this.queryEC2("DescribeAvailabilityZones", [], this, false, "onCompleteDescribeAvailabilityZones", callback);
    },

    onCompleteDescribeAvailabilityZones : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "availabilityZoneInfo", "item");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() { return this.name + fieldSeparator + this.state; }
            obj.name = obj.id = getNodeValue(items[i], "zoneName");
            obj.state = getNodeValue(items[i], "zoneState");
            obj.message = this.getItems(items[i], "messageSet", "item", ["message"], function(obj) { return obj.message; });
            list.push(obj);
        }

        this.core.setModel('availabilityZones', list);
        response.result = list;
    },

    describeAddresses : function(callback)
    {
        this.queryEC2("DescribeAddresses", [], this, false, "onCompleteDescribeAddresses", callback);
    },

    onCompleteDescribeAddresses : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("item");
        for ( var i = 0; i < items.length; i++) {
            var eni = new Element();
            eni.publicIp = getNodeValue(items[i], "publicIp");
            eni.instanceId = getNodeValue(items[i], "instanceId");
            eni.allocationId = getNodeValue(items[i], "allocationId");
            eni.associationId = getNodeValue(items[i], "associationId");
            eni.networkInterfaceId = getNodeValue(items[i], "networkInterfaceId");
            eni.domain = getNodeValue(items[i], "domain");
            eni.tags = this.getTags(items[i]);
            this.core.processTags(eni);
            list.push(eni);
        }
        this.core.setModel('addresses', list);
        response.result = list;
    },

    allocateAddress : function(vpc, callback)
    {
        var params = vpc ? [["Domain", "vpc"]] : []
        this.queryEC2("AllocateAddress", params, this, false, "onComplete:allocationId", callback);
    },

    releaseAddress : function(eip, callback)
    {
        var params = eip.allocationId ? [["AllocationId", eip.allocationId]] : [[ 'PublicIp', eip.publicIp ]]
        this.queryEC2("ReleaseAddress", params, this, false, "onComplete", callback);
    },

    associateAddress : function(eip, instanceId, networkInterfaceId, privateIp, force, callback)
    {
        var params = eip.allocationId ? [["AllocationId", eip.allocationId]] : [[ 'PublicIp', eip.publicIp ]]
        if (instanceId) {
            params.push([ 'InstanceId', instanceId ])
        }
        if (networkInterfaceId) {
            params.push([ 'NetworkInterfaceId', networkInterfaceId ])
        }
        if (privateIp) {
            params.push(["PrivateIpAddress", privateIp]);
        }
        if (force){
            params.push(["AllowReassociation", true]);
        }
        this.queryEC2("AssociateAddress", params, this, false, "onComplete:associationId", callback);
    },

    disassociateAddress : function(eip, callback)
    {
        var params = eip.associationId ? [["AssociationId", eip.associationId]] : [[ 'PublicIp', eip.publicIp ]]
        this.queryEC2("DisassociateAddress", params, this, false, "onComplete", callback);
    },

    describeRegions : function(callback)
    {
        this.queryEC2("DescribeRegions", [], this, false, "onCompleteDescribeRegions", callback);
    },

    onCompleteDescribeRegions : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "regionInfo", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var name = getNodeValue(item, "regionName");
            var url = getNodeValue(item, "regionEndpoint");
            if (url.indexOf("https://") != 0) {
                url = "https://" + url;
            }
            list.push(new Endpoint(name, url));
        }

        response.result = list;
    },

    describeLoadBalancers : function(callback)
    {
        this.queryELB("DescribeLoadBalancers", [], this, false, "onCompleteDescribeLoadBalancers", callback);
    },

    onCompleteDescribeLoadBalancers : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "LoadBalancerDescriptions", "member");
        for ( var i = 0; i < items.length; i++) {
            var elb = new Element();
            elb.toString = function() {
                return this.name;
            }

            elb.name = getNodeValue(items[i], "LoadBalancerName");
            elb.CreatedTime = getNodeValue(items[i], "CreatedTime");
            elb.DNSName = getNodeValue(items[i], "DNSName");
            elb.CanonicalHostedHostName = getNodeValue(items[i], "CanonicalHostedZoneName");
            elb.CanonicalHostedZoneId = getNodeValue(items[i], "CanonicalHostedZoneNameID");
            elb.Instances = new Array();
            var InstanceId = items[i].getElementsByTagName("InstanceId");
            for ( var j = 0; j < InstanceId.length; j++) {
                elb.Instances.push(InstanceId[j].firstChild.nodeValue);
            }

            elb.Listeners = [];
            var members = this.getItems(items[i], "ListenerDescriptions", "member");
            for ( var k = 0; k < members.length; k++) {
                var lst = new Element();
                lst.toString = function() {
                    return this.Protocol + ":" + this.Port + "->" + this.InstancePort + (this.policies.length ? fieldSeparator + this.policies : "");
                }
                lst.Protocol = getNodeValue(members[k], "Protocol");
                lst.Port = getNodeValue(members[k], "LoadBalancerPort");
                lst.InstancePort = getNodeValue(members[k], "InstancePort");
                lst.InstanceProtocol = getNodeValue(members[k], "InstanceProtocol");
                lst.policies = this.getItems(members[k], "Policies", "member", null, function(obj) { return obj.firstChild.nodeValue; });
                elb.Listeners.push(lst)
            }

            elb.HealthCheck = new Element();
            elb.HealthCheck.toString = function() {
                return this.Target + fieldSeparator + this.Interval + "/" + this.Timeout + fieldSeparator + this.HealthyThreshold + "/" + this.UnhealthyThreshold;
            }
            elb.HealthCheck.Target = getNodeValue(items[i], "HealthCheck", "Target");
            elb.HealthCheck.Interval = getNodeValue(items[i], "HealthCheck", "Interval");
            elb.HealthCheck.Timeout = getNodeValue(items[i], "HealthCheck", "Timeout");
            elb.HealthCheck.HealthyThreshold = getNodeValue(items[i], "HealthCheck", "HealthyThreshold");
            elb.HealthCheck.UnhealthyThreshold = getNodeValue(items[i], "HealthCheck", "UnhealthyThreshold");

            elb.zones = this.getItems(items[i], "AvailabilityZones", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            elb.appStickinessPolicies = this.getItems(items[i], "AppCookieStickinessPolicies", "member", ["PolicyName", "CookieName"], function(obj) { return new Element('name',obj.PolicyName, 'cookieName', obj.CookieName) });
            elb.lbStickinessPolicies = this.getItems(items[i], "LBCookieStickinessPolicies", "member", ["PolicyName", "CookieExpirationPeriod"], function(obj) { return new Element('name',obj.PolicyName, 'cookieName', '', "expirationPeriod", obj.CookieExpirationPeriod) });
            elb.otherPolicies = this.getItems(items[i], "OtherPolicies", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            elb.securityGroups = this.getItems(items[i], "SecurityGroups", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            elb.subnets = this.getItems(items[i], "Subnets", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            elb.SourceSecurityGroup = getNodeValue(items[i], "SourceSecurityGroup", "GroupName");
            elb.vpcId = getNodeValue(items[i], "VPCId");
            elb.scheme = getNodeValue(items[i], "Scheme");
            list.push(elb);
        }
        this.core.setModel('loadBalancers', list);
        response.result = list;
    },

    describeInstanceHealth : function(LoadBalancerName, callback)
    {
        var params =[ [ "LoadBalancerName", LoadBalancerName ] ];

        this.queryELB("DescribeInstanceHealth", params, this, false, "onCompleteDescribeInstanceHealth", callback);
    },

    onCompleteDescribeInstanceHealth : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.Description + fieldSeparator + this.State + fieldSeparator + ew_core.modelValue("instanceId", this.InstanceId);
            }
            obj.Description = getNodeValue(items[i], "Description");
            obj.State = getNodeValue(items[i], "State");
            obj.InstanceId = getNodeValue(items[i], "InstanceId");
            obj.ReasonCode = getNodeValue(items[i], "ReasonCode");
            list.push(obj);
        }

        var elb = this.core.findModel('loadBalancers', response.params[0][1]);
        if (elb) elb.InstanceHealth = list;

        response.result = list;
    },

    DescribeLoadBalancerPolicyTypes : function(callback)
    {
        this.queryELB("DescribeLoadBalancerPolicyTypes", [], this, false, "onCompleteDescribeLoadBalancerPolicyTypes", callback);
    },

    onCompleteDescribeLoadBalancerPolicyTypes : function(response)
    {
        response.hasErrors = false;
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "PolicyTypeDescriptions", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() { return this.name; }
            obj.name = getNodeValue(items[i], "PolicyTypeName");
            obj.descr = getNodeValue(items[i], "Description");
            obj.attributes = [];
            var attrs = this.getItems(xmlDoc, "PolicyAttributeTypeDescriptions", "member");
            for (var j = 0; j < attrs.length; j++) {
                var attr = new Element();
                attr.toString = function() { return this.name }
                attr.name = getNodeValue(attrs[j], "AttributeName");
                attr.type = getNodeValue(attrs[j], "AttributeType");
                attr.defaultValue = getNodeValue(attrs[j], "DefaultValue");
                attr.cardinality = getNodeValue(attrs[j], "Cardinality");
                attr.descr = getNodeValue(attrs[j], "Description");
                obj.attributes.push(attr);
            }
            list.push(obj)
        }
        this.core.setModel('elbPolicyTypes', list);
        response.result = list;
    },

    deleteLoadBalancer : function(LoadBalancerName, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);

        this.queryELB("DeleteLoadBalancer", params, this, false, "onComplete", callback);
    },

    createLoadBalancer : function(LoadBalancerName, protocol, elbport, instanceport, cert, azones, subnets, groups, scheme, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        if (azones) {
            for (var i = 0; i < azones.length; i++) {
                params.push([ "AvailabilityZones.member." + (i + 1), azones[i] ]);
            }
        }
        if (subnets) {
            for (var i = 0; i < subnets.length; i++) {
                params.push(["Subnets.member." + (i + 1), subnets[i]]);
            }
            for (var i = 0; i < groups.length; i++) {
                params.push(["SecurityGroups.member." + (i + 1), groups[i]]);
            }
        }
        params.push([ "Listeners.member.Protocol", protocol ]);
        if (protocol == "HTTPS") {
            params.push([ "Listeners.member.SSLCertificateId", cert || "arn:aws:iam::322191361670:server-certificate/testCert" ]);
        }
        if (scheme) params.push(["Scheme", scheme]);
        params.push([ "Listeners.member.LoadBalancerPort", elbport ]);
        params.push([ "Listeners.member.InstancePort", instanceport ]);
        this.queryELB("CreateLoadBalancer", params, this, false, "onComplete", callback);
    },

    configureHealthCheck : function(LoadBalancerName, Target, Interval, Timeout, HealthyThreshold, UnhealthyThreshold, callback)
    {
        var params = [];
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "HealthCheck.Target", Target ]);
        params.push([ "HealthCheck.Interval", Interval ]);
        params.push([ "HealthCheck.Timeout", Timeout ]);
        params.push([ "HealthCheck.HealthyThreshold", HealthyThreshold ]);
        params.push([ "HealthCheck.UnhealthyThreshold", UnhealthyThreshold ]);

        this.queryELB("ConfigureHealthCheck", params, this, false, "onComplete", callback);
    },

    registerInstancesWithLoadBalancer : function(LoadBalancerName, instances, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < instances.length; i++) {
            params.push([ "Instances.member." + (i + 1) + ".InstanceId", instances[i] ]);
        }
        this.queryELB("RegisterInstancesWithLoadBalancer", params, this, false, "onComplete", callback);
    },

    deregisterInstancesWithLoadBalancer : function(LoadBalancerName, instances, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < instances.length; i++) {
            params.push([ "Instances.member." + (i + 1) + ".InstanceId", instances[i] ]);
        }
        this.queryELB("DeregisterInstancesFromLoadBalancer", params, this, false, "onComplete", callback);
    },

    enableAvailabilityZonesForLoadBalancer : function(LoadBalancerName, Zones, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < Zones.length; i++) {
            params.push([ "AvailabilityZones.member." + (i + 1), Zones[i] ]);
        }
        this.queryELB("EnableAvailabilityZonesForLoadBalancer", params, this, false, "onComplete", callback);
    },

    disableAvailabilityZonesForLoadBalancer : function(LoadBalancerName, Zones, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0 ; i < Zones.length; i++) {
            params.push([ "AvailabilityZones.member." + (i + 1), Zones[i] ]);
        }
        this.queryELB("DisableAvailabilityZonesForLoadBalancer", params, this, false, "onComplete", callback);
    },

    createAppCookieStickinessPolicy : function(LoadBalancerName, PolicyName, CookieName, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "CookieName", CookieName ]);
        params.push([ "PolicyName", PolicyName ]);
        this.queryELB("CreateAppCookieStickinessPolicy", params, this, false, "onComplete", callback);
    },

    createLBCookieStickinessPolicy : function(LoadBalancerName, PolicyName, CookieExpirationPeriod, callback)
    {
        var params = []
        params.push([ "CookieExpirationPeriod", CookieExpirationPeriod ]);
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "PolicyName", PolicyName ]);
        this.queryELB("CreateLBCookieStickinessPolicy", params, this, false, "onComplete", callback);
    },

    deleteLoadBalancerPolicy : function(LoadBalancerName, PolicyName, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "PolicyName", PolicyName ]);
        this.queryELB("DeleteLoadBalancerPolicy", params, this, false, "onComplete", callback);
    },

    applySecurityGroupsToLoadBalancer : function (loadBalancerName, groups, callback)
    {
        var params = [ ["LoadBalancerName", loadBalancerName] ];
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            params.push(["SecurityGroups.member." + (i + 1), group]);
        }
        this.queryELB("ApplySecurityGroupsToLoadBalancer", params, this, false, "onComplete", callback);
    },

    attachLoadBalancerToSubnets : function(LoadBalancerName, subnets, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["Subnets.member." + (i + 1), subnets[i]]);
        }
        this.queryELB("AttachLoadBalancerToSubnets", params, this, false, "onComplete", callback);
    },

    detachLoadBalancerFromSubnets : function(LoadBalancerName, subnets, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["Subnets.member." + (i + 1), subnets[i]]);
        }
        this.queryELB("DetachLoadBalancerFromSubnets", params, this, false, "onComplete", callback);
    },

    setLoadBalancerListenerSSLCertificate: function(LoadBalancerName, port, certId, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "LoadBalancerPort", port]);
        params.push([ "SSLCertificateId", certId]);
        this.queryELB("SetLoadBalancerListenerSSLCertificate", params, this, false, "onComplete", callback);
    },

    setLoadBalancerPoliciesForBackendServer: function(LoadBalancerName, InstancePort, PolicyNames, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "InstancePort", InstancePort ]);
        for (var i = 0; i < PolicyNames.length; i++) {
            params.push([ "PolicyNames.member." + (i + 1), PolicyNames[i] ]);
        }
        this.queryELB("SetLoadBalancerPoliciesForBackendServer", params, this, false, "onComplete", callback);
    },

    setLoadBalancerPoliciesOfListener: function(LoadBalancerName, LoadBalancerPort, PolicyNames, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "LoadBalancerPort", LoadBalancerPort ]);
        for (var i = 0; i < PolicyNames.length; i++) {
            params.push([ "PolicyNames.member." + (i + 1), PolicyNames[i] ]);
        }
        this.queryELB("SetLoadBalancerPoliciesOfListener", params, this, false, "onComplete", callback);
    },

    createLoadBalancerListeners: function(LoadBalancerName, InstancePort, InstanceProtocol, LoadBalancerPort, Protocol, SSLCertificateId, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "Listeners.member.1.InstancePort", InstancePort]);
        params.push([ "Listeners.member.1.InstanceProtocol", InstanceProtocol]);
        params.push([ "Listeners.member.1.LoadBalancerPort", LoadBalancerPort]);
        params.push([ "Listeners.member.1.Protocol", Protocol]);
        params.push([ "Listeners.member.1.SSLCertificateId", SSLCertificateId]);
        this.queryELB("CreateLoadBalancerListeners", params, this, false, "onComplete", callback);
    },

    createLoadBalancerPolicy: function(LoadBalancerName, PolicyName, PolicyType, PolicyAttributes, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "PolicyName", PolicyName ]);
        params.push([ "PolicyTypeName", PolicyType ]);
        if (PolicyAttributes) {
            for (var i = 0; i < PolicyAttributes.length; i++) {
                params.push([ "PolicyAttributes.member." + (i + 1) + ".AttributeName", PolicyAttributes[i].name ]);
                params.push([ "PolicyAttributes.member." + (i + 1) + ".AttributeValue", PolicyAttributes[i].value ]);
            }
        }
        this.queryELB("CreateLoadBalancerPolicy", params, this, false, "onComplete", callback);
    },

    deleteLoadBalancerListeners: function(LoadBalancerName, LoadBalancerPorts, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        for (var i = 0; i < LoadBalancerPorts.length; i++) {
            params.push([ "LoadBalancerPorts.member." + (i + 1), LoadBalancerPorts[i] ]);
        }
        this.queryELB("DeleteLoadBalancerListeners", params, this, false, "onComplete", callback);
    },

    uploadServerCertificate : function(ServerCertificateName, CertificateBody, PrivateKey, Path, callback)
    {
        var params = []
        params.push([ "ServerCertificateName", ServerCertificateName ]);
        params.push([ "CertificateBody", CertificateBody ]);
        params.push([ "PrivateKey", PrivateKey ]);
        if (Path != null) params.push([ "Path", Path ]);
        this.queryIAM("UploadServerCertificate", params, this, false, "onComplete", callback);
    },

    createTags : function(tags, callback)
    {
        var params = new Array();

        for ( var i = 0; i < tags.length; i++) {
            params.push([ "ResourceId." + (i + 1), tags[i].resourceId ]);
            params.push([ "Tag." + (i + 1) + ".Key", tags[i].name ]);
            params.push([ "Tag." + (i + 1) + ".Value", tags[i].value ]);
        }

        this.queryEC2("CreateTags", params, this, false, "onComplete", callback);
    },

    deleteTags : function(tags, callback)
    {
        var params = new Array();

        for ( var i = 0; i < tags.length; i++) {
            params.push([ "ResourceId." + (i + 1), tags[i].resourceId ]);
            params.push([ "Tag." + (i + 1) + ".Key", tags[i].name ]);
        }

        this.queryEC2("DeleteTags", params, this, false, "onComplete", callback);
    },

    describeTags : function(ids, callback)
    {
        if (!(ids instanceof Array)) ids = [ ids ];

        var params = new Array();
        for ( var i = 0; i < ids.length; i++) {
            params.push([ "Filter." + (i + 1) + ".Name", "resource-id" ]);
            params.push([ "Filter." + (i + 1) + ".Value.1", ids[i] ]);
        }

        this.queryEC2("DescribeTags", params, this, false, "onCompleteDescribeTags", callback);
    },

    onCompleteDescribeTags : function(response)
    {
        var xmlDoc = response.responseXML;
        var tags = new Array();

        var items = this.getItems(xmlDoc, "tagSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "resourceId");
            var key = getNodeValue(item, "key");
            var value = getNodeValue(item, "value");
            tags.push(new Tag(key, value, id));
        }

        response.result = tags;
    },

    listAccountAliases : function(callback)
    {
        this.queryIAM("ListAccountAliases", [], this, false, "onCompleteListAccountAliases", callback);
    },

    onCompleteListAccountAliases : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = getNodeValue(xmlDoc, "AccountAliases", "member");
    },

    createAccountAlias: function(name, callback)
    {
        this.queryIAM("CreateAccountAlias", [ ["AccountAlias", name]], this, false, "onComplete", callback);
    },

    deleteAccountAlias: function(name, callback)
    {
        this.queryIAM("DeleteAccountAlias", [ ["AccountAlias", name]], this, false, "onComplete", callback);
    },

    getAccountSummary: function(callback)
    {
        this.queryIAM("GetAccountSummary", [], this, false, "onCompleteGetAccountSummary", callback);
    },

    onCompleteGetAccountSummary: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.getItems(xmlDoc, "SummaryMap", "entry", ["key", "value"]);
    },

    createAccessKey : function(name, callback)
    {
        var params = []

        if (name) {
            params.push([ "UserName", name ])
        }
        this.queryIAM("CreateAccessKey", params, this, false, "onCompleteCreateAccessKey", callback);
    },

    onCompleteCreateAccessKey : function(response)
    {
        var xmlDoc = response.responseXML;

        var obj = new Element();
        obj.toString = function() { return this.id + (this.state ? fieldSeparator + this.state : ""); }
        obj.userName = getNodeValue(xmlDoc, "UserName");
        obj.id = getNodeValue(xmlDoc, "AccessKeyId");
        obj.secret = getNodeValue(xmlDoc, "SecretAccessKey");
        obj.status = getNodeValue(xmlDoc, "Status");
        response.result = obj;
    },

    deleteAccessKey : function(id, user, callback)
    {
        var params = [ [ "AccessKeyId", id ] ];
        if (user) params.push(["UserName", user])
        this.queryIAM("DeleteAccessKey", params, this, false, "onComplete", callback);
    },

    listAccessKeys : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        this.queryIAM("ListAccessKeys", params, this, false, "onCompleteListAccessKeys", callback);
    },

    onCompleteListAccessKeys : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var user = getNodeValue(xmlDoc, "UserName");
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element('userName', user);
            obj.toString = function() { return this.id + (this.state ? fieldSeparator + this.state : ""); }
            obj.id = getNodeValue(items[i], "AccessKeyId");
            obj.status = getNodeValue(items[i], "Status");
            obj.date = new Date(getNodeValue(items[i], "CreateDate"));
            list.push(obj);
        }

        this.core.updateModel('users', getParam(params, 'UserName'), 'accessKeys', list)

        response.result = list;
    },

    listVirtualMFADevices : function(status, callback)
    {
        var params = [];
        if (status) params.push(["AssignmentStatus", status]);
        this.queryIAM("ListVirtualMFADevices", [], this, false, "onCompleteListVirtualMFADevices", callback);
    },

    onCompleteListVirtualMFADevices : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "VirtualMFADevices", "member");
        for ( var i = 0; i < items.length; i++) {
            var dev = new Element();
            dev.toString = function() { return this.name }
            dev.id = getNodeValue(items[i], "SerialNumber");
            dev.date = getNodeValue(items[i], "EnableDate");
            dev.userName = getNodeValue(items[i], "UserName");
            dev.arn = toArn(getNodeValue(items[i], "Arn"));
            // arn:aws:iam::123456:mfa/name
            dev.name = dev.id.indexOf('arn:aws') == 0 ? dev.id.split(/[:\/]+/).pop() : dev.id;
            list.push(dev);
        }
        this.core.setModel('vmfas', list);
        response.result = list;
    },

    createVirtualMFADevice : function(name, path, callback)
    {
        this.queryIAM("CreateVirtualMFADevice", [["VirtualMFADeviceName", name], [ "Path", path || "/" ]], this, false, "onCompleteCreateVirtualMFADevice", callback);
    },

    onCompleteCreateVirtualMFADevice : function(response)
    {
        var xmlDoc = response.responseXML;

        var obj = [];
        obj.id = getNodeValue(xmlDoc, "SerialNumber");
        obj.seed = getNodeValue(xmlDoc, "Base32StringSeed");
        obj.qrcode = getNodeValue(xmlDoc, "QRCodePNG");

        response.result = obj;
    },

    deleteVirtualMFADevice: function(serial, callback)
    {
        this.queryIAM("DeleteVirtualMFADevice", [ ["SerialNumber", serial] ], this, false, "onComplete", callback);
    },

    listMFADevices : function(user, callback)
    {
        var params = [];
        // Not implemented in Euca
        //if (user) params.push(["UserName", user]);
        //this.queryIAM("ListMFADevices", params, this, false, "onCompleteListMFADevices", callback);
    },

    onCompleteListMFADevices : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = this.getItems(xmlDoc, "MFADevices", "member", ["SerialNumber", "EnableDate"], function(obj) {
            var dev = new Element('id', obj.SerialNumber, 'date', obj.EnableDate);
            dev.toString = function() { return this.name }
            // arn:aws:iam::123456:mfa/name
            dev.name = dev.id.indexOf('arn:aws') == 0 ? dev.id.split(/[:\/]+/).pop() : dev.id;
            return dev;
        });

        var user = getNodeValue(xmlDoc, "UserName");
        if (!user) user = getParam(params, 'UserName');
        if (!user) user = this.core.user.name;
        this.core.updateModel('users', user, 'mfaDevices', list)

        response.result = list;
    },

    enableMFADevice: function(user, serial, auth1, auth2, callback)
    {
        this.queryIAM("EnableMFADevice", [["UserName", user], ["SerialNumber", serial], ["AuthenticationCode1", auth1], ["AuthenticationCode2", auth2] ], this, false, "onComplete", callback);
    },

    resyncMFADevice: function(user, serial, auth1, auth2, callback)
    {
        this.queryIAM("ResyncMFADevice", [["UserName", user], ["SerialNumber", serial], ["AuthenticationCode1", auth1], ["AuthenticationCode2", auth2] ], this, false, "onComplete", callback);
    },

    deactivateMFADevice: function(user, serial, callback)
    {
        this.queryIAM("DeactivateMFADevice", [["UserName", user], ["SerialNumber", serial] ], this, false, "onComplete", callback);
    },

    unpackInstanceProfile: function(item)
    {
        var obj = new Element();
        obj.toString = function() {
            return this.name + (this.roles.length && this.name != this.roles[0].name ? "(" + this.roles[0].name + ")" : "")
        }
        obj.arn = toArn(getNodeValue(item, "Arn"));
        obj.path = getNodeValue(item, "Path");
        obj.id = getNodeValue(item, "InstanceProfileId");
        obj.name = getNodeValue(item, "InstanceProfileName");
        obj.date = getNodeValue(item, "CreateDate");
        obj.roles = [];
        var objs = this.getItems(item, "Roles", "member");
        for (var i = 0; i < objs.length; i++) {
            obj.roles.push(this.unpackRole(objs[i]));
        }
        return obj;
    },

    createInstanceProfile : function(name, path, callback)
    {
        this.queryIAM("CreateInstanceProfile", [ ["InstanceProfileName", name], [ "Path", path || "/"] ], this, false, "onCompleteGetInstanceProfile", callback);
    },

    deleteInstanceProfile : function(name, callback)
    {
        this.queryIAM("DeleteInstanceProfile", [ ["InstanceProfileName", name] ], this, false, "onComplete", callback);
    },

    listInstanceProfiles : function(callback)
    {
        this.queryIAM("ListInstanceProfiles", [], this, false, "onCompleteListInstanceProfiles", callback);
    },

    addRoleToInstanceProfile : function(name, role, callback)
    {
        this.queryIAM("AddRoleToInstanceProfile", [ ["InstanceProfileName", name], ["RoleName", role] ], this, false, "onComplete", callback);
    },

    removeRoleFromInstanceProfile : function(name, role, callback)
    {
        this.queryIAM("RemoveRoleFromInstanceProfile", [ ["InstanceProfileName", name], ["RoleName", role] ], this, false, "onComplete", callback);
    },

    onCompleteListInstanceProfiles : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "InstanceProfiles", "member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackInstanceProfile(items[i]));
        }
        this.core.setModel('instanceProfiles', list);
        response.result = list;
    },

    listInstanceProfilesForRole : function(name, callback)
    {
        this.queryIAM("ListInstanceProfilesForRole", [ ["RoleName", name] ], this, false, "onCompleteListInstanceProfilesForRole", callback);
    },

    onCompleteListInstanceProfilesForRole: function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = this.getItems(xmlDoc, "InstanceProfiles", "member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackInstanceProfile(items[i]));
        }
        this.core.updateModel('roles', getParam(params, 'RoleName'), 'instanceProfiles', list)
        response.result = list;
    },

    getInstanceProfile : function(name, callback)
    {
        this.queryIAM("GetInstanceProfile", [ ["InstanceProfileName", name] ], this, false, "onCompleteGetInstanceProfile", callback);
    },

    onCompleteGetInstanceProfile : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackInstanceProfile(xmlDoc);
    },

    unpackRole: function(item)
    {
        var obj = new Element();
        obj.toString = function() { return this.name }
        obj.arn = toArn(getNodeValue(item, "Arn"));
        obj.path = getNodeValue(item, "Path");
        obj.id = getNodeValue(item, "RoleId");
        obj.name = getNodeValue(item, "RoleName");
        obj.assumeRolePolicyDocument = decodeURIComponent(getNodeValue(item, "AssumeRolePolicyDocument"));
        obj.date = getNodeValue(item, "CreateDate");
        obj.instanceProfiles = null;
        obj.policies = null;
        return obj;
    },

    listRoles : function(callback)
    {
        this.queryIAM("ListRoles", [], this, false, "onCompleteListRoles", callback);
    },

    onCompleteListRoles : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackRole(items[i]));
        }
        this.core.setModel('roles', list);
        response.result = list;
    },

    getRole : function(name, callback)
    {
        this.queryIAM("GetRole", [ ["RoleName", name] ], this, false, "onCompleteGetRole", callback);
    },

    onCompleteGetRole : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackRole(xmlDoc);
    },

    createRole : function(name, path, policy, callback)
    {
        this.queryIAM("CreateRole", [ ["RoleName", name], [ "Path", path || "/"], ["AssumeRolePolicyDocument", policy] ], this, false, "onCompleteGetRole", callback);
    },

    deleteRole : function(name, callback)
    {
        this.queryIAM("DeleteRole", [ ["RoleName", name] ], this, false, "onComplete", callback);
    },

    listRolePolicies : function(name, callback)
    {
        this.queryIAM("ListRolePolicies", [ ["RoleName", name]], this, false, "onCompleteListPolicies", callback);
    },

    getRolePolicy : function(name, policy, callback)
    {
        this.queryIAM("GetRolePolicy", [ ["RoleName", name], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    putRolePolicy: function(name, policy, text, callback)
    {
        this.queryIAM("PutRolePolicy", [ ["RoleName", name], [ "PolicyName", policy ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    deleteRolePolicy : function(name, policy, callback)
    {
        this.queryIAM("DeleteRolePolicy", [ ["RoleName", name], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    listUsers : function(callback)
    {
        this.queryIAM("ListUsers", [], this, false, "onCompleteListUsers", callback);
    },

    unpackUser: function(item)
    {
        var o = new Element();
        o.toString = function() { return this.name + (this.groups && this.groups.length ? fieldSeparator + this.groups : ""); }
        o.id = getNodeValue(item, "UserId");
        o.name = getNodeValue(item, "UserName");
        o.path = getNodeValue(item, "Path");
        o.arn = toArn(getNodeValue(item, "Arn"));
        // arn:aws:iam::123456:user/name
        o.accountId = o.arn ? o.arn.split(":")[4] : "";
        return o;
    },

    onCompleteListUsers : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackUser(items[i]));
        }
        this.core.setModel('users', list);
        response.result = list;
    },

    getUser : function(name, callback)
    {
        var params = [];
        if (name) params.push(["UserName", name])
        this.queryIAM("GetUser", params, this, false, "onCompleteGetUser", callback);
    },

    onCompleteGetUser : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackUser(xmlDoc);
    },

    getUserPolicy : function(name, policy, callback)
    {
        this.queryIAM("GetUserPolicy", [ ["UserName", name], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    putUserPolicy: function(name, policy, text, callback)
    {
        this.queryIAM("PutUserPolicy", [ ["UserName", name], [ "PolicyName", policy ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    deleteUserPolicy : function(name, policy, callback)
    {
        this.queryIAM("DeleteUserPolicy", [ ["UserName", name], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    onCompleteGetPolicy : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = unescape(getNodeValue(xmlDoc, "PolicyDocument"));
    },

    createUser : function(name, path, callback)
    {
        this.queryIAM("CreateUser", [ ["UserName", name], [ "Path", path || "/"] ], this, false, "onCompleteGetUser", callback);
    },

    deleteUser : function(name, callback)
    {
        this.queryIAM("DeleteUser", [ ["UserName", name] ], this, false, "onComplete", callback);
    },

    getLoginProfile : function(name, callback)
    {
        var params = [];
        if (name) params.push(["UserName", name])
        this.queryIAM("GetLoginProfile", params, this, false, "onCompleteGetLoginProfile", callback);
    },

    onCompleteGetLoginProfile : function(response)
    {
        var xmlDoc = response.responseXML;

        var name = getNodeValue(xmlDoc, "UserName");
        var date = getNodeValue(xmlDoc, "CreateDate");

        // It is valid not to have it
        if (!response.hasErrors) {
            this.core.updateModel('users', name, 'loginProfileDate', date)
        }
        response.hasErrors = false;
        response.result = date;
    },

    createLoginProfile : function(name, pwd, callback)
    {
        this.queryIAM("CreateLoginProfile", [ ["UserName", name], [ "Password", pwd ] ], this, false, "onComplete", callback);
    },

    updateLoginProfile : function(name, pwd, callback)
    {
        this.queryIAM("UpdateLoginProfile", [ ["UserName", name], [ "Password", pwd ] ], this, false, "onComplete", callback);
    },

    updateUser : function(name, newname, newpath, callback)
    {
        var params = [ ["UserName", name] ]
        if (newname) params.push([ "NewUserName", newname])
        if (newpath) params.push(["NewPath", newpath])
        this.queryIAM("UpdateUser", params, this, false, "onComplete", callback);
    },

    deleteLoginProfile : function(name, callback)
    {
        this.queryIAM("DeleteLoginProfile", [ ["UserName", name] ], this, false, "onComplete", callback);
    },

    listUserPolicies : function(user, callback)
    {
        this.queryIAM("ListUserPolicies", [ ["UserName", user]], this, false, "onCompleteListPolicies", callback);
    },

    changePassword : function(oldPw, newPw, callback)
    {
        this.queryIAM("ChangePassword", [ ["OldPassword", oldPw], [ "NewPassword", newPw ] ], this, false, "onComplete", callback);
    },

    addUserToGroup : function(user, group, callback)
    {
        this.queryIAM("AddUserToGroup", [ ["UserName", user], [ "GroupName", group ] ], this, false, "onComplete", callback);
    },

    removeUserFromGroup : function(user, group, callback)
    {
        this.queryIAM("RemoveUserFromGroup", [ ["UserName", user], [ "GroupName", group ] ], this, false, "onComplete", callback);
    },

    listGroups : function(callback)
    {
        this.queryIAM("ListGroups", [], this, false, "onCompleteListGroups", callback);
    },

    listGroupsForUser : function(user, callback)
    {
        this.queryIAM("ListGroupsForUser", [ ["UserName", user]], this, false, "onCompleteListGroups", callback);
    },

    unpackGroup: function(item)
    {
        var obj = new Element();
        obj.toString = function() { return this.name; }
        obj.path = getNodeValue(item, "Path");
        obj.name = getNodeValue(item, "GroupName");
        obj.id = getNodeValue(item, "GroupId");
        obj.arn = toArn(getNodeValue(item, "Arn"));
        return obj;
    },

    onCompleteListGroups : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackGroup(items[i]));
        }

        // Update model directly
        switch (response.action) {
        case 'ListGroups':
            this.core.setModel('groups', list);
            break;

        case "ListGroupsForUser":
            this.core.updateModel('users', getParam(params, 'UserName'), 'groups', list)
            break;
        }

        response.result = list;
    },

    listGroupPolicies : function(name, callback)
    {
        this.queryIAM("ListGroupPolicies", [ ["GroupName", name]], this, false, "onCompleteListPolicies", callback);
    },

    onCompleteListPolicies : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(items[i].firstChild.nodeValue);
        }

        // Update model directly
        switch(response.action) {
        case "ListGroupPolicies":
            this.core.updateModel('groups', getParam(params, 'GroupName'), 'policies', list)
            break;

        case "ListUserPolicies":
            this.core.updateModel('users', getParam(params, 'UserName'), 'policies', list)
            break;

        case "ListRolePolicies":
            this.core.updateModel('roles', getParam(params, 'RoleName'), 'policies', list)
            break;
        }
        response.result = list;
    },

    getGroupPolicy : function(group, policy, callback)
    {
        this.queryIAM("GetGroupPolicy", [ ["GroupName", group], [ "PolicyName", policy] ], this, false, "onCompleteGetPolicy", callback);
    },

    deleteGroupPolicy : function(group, policy, callback)
    {
        this.queryIAM("DeleteGroupPolicy", [ ["GroupName", group], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    putGroupPolicy: function(group, policy, text, callback)
    {
        this.queryIAM("PutGroupPolicy", [ ["GroupName", group], [ "PolicyName", policy ], ["PolicyDocument", text] ], this, false, "onComplete", callback);
    },

    createGroup : function(name, path, callback)
    {
        this.queryIAM("CreateGroup", [ ["GroupName", name], [ "Path", path || "/"] ], this, false, "onCompleteGetGroup", callback);
    },

    deleteGroup : function(name, callback)
    {
        this.queryIAM("DeleteGroup", [ ["GroupName", name] ], this, false, "onComplete", callback);
    },

    getGroup : function(name, callback)
    {
        this.queryIAM("GetGroup", [ ["GroupName", name]], this, false, "onCompleteGetGroup", callback);
    },

    onCompleteGetGroup : function(response)
    {
        var xmlDoc = response.responseXML;

        var group = this.unpackGroup(xmlDoc);
        // User real object from the model
        var obj = this.core.findModel('groups', group.id);
        if (!obj) obj = group;

        var users = this.getItems(xmlDoc, 'Users', 'member', ["UserId", "UserName", "Path", "Arn"], function(o) {
            var o = new Element('id', o.UserId, 'name', o.UserName, 'path', o.Path, 'arn', toArn(o.Arn));
            o.toString = function() {
                return this.name + (this.groups && this.groups.length ? fieldSeparator + this.groups : "");
            }
            // arn:aws:iam::123456:user/name
            o.accountId = o.arn ? o.arn.split(":")[4] : "";
            return o;
        });

        // Update with real users from the model so we can share between users and groups screens
        for (var i in users) {
            var user = this.core.findModel('users', users[i].id);
            if (user) users[i] = user;
        }
        obj.users = users;
        response.result = obj;
    },

    updateGroup: function(name, newname, newpath, callback)
    {
        var params = [ ["GroupName", name] ]
        if (newname) params.push([ "NewGroupName", newname])
        if (newpath) params.push(["NewPath", newpath])
        this.queryIAM("UpdateGroup", params, this, false, "onComplete", callback);
    },

    getAccountPasswordPolicy: function(callback)
    {
        this.queryIAM("GetAccountPasswordPolicy", [], this, false, "onCompleteGetPasswordPolicy", callback);
    },

    onCompleteGetPasswordPolicy: function(response)
    {
        debug(response.responseText)
        var xmlDoc = response.responseXML;
        var obj = { MinimumPasswordLength: null, RequireUppercaseCharacters: null, RequireLowercaseCharacters: null, RequireNumbers: null, RequireSymbols: null, AllowUsersToChangePassword: null };

        // It is ok not to have a policy
        if (!response.hasErrors) {
            obj.MinimumPasswordLength = getNodeValue(xmlDoc, 'MinimumPasswordLength');
            obj.RequireUppercaseCharacters = getNodeValue(xmlDoc, 'RequireUppercaseCharacters');
            obj.RequireLowercaseCharacters = getNodeValue(xmlDoc, 'RequireLowercaseCharacters');
            obj.RequireNumbers = getNodeValue(xmlDoc, 'RequireNumbers');
            obj.RequireSymbols = getNodeValue(xmlDoc, 'RequireSymbols');
            obj.AllowUsersToChangePassword = getNodeValue(xmlDoc, 'AllowUsersToChangePassword');
        } else {
            obj.disabled = true;
            response.hasErrors = false;
        }
        response.result = obj;
    },

    updateAccountPasswordPolicy: function(obj, callback)
    {
        var params = []
        for (var p in obj) {
            if (obj[p] == "") continue;
            params.push([p, obj[p]]);
        }
        this.queryIAM("UpdateAccountPasswordPolicy", params, this, false, "onComplete", callback);
    },

    deleteAccountPasswordPolicy: function(callback)
    {
        this.queryIAM("DeleteAccountPasswordPolicy", [], this, false, "onComplete", callback);
    },

    importKeypair : function(name, keyMaterial, callback)
    {
        this.queryEC2("ImportKeyPair", [ [ "KeyName", name ], [ "PublicKeyMaterial", keyMaterial ] ], this, false, "onComplete", callback);
    },

    listSigningCertificates : function(user, callback)
    {
        var params = [];
        if (user) params.push(["UserName", user]);
        this.queryIAM("ListSigningCertificates", params, this, false, "onCompleteListSigningCertificates", callback);
    },

    onCompleteListSigningCertificates : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {return this.id;}
            obj.id = getNodeValue(items[i], "CertificateId");
            obj.body = getNodeValue(items[i], "CertificateBody");
            obj.userName = getNodeValue(items[i], "UserName");
            list.push(obj);
        }
        response.result = list;
    },

    uploadSigningCertificate : function(user, body, callback)
    {
        var params = [ [ "CertificateBody", body ] ];
        if (user) params.push([["UserName", user]])
        this.queryIAM("UploadSigningCertificate", params, this, false, "onComplete", callback);
    },

    deleteSigningCertificate : function(id, callback)
    {
        this.queryIAM("DeleteSigningCertificate", [ [ "CertificateId", id ] ], this, false, "onComplete", callback);
    },

    updateSigningCertificate : function(id, status, callback)
    {
        this.queryIAM("UpdateSigningCertificate", [ [ "CertificateId", id ], ["Status", status] ], this, false, "onComplete", callback);
    },

    uploadServerCertificate : function(name, body, privateKey, path, chain, callback)
    {
        var params = [ ["ServerCertificateName", name]];
        params.push([ "CertificateBody", body ]);
        params.push(["PrivateKey", privateKey ]);
        if (path) params.push([["Path", path]])
        if (chain) params.push(["CertificateChain", chain])
        this.queryIAM("UploadServerCertificate", params, this, false, "onComplete", callback);
    },

    deleteServerCertificate : function(name, callback)
    {
        this.queryIAM("DeleteServerCertificate", [ [ "ServerCertificateName", name ] ], this, false, "onComplete", callback);
    },

    updateServerCertificate : function(name, newname, newpath, callback)
    {
        var params = [ [ "ServerCertificateName", name ] ];
        if (newname) params.push(["NewServerCertificateName", newname]);
        if (newpath) params.push(["NewPath", newpath]);
        this.queryIAM("UpdateServerCertificate", params, this, false, "onComplete", callback);
    },

    getServerCertificate : function(name, callback)
    {
        this.queryIAM("GetServerCertificate", [ [ "ServerCertificateName", name ] ], this, false, "onCompleteGetServerCertificate", callback);
    },

    unpackServerCertificate: function(item)
    {
        var obj = new Element()
        obj.toString = function() { return this.name; }
        obj.id = getNodeValue(item, "ServerCertificateId");
        obj.name = getNodeValue(item, "ServerCertificateName");
        obj.arn = toArn(getNodeValue(item, "Arn"));
        obj.path = getNodeValue(item, "Path");
        obj.date = getNodeValue(item, "UploadDate");
        obj.body = getNodeValue(item, "CertificateBody");
        return obj;
    },

    onCompleteGetServerCertificate : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackServerCertificate(xmlDoc);
    },

    listServerCertificates : function(callback)
    {
        var params = [];
        //Not implemented in Euca
        //this.queryIAM("ListServerCertificates", params, this, false, "onCompleteListServerCertificates", callback);
    },

    onCompleteListServerCertificates : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = xmlDoc.getElementsByTagName("member");
        for ( var i = 0; i < items.length; i++) {
            list.push(this.unpackServerCertificate(items[i]));
        }
        this.core.setModel('serverCerts', list);
        response.result = list;
    },

    putMetricAlarm : function(AlarmName, Namespace, MetricName, ComparisonOperator, Threshold, Period, EvaluationPeriods, Statistic, params, callback)
    {
        if (!params) params = [];
        params.push(["AlarmName", AlarmName])
        params.push(["MetricName", MetricName])
        params.push(["Namespace", Namespace])
        params.push(["ComparisonOperator", ComparisonOperator])
        params.push(["Period", Period])
        params.push(["EvaluationPeriods", EvaluationPeriods])
        params.push(["Threshold", Threshold])
        params.push(["Statistic", Statistic])

        this.queryCloudWatch("PutMetricAlarm", params, this, false, "onComplete", callback);
    },

    unpackAlarm: function(item)
    {
        var obj = new Element();
        obj.toString = function() {
            return this.name + fieldSeparator + this.descr;
        }

        obj.arn = toArn(getNodeValue(item, "AlarmArn"));
        obj.name = getNodeValue(item, "AlarmName");
        obj.actionsEnabled = getNodeValue(item, "ActionsEnabled");
        obj.descr = getNodeValue(item, "AlarmDescription");
        obj.stateReason = getNodeValue(item, "StateReason");
        obj.stateReasonData = getNodeValue(item, "StateReasonData");
        obj.stateValue = getNodeValue(item, "StateValue");
        obj.stateTimestamp = new Date(getNodeValue(item, "StateUpdatedTimestamp"));
        obj.namespace = getNodeValue(item, "Namespace");
        obj.period = getNodeValue(item, "Period");
        obj.unit = getNodeValue(item, "Unit");
        obj.threshold = getNodeValue(item, "Threshold");
        obj.statistic = getNodeValue(item, "Statistic");
        obj.comparisonOper = getNodeValue(item, "ComparisonOperator");
        obj.metricName = getNodeValue(item, "MetricName");
        obj.evaluationPeriods = getNodeValue(item, "EvaluationPeriods");
        obj.insufficientDataActions = this.getItems(item, "InsufficientDataActions", "member", "");
        obj.okActions = this.getItems(item, "OKActions", "member", "");
        obj.dimensions = this.getItems(item, "Dimensions", "member", ["Name", "Value"], function(o) { return new Tag(o.Name, o.Value)});
        obj.actions = this.getItems(item, "AlarmActions", "member", "");
        return obj;
    },

    describeAlarms : function(callback)
    {
        this.queryCloudWatch("DescribeAlarms", [], this, false, "onCompleteDescribeAlarms", callback);
    },

    onCompleteDescribeAlarms : function(response)
    {
        var xmlDoc = response.responseXML;
        var alarms = new Array();

        var items = this.getItems(xmlDoc, "MetricAlarms", "member");
        for ( var i = 0; i < items.length; i++) {
            alarms.push(this.unpackAlarm(items[i]));
        }

        this.core.setModel('alarms', alarms);

        response.result = alarms;
    },

    describeAlarmHistory : function(name, callback)
    {
        var params = [];
        if (name) params.push(["AlarmName", name])
        this.queryCloudWatch("DescribeAlarmHistory", params, this, false, "onCompleteDescribeAlarmHistory", callback);
    },

    onCompleteDescribeAlarmHistory : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "AlarmHistoryItems", "member");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.type + fieldSeparator + this.date + fieldSeparator + this.descr;
            }

            obj.name = getNodeValue(items[i], "AlarmName");
            obj.type = getNodeValue(items[i], "HistoryItemType");
            obj.data = getNodeValue(items[i], "HistoryData");
            obj.descr = getNodeValue(items[i], "HistorySummary");
            obj.date = new Date(getNodeValue(items[i], "Timestamp"));
            list.push(obj);
        }
        response.result = list;
    },

    deleteAlarms : function(list, callback)
    {
        var params = [];
        for (var i = 0; i < list.length; i++) {
            params.push(["AlarmNames.member." + (i + 1), typeof list[i] == "object" ? list[i].name : list[i] ]);
        }
        this.queryCloudWatch("DeleteAlarms", params, this, false, "onComplete", callback);
    },

    disableAlarmActions : function(list, callback)
    {
        var params = [];
        for (var i = 0; i < list.length; i++) {
            params.push(["AlarmNames.member." + (i + 1), typeof list[i] == "object" ? list[i].name : list[i] ]);
        }
        this.queryCloudWatch("DisableAlarmActions", params, this, false, "onComplete", callback);
    },

    enableAlarmActions : function(list, callback)
    {
        var params = [];
        for (var i = 0; i < list.length; i++) {
            params.push(["AlarmNames.member." + (i + 1), typeof list[i] == "object" ? list[i].name : list[i] ]);
        }
        this.queryCloudWatch("EnableAlarmActions", params, this, false, "onComplete", callback);
    },

    setAlarmState : function(name, state, reason, callback)
    {
        var params = [];
        params.push(["AlarmName", name ]);
        params.push(["StateValue", state ]);
        params.push(["StateReason", reason ]);
        this.queryCloudWatch("SetAlarmState", params, this, false, "onComplete", callback);
    },

    listMetrics : function(name, namespace, dimensions, callback)
    {
        var params = [];
        if (name) params.push(["MetricName", name])
        if (namespace) params.push(["Namespace", namespace])
        if (dimensions instanceof Array) {
            for (var i = 0; i < dimensions.length; i++) {
                params.push(["Dimensions.member." + (i + 1) + ".Name", dimensions[i].name]);
                params.push(["Dimensions.member." + (i + 1) + ".Value", dimensions[i].value]);
            }
        }
        this.queryCloudWatch("ListMetrics", params, this, false, "onCompleteListMetrics", callback);
    },

    onCompleteListMetrics : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "Metrics", "member");
        for ( var i = 0; i < items.length; i++) {
            var metric = new Element("info", "");
            metric.update = function () {
                if (this.dimensions.length == 1 && !this.info) {
                    this.info = ew_core.modelValue(this.dimensions[0].name, this.dimensions[0].value, true);
                    if (this.info == this.dimensions) this.info = "";
                }
            }

            metric.toString = function() {
                return this.name + fieldSeparator + this.namespace + (this.dimensions.length ? fieldSeparator + ew_core.modelValue(this.dimensions[0].name, this.dimensions[0].value, true) : "");
            }

            metric.name = getNodeValue(items[i], "MetricName");
            metric.namespace = getNodeValue(items[i], "Namespace");
            metric.dimensions = this.getItems(items[i], "Dimensions", "member", ["Name", "Value"], function(obj) { return new Tag(obj.Name, obj.Value)});
            list.push(metric);
        }
        return this.getNext(response, this.queryCloudWatch, list);
    },

    getMetricStatistics : function(name, namespace, start, end, period, statistics, unit, dimensions, callback)
    {
        var params = [];
        params.push(["MetricName", name])
        params.push(["Namespace", namespace])
        params.push(["StartTime", start])
        params.push(["EndTime", end])
        params.push(["Period", period])
        if (unit) params.push(["Unit", unit])
        if (statistics instanceof Array) {
            for (var i = 0; i < statistics.length; i++) {
                params.push(["Statistics.member." + (i + 1), statistics[i]])
            }
        } else {
            params.push(["Statistics.member.1", statistics])
        }
        if (dimensions instanceof Array)
        for (var i = 0; i < dimensions.length; i++) {
            params.push(["Dimensions.member." + (i + 1) + ".Name", dimensions[i].name]);
            params.push(["Dimensions.member." + (i + 1) + ".Value", dimensions[i].value]);
        }
        this.queryCloudWatch("GetMetricStatistics", params, this, false, "onCompleteGetMetricStatistics", callback);
    },

    onCompleteGetMetricStatistics : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "Datapoints", "member");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.timestamp + fieldSeparator + this.unit + fieldSeparator + this.value;
            }
            obj.timestamp = new Date(getNodeValue(items[i], "Timestamp"));
            obj.unit = getNodeValue(items[i], "Unit");
            obj.average = getNodeValue(items[i], "Average");
            obj.sum = getNodeValue(items[i], "Sum");
            obj.sampleCount = getNodeValue(items[i], "SampleCount");
            obj.maximum = getNodeValue(items[i], "Maximum");
            obj.minimum = getNodeValue(items[i], "Minimum");
            obj.value = parseFloat(parseFloat(obj.average || obj.sum || obj.sampleCount || obj.maximum || obj.minimum || '0').toFixed(2));

            list.push(obj);
        }
        response.result = list;
    },

    getSessionToken : function (duration, serial, token, accesskey, callback)
    {
        var params = [];
        if (duration) params.push(["DurationSeconds", duration]);
        if (serial) params.push(["SerialNumber", serial]);
        if (token) params.push(["TokenCode", token]);

        this.querySTS("GetSessionToken", params, this, false, "onCompleteGetSessionToken", callback, accesskey);
    },

    getFederationToken : function (duration, name, policy, callback)
    {
        var params = [ ["Name", name] ];
        if (duration) params.push(["DurationSeconds", duration]);
        if (policy) params.push(["Policy", policy]);

        this.querySTS("GetFederationToken", params, this, false, "onCompleteGetSessionToken", callback);
    },

    onCompleteGetSessionToken : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var item = xmlDoc.getElementsByTagName('Credentials')[0];
        var id = getNodeValue(xmlDoc, "FederatedUser", "FederatedUserId");
        var arn = toArn(getNodeValue(xmlDoc, "FederatedUser", "Arn"));

        var token = getNodeValue(item, "SessionToken");
        var key = getNodeValue(item, "AccessKeyId");
        var secret = getNodeValue(item, "SecretAccessKey");
        var expire = new Date(getNodeValue(item, "Expiration"));
        var name = getParam(params, "Name");
        var obj = new Element('region', this.region, 'status', 'Temporary', 'state', '',
                              'id', key, 'secret', secret, 'securityToken', token,
                              'expire', expire,
                              'userName', name || this.core.user.name,
                              'userId', id || this.core.user.id,
                              'arn', arn || this.core.user.arn);
        obj.toString = function() { return this.id + (this.state ? fieldSeparator + this.state : ""); }
        response.result = obj;
    },

    onCompleteCustomerGatewayConfigFormats: function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        switch (response.action) {
        case "customer-gateway-config-formats.xml":
            var list = [];
            var items = this.getItems(xmlDoc, "CustomerGatewayConfigFormats" ,"Format");
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var platform = getNodeValue(item, "Platform");
                var filename = getNodeValue(item, "Filename");
                var vendor = getNodeValue(item, "Vendor");
                var software = getNodeValue(item, "Software");
                list.push({ title: vendor + " " + platform + " [" + software + "]", filename: filename });
            }
            response.result = list;
            break;

        default:
            try {
                var configXml = new DOMParser().parseFromString(params, "text/xml");
                var proc = new XSLTProcessor;
                proc.importStylesheet(xmlDoc);
                var resultXml = proc.transformToDocument(configXml);
                response.result = getNodeValue(resultXml, "transformiix:result");
            } catch (e) {
                debug("Exception while processing XSLT: "+e)
            }
        }
        return response.result;
    },

    listQueues : function(callback)
    {
        this.querySQS(null, "ListQueues", [], this, false, "onCompleteListQueues", callback);
    },

    onCompleteListQueues : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "ListQueuesResult", "QueueUrl", null, function(node) {
            var item = new Element('url', node.firstChild.nodeValue);
            item.name = item.url.split("/").pop();
            item.messages = null;
            item.toString = function() {
                return this.name
            }
            return item;
        });
        this.core.setModel('queues', list);
        response.result = list;
    },

    getQueueAttributes : function(url, callback)
    {
        this.querySQS(url, "GetQueueAttributes", [ ["AttributeName.1", "All"] ], this, false, "onCompleteGetQueueAttributes", callback);
    },

    onCompleteGetQueueAttributes : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "GetQueueAttributesResult", "Attribute", ["Name", "Value"], function(obj) { return new Element('name',obj.Name,'value',obj.Value)});
        response.result = list;
    },

    setQueueAttributes : function(url, name, value, callback)
    {
        this.querySQS(url, "SetQueueAttributes", [ ["Attribute.Name", name], ["Attribute.Value", value] ], this, false, "onComplete", callback);
    },

    createQueue : function(name, params, callback)
    {
        if (!params) params = [];
        params.push(["QueueName", name]);
        this.querySQS(null, "CreateQueue", params, this, false, "onComplete:QueueUrl", callback);
    },

    deleteQueue : function(url, callback)
    {
        this.querySQS(url, "DeleteQueue", [], this, false, "onComplete", callback);
    },

    sendMessage : function(url, body, delay, callback)
    {
        var params = [["MessageBody", body]];
        if (delay) params.push(["DelaySeconds", delay]);
        this.querySQS(url, "SendMessage", params, this, false, "onComplete:MessageId", callback);
    },

    deleteMessage : function(url, handle, callback)
    {
        this.querySQS(url, "DeleteMessage", [["ReceiptHandle", handle]], this, false, "onComplete", callback);
    },

    receiveMessage : function(url, max, visibility, timeout, callback)
    {
        var params = [ [ "AttributeName", "All"] ];
        if (max) params.push(["MaxNumberOfMessages", max]);
        if (visibility) params.push(["VisibilityTimeout", visibility]);
        if (typeof timeout == "number") params.push(["WaitTimeSeconds", timeout]);
        this.querySQS(url, "ReceiveMessage", params, this, false, "onCompleteReceiveMessage", callback);
    },

    onCompleteReceiveMessage : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ReceiveMessageResult", "Message");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element('subject', '')
            obj.id = getNodeValue(items[i], "MessageId");
            obj.handle = getNodeValue(items[i], "ReceiptHandle");
            obj.body = getNodeValue(items[i], "Body");
            obj.md5 = getNodeValue(items[i], "MD5OfBody")
            obj.url = response.url;
            obj.toString = function() {
                return this.id + (this.subject ? fieldSeparator + this.subject : "");
            }

            // Try to determine the subject
            try {
                var o = JSON.parse(obj.body)
                obj.subject = o.subject || o.type || '';
            } catch(e) {
                obj.subject = obj.body.split("\n")[0];
            }

            var attrs = items[i].getElementsByTagName('Attribute');
            for (var j = 0; j < attrs.length; j++) {
                var name = getNodeValue(attrs[j], "Name");
                var value = getNodeValue(attrs[j], "Value");
                switch (name) {
                case "":
                    break;
                case "SentTimestamp":
                case "ApproximateFirstReceiveTimestamp":
                    obj[name] = new Date(value * 1000);
                    break;
                default:
                    obj[name] = value;
                }
            }
            list.push(obj);
        }
        response.result = list;
    },

    addQueuePermission : function(url, label, actions, callback)
    {
        var params = [ ["Label", label]];
        for (var i = 0; i < actions.length; i++) {
            params.push(["ActionName." + (i + 1), actions[i].name]);
            params.push(["AWSAccountId." + (i + 1), actions[i].id]);
        }
        this.querySQS(url, "AddPermission", params, this, false, "onComplete:QueueUrl", callback);
    },

    removeQueuePermission : function(url, label, callback)
    {
        this.querySQS(url, "RemovePermission", [["Label", label]], this, false, "onComplete", callback);
    },

    listTopics : function(callback)
    {
        this.querySNS("ListTopics", [], this, false, "onCompleteListTopics", callback);
    },

    onCompleteListTopics : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "Topics", "member", ["TopicArn"], function(obj) {
            var item = new Element();
            item.id = toArn(obj.TopicArn);
            item.name = item.id.split(/[:\/]/).pop();
            item.subscriptions = [];
            item.toString = function() {
                return this.name + (this.subscriptions.length ? fieldSeparator + this.subscriptions[0] : "");
            }
            return item;
        });
        this.core.setModel('topics', list);
        response.result = list;
    },

    createTopic: function(name, callback)
    {
        this.querySNS("CreateTopic", [ ["Name", name ]], this, false, "onComplete:TopicArn", callback);
    },

    deleteTopic: function(id, callback)
    {
        this.querySNS("DeleteTopic", [ ["TopicArn", id ]], this, false, "onComplete:TopicArn", callback);
    },

    addTopicPermission : function(id, label, actions, callback)
    {
        var params = [];
        params.push([ "Label", label ]);
        params.push([ "TopicArn", id ])
        for (var i = 0; i < actions.length; i++) {
            params.push(["ActionName." + (i + 1), actions[i].name]);
            params.push(["AWSAccountId." + (i + 1), actions[i].id]);
        }
        this.querySNS("AddPermission", params, this, false, "onComplete", callback);
    },

    removeTopicPermission : function(id, label, callback)
    {
        this.querySNS("RemovePermission", [["Label", label], [ "TopicArn", id ]], this, false, "onComplete", callback);
    },

    getTopicAttributes : function(id, callback)
    {
        this.querySNS("GetTopicAttributes", [ ["TopicArn", id] ], this, false, "onCompleteGetTopicAttributes", callback);
    },

    onCompleteGetTopicAttributes : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "Attributes", "entry", ["key", "value"], function(obj) { return new Tag(obj.key,obj.value)});
        response.result = list;
    },

    setTopicAttributes : function(id, name, value, callback)
    {
        this.querySNS("SetTopicAttributes", [ ["TopicArn", id], ["AttributeName", name], ["AttributeValue", value] ], this, false, "onComplete", callback);
    },

    publish : function(id, subject, message, json, callback)
    {
        var params = [ ["TopicArn", id] ];
        params.push([ "Message", message] );
        if (subject) {
            params.push(["Subject", subject]);
        }
        if (json) {
            params.push(["MessageStructure", "json"])
        }
        this.querySNS("Publish", params, this, false, "onComplete:MessageId", callback);
    },

    subscribe : function(id, endpoint, protocol, callback)
    {
        this.querySNS("Subscribe", [ ["TopicArn", id], ["Endpoint", endpoint], ["Protocol", protocol] ], this, false, "onComplete:SubscriptionArn", callback);
    },

    confirmSubscription : function(id, token, AuthenticateOnUnsubscribe, callback)
    {
        var params = [ ["TopicArn", id]];
        params.push([ "Token", token] );
        if (AuthenticateOnUnsubscribe) {
            params.push(["AuthenticateOnUnsubscribe", "true"])
        }
        this.querySNS("Subscribe", params, this, false, "onComplete:SubscriptionArn", callback);
    },

    unsubscribe : function(id, callback)
    {
        this.querySNS("Unsubscribe", [ ["SubscriptionArn", id] ], this, false, "onComplete", callback);
    },

    listSubscriptions : function(callback)
    {
        //Not implemented in Euca
        //this.querySNS("ListSubscriptions", [], this, false, "onCompleteListSubscriptions", callback);
    },

    listSubscriptionsByTopic : function(id, callback)
    {
        this.querySNS("ListSubscriptionsByTopic", [["TopicArn", id]], this, false, "onCompleteListSubscriptions", callback);
    },

    onCompleteListSubscriptions : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "Subscriptions", "member", ["TopicArn","Protocol","SubscriptionArn","Owner","Endpoint"], function(obj) {
            var item = new Element();
            item.id = toArn(obj.SubscriptionArn)
            item.topicArn = toArn(obj.TopicArn)
            item.topicName = item.topicArn.split(/[:\/]+/).pop()
            item.protocol = obj.Protocol
            item.endpoint = obj.Endpoint
            item.owner = obj.Owner
            item.toString = function() {
                return this.protocol + fieldSeparator + this.endpoint;
            }
            return item;
        });

        if (response.action == "ListSubscriptions") {
            this.core.setModel('subscriptions', list);
            var topics = this.core.getModel('topics')
            for (var i in topics) {
                topics[i].subscriptions = this.core.queryModel('subscriptions', 'topicArn', topics[i].id);
            }
        }
        response.result = list;
    },

    getSubscriptionAttributes : function(id, callback)
    {
        this.querySNS("GetSubscriptionAttributes", [ ["SubscriptionArn", id] ], this, false, "onCompleteGetTopicAttributes", callback);
    },

    setSubscriptionAttributes : function(id, name, value, callback)
    {
        this.querySNS("SetSubscriptionAttributes", [ ["SubscriptionArn", id], ["AttributeName", name], ["AttributeValue", value] ], this, false, "onComplete", callback);
    },

    unpackDBSubnetGroup: function(item)
    {
        if (!item) return null;
        var name = getNodeValue(item, "DBSubnetGroupName");
        if (name == "") return null;

        var grp = new Element('name', name);
        grp.descr = getNodeValue(item,"DBSubnetGroupDescription");
        grp.status = getNodeValue(item, "SubnetGroupStatus");
        grp.vpcId = getNodeValue(item, "VpcId");
        grp.subnets = [];
        var subnets = this.getItems(item, "Subnets", "Subnet");
        for (var i = 0; i < subnets.length; i++) {
            grp.subnets.push(new Element('id', getNodeValue(subnets[i], "SubnetIdentifier"),
                                         'availabilityZone', getNodeValue(subnets[i], "SubnetAvailabilityZone", "Name"),
                                         'status', getNodeValue(subnets[i], "SubnetStatus"),
                                         'iopsCapable', toBool(getNodeValue(subnets[i], "SubnetAvailabilityZone", "ProvisionedIopsCapable")) ? "IopsCapable" : ""));
        }
        grp.toString = function() { return this.name + fieldSeparator + this.descr + fieldSeparator + this.status + fieldSeparator + ew_core.modelValue('vpcId', this.vpcId) + fieldSeparator + this.subnets; }
        return grp;
    },

    unpackDBSecurityGroup: function(item)
    {
        if (!item) return null;
        var grp = new Element();
        grp.toString = function() {  return this.name; }
        grp.name = getNodeValue(item, "DBSecurityGroupName");
        if (!grp.name) return null;
        grp.descr = getNodeValue(item,"DBSecurityGroupDescription");
        grp.ownerId = getNodeValue(item, "OwnerId");
        grp.vpcId = getNodeValue(item, "VpcId");
        grp.groups = this.getItems(item, "EC2SecurityGroups", "EC2SecurityGroup", ["EC2SecurityGroupName","EC2SecurityGroupOwnerId","Status"]);
        grp.ipRanges = this.getItems(item, "IPRanges", "IPRange", ["CIDRIP","Status"]);
        return grp;
    },

    unpackDBInstance: function(item)
    {
        var obj = new Element();
        obj.toString = function() {
            return this.name + fieldSeparator + this.id + fieldSeparator + this.engine + "/" + this.version;
        }

        obj.id = getNodeValue(item, "DBInstanceIdentifier");
        obj.name = getNodeValue(item, "DBName");
        obj.engine = getNodeValue(item, "Engine");
        obj.version = getNodeValue(item, "EngineVersion");
        obj.host = getNodeValue(item, "Endpoint", "Address");
        obj.port = getNodeValue(item, "Endpoint", "Port");
        setNodeValue(obj, item, "MasterUsername");
        obj.instanceClass = getNodeValue(item, "DBInstanceClass");
        obj.status = getNodeValue(item, "DBInstanceStatus");
        setNodeValue(obj, item, "AvailabilityZone");
        setNodeValue(obj, item, "AllocatedStorage");
        setNodeValue(obj, item, "InstanceCreateTime");
        setNodeValue(obj, item, "LicenseModel");
        setNodeValue(obj, item, "AutoMinorVersionUpgrade");
        setNodeValue(obj, item, "BackupRetentionPeriod");
        setNodeValue(obj, item, "CharacterSetName");
        setNodeValue(obj, item, "LatestRestorableTime");
        setNodeValue(obj, item, "MultiAZ");
        setNodeValue(obj, item, "Iops");
        setNodeValue(obj, item, "PreferredBackupWindow");
        setNodeValue(obj, item, "PreferredMaintenanceWindow");
        setNodeValue(obj, item, "ReadReplicaDBInstanceIdentifiers");
        setNodeValue(obj, item, "ReadReplicaSourceDBInstanceIdentifier");
        setNodeValue(obj, item, "OptionGroupMembership", "Status");
        setNodeValue(obj, item, "OptionGroupMembership", "OptionGroupName");
        obj.pendingModifiedValues = this.getItems(item, "PendingModifiedValues", null, null, function(obj) { return obj.tagName && obj.firstChild ? new Element('name',obj.tagName, 'value',obj.firstChild.nodeValue) : null; });
        obj.securityGroups = this.getItems(item, "DBSecurityGroups", "DBSecurityGroup", ["DBSecurityGroupName"], function(obj) { return obj.DBSecurityGroupName; })
        obj.parameterGroups = this.getItems(item, "DBParameterGroups", "DBParameterGroup", ["ParameterApplyStatus","DBParameterGroupName"], function(obj) { return new Element('name',obj.DBParameterGroupName,'value',obj.ParameterApplyStatus)});
        obj.subnetGroupName = this.unpackDBSubnetGroup(item.getElementsByTagName("DBSubnetGroup")[0])
        return obj;
    },

    describeDBInstances : function(callback)
    {
        this.queryRDS("DescribeDBInstances", [], this, false, "onCompleteDescribeDBInstances", callback);
    },

    onCompleteDescribeDBInstances : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBInstances", "DBInstance");
        for (var i = 0; i < items.length; i++) {
            list.push(this.unpackDBInstance(items[i]));
        }
        return this.getNext(response, this.queryRDS, list);
    },

    deleteDBInstance : function(id, snapshotId, callback)
    {
        var params = [ [ "DBInstanceIdentifier", id ]];
        if (snapshotId) {
            params.push([ "FinalDBSnapshotIdentifier", snapshotId]);
            params.push([ "SkipFinalSnapshot", false]);
        } else {
            params.push([ "SkipFinalSnapshot", true]);
        }

        this.queryRDS("DeleteDBInstance", params, this, false, "onComplete", callback);
    },

    createDBInstance : function(id, Engine, DBInstanceClass, AllocatedStorage, MasterUserName, MasterUserPassword, options, callback)
    {
        var params = []
        params.push([ "DBInstanceIdentifier", id ]);
        params.push([ "Engine", Engine ]);
        params.push([ "DBInstanceClass", DBInstanceClass ]);
        params.push([ "AllocatedStorage", AllocatedStorage ]);
        params.push([ "MasterUsername", MasterUserName])
        params.push([ "MasterUserPassword", MasterUserPassword])

        debug(JSON.stringify(options))

        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.AvailabilityZone) {
            params.push([ "AvailabilityZone", options.AvailabilityZone ]);
        }
        if (options.BackupRetentionPeriod) {
            params.push([ "BackupRetentionPeriod", options.BackupRetentionPeriod ]);
        }
        if (options.CharacterSetName) {
            params.push([ "CharacterSetName", options.CharacterSetName ]);
        }
        if (options.DBName) {
            params.push(["DBName", options.DBName])
        }
        if (options.IOPS) {
            params.push(["Iops", options.IOPS])
        }
        if (options.DBParameterGroupName) {
            params.push([ "DBParameterGroupName", options.DBParameterGroupName ]);
        }
        if (options.DBSecurityGroups) {
            for (var i = 0; i < options.DBSecurityGroups.length; i++) {
                params.push([ "DBSecurityGroups.member." + (i+1), typeof options.DBSecurityGroups[i] == "object" ? options.DBSecurityGroups[i].name : options.DBSecurityGroups[i] ]);
            }
        }
        if (options.DBSubnetGroupName) {
            params.push([ "DBSubnetGroupName", options.DBSubnetGroupName])
        }
        if (options.EngineVersion) {
            params.push([ "EngineVersion", options.EngineVersion]);
        }
        if (options.LicenseModel) {
            params.push([ "LicenseModel", options.LicenseModel]);
        }
        if (options.MultiAZ) {
            params.push([ "MultiAZ", "true"]);
        }
        if (options.OptionGroupName) {
            params.push([ "OptionGroupName", options.OptionGroupName ]);
        }
        if (options.Port) {
            params.push([ "Port", options.Port ]);
        }
        if (options.PreferredBackupWindow) {
            params.push([ 'PreferredBackupWindow', options.PreferredBackupWindow ]);
        }
        if (options.PreferredMaintenanceWindow) {
            params.push([ 'PreferredMaintenanceWindow', options.PreferredMaintenanceWindow ]);
        }
        this.queryRDS("CreateDBInstance", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    onCompleteCreateDBInstance : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackDBInstance(xmlDoc);
    },

    modifyDBInstance : function(id, options, callback)
    {
        var params = []
        params.push([ "DBInstanceIdentifier", id ]);

        if (options.AllocatedStorage) {
            params.push([ "AllocatedStorage", options.AllocatedStorage ]);
        }
        if (options.AllowMajorVersionUpgrade) {
            params.push([ "AllowMajorVersionUpgrade", options.AllowMajorVersionUpgrade ]);
        }
        if (options.ApplyImmediately) {
            params.push([ "ApplyImmediately", "true" ]);
        }
        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.DBInstanceClass) {
            params.push([ "DBInstanceClass", options.DBInstanceClass ]);
        }
        if (options.BackupRetentionPeriod) {
            params.push([ "BackupRetentionPeriod", options.BackupRetentionPeriod ]);
        }
        if (options.MasterUserPassword) {
            params.push([ "MasterUserPassword", options.MasterUserPassword ]);
        }
        if (options.MultiAZ) {
            params.push(["MultiAZ", options.MultiAZ])
        }
        if (options.DBParameterGroupName) {
            params.push([ "DBParameterGroupName", options.DBParameterGroupName ]);
        }
        for (var i in options.DBSecurityGroups) {
            params.push([ "DBSecurityGroups." + parseInt(i), typeof options.DBSecurityGroups[i] == "object" ? options.DBSecurityGroups[i].id : options.DBSecurityGroups[i] ]);
        }
        if (options.DBSubnetGroupName) {
            params.push([ "DBSubnetGroupName", options.DBSubnetGroupName])
        }
        if (options.EngineVersion) {
            params.push([ "EngineVersion", options.EngineVersion]);
        }
        if (options.OptionGroupName) {
            params.push([ "OptionGroupName", options.OptionGroupName ]);
        }
        if (options.PreferredBackupWindow) {
            params.push([ 'PreferredBackupWindow', options.PreferredBackupWindow ]);
        }
        if (options.PreferredMaintenanceWindow) {
            params.push([ 'PreferredMaintenanceWindow', options.PreferredMaintenanceWindow ]);
        }
        this.queryRDS("ModifyDBInstance", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    restoreDBInstanceFromDBSnapshot : function(id, snapshotId, options, callback)
    {
        var params = []
        params.push([ "DBInstanceIdentifier", id ]);
        params.push([ "DBSnapshotIdentifier", snapshotId ]);

        if (options.AvailabilityZone) {
            params.push([ "AvailabilityZone", options.AvailabilityZone ]);
        }
        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.DBInstanceClass) {
            params.push([ "DBInstanceClass", options.DBInstanceClass ]);
        }
        if (options.DBName) {
            params.push([ "DBName", options.DBName ]);
        }
        if (options.DBSubnetGroupName) {
            params.push([ "DBSubnetGroupName", options.DBSubnetGroupName])
        }
        if (options.Engine) {
            params.push([ "Engine", options.Engine]);
        }
        if (options.OptionGroupName) {
            params.push([ "OptionGroupName", options.OptionGroupName ]);
        }
        if (options.LicenseModel) {
            params.push([ 'LicenseModel', options.LicenseModel ]);
        }
        if (options.MultiAZ) {
            params.push(["MultiAZ", options.MultiAZ])
        }
        if (options.Port) {
            params.push([ "Port", options.Port ]);
        }
        this.queryRDS("RestoreDBInstanceFromDBSnapshot", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    restoreDBInstanceToPointInTime : function(sourceId, targetId, options, callback)
    {
        var params = []
        params.push([ "SourceDBInstanceIdentifier", sourceId ]);
        params.push([ "TargetDBInstanceIdentifier", targetId ]);

        if (options.AvailabilityZone) {
            params.push([ "AvailabilityZone", options.AvailabilityZone ]);
        }
        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.DBInstanceClass) {
            params.push([ "DBInstanceClass", options.DBInstanceClass ]);
        }
        if (options.DBName) {
            params.push([ "DBName", options.DBName ]);
        }
        if (options.DBSubnetGroupName) {
            params.push([ "DBSubnetGroupName", options.DBSubnetGroupName])
        }
        if (options.Engine) {
            params.push([ "Engine", options.Engine]);
        }
        if (options.OptionGroupName) {
            params.push([ "OptionGroupName", options.OptionGroupName ]);
        }
        if (options.LicenseModel) {
            params.push([ 'LicenseModel', options.LicenseModel ]);
        }
        if (options.MultiAZ) {
            params.push(["MultiAZ", options.MultiAZ])
        }
        if (options.Port) {
            params.push([ "Port", options.Port ]);
        }
        if (options.RestoreTime) {
            params.push([ "RestoreTime", options.RestoreTime])
        }
        if (options.UseLatestRestorableTime) {
            params.pus(["UseLatestRestorableTime", options.UseLatestRestorableTime])
        }
        this.queryRDS("RestoreDBInstanceToPointInTime", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    createDBInstanceReadReplica : function(id, sourceId, options, callback)
    {
        var params = []
        params.push([ "SourceDBInstanceIdentifier", sourceId ]);
        params.push([ "DBInstanceIdentifier", id ]);

        if (options.AvailabilityZone) {
            params.push([ "AvailabilityZone", options.AvailabilityZone ]);
        }
        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.DBInstanceClass) {
            params.push([ "DBInstanceClass", options.DBInstanceClass ]);
        }
        if (options.OptionGroupName) {
            params.push([ "OptionGroupName", options.OptionGroupName ]);
        }
        if (options.Port) {
            params.push([ "Port", options.Port ]);
        }
        this.queryRDS("CreateDBInstanceReadReplica", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    rebootDBInstance: function(id, ForceFailover, callback)
    {
        var params = [];
        params.push(["DBInstanceIdentifier", id])
        if (ForceFailover) params.push(["ForceFailover", "true"])
        this.queryRDS("RebootDBInstance", params, this, false, "onCompleteCreateDBInstance", callback);
    },

    describeDBEngineVersions: function(callback)
    {
        var params = [ ["ListSupportedCharacterSets", "true" ]];
        this.queryRDS("DescribeDBEngineVersions", params, this, false, "onCompleteDescribeDBEngineVersions", callback);
    },

    onCompleteDescribeDBEngineVersions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBEngineVersions", "DBEngineVersion");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + "/" + this.version + " " + this.versionDescr + " " + (this.descr ? "/" + this.descr : "");
            }

            obj.family = getNodeValue(items[i], "DBParameterGroupFamily");
            obj.descr = getNodeValue(items[i], "DBEngineDescription");
            obj.versionDescr = getNodeValue(items[i], "DBEngineVersionDescription");
            obj.name = getNodeValue(items[i], "Engine");
            obj.version = getNodeValue(items[i], "EngineVersion");
            obj.charsets = this.getItems(items[i], "CharacterSet", "CharacterSetName", "");
            list.push(obj)
        }
        return this.getNext(response, this.queryRDS, list);
    },

    createDBParameterGroup: function(family, name, descr, callback)
    {
        var params = [];
        params.push(["DBParameterGroupFamily", family])
        params.push(["DBParameterGroupName", name])
        params.push(["Description", descr])
        this.queryRDS("CreateDBParameterGroup", params, this, false, "onComplete", callback);
    },

    deleteDBParameterGroup: function(name, callback)
    {
        var params = [];
        params.push(["DBParameterGroupName", name])
        this.queryRDS("DeleteDBParameterGroup", params, this, false, "onComplete", callback);
    },

    describeDBParameterGroups: function(callback)
    {
        this.queryRDS("DescribeDBParameterGroups", [], this, false, "onCompleteDescribeDBParameterGroups", callback);
    },

    onCompleteDescribeDBParameterGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "DBParameterGroups", "DBParameterGroup", ["DBParameterGroupFamily","Description","DBParameterGroupName"], function(o) {
            var obj = new Element('name',o.DBParameterGroupName,'descr',o.Description,'family',o.DBParameterGroupFamily)
            obj.toString = function() { return this.name }
            return obj;
        });
        this.core.setModel('dbparameters', list);
        response.result = list;
    },

    describeDBParameters: function(name, callback)
    {
        this.queryRDS("DescribeDBParameters", [ [ "DBParameterGroupName", name]], this, false, "onCompleteDescribeDBParameters", callback);
    },

    describeEngineDefaultParameters: function(family, callback)
    {
        return this.queryRDS("DescribeEngineDefaultParameters", [ [ "DBParameterGroupFamily", family]], this, callback ? false : true, "onCompleteDescribeDBParameters", callback);
    },

    onCompleteDescribeDBParameters: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "Parameters", "Parameter");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element()
            obj.toString = function() {
                return this.name + fieldSeparator + this.value + fieldSeparator + this.type
            }

            obj.name = getNodeValue(items[i], "ParameterName")
            obj.value = getNodeValue(items[i], "ParameterValue")
            obj.type = getNodeValue(items[i], "DataType")
            obj.descr = getNodeValue(items[i], "Description")
            obj.minVersion = getNodeValue(items[i], "MinimumEngineVersion")
            obj.isModifiable = toBool(getNodeValue(items[i], "IsModifiable"))
            obj.applyType = getNodeValue(items[i], "ApplyType")
            obj.applyMethod = getNodeValue(items[i], "ApplyMethod")
            obj.allowedValues = getNodeValue(items[i], "AllowedValues")
            obj.source = getNodeValue(items[i], "Source")
            list.push(obj)
        }
        return this.getNext(response, this.queryRDS, list);
    },

    modifyDBParameterGroup: function(name, options, callback)
    {
        var params =  [ [ "DBParameterGroupName", name]];
        for (var i  = 0; i < options.length; i++) {
            params.push(["Parameters.member." + (i + 1) + ".ParameterName", options[i].name]);
            params.push(["Parameters.member." + (i + 1) + ".ParameterValue", options[i].value]);
            params.push(["Parameters.member." + (i + 1) + ".ApplyMethod", options[i].applyMethod]);
        }

        this.queryRDS("ModifyDBParameterGroup", params, this, false, "onComplete", callback);
    },

    resetDBParameterGroup: function(name, resetAll, options, callback)
    {
        var params =  [ [ "DBParameterGroupName", name]];
        if (resetAll) params.push(["ResetAllParameters", "true"])
        for (var i  = 0; i < options.length; i++) {
            params.push(["Parameters.member." + i + ".ParameterName", options[i].name]);
            params.push(["Parameters.member." + i + ".ApplyMethod", options[i].applyMethod]);
        }

        this.queryRDS("ResetDBParameterGroup", params, this, false, "onComplete", callback);
    },

    describeDBEvents: function(callback)
    {
        var now = new Date();
        var params = [];
        params.push([ 'StartTime', (new Date(now.getTime() - 86400*13000)).toISOString()])
        this.queryRDS("DescribeEvents", params, this, false, "onCompleteDescribeEvents", callback);
    },

    onCompleteDescribeEvents: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = this.getItems(xmlDoc, "Events", "Event", ["SourceIdentifier","SourceType","Date","Message"], function(o) {
            return new Element('id',o.SourceIdentifier,'type',o.SourceType,'date',o.Date,'msg',o.Message)
        });
        return this.getNext(response, this.queryRDS, list);
    },

    describeDBSnapshots: function(callback)
    {
        return this.queryRDS("DescribeDBSnapshots", [], this, callback ? false : true, "onCompleteDescribeDBSnapshots", callback);
    },

    onCompleteDescribeDBSnapshots: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBSnapshots", "DBSnapshot");
        for (var i = 0; i < items.length; i++) {
            var snap = new Element();
            snap.toString = function() {
                return this.dbInstanceId + fieldSeparator + this.engine + "/" + this.version;
            }
            snap.id = getNodeValue(items[i], "DBSnapshotIdentifier")
            snap.dbInstanceId = getNodeValue(items[i], "DBInstanceIdentifier")
            snap.type = getNodeValue(items[i], "DBSnapshotType")
            snap.userName = getNodeValue(items[i], "MasterUsername")
            snap.version = getNodeValue(items[i], "EngineVersion")
            snap.allocatedStorage = getNodeValue(items[i], "AllocatedStorage")
            snap.createTime = new Date(getNodeValue(items[i], "InstanceCreateTime"))
            snap.licenseModel = getNodeValue(items[i], "LicenseModel")
            snap.availabilityZone = getNodeValue(items[i], "AvailabilityZone")
            snap.status = getNodeValue(items[i], "Status")
            snap.engine = getNodeValue(items[i], "Engine")
            snap.port = getNodeValue(items[i], "Port")
            snap.snapshotTime = new Date(getNodeValue(items[i], "SnapshotCreateTime"))
            list.push(snap);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    createDBSnapshot: function(db, snapshot, callback)
    {
        var params = [ ["DBInstanceIdentifier", db]];
        params.push([ "DBSnapshotIdentifier", snapshot]);
        this.queryRDS("CreateDBSnapshot", params, this, false, "onComplete:DBSnapshotIdentifier", callback);
    },

    deleteDBSnapshot: function(snapshot, callback)
    {
        this.queryRDS("DeleteDBSnapshot", [ ["DBSnapshotIdentifier", snapshot]], this, false, "onComplete", callback);
    },

    createDBSubnetGroup: function(name, descr, subnets, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        params.push([ "DBSubnetGroupDescription", descr]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["SubnetIds.member." + (i+1), typeof subnets[i] == "object" ? subnets[i].id : subnets[i]])
        }
        this.queryRDS("CreateDBSubnetGroup", params, this, false, "onComplete", callback);
    },

    modifyDBSubnetGroup: function(name, descr, subnets, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        if (descr) params.push([ "DBSubnetGroupDescription", descr]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["SubnetIds.member." + (i+1), typeof subnets[i] == "object" ? subnets[i].id : subnets[i]])
        }
        this.queryRDS("ModifyDBSubnetGroup", params, this, false, "onComplete", callback);
    },

    deleteDBSubnetGroup: function(name, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        this.queryRDS("DeleteDBSubnetGroup", params, this, false, "onComplete", callback);
    },

    describeDBSubnetGroups: function(callback)
    {
        this.queryRDS("DescribeDBSubnetGroups", [], this, false, "onCompleteDescribeDBSubnetGroups", callback);
    },

    onCompleteDescribeDBSubnetGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBSubnetGroups", "DBSubnetGroup");
        for (var i = 0; i < items.length; i++) {
            list.push(this.unpackDBSubnetGroup(items[i]));
        }
        return this.getNext(response, this.queryRDS, list);
    },

    describeDBSecurityGroups: function(callback)
    {
        this.queryRDS("DescribeDBSecurityGroups", [], this, false, "onCompleteDescribeDBSecurityGroups", callback);
    },

    onCompleteDescribeDBSecurityGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBSecurityGroups", "DBSecurityGroup");
        for (var i = 0; i < items.length; i++) {
            list.push(this.unpackDBSecurityGroup(items[i]));
        }
        return this.getNext(response, this.queryRDS, list);
    },

    createDBSecurityGroup: function(name, descr, vpc, callback)
    {
        var params = [ ["DBSecurityGroupName", name]];
        params.push([ "DBSecurityGroupDescription", descr]);
        if (vpc) params.push([ "EC2VpcId", vpc]);
        this.queryRDS("CreateDBSecurityGroup", params, this, false, "onComplete", callback);
    },

    deleteDBSecurityGroup: function(name, callback)
    {
        var params = [ ["DBSecurityGroupName", name]];
        this.queryRDS("DeleteDBSecurityGroup", params, this, false, "onComplete", callback);
    },

    authorizeDBSecurityGroupIngress: function(name, group, cidr, callback)
    {
        var params = [ ["DBSecurityGroupName", name]];
        if (cidr) {
            params.push([ "CIDRIP", cidr]);
        } else
        if (group) {
            if (group.id) params.push(["EC2SecurityGroupId", group.id]); else
            if (group.name) params.push(["EC2SecurityGroupName", group.name])
            if (group.ownerId) params.push(["EC2SecurityGroupOwnerId", group.ownerId])
        }
        this.queryRDS("AuthorizeDBSecurityGroupIngress", params, this, false, "onComplete", callback);
    },

    revokeDBSecurityGroupIngress: function(name, group, cidr, callback)
    {
        var params = [ ["DBSecurityGroupName", name]];
        if (cidr) {
            params.push([ "CIDRIP", cidr]);
        } else
        if (group) {
            if (group.id) params.push(["EC2SecurityGroupId", group.id]); else
            if (group.name) params.push(["EC2SecurityGroupName", group.name])
            if (group.ownerId) params.push(["EC2SecurityGroupOwnerId", group.ownerId])
        }
        this.queryRDS("RevokeDBSecurityGroupIngress", params, this, false, "onComplete", callback);
    },

    describeOptionGroupOptions: function(engine, callback)
    {
        this.queryRDS("DescribeOptionGroupOptions", [["EngineName", engine]], this, false, "onCompleteDescribeOptionGroupOptions", callback);
    },

    onCompleteDescribeOptionGroupOptions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "OptionGroupOptions", "OptionGroupOption");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.descr + fieldSeparator +
                        this.majorEngineVersion + "/" + this.minimumRequiredMinorEngineVersion +
                        (this.portRequired ? fieldSeparator + "Port Required" : "") +
                        (this.dependsOn ? fieldSeparator + "Depends " + this.dependsOn : "");
            }

            obj.name = getNodeValue(items[i], "Name");
            obj.engine = getNodeValue(items[i], "EngineName");
            obj.majorEngineVersion = getNodeValue(items[i], "MajorEngineVersion");
            obj.defaultPort = getNodeValue(items[i], "DefaultPort");
            obj.descr = getNodeValue(items[i], "Description");
            obj.portRequired = toBool(getNodeValue(items[i], "PortRequired"));
            obj.minimumRequiredMinorEngineVersion = getNodeValue(items[i], "MinimumRequiredMinorEngineVersion");
            obj.dependsOn = getNodeValue(items[i], "OptionsDependedOns");
            list.push(obj);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    createOptionGroup: function(name, descr, engine, version, callback)
    {
        var params = [];
        params.push(["OptionGroupDescription", descr])
        params.push(["OptionGroupName", name])
        params.push(["EngineName", engine])
        params.push(["MajorEngineVersion", version]);
        this.queryRDS("CreateOptionGroup", params, this, false, "onComplete", callback);
    },

    deleteOptionGroup: function(name, callback)
    {
        var params = [];
        params.push(["OptionGroupName", name])
        this.queryRDS("DeleteOptionGroup", params, this, false, "onComplete", callback);
    },

    modifyOptionGroup: function(name, now, include, remove, callback)
    {
        var params = [ ["OptionGroupName", name]];
        params.push([ "ApplyImmediately", toBool(now)]);
        for (var i = 0; i < include.length; i++) {
            if (typeof include[i] == "object") {
                params.push(["OptionsToInclude.member." + (i + 1) + ".OptionName", include[i].name])
                if (include[i].port) params.push(["OptionsToInclude.member." + (i + 1) + ".Port", include[i].port])
                if (include[i].groups) {
                    for (var j = 0; j < include[i].groups.length; j++) {
                        params.push(["OptionsToInclude.member." + (i + 1) + ".DBSecurityGroupMemberships.member." + (j + 1), include[i].groups[j]])
                    }
                }
            } else {
                params.push(["OptionsToInclude.member." + (i + 1) + ".OptionName", include[i]])
            }
        }
        for (var i = 0; i < remove.length; i++) {
            params.push(["OptionsToRemove.member." + (i + 1), remove[i]])
        }
        this.queryRDS("ModifyOptionGroup", params, this, false, "onComplete", callback);
    },

    describeOptionGroups: function(callback)
    {
        this.queryRDS("DescribeOptionGroups", [], this, false, "onCompleteDescribeOptionGroups", callback);
    },

    onCompleteDescribeOptionGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "OptionGroupsList", "OptionGroup");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.engine + "/" + this.version + " (" + this.options + ")";
            }

            obj.name = getNodeValue(items[i], "OptionGroupName");
            obj.engine = getNodeValue(items[i], "EngineName");
            obj.version = getNodeValue(items[i], "MajorEngineVersion");
            obj.descr = getNodeValue(items[i], "OptionGroupDescription");
            obj.options = [];
            var olist = this.getItems(items[i], "Options", "Option");
            for (var j = 0; j < olist.length; j++) {
                var o = new Element();
                o.toString = function() {
                    return this.name + fieldSeparator + this.descr + fieldSeparator + this.groups;
                }
                o.oname = getNodeValue(olist[j], "OptionName");
                o.descr = getNodeValue(olist[j], "OptionDescription");
                o.port = getNodeValue(olist[j], "Port");
                o.groups = this.getItems(olist[j], "DBSecurityGroupMemberships", "DBSecurityGroup", []);
                obj.options.push(o);
            }
            list.push(obj);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    describeOrderableDBInstanceOptions: function(engine, callback)
    {
        return this.queryRDS("DescribeOrderableDBInstanceOptions", [ ["Engine", engine]], this, callback ? false : true, "onCompleteDescribeOrderableDBInstanceOptions", callback);
    },

    onCompleteDescribeOrderableDBInstanceOptions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "OrderableDBInstanceOptions", "OrderableDBInstanceOption");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            function DBOrderableOption(dbclass, engine, ver, license, maz, replica, vpc, vpcmaz, vpcreplica, azones)
            {
                this.instanceClass = dbclass
                this.engine = engine
                this.version = ver
                this.licenseModel = license
                this.multiAZCapable = maz
                this.readReplicaCapable = replica
                this.vpcCapable = vpc
                this.vpcMultiAZCapable = vpcmaz
                this.vpcReadReplicaCapable = vpcreplica
                this.availabilityZones = azones
                this.toString = function() {
                    return this.instanceClass + fieldSeparator + this.engine + "/" + this.version + fieldSeparator +
                                      (this.vpcCapable ? "VPC" : "") + " " +
                                      (this.multiAZCapable ? "MultiAZ" : "") + " " +
                                      (this.vpcMultiAZCapable ? "VPCMultiAZ" : "" ) + " " +
                                      (this.readReplicaCapable ? " Replica" : "") + " " +
                                      (this.vpcReadReplicaCapable ? " VPCReplica" : "") + fieldSeparator +
                                      this.availabilityZones;
                }
            }

            obj.instanceClass = getNodeValue(items[i], "DBInstanceClass");
            obj.engine = getNodeValue(items[i], "Engine");
            obj.version = getNodeValue(items[i], "EngineVersion");
            obj.licenseModel = getNodeValue(items[i], "LicenseModel");
            obj.multiAZCapable = toBool(getNodeValue(items[i], "MultiAZCapable"));
            obj.readReplicaCapable = toBool(getNodeValue(items[i], "ReadReplicaCapable"));
            obj.vpcCapable = toBool(getNodeValue(items[i], "VpcCapable"));
            obj.vpcMultiAZCapable = toBool(getNodeValue(items[i], "VpcMultiAZCapable"));
            obj.vpcReadReplicaCapable = toBool(getNodeValue(items[i], "VpcReadReplicaCapable"));
            obj.availabilityZones = this.getItems(items[i], "AvailabilityZones", "AvailabilityZone", ["Name"], function(o) {return o.Name;});
            list.push(obj);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    describeReservedDBInstancesOfferings : function(callback)
    {
        this.queryRDS("DescribeReservedDBInstancesOfferings", [], this, false, "onCompleteDescribeReservedDBInstancesOfferings", callback);
    },

    onCompleteDescribeReservedDBInstancesOfferings : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "ReservedDBInstancesOfferings", "ReservedDBInstancesOffering");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.id
            }
            var item = items[i];
            obj.id = getNodeValue(item, "ReservedDBInstancesOfferingId");
            obj.dbInstanceClass = getNodeValue(item, "DBInstanceClass");
            obj.multiAZ = toBool(getNodeValue(item, "MultiAZ"));
            obj.duration = secondsToYears(getNodeValue(item, "Duration"));
            obj.fixedPrice = parseInt(getNodeValue(item, "FixedPrice")).toString();
            obj.usagePrice = getNodeValue(item, "UsagePrice");
            obj.productDescription = getNodeValue(item, "ProductDescription");
            obj.offeringType = getNodeValue(item, "OfferingType");
            obj.recurringPrices = this.getItems(item, "RecurringCharges", "RecurringCharge", []);
            list.push(obj);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    describeReservedDBInstances : function(callback)
    {
        this.queryRDS("DescribeReservedDBInstances", [], this, false, "onCompleteDescribeDBReservedInstances", callback);
    },

    onCompleteDescribeDBReservedInstances : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "ReservedDBInstances", "ReservedDBInstance");
        for ( var i = 0; i < items.length; i++) {
            var obj = new Element()
            function DBReservedInstance(id, type, az, start, duration, fPrice, uPrice, rPrices, count, desc, state, otype, oid)
            {
                this.id = id;
                this.dbInstanceClass = type;
                this.multiAZ = az;
                this.startTime = start;
                this.duration = duration;
                this.fixedPrice = fPrice;
                this.usagePrice = uPrice;
                this.recurringCharges = rPrices;
                this.count = count;
                this.productDescription = desc;
                this.state = state;
                this.offeringType = otype
                this.offeringId = oid

                this.toString = function() {
                    return this.dbInstanceClass  + fieldSeparator + this.fixedPrice + fieldSeparator +  this.recurringCharges + fieldSeparator + this.id;
                }
            }

            var item = items[i];
            obj.id = getNodeValue(item, "ReservedDBInstanceId");
            obj.type = getNodeValue(item, "DBInstanceClass");
            obj.multiAZ = toBool(getNodeValue(item, "MultiAZ"));
            obj.startTime = new Date(getNodeValue(item, "StartTime"));
            obj.duration = secondsToYears(getNodeValue(item, "Duration"));
            obj.fixedPrice = parseInt(getNodeValue(item, "FixedPrice")).toString();
            obj.usagePrice = getNodeValue(item, "UsagePrice");
            obj.count = getNodeValue(item, "DBInstanceClass");
            obj.desc = getNodeValue(item, "ProductDescription");
            obj.state = getNodeValue(item, "State");
            obj.offeringType = getNodeValue(item, "OfferingType");
            obj.offeringId = getNodeValue(item, "ReservedDBInstancesOfferingId");
            obj.recurringPrices = this.getItems(item, "RecurringCharges", "RecurringCharge", []);
            list.push(obj);
        }
        return this.getNext(response, this.queryRDS, list);
    },

    purchaseReservedDBInstancesOffering : function(id, count, callback)
    {
        this.queryRDS("PurchaseReservedDBInstancesOffering", [ [ "ReservedDBInstancesOfferingId", id ], [ "DBInstanceCount", count ] ], this, false, "onComplete", callback);
    },

    unpackHostedZone: function(item)
    {
        if (!item) return null;
        var obj = new Element()
        obj.toString = function() {
            return this.name + fieldSeparator + this.count;
        }

        obj.id = getNodeValue(item, "Id");
        obj.name = getNodeValue(item, "Name")
        obj.reference = getNodeValue(item, "CallerReference")
        obj.count = getNodeValue(item, "ResourceRecordSetCount");
        obj.comment = getNodeValue(item, "Config", "Comment");
        return obj;
    },

    listHostedZones: function(callback)
    {
        this.queryRoute53("GET", "hostedzone", null, {}, this, false, "onCompleteListHostedZones", callback);
    },

    onCompleteListHostedZones : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "HostedZones", "HostedZone");
        for (var i = 0; i < items.length; i++) {
            list.push(this.unpackHostedZone(items[i]));
        }

        this.core.setModel('hostedZones', list);
        response.result = list;
    },

    getHostedZone: function(id, callback)
    {
        this.queryRoute53("GET", id, null, {}, this, false, "onCompleteGetHostedZone", callback);
    },

    onCompleteGetHostedZone : function(response)
    {
        var xmlDoc = response.responseXML;
        var obj = this.unpackHostedZone(xmlDoc.getElementsByTagName('HostedZone')[0]);
        obj.nameServers = this.getItems(xmlDoc, "DelegationSet", "NameServers", [ "NameServer" ], function(obj) { return obj.NameServer; });
        response.result = obj;
    },

    deleteHostedZone: function(id, callback)
    {
        this.queryRoute53("DELETE", id, null, {}, this, false, "onComplete", callback);
    },

    createHostedZone: function(name, ref, comment, callback)
    {
        var content = '<?xml version="1.0" encoding="UTF-8"?>\n<CreateHostedZoneRequest xmlns="https://route53.amazonaws.com/doc/2012-02-29/">' +
                      '<Name>' + name + '</Name>' +
                      '<CallerReference>' + ref + '</CallerReference>' +
                      '<HostedZoneConfig><Comment>' + (comment || "") + '</Comment></HostedZoneConfig>' +
                      '</CreateHostedZoneRequest>\n';

        this.queryRoute53("POST", 'hostedzone', content, {}, this, false, "onCompleteCreateHostedZone", callback);
    },

    onCompleteCreateHostedZone : function(response)
    {
        var xmlDoc = response.responseXML;
        var obj = this.unpackHostedZone(xmlDoc.getElementsByTagName('HostedZone')[0]);
        obj.nameServers = this.getItems(xmlDoc, "DelegationSet", "NameServers", [ "NameServer" ], function(obj) { return obj.NameServer; });
        obj.requestId = getNodeValue(xmlDoc, 'ChangeInfo', 'Id');
        obj.status = getNodeValue(xmlDoc, 'ChangeInfo', 'Status');
        obj.submitted = getNodeValue(xmlDoc, 'ChangeInfo', 'SubmittedAt');
        this.core.replaceModel('hostedChanges', obj)
        response.result = obj;
    },

    listResourceRecordSets: function(id, callback)
    {
        this.queryRoute53("GET", id + '/rrset', null, {}, this, false, "onCompleteListResourceRecordSets", callback);
    },

    onCompleteListResourceRecordSets : function(response)
    {
        var id = response.action.match(/(\/hostedzone\/[^\/]+)\//)[1];
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ResourceRecordSets", "ResourceRecordSet");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.type + fieldSeparator + this.values;
            }

            obj.type = getNodeValue(items[i], "Type");
            obj.name = getNodeValue(items[i], "Name")
            obj.ttl = getNodeValue(items[i], "TTL")
            obj.hostedZone = getNodeValue(items[i], "AliasTarget", "HostedZoneId");
            obj.dnsName = getNodeValue(items[i], "AliasTarget", "DNSName");
            obj.setId = getNodeValue(items[i], "SetIdentifier");
            obj.weight = getNodeValue(items[i], "Weight");
            obj.region = getNodeValue(items[i], "Region");
            obj.values = this.getItems(items[i], "ResourceRecords", "ResourceRecord", ["Value"], function(o) { return o.Value; })
            list.push(obj);
        }

        this.core.updateModel('hostedZones', id, 'records', list);
        response.result = list;
    },

    changeResourceRecordSets: function(action, id, rec, callback)
    {
        var contents = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                       '<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/' + this.versions.R53 + '/">\n' +
                       ' <ChangeBatch>\n' +
                       '  <Comment>' + (rec.comment || "") + '</Comment>\n' +
                       '   <Changes>\n' +
                       '    <Change>\n' +
                       '     <Action>' + action + '</Action>\n' +
                       '     <ResourceRecordSet>\n' +
                       '      <Name>' + rec.name + '</Name>\n' +
                       '      <Type>' + rec.type + '</Type>\n';

        if (rec.ttl > 0) {
            contents += '      <TTL>' + rec.ttl + '</TTL>\n';
        }
        if (rec.weight > 0) {
            contents += '      <Weight>' + rec.weight + '</Weight>\n';
        }
        if (rec.setId) {
            contents += '      <SetIdentifier>' + rec.setId + '</SetIdentifier>\n';
        }
        if (rec.region) {
            contents += '      <Region>' + rec.region + '</Region>\n';
        }
        if (rec.hostedZoneId && rec.dnsName) {
            contents += '      <AliasTarget>\n';
            contents += '       <HostedZoneId>' + rec.hostedZoneId + '</HostedZoneId>\n';
            contents += '       <DNSName>' + rec.dnsName + '</DNSName>\n';
            contents += '      </AliasTarget>\n';
        }

        if (rec.values.length) {
            contents += '      <ResourceRecords>\n' +
                        '       <ResourceRecord>\n';
            for (var i = 0; i < rec.values.length; i++) {
                if (rec.values[i] == "") continue;
                contents += '        <Value>' + rec.values[i] + '</Value>\n';
            }
            contents += '       </ResourceRecord>\n' +
                        '      </ResourceRecords>\n';
        }

        contents += '     </ResourceRecordSet>\n' +
                    '    </Change>\n' +
                    '   </Changes>\n' +
                    '  </ChangeBatch>\n' +
                    '</ChangeResourceRecordSetsRequest>\n';

        debug(contents)
        this.queryRoute53("POST", id + '/rrset', contents, {}, this, false, "onCompleteChangeResourceRecordSets", callback);
    },

    getChange: function(id, callback)
    {
        this.queryRoute53("GET", 'change/' + id, null, {}, this, false, "onCompleteListResourceRecordSets", callback);
    },

    onCompleteChangeResourceRecordSets: function(response)
    {
        var xmlDoc = response.responseXML;
        var obj = {}
        obj.id = getNodeValue(xmlDoc, "ChangeInfo", "Id");
        obj.status = getNodeValue(xmlDoc, 'ChangeInfo', 'Status');
        obj.submitted = getNodeValue(xmlDoc, 'ChangeInfo', 'SubmittedAt');
        this.core.replaceModel('hostedChanges', obj)
        response.result = obj;
    },

    describeAutoScalingGroups: function(callback)
    {
        this.queryAS("DescribeAutoScalingGroups", [], this, false, "onCompleteDescribeAutoScalingGroups", callback);
    },

    deleteAutoScalingGroup: function(name, force, callback)
    {
        var params = [ ["AutoScalingGroupName", name]]
        if (force) params.push(["ForceDelete", true])
        this.queryAS("DeleteAutoScalingGroup", params, this, false, "onComplete", callback);
    },

    createAutoScalingGroup: function(name, zones, config, min, max, capacity, cooldown, healthType, healthGrace, subnets, elbs, pgroup,  tpolicies, tags,callback)
    {
        var params = [ ["AutoScalingGroupName", name]]
        zones.forEach(function(x, i) {
            params.push(["AvailabilityZones.member." + (i + 1), typeof x == "object" ? x.name : x])
        })
        params.push(["LaunchConfigurationName", config])
        params.push(["MinSize", min])
        params.push(["MaxSize", max])
        if (pgroup) params.push(["PlacementGroup", pgroup])
        if (capacity) params.push(["DesiredCapacity", capacity])
        if (cooldown) params.push(["DefaultCooldown", cooldown])
        if (healthType) params.push(["HealthCheckType", healthType])
        if (healthGrace) params.push(["HealthCheckGracePeriod", healthGrace])
        if (subnets) params.push(["VPCZoneIdentifier", subnets.map(function(x) { return typeof x == "object" ? x.id : x; }).join(",") ])
        if (tpolicies) {
            if (typeof tpolicies == "string") tpolicies = tpolicies.split(",");
            for (var i = 0; i < tpolicies.length; i++) {
                params.push(["TerminationPolicies.member." + (i + 1), tpolicies[i]]);
            }
        }

        (elbs || []).forEach(function(x,i) {
            params.push(["LoadBalancerNames.member." + (i+1), typeof x == "object" ? x.name : x]);
        });

        (tags || []).forEach(function(x,i) {
            params.push(["Tags.member." + (i+1) + ".Key", x.name]);
            params.push(["Tags.member." + (i+1) + ".Value", x.value]);
            params.push(["Tags.member." + (i+1) + ".PropagateAtLaunch", true]);
            params.push(["Tags.member." + (i+1) + ".ResourceType", "auto-scaling-group"]);
            params.push(["Tags.member." + (i+1) + ".ResourceId", name]);
        });

        this.queryAS("CreateAutoScalingGroup", params, this, false, "onComplete", callback);
    },

    updateAutoScalingGroup: function(name, zones, config, min, max, capacity, cooldown, healthType, healthGrace, subnets, elbs, pgroup, tpolicies, tags, callback)
    {
        var params = [ ["AutoScalingGroupName", name]];

        (zones || []).forEach(function(x, i) {
            params.push(["AvailabilityZones.member." + (i + 1), typeof x == "object" ? x.name : x])
        });
        params.push(["LaunchConfigurationName", config])
        params.push(["MinSize", min])
        params.push(["MaxSize", max])
        if (pgroup) params.push(["PlacementGroup", pgroup])
        if (capacity) params.push(["DesiredCapacity", capacity])
        if (cooldown) params.push(["DefaultCooldown", cooldown])
        if (healthType) params.push(["HealthCheckType", healthType])
        if (healthGrace) params.push(["HealthCheckGracePeriod", healthGrace])
        if (subnets) params.push(["VPCZoneIdentifier", subnets.map(function(x) { return typeof x == "object" ? x.id : x; }).join(",") ])
        if (tpolicies) {
            if (typeof tpolicies == "string") tpolicies = tpolicies.split(",");
            for (var i = 0; i < tpolicies.length; i++) {
                params.push(["TerminationPolicies.member." + (i + 1), tpolicies[i]]);
            }
        }

        (elbs || []).forEach(function(x,i) {
            params.push(["LoadBalancerNames.member." + (i+1), typeof x == "object" ? x.name : x]);
        });

        (tags || []).forEach(function(x,i) {
            params.push(["Tags.member." + (i+1) + ".Key", x.name]);
            params.push(["Tags.member." + (i+1) + ".Value", x.value]);
            params.push(["Tags.member." + (i+1) + ".PropagateAtLaunch", true]);
            params.push(["Tags.member." + (i+1) + ".ResourceType", "auto-scaling-group"]);
            params.push(["Tags.member." + (i+1) + ".ResourceId", name]);
        });

        this.queryAS("UpdateAutoScalingGroup", params, this, false, "onComplete", callback);
    },

    onCompleteDescribeAutoScalingGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "AutoScalingGroups", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.capacity + fieldSeparator + this.healthCheckType;
            }

            obj.name = getNodeValue(items[i], "AutoScalingGroupName");
            obj.id = toArn(getNodeValue(items[i], "AutoScalingGroupARN"));
            obj.date = new Date(getNodeValue(items[i], "CreatedTime"));
            obj.launchConfiguration = getNodeValue(items[i], "LaunchConfigurationName");
            obj.capacity = getNodeValue(items[i], "DesiredCapacity");
            obj.minSize = getNodeValue(items[i], "MinSize");
            obj.maxSize = getNodeValue(items[i], "MaxSize");
            obj.defaultCooldown = getNodeValue(items[i], "DefaultCooldown");
            obj.status = getNodeValue(items[i], "Status");
            obj.healthCheckType = getNodeValue(items[i], "HealthCheckType");
            obj.healthCheckGracePeriod = getNodeValue(items[i], "HealthCheckGracePeriod");
            obj.vpcZone = getNodeValue(items[i], "VPCZoneIdentifier");
            obj.placementGroup = getNodeValue(items[i], "PlacementGroup");
            obj.loadBalancers = this.getItems(items[i], "LoadBalancerNames", "member", "");
            obj.availabilityZones = this.getItems(items[i], "AvailabilityZones", "member", "");
            obj.terminationPolicies = this.getItems(items[i], "TerminationPolicies", "member", "");
            obj.metrics = this.getItems(items[i], "EnabledMetrics", "item", ["Metric","Granularity"], function(o) { return new Element('name',o.Metric, 'value',o.Granularity); });
            obj.granularity = getNodeValue(items[i], "EnabledMetric", "Granularity");
            obj.instances = this.getItems(items[i], "Instances", "member", ["HealthStatus","AvailabilityZone","InstanceId","LaunchConfigurationName","LifecycleState"], function(o) {
                var g = new Element('group',this.name,'availabilityZone',o.AvailabilityZone,'healthStatus',o.HealthStatus,'instanceId',o.InstanceId,'launchConfigurationName',o.LaunchConfigurationName,'state',o.LifecycleState)
                g.toString = function() {
                    return ew_core.modelValue('instanceId', this.instanceId) + fieldSeparator + this.healthStatus + fieldSeparator + this.state;
                }
                return g
            })
            obj.suspendedProcesses = this.getItems(items[i], "SuspendedProcesses", "member", ["ProcessName","SuspensionReason"], function(o) { return new Element('name',o.ProcessName,'value',o.SuspensionReason)})
            obj.tags = this.getItems(items[i], "Tags", "member", ["Key","Value","ResourceId","ResourceType","PropagateAtLaunch"], function(o) { return new Tag(o.Key,o.Value,o.ResourceId,o.ResourceType,toBool(o.PropagateAtLaunch))})
            list.push(obj);
        }
        this.core.setModel('asgroups', list);
        response.result = list;
    },

    deleteLaunchConfiguration: function(name, callback)
    {
        var params = [ ["LaunchConfigurationName", name]]
        this.queryAS("DeleteLaunchConfiguration", params, this, false, "onComplete", callback);
    },

    createLaunchConfiguration: function(name, instanceType, imageId, ebsOptimized, kernelId, ramdiskId, iamProfile, keypair, price, userData, monitoring, groups, callback)
    {
        var params = [ ["LaunchConfigurationName", name]]
        params.push(["InstanceType", instanceType])
        params.push(["ImageId", imageId])
        params.push(["InstanceMonitoring.Enabled", monitoring ? true : false])
        if (kernelId) params.push(["KernelId", kernelId])
        if (ramdiskId) params.push(["RamdiskId", ramdiskId])
        if (iamProfile) params.push(["IamInstanceProfile", iamProfile])
        if (keypair) params.push(["KeyName", keypair])
        if (price > 0) params.push(["SpotPrice", price])
        if (userData) params.push(["UserData", userData])
        if (ebsOptimized) params.push(["EbsOptimized", true])
        if (groups) {
            groups.forEach(function(x, i) {
                params.push(["SecurityGroups.member." + (i + 1), typeof x == "object" ? (x.vpcId ? x.id : x.name) : x])
            })
        }
        this.queryAS("CreateLaunchConfiguration", params, this, false, "onComplete", callback);
    },

    describeLaunchConfigurations: function(callback)
    {
        this.queryAS("DescribeLaunchConfigurations", [], this, false, "onCompleteDescribeLaunchConfigurations", callback);
    },

    onCompleteDescribeLaunchConfigurations: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "LaunchConfigurations", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.name + fieldSeparator + this.instanceType + fieldSeparator + ew_core.modelValue('imageId', this.imageId);
            }

            obj.name = getNodeValue(items[i], "LaunchConfigurationName");
            obj.id = toArn(getNodeValue(items[i], "LaunchConfigurationARN"));
            obj.date = new Date(getNodeValue(items[i], "CreatedTime"));
            obj.instanceType = getNodeValue(items[i], "InstanceType");
            obj.keyName = getNodeValue(items[i], "KeyName");
            obj.profile = getNodeValue(items[i], "IamInstanceProfile");
            obj.imageId = getNodeValue(items[i], "ImageId");
            obj.ebsOptimized = toBool(getNodeValue(items[i], "EbsOptimized"));
            obj.kernelId = getNodeValue(items[i], "KernelId");
            obj.ramdiskId = getNodeValue(items[i], "RamdiskId");
            obj.userData = getNodeValue(items[i], "UserData");
            obj.spotPrice = getNodeValue(items[i], "SpotPrice");
            obj.monitoring = toBool(getNodeValue(items[i], "InstanceMonitoring", "Enabled"));
            obj.groups = this.getItems(items[i], "SecurityGroups", "member", "");
            obj.devices = [];
            var objs = this.getItems(items[i], "BlockDeviceMappings", "member");
            for (var j = 0; j < objs.length; j++) {
                var dev = new Element();
                dev.toString = function() {
                    return this.deviceName +
                           (this.virtualName ? fieldSeparator + this.virtualName : "") + (this.volumeSize ? fieldSeparator + this.volumeSize + "GB" : "") +
                           (this.snapshotId ? fieldSeparator + this.snapshotId : "") + (this.deleteOnTermination ? fieldSeparator + "DeleteOnTermination" : "") +
                           (this.noDevice ? fieldSeparator + "noDevice" : "");
                }
                dev.deviceNqame = getNodeValue(objs[j], "DeviceName");
                dev.virtualName = getNodeValue(objs[j], "VirtualName");
                dev.snapshotId = getNodeValue(objs[j], "ebs", "SnapshotId");
                dev.volumeSize = getNodeValue(objs[j], "ebs", "VolumeSize");
                this.deleteOnTermination = 0;
                this.noDevice = 0;
                obj.devices.push(dev);
            }
            list.push(obj);
        }
        this.core.setModel('asconfigs', list);
        response.result = list;
    },

    disableMetricsCollection: function(name, callback)
    {
        this.queryAS("DisableMetricsCollection", [["AutoScalingGroupName", name]], this, false, "onComplete", callback);
    },

    enableMetricsCollection: function(name, callback)
    {
        this.queryAS("EnableMetricsCollection", [["AutoScalingGroupName", name], ["Granularity", "1Minute"]], this, false, "onComplete", callback);
    },

    executePolicy: function(name, policy, honorCooldown, callback)
    {
        var params = [["AutoScalingGroupName", name]];
        params.push(["PolicyName", policy]);
        if (honorCooldown) params.push(["HonorCooldown",honorCooldown])
        this.queryAS("ExecutePolicy", params, this, false, "onComplete", callback);
    },

    deletePolicy: function(name, policy, callback)
    {
        this.queryAS("DeletePolicy", [["AutoScalingGroupName", name], ["PolicyName", policy] ], this, false, "onComplete", callback);
    },

    deleteNotificationConfiguration: function(name, topic, callback)
    {
        this.queryAS("DeleteNotificationConfiguration", [["AutoScalingGroupName", name], ["TopicARN", topic]], this, false, "onComplete", callback);
    },

    putNotificationConfiguration: function(name, topic, events, callback)
    {
        var params = ["AutoScalingGroupName", name];
        params.push(["TopicARN", topic]);
        (events || []).forEach(function(x,i) { params.push(["NotificationTypes.member." + (i + 1), x])})

        this.queryAS("DeleteNotificationConfiguration", params, this, false, "onComplete", callback);
    },

    suspendProcesses: function(name, processes, callback)
    {
        var params = ["AutoScalingGroupName", name];
        (processes || []).forEach(function(x,i) { params.push(["ScalingProcesses.member." + (i + 1), x])})

        this.queryAS("SuspendProcesses", params, this, false, "onComplete", callback);
    },

    resumeProcesses: function(name, processes, callback)
    {
        var params = ["AutoScalingGroupName", name];
        (processes || []).forEach(function(x,i) { params.push(["ScalingProcesses.member." + (i + 1), x])})

        this.queryAS("ResumeProcesses", params, this, false, "onComplete", callback);
    },

    describeAutoScalingNotificationTypes: function(callback)
    {
        this.queryAS("DescribeAutoScalingNotificationTypes", [], this, false, "onComplete:AutoScalingNotificationTypes:member", callback);
    },

    describeNotificationConfigurations: function(callback)
    {
        this.queryAS("DescribeNotificationConfigurations", [], this, false, "onCompleteDescribeNotificationConfigurations", callback);
    },

    onCompleteDescribeNotificationConfigurations: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "NotificationConfigurations", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.type + fieldSeparator + this.group + fieldSeparator + this.topic;
            }

            obj.group = getNodeValue(items[i], "AutoScalingGroupName");
            obj.type = getNodeValue(items[i], "NotificationType");
            obj.topic = getNodeValue(items[i], "TopicARN");
            list.push(obj);
        }
        return this.getNext(response, this.queryAS, list);
    },

    deleteScheduledAction: function(name, action, callback)
    {
        this.queryAS("DeleteScheduledAction", [["AutoScalingGroupName", name], ["ScheduledActionName", action] ], this, false, "onComplete", callback);
    },

    terminateInstanceInAutoScalingGroup: function(id, decr, callback)
    {
        this.queryAS("TerminateInstanceInAutoScalingGroup", [["ShouldDecrementDesiredCapacity", decr], ["InstanceId", id] ], this, false, "onComplete", callback);
    },

    setInstanceHealth: function(id, status, graceperiod, callback)
    {
        var params = [["HealthStatus", status]];
        params.push(["InstanceId", id]);
        if (graceperiod) params.push(["ShouldRespectGracePeriod", true])
        this.queryAS("SetInstanceHealth", params, this, false, "onComplete", callback);
    },

    setDesiredCapacity: function(name, capacity, honorCooldown, callback)
    {
        var params = [["AutoScalingGroupName", name]];
        params.push(["DesiredCapacity", capacity]);
        if (honorCooldown) params.push(["HonorCooldown", true])
        this.queryAS("SetDesiredCapacity", params, this, false, "onComplete", callback);
    },

    putScalingPolicy: function(name, group, adjustmentType, adjustment, minStep, cooldown, callback)
    {
        var params = [];
        params.push(["PolicyName", name]);
        params.push(["AutoScalingGroupName", group]);
        params.push(["AdjustmentType", adjustmentType])
        params.push(["ScalingAdjustment", adjustment])
        if (minStep) params.push(["MinAdjustmentStep", minStep])
        if (cooldown) params.push(["Cooldown", cooldown])
        this.queryAS("PutScalingPolicy", params, this, false, "onComplete", callback);
    },

    putScheduledUpdateGroupAction: function(name, group, capacity, recurrence, start, end, min, max, callback)
    {
        var params = [];
        params.push(["ScheduledActionName", name]);
        params.push(["AutoScalingGroupName", group]);
        if (capacity) params.push(["DesiredCapacity", capacity])
        if (recurrence) params.push(["Recurrence", recurrence])
        if (start) params.push(["StartTime", start])
        if (end) params.push(["EndTime", end])
        if (min) params.push(["MinSize", min])
        if (max) params.push(["MaxSize", max])
        this.queryAS("PutScheduledUpdateGroupAction", params, this, false, "onComplete", callback);
    },

    describePolicies: function(callback)
    {
        this.queryAS("DescribePolicies", [], this, false, "onCompleteDescribePolicies", callback);
    },

    onCompleteDescribePolicies: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ScalingPolicies", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function () {
                return this.name + fieldSeparator + this.group + fieldSeparator + this.adjustmentType;
            }

            obj.group = getNodeValue(items[i], "AutoScalingGroupName");
            obj.adjustmentType = getNodeValue(items[i], "AdjustmentType");
            obj.cooldown = getNodeValue(items[i], "Cooldown");
            obj.minAdjustmentStep = getNodeValue(items[i], "MinAdjustmentStep");
            obj.id = toArn(getNodeValue(items[i], "PolicyARN"));
            obj.name = getNodeValue(items[i], "PolicyName");
            obj.scalingAdjustment = getNodeValue(items[i], "ScalingAdjustment");
            obj.alarms = this.getItems(items[i], "Alarms", "member", ["AlarmName", "AlarmARN"], function(o) { return new Element('name',o.AlarmName, 'value',toArn(o.AlarmARN));});
            list.push(obj);
        }
        this.core.setModel('aspolicies', list);
        response.result = list;
    },

    describeScheduledActions: function(callback)
    {
        this.queryAS("DescribeScheduledActions", [], this, false, "onCompleteDescribeScheduledActions", callback);
    },

    onCompleteDescribeScheduledActions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ScheduledUpdateGroupActions", "member");
        for (var i = 0; i < items.length; i++) {
            var action = new Element();
            action.toString = function() {
                return this.name + fieldSeparator + this.group + fieldSeparator + this.recurrence
            }
            action.name = getNodeValue(items[i], "ScheduledActionName");
            action.id = toArn(getNodeValue(items[i], "ScheduledActionARN"));
            action.group = getNodeValue(items[i], "AutoScalingGroupName");
            action.capacity = getNodeValue(items[i], "DesiredCapacity");
            action.start = new Date(getNodeValue(items[i], "StartTime"));
            action.end = new Date(getNodeValue(items[i], "EndTime"));
            action.recurrence = getNodeValue(items[i], "Recurrence");
            action.min = getNodeValue(items[i], "MinSize");
            action.max = getNodeValue(items[i], "MaxSize");
            list.push(action);
        }
        this.core.setModel('asactions', list);
        response.result = list;
    },

    describeAutoScalingInstances: function(callback)
    {
        this.queryAS("DescribeAutoScalingInstances", [], this, false, "onCompleteDescribeAutoScalingInstances", callback);
    },

    onCompleteDescribeAutoScalingInstances: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "AutoScalingInstances", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element()
            obj.toString = function() {
                return ew_core.modelValue('instanceId', this.instanceId) + fieldSeparator + this.healthStatus + fieldSeparator + this.state;
            }
            obj.group = getNodeValue(items[i], "AutoScalingGroupName");
            obj.availabilityZone = getNodeValue(items[i], "AvailabilityZone");
            obj.healthStatus = getNodeValue(items[i], "HealthStatus");
            obj.instanceId = getNodeValue(items[i], "InstanceId");
            obj.launchConfigurationName = getNodeValue(items[i], "LaunchConfigurationName");
            obj.state = getNodeValue(items[i], "LifecycleState");
            list.push(obj);
        }
        this.core.setModel('asinstances', list);
        response.result = list;
    },

    describeScalingActivities: function(callback)
    {
        this.queryAS("DescribeScalingActivities", [], this, false, "onCompleteDescribeScalingActivities", callback);
    },

    onCompleteDescribeScalingActivities: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "Activities", "member");
        for (var i = 0; i < items.length; i++) {
            var obj = new Element();
            obj.toString = function() {
                return this.group + fieldSeparator + this.status
            }

            obj.group = getNodeValue(items[i], "AutoScalingGroupName");
            obj.id = getNodeValue(items[i], "ActivityId");
            obj.descr = getNodeValue(items[i], "Description");
            obj.cause = getNodeValue(items[i], "Cause");
            obj.details = getNodeValue(items[i], "Details");
            obj.progress = getNodeValue(items[i], "Progress");
            obj.start = new Date(getNodeValue(items[i], "StartTime"));
            obj.end = new Date(getNodeValue(items[i], "EndTime"));
            obj.status = getNodeValue(items[i], "StatusCode");
            obj.statusMsg = getNodeValue(items[i], "StatusMessage");
            list.push(obj);
        }
        return this.getNext(response, this.queryAS, list);

    },

    describeJobFlows: function(callback)
    {
        this.queryEMR("DescribeJobFlows", [], this, false, "onCompleteDescribeJobFlows", callback);
    },

    onCompleteDescribeJobFlows: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "JobFlows", "member");
        for (var i = 0; i < items.length; i++) {
            var job = new Element();
            job.toString = function() {
                return this.name + fieldSeparator + this.id + fieldSeparator + this.state;
            }
            job.id = getNodeValue(items[i], "JobFlowId");
            job.name = getNodeValue(items[i], "Name")
            job.logURI = getNodeValue(items[i], "LogUri")
            job.supportedProducts = getNodeValue(items[i], "SupportedProducts");
            job.amiVersion = getNodeValue(items[i], "AmiVersion")
            job.state = getNodeValue(items[i], "ExecutionStatusDetail", "State")
            job.creationDateTime = new Date(getNodeValue(items[i], "ExecutionStatusDetail", "CreationDateTime"));
            job.startDateTime = new Date(getNodeValue(items[i], "ExecutionStatusDetail", "StartDateTime"));
            job.endDateTime = new Date(getNodeValue(items[i], "ExecutionStatusDetail", "EndDateTime"));
            job.readyDateTime = new Date(getNodeValue(items[i], "ExecutionStatusDetail", "ReadyDateTime"));
            job.lastStateReason = getNodeValue(items[i], "ExecutionStatusDetail", "LastStateChangeReason");
            job.availabilityZone = getNodeValue(items[i], "Placement", "AvailabilityZone");
            job.slaveInstanceType = getNodeValue(items[i], "SlaveInstanceType");
            job.ec2KeyName = getNodeValue(items[i], "Ec2KeyName");
            job.ec2SubnetId = getNodeValue(items[i], "Ec2SubnetId");
            job.hadoopVersion = getNodeValue(items[i], "HadoopVersion");
            job.masterInstanceType = getNodeValue(items[i], "MasterInstanceType");
            job.masterInstanceId = getNodeValue(items[i], "MasterInstanceId");
            job.masterPublicDnsName = getNodeValue(items[i], "MasterPublicDnsName");
            job.mormalizedInstanceHours = getNodeValue(items[i], "NormalizedInstanceHours");
            job.instanceCount = getNodeValue(items[i], "InstanceCount");
            job.keepJobFlowAliveWhenNoSteps = toBool(getNodeValue(items[i], "KeepJobFlowAliveWhenNoSteps"));
            job.terminationProtected = toBool(getNodeValue(items[i], "TerminationProtected"));
            job.instanceGroups = this.getItems(items[i], "InstanceGroups", "member", [], function(obj) {
                obj.toString = function () { return this.Name + fieldSeparator + this.State + fieldSeparator + this.InstanceRole + fieldSeparator + this.InstanceType + fieldSeparator + this.InstanceRunningCount + '/' + this.InstanceRequestCount; }
                return obj;
            });
            job.steps = [];
            var steps = this.getItems(items[i], "Steps", "member");
            for (var j = 0; j < steps.length; j++) {
                var step = new Element();
                step.toString = function() { return step.name + fieldSeparator + step.state }
                step.state = getNodeValue(steps[j], "ExecutionStatusDetail", "State")
                step.creationDateTime = new Date(getNodeValue(steps[j], "ExecutionStatusDetail", "CreationDateTime"));
                step.startDateTime = new Date(getNodeValue(steps[j], "ExecutionStatusDetail", "StartDateTime"));
                step.endDateTime = new Date(getNodeValue(steps[j], "ExecutionStatusDetail", "EndDateTime"));
                step.lastStateReason = getNodeValue(steps[j], "ExecutionStatusDetail", "LastStateChangeReason");
                step.name = getNodeValue(steps[j], "StepConfig", "Name")
                step.actionOnFailure = getNodeValue(steps[j], "StepConfig", "ActionOnFailure")
                step.hadoopArgs = this.getItems(steps[j], "Args", "member", [])
                step.hadoopJar = getNodeValue(steps[j], "HadoopJarStep", "Jar")
                step.hadoopMainClass = getNodeValue(steps[j], "HadoopJarStep", "MainClass")
                step.hadoopProperties = this.getItems(steps[j], "HadoopJarStep", "Properties", [])
                job.steps.push(step)
            }
            job.bootstrapActions = [];
            var actions = this.getItems(items[i], "BootstrapActions", "member");
            for (var j = 0; j < actions.length; j++) {
                var action = new Element();
                action.name = getNodeValue(actions[j], "Name")
                action.path = getNodeValue(actions[j], "Path")
                action.args = this.getItems(actions[j], "Args", "member", []);
                job.bootstrapActions.push(action)
            }
            list.push(job)
        }
        this.core.setModel('jobflows', list);
        response.result = list;
    },

    runJobFlow: function(name, count, options, callback)
    {
        var params = [ [ "Name", name ]];
        params.push(["Instances.InstanceCount", count]);
        for (var i in options) params.push([i, options[i]]);

        this.queryEMR("RunJobFlow", params, this, false, "onComplete", callback);
    },

    terminateJobFlows: function(id, callback)
    {
        var params = [];
        if (!Array.isArray(id)) id = [ id ];
        for (var i = 0; i < id.length; i++) {
            params.push(["JobFlowIds.member." + (i + 1), id]);
        }
        this.queryEMR("TerminateJobFlows", params, this, false, "onComplete", callback);
    },

    modifyInstanceGroups: function(groups, callback)
    {
        var params = [];
        if (!Array.isArray(groups)) groups = [ groups ];
        for (var i = 0; i < groups.length; i++) {
            params.push(["InstanceGroups.member." + (i + 1) + ".InstanceGroupId", groups[i].InstanceGroupId]);
            params.push(["InstanceGroups.member." + (i + 1) + ".InstanceCount", groups[i].InstanceCount]);
        }
        this.queryEMR("ModifyInstanceGroups", params, this, false, "onComplete", callback);
    },


    addInstanceGroups: function(id, groups, callback)
    {
        var params = [ ["JobFlowId", id]];
        if (!Array.isArray(groups)) groups = [ groups ];
        for (var i = 0; i < groups.length; i++) {
            params.push(["InstanceGroups.member." + (i + 1) + ".Name", groups[i].Name]);
            params.push(["InstanceGroups.member." + (i + 1) + ".InstanceCount", groups[i].InstanceCount]);
            params.push(["InstanceGroups.member." + (i + 1) + ".InstanceRole", groups[i].InstanceRole]);
            params.push(["InstanceGroups.member." + (i + 1) + ".InstanceType", groups[i].InstanceType]);
            params.push(["InstanceGroups.member." + (i + 1) + ".Market", groups[i].Market]);
            if (groups[i].BidPrice) params.push(["InstanceGroups.member." + (i + 1) + ".BidPrice", groups[i].BidPrice]);
        }
        this.queryEMR("AddInstanceGroups", params, this, false, "onComplete", callback);
    },

    addJobFlowSteps: function(id, steps, callback)
    {
        var params = [ ["JobFlowId", id]];
        if (!Array.isArray(steps)) steps = [ steps ];
        for (var i = 0; i < steps.length; i++) {
            params.push(["Steps.member." + (i + 1) + ".Name", steps[i].Name]);
            params.push(["Steps.member." + (i + 1) + ".ActionOnFailure", steps[i].ActionOnFailure]);
            params.push(["Steps.member." + (i + 1) + ".HadoopJarStep.Jar", steps[i].Jar]);
            if (steps[i].MainClass) params.push(["Steps.member." + (i + 1) + ".HadoopJarStep.MainClass", steps[i].MainClass]);
            for (var j = 0 ; i < steps[i].Args.length; j++) {
                params.push(["Steps.member." + (i + 1) + ".HadoopJarStep.Args.member." + (j + 1), steps[i].Args[j]]);
            }
            for (var j = 0; j < steps[i].Properties.length; j++) {
                params.push(["Steps.member." + (i + 1) + ".HadoopJarStep.Properties.member.Key" + (j + 1), steps[i].Properties[j].name]);
                params.push(["Steps.member." + (i + 1) + ".HadoopJarStep.Properties.member.Value" + (j + 1), steps[i].Properties[j].value]);
            }
        }
        this.queryEMR("AddJobFlowSteps", params, this, false, "onComplete", callback);
    },

    setTerminationProtection: function(id, flag, callback)
    {
        var params = [["TerminationProtected", toBool(flag)]]
        if (!Array.isArray(id)) id = [ id ];
        for (var i = 0; i < id.length; i++) {
            params.push(["JobFlowIds.member." + (i + 1), id]);
        }
        this.queryEMR("SetTerminationProtection", params, this, false, "onComplete", callback);
    },

    listTables: function(params, callback)
    {
        if (!params) params = {};
        this.queryDDB('ListTables', params, this, false, "onCompleteListTables", callback);
    },

    onCompleteListTables: function(response)
    {
        var json = response.json;
        if (!json) return response.result = [];

        var list = [];
        for (var i in json.TableNames) {
            var ddb = new Element('name', json.TableNames[i]);
            list.push(ddb);
        }
        response.result = list;
    },

    describeTable: function(name, callback)
    {
        var params = { TableName: name };
        this.queryDDB('DescribeTable', params, this, false, "onCompleteJson:Table", callback);
    },

    createTable: function(name, hash, hashtype, range, rangetype, rlimit, wlimit, callback)
    {
        var schema = { "HashKeyElement": {"AttributeName": hash, "AttributeType": hashtype } };
        if (range && rangetype) schema.RangeKeyElement = {"AttributeName": range,"AttributeType": rangetype };

        var params = { "TableName": name, "KeySchema": schema, "ProvisionedThroughput":{"ReadCapacityUnits": rlimit,"WriteCapacityUnits": wlimit }}
        this.queryDDB('CreateTable', params, this, false, "onCompleteJson:TableDescription", callback);
    },

    deleteTable: function(name, callback)
    {
        var params = { TableName: name };
        this.queryDDB('DeleteTable', params, this, false, "onCompleteJson:TableDescription", callback);
    },

    updateTable: function(name, r, w, callback)
    {
        var params = {"TableName": name, "ProvisionedThroughput": {"ReadCapacityUnits":r,"WriteCapacityUnits":w } }
        this.queryDDB('UpdateTable', params, this, false, "onCompleteJson:TableDescription", callback);
    },

    getItem: function(name, key, range, options, callback)
    {
        var params = { TableName: name, Key: { HashKeyElement: toDynamoDB(key) } };
        if (range) params.Key.RangeKeyElement = toDynamoDB(range);
        if (options.attributesToGet) {
            params.AttributesToGet = options.attributesToGet;
        }
        if (options.consistentRead) {
            params.ConsistentRead = options.consistentRead;
        }
        this.queryDDB('GetItem', params, this, false, "onCompleteJson", callback);
    },

    putItem: function(name, item, options, callback)
    {
        var params = { TableName: name, Item: toDynamoDB(item) };
        if (options.expected) {
            params.Expected = {};
            for (var i in options.expected) {
                params.Expected[i] = {};
                if (typeof options.expected[i].exists === 'boolean') {
                    params.Expected[i].Exists = options.expected[i].exists;
                }
                if (typeof options.expected[i].value !== 'undefined') {
                    params.Expected[i].Value = toDynamoDB(options.expected[i].value);
                }
            }
        }
        if (options.returnValues) {
            params.ReturnValues = options.returnValues;
        }
        this.queryDDB('PutItem', params, this, false, "onCompleteJson", callback);
    },

    deleteItem: function(name, key, range, options, callback)
    {
        var params = { TableName: name, Key: { HashKeyElement: toDynamoDB(key) } };
        if (range) params.Key.RangeKeyElement = toDynamoDB(range);
        if (options.expected) {
            params.Expected = {};
            for (var i in options.expected) {
                params.Expected[i] = {};
                if (typeof options.expected[i].exists === 'boolean') {
                    params.Expected[i].Exists = options.expected[i].exists;
                }
                if (typeof options.expected[i].value !== 'undefined') {
                    params.Expected[i].Value = toDynamoDB(options.expected[i].value);
                }
            }
        }
        if (options.returnValues) {
            params.ReturnValues = options.returnValues;
        }
        this.queryDDB('DeleteItem', params, this, false, "onCompleteJson", callback);
    },

    queryTable: function(name, key, options, callback)
    {
        var params = { TableName: name, HashKeyValue: toDynamoDB(key) };
        if (options.attributesToGet) {
            params.AttributesToGet = options.attributesToGet;
        }
        if (options.limit) {
            params.Limit = options.limit;
        }
        if (options.consistentRead) {
            params.ConsistentRead = options.consistentRead;
        }
        if (options.count && !options.attributesToGet) {
            params.Count = options.count;
        }
        if (options.rangeKeyCondition) {
            for (var op in options.rangeKeyCondition) {
                if (typeof op === 'string') {
                    params.RangeKeyCondition = {"AttributeValueList":[], "ComparisonOperator": op.toUpperCase() };
                    switch (op.toLowerCase()) {
                    case 'between':
                        if (Array.isArray(options.rangeKeyCondition[op]) && options.rangeKeyCondition[op].length > 1) {
                            params.RangeKeyCondition.AttributeValueList.push(toDynamoDB(options.rangeKeyCondition[op][0]));
                            params.RangeKeyCondition.AttributeValueList.push(toDynamoDB(options.rangeKeyCondition[op][1]));
                        }
                        break;

                    case 'eq':
                    case 'le':
                    case 'lt':
                    case 'ge':
                    case 'gt':
                    case 'begins_with':
                        params.RangeKeyCondition.AttributeValueList.push(toDynamoDB(options.rangeKeyCondition[op]));
                    }
                }
            }
        }
        if (options.scanIndexForward === false) {
            params.ScanIndexForward = false;
        }
        if (options.exclusiveStartKey && options.exclusiveStartKey.HashKeyElement) {
            params.ExclusiveStartKey = { HashKeyElement: toDynamoDB(options.exclusiveStartKey.HashKeyElement) };
            if (options.exclusiveStartKey.RangeKeyElement) {
                params.ExclusiveStartKey.RangeKeyElement = toDynamoDB(options.exclusiveStartKey.RangeKeyElement);
            }
        }

        this.queryDDB('Query', params, this, false, "onCompleteJson", callback);
    },

    scanTable: function(name, options, callback)
    {
        var params = { TableName: name };
        if (options.attributesToGet) {
            params.AttributesToGet = options.attributesToGet;
        }
        if (options.limit) {
            params.Limit = options.limit;
        }
        if (options.count && !options.attributesToGet) {
            params.Count = options.count;
        }
        if (options.exclusiveStartKey && options.exclusiveStartKey.HashKeyElement) {
            params.ExclusiveStartKey = { HashKeyElement: toDynamoDB(options.exclusiveStartKey.HashKeyElement) };
            if (options.exclusiveStartKey.RangeKeyElement) {
                params.ExclusiveStartKey.RangeKeyElement = toDynamoDB(options.exclusiveStartKey.RangeKeyElement);
            }
        }
        if (options.filter) {
            params.ScanFilter = {}
            for (var attr in options.filter) {
                if (options.filter.hasOwnProperty(attr)) {
                    for (var op in options.filter[attr]) {
                        if (typeof op === 'string') {
                            params.ScanFilter[attr] = {"AttributeValueList":[],"ComparisonOperator": op.toUpperCase()};
                            if(op === 'not_null' || op === 'null') {
                                // nothing ot do
                            } else
                            if ((op == 'between' || op == 'in') && Array.isArray(options.filter[attr][op]) && options.filter[attr][op].length > 1) {
                                for (var i = 0; i < options.filter[attr][op].length; ++i) {
                                    params.ScanFilter[attr].AttributeValueList.push(toDynamoDB(options.filter[attr][op][i]));
                                }
                            } else {
                                params.ScanFilter[attr].AttributeValueList.push(toDynamoDB(options.filter[attr][op]));
                            }
                        }
                    }
                }
            }
        }
        this.queryDDB('Scan', params, this, false, "onCompleteJson", callback);
    },

    listDomains: function(callback)
    {
        var params = { registrationStatus: "REGISTERED" };
        this.querySWF('com.amazonaws.swf.service.model.SimpleWorkflowService.ListDomains', params, this, false, "onCompleteJson:domainInfos", callback);
    },

    listActivityTypes: function(domain, callback)
    {
        var params = { domain: domain, registrationStatus: "REGISTERED" };
        this.querySWF('com.amazonaws.swf.service.model.SimpleWorkflowService.ListActivityTypes', params, this, false, "onCompleteJson:typeInfos", callback);
    },

};
