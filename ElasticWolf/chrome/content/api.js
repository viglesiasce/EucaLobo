//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var ew_api = {
    EC2_API_VERSION: '2012-07-20',
    ELB_API_VERSION: '2012-06-01',
    IAM_API_VERSION: '2010-05-08',
    CW_API_VERSION: '2010-08-01',
    STS_API_VERSION: '2011-06-15',
    SQS_API_VERSION: '2011-10-01',
    SNS_API_VERSION: '2010-03-31',
    RDS_API_VERSION: '2012-04-23',
    R53_API_VERSION: '2012-02-29',
    AS_API_VERSION: '2011-01-01',
    SIG_VERSION: '2',

    core: null,
    timers: {},
    urls: {},
    versions: {},
    region: "",
    accessKey: "",
    secretKey: "",
    securityToken: "",
    httpCount: 0,
    errorList: [],

    isEnabled: function()
    {
        return this.core.isEnabled();
    },

    showBusy : function(fShow)
    {
        if (fShow) {
            this.httpCount++;
            window.setCursor("wait");
        } else {
            --this.httpCount;
            if (this.httpCount <= 0) {
                window.setCursor("auto");
            }
        }
    },

    setCredentials : function (accessKey, secretKey, securityToken)
    {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.securityToken = typeof securityToken == "string" ? securityToken : "";
        debug('setCreds: ' + this.accessKey + ", " + this.secretKey + ", " + this.securityToken)
    },

    setEndpoint : function (endpoint)
    {
        if (!endpoint) return;
        this.region = endpoint.name;
        this.urls.EC2 = endpoint.url;
        this.versions.EC2 = endpoint.version || this.EC2_API_VERSION;
        this.urls.ELB = endpoint.urlELB || "https://elasticloadbalancing." + this.region + ".amazonaws.com";
        this.versions.ELB = endpoint.versionELB || this.ELB_API_VERSION;
        this.urls.CW = endpoint.urlCW || "https://monitoring." + this.region + ".amazonaws.com";
        this.versions.CW = endpoint.versionCW || this.CW_API_VERSION;
        this.urls.IAM = endpoint.urlIAM || 'https://iam.amazonaws.com';
        this.versions.IAM = endpoint.versionIAM || this.IAM_API_VERSION;
        this.urls.STS = endpoint.urlSTS || 'https://sts.amazonaws.com';
        this.versions.STS = endpoint.versionSTS || this.STS_API_VERSION;
        this.urls.SQS = endpoint.urlSQS || 'https://sqs.' + this.region + '.amazonaws.com';
        this.versions.SQS = endpoint.versionSQS || this.SQS_API_VERSION;
        this.urls.SNS = endpoint.urlSNS || 'https://sns.' + this.region + '.amazonaws.com';
        this.versions.SNS = endpoint.versionSNS || this.SNS_API_VERSION;
        this.urls.RDS = endpoint.urlRDS || 'https://rds.' + this.region + '.amazonaws.com';
        this.versions.RDS = endpoint.versionRDS || this.RDS_API_VERSION;
        this.urls.R53 = endpoint.urlR53 || 'https://route53.amazonaws.com';
        this.versions.R53 = endpoint.versionR53 || this.R53_API_VERSION;
        this.urls.AS = endpoint.urlAS || "https://autoscaling.amazonaws.com";
        this.versions.AS = endpoint.versionAS || this.AS_API_VERSION;
        this.actionIgnore = endpoint.actionIgnore || [];
        debug('setEndpoint: ' + this.region + ", " + JSON.stringify(this.urls) + ", " + JSON.stringify(this.versions) + ", " + this.actionIgnore);
    },

    getTimerKey: function()
    {
        return String(Math.random()) + ":" + String(new Date().getTime());
    },

    startTimer : function(key, expr)
    {
        var timeout = this.core.getIntPrefs("ew.http.timeout", 15000, 5000, 3600000);
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
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.ELB, this.versions.ELB);
    },

    queryAS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.AS, this.versions.AS);
    },

    queryIAM : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.IAM, this.versions.IAM);
    },

    queryCloudWatch : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.CW, this.versions.CW);
    },

    querySTS : function (action, params, handlerObj, isSync, handlerMethod, callback, accessKey)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.STS, this.versions.STS, accessKey);
    },

    querySQS : function (url, action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, url || this.urls.SQS, this.versions.SQS);
    },

    querySNS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.SNS, this.versions.SNS);
    },

    queryRDS : function (action, params, handlerObj, isSync, handlerMethod, callback)
    {
        return this.queryEC2(action, params, handlerObj, isSync, handlerMethod, callback, this.urls.RDS, this.versions.RDS);
    },

    queryEC2 : function (action, params, handlerObj, isSync, handlerMethod, callback, apiURL, apiVersion, accessKey)
    {
        if (!this.isEnabled()) return null;

        var curTime = new Date();
        var formattedTime = curTime.strftime("%Y-%m-%dT%H:%M:%SZ", true);
        if (!accessKey) {
            accessKey = { id: this.accessKey, secret: this.secretKey, securityToken: this.securityToken || "" };
        }

        var url = apiURL ? apiURL : this.urls.EC2;
        var sigValues = new Array();
        sigValues.push(new Array("Action", action));
        sigValues.push(new Array("AWSAccessKeyId", accessKey.id));
        sigValues.push(new Array("SignatureVersion", this.SIG_VERSION));
        sigValues.push(new Array("SignatureMethod", "HmacSHA1"));
        sigValues.push(new Array("Version", apiVersion ? apiVersion : this.versions.EC2));
        sigValues.push(new Array("Timestamp", formattedTime));
        if (accessKey.securityToken != "") {
            sigValues.push(new Array("SecurityToken", accessKey.securityToken));
        }

        // Mix in the additional parameters. params must be an Array of tuples as for sigValues above
        for (var i = 0; i < params.length; i++) {
            sigValues.push(params[i]);
        }

        // Parse the url
        var io = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
        var uri = io.newURI(url, null, null);

        var strSig = "";
        var queryParams = "";

        function encode(str) {
            str = encodeURIComponent(str);
            var efunc = function(m) { return m == '!' ? '%21' : m == "'" ? '%27' : m == '(' ? '%28' : m == ')' ? '%29' : m == '*' ? '%2A' : m; }
            return str.replace(/[!'()*~]/g, efunc);
        }

        sigValues.sort();
        strSig = "POST\n" + uri.host + "\n" + uri.path + "\n";
        for (var i = 0; i < sigValues.length; i++) {
            var item = (i ? "&" : "") + sigValues[i][0] + "=" + encode(sigValues[i][1]);
            strSig += item;
            queryParams += item;
        }
        queryParams += "&Signature="+encodeURIComponent(b64_hmac_sha1(accessKey.secret, strSig));

        log("EC2: url=" + url + "?" + queryParams + ', sig=' + strSig);

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            log("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open("POST", url, !isSync);
        xmlhttp.setRequestHeader("User-Agent", this.core.getUserAgent());
        xmlhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xmlhttp.setRequestHeader("Content-Length", queryParams.length);
        xmlhttp.setRequestHeader("Connection", "close");

        return this.sendRequest(xmlhttp, url, queryParams, isSync, action, handlerMethod, handlerObj, callback, params);
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
        var strSig = curTime;

        params["X-Amzn-Authorization"] = "AWS3-HTTPS AWSAccessKeyId=" + this.accessKey + ",Algorithm=HmacSHA1,Signature=" + b64_hmac_sha1(this.secretKey, strSig);
        params["User-Agent"] = this.core.getUserAgent();
        params["Connection"] = "close";

        log("R53 [" + method + ":" + url + ":" + strSig.replace(/\n/g, "|") + " " + JSON.stringify(params) + "]")

        var xmlhttp = this.getXmlHttp();
        if (!xmlhttp) {
            debug("Could not create xmlhttp object");
            return null;
        }
        xmlhttp.open(method, url, !isSync);

        for (var p in params) {
            xmlhttp.setRequestHeader(p, params[p]);
        }

        return this.sendRequest(xmlhttp, url, content, isSync, action, handlerMethod, handlerObj, callback);
    },

    queryS3Prepare : function(method, bucket, key, path, params, content)
    {
        var curTime = new Date().toUTCString();
        var url = this.core.getS3Protocol(this.region, bucket) + (bucket ? bucket + "." : "") + this.core.getS3Region(this.region || "").url;

        if (!params) params = {}

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
        var strSig = method + "\n" + (params['Content-MD5']  || "") + "\n" + (params['Content-Type'] || "") + "\n" + "\n";

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
            strSig += headers.sort().join('\n') + "\n"
        }

        // Split query string for subresources, supported are:
        var resources = ["acl", "lifecycle", "location", "logging", "notification", "partNumber", "policy", "requestPayment", "torrent",
                         "uploadId", "uploads", "versionId", "versioning", "versions", "website",
                         "delete",
                         "response-content-type", "response-content-language", "response-expires",
                         "response-cache-control", "response-content-disposition", "response-content-encoding" ]
        var rclist = []
        var query = parseQuery(path)
        for (var p in query) {
            p = p.toLowerCase();
            if (resources.indexOf(p) != -1) {
                rclist.push(p + (query[p] == true ? "" : "=" + query[p]))
            }
        }
        strSig += (bucket ? "/" + bucket : "") + (key[0] != "/" ? "/" : "") + key + (rclist.length ? "?" : "") + rclist.sort().join("&");

        params["Authorization"] = "AWS " + this.accessKey + ":" + b64_hmac_sha1(this.secretKey, strSig);
        params["User-Agent"] = this.core.getUserAgent();
        params["Connection"] = "close";

        log("S3 [" + method + ":" + url + "/" + key + path + ":" + strSig.replace(/\n/g, "|") + " " + JSON.stringify(params) + "]")

        return { method: method, url: url + (key[0] != "/" ? "/" : "") + key + path, headers: params, sig: strSig, time: curTime }
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

        return this.sendRequest(xmlhttp, req.url, content, isSync, method, handlerMethod, handlerObj, callback, [bucket, key, path]);
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
        return this.sendRequest(xmlhttp, url, null, true, stylesheet, "onCompleteCustomerGatewayConfigFormats", this, null, config || "");
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
        return this.sendRequest(xmlhttp, url, null, true, "checkip", "onCompleteResponseText", this);
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
              hdrs += p + ":" + headers[p] + "\n";
          }
          persist.saveURI(io, null, null, null, hdrs, file);
          return true;

        } catch (e) {
          alert(e);
        }
        return false;
    },

    sendRequest: function(xmlhttp, url, content, isSync, action, handlerMethod, handlerObj, callback, params)
    {
        debug('sendRequest: ' + url + ', action=' + action + '/' + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ', params=' + params);
        var me = this;

        var xhr = xmlhttp;
        // Generate random timer
        var timerKey = this.getTimerKey();
        this.startTimer(timerKey, function() { xhr.abort() });
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
            return this.handleResponse(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params);
        }
        return true;
    },

    handleResponse : function(xmlhttp, url, isSync, action, handlerMethod, handlerObj, callback, params)
    {
        log(xmlhttp.responseText);

        var now = (new Date()).getTime();
        var rc = xmlhttp && (xmlhttp.status >= 200 && xmlhttp.status < 300) ?
                 this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params) :
                 this.createResponseError(xmlhttp, url, isSync, action, handlerMethod, callback, params);

        // Response callback is called in all cases, some errors can be ignored
        if (handlerObj) {
            handlerObj.onResponseComplete(rc);
        }
        debug('handleResponse: ' + action + ", method=" + handlerMethod + ", mode=" + (isSync ? "Sync" : "Async") + ", status=" + rc.status + ', error=' + rc.errCode + ' ' + rc.errString);

        // Prevent from showing error dialog on every error until success, this happens in case of wrong credentials or endpoint and until all views not refreshed,
        // also ignore not supported but implemented API calls, handle known cases when API calls are not supported yet
        if (rc.hasErrors) {
            this.displayError(rc.action + ": " + rc.errCode + ": " + rc.errString + ': ' + (params || ""));
            // Call error handler if passed as an object
            if (callback && !rc.skipCallback) {
                if (typeof callback == "object" && callback.error) {
                    callback.error(rc);
                }
            }
        } else {
            // Pass the result and the whole response object if it is null
            if (callback  && !rc.skipCallback) {
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

    displayError: function(msg)
    {
        if (this.core.getBoolPrefs("ew.errors.show", false)) {
            if (this.actionIgnore.indexOf(rc.action) == -1 && !msg.match(/(is not enabled in this region|is not supported in your requested Availability Zone)/)) {
                this.core.errorDialog("Server responded with an error for " + rc.action, rc)
            }
        }
        this.core.errorMessage(msg);
        // Add to the error list
        this.errorList.push((new Date()).strftime("%Y-%m-%d %H:%M:%S: ") + msg);
        if (this.errorList.length > 500) this.errorList.splice(0, 1);
    },

    // Extract standard AWS error code and message
    createResponseError : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        var rc = this.createResponse(xmlhttp, url, isSync, action, handlerMethod, callback, params);
        rc.errCode = "Unknown: " + (xmlhttp ? xmlhttp.status : 0);
        rc.errString = "An unknown error occurred, please check connectivity";
        rc.requestId = "";
        rc.hasErrors = true;

        if (xmlhttp && xmlhttp.responseXML) {
            // EC2 common error reponse format
            rc.errCode = getNodeValue(xmlhttp.responseXML, "Code");
            rc.errString = getNodeValue(xmlhttp.responseXML, "Message");
            rc.requestId = getNodeValue(xmlhttp.responseXML, "RequestID");

            // Route53 error messages
            if (!rc.errString) {
                rc.errString = this.getItms(xmlhttp.responseXML, 'InvalidChangeBatch', 'Messages', [ 'Message' ], function(obj) { return obj.Message });
                if (rc.errString) rc.errCode = "InvalidChangeBatch";
            }
            debug('response error: ' +  action + ", " + xmlhttp.responseText + ", " + rc.errString + ", " + url);
        }
        return rc;
    },

    createResponse : function(xmlhttp, url, isSync, action, handlerMethod, callback, params)
    {
        return { xmlhttp: xmlhttp,
                 responseXML: xmlhttp && xmlhttp.responseXML ? xmlhttp.responseXML : document.createElement('document'),
                 responseText: xmlhttp ? xmlhttp.responseText : '',
                 status : xmlhttp.status,
                 url: url,
                 action: action,
                 method: handlerMethod,
                 isSync: isSync,
                 hasErrors: false,
                 skipCallback: false,
                 params: params || {},
                 callback: callback,
                 result: null,
                 errCode: "",
                 errString: "",
                 requestId: "" };
    },

    // Main callback on request complete, if callback specified in the form onComplete:id,
    // then response will put value of the node 'id' in the result
    onResponseComplete : function(response)
    {
        var id = null;
        var method = response.method;
        if (!method) return;

        // Return value in response
        if (method.indexOf(":") > 0) {
            var m = method.split(":");
            method = m[0];
            id = m[1];
        }

        if (this[method]) {
            this[method](response, id);
        } else {
           alert('Error calling handler ' + response.method + ' for ' + response.action);
        }
    },

    // Common response callback when there is no need to parse result but only to call user callback
    onComplete : function(response, id)
    {
        if (id) response.result = getNodeValue(response.responseXML, id);
    },

    onCompleteResponseText : function(response, id)
    {
        response.result = response.responseText.trim();
    },

    // Iterate through all pages while NextToken is present, collect all items in the model
    getNext: function(response, method, list, model)
    {
        var me = this;
        var xmlDoc = response.responseXML;
        var nextToken = getNodeValue(xmlDoc, "NextToken");
        // Collected result will be returned by the last call
        if (nextToken) {
            var params = cloneObject(response.params);
            setParam(params, "NextToken", nextToken);
            setTimeout(function() { method.call(me, response.action, params, me, false, response.method, response.callback); }, 100);
            response.skipCallback = true;
            return;
        }
        this.core.appendModel(model, list, getParam(response.params, "NextToken") == "" ? 1 : 0);
        response.result = this.core.getModel(model);
    },

    // Parse XML node parentNode and extract all items by itemNode tag name, if item node has multiple fields, columns may be used to restrict which
    // fields needs to be extracted and put into Javascript object as properties. If callback specified, the final object will be passed through the
    // callback as parameters which shoulkd return valid object or value to be included in the list
    getItems : function(item, parentNode, itemsNode, columns, callback)
    {
        var list = [];
        var tagSet = item.getElementsByTagName(parentNode)[0];
        if (tagSet) {
            var items = itemsNode ? tagSet.getElementsByTagName(itemsNode) : tagSet.childNodes;
            for (var i = 0; i < items.length; i++) {
                if (items[i].parentNode && items[i].parentNode.tagName != parentNode) continue;
                if (columns != null) {
                    // Return object or just plain list if columns is a string
                    if (columns instanceof Array) {
                        var obj = {};
                        for (var j in columns) {
                            var val = getNodeValue(items[i], columns[j]);
                            if (val) obj[columns[j]] = val;
                        }
                        list.push(callback ? callback(obj) : obj);
                    } else {
                        var val = columns == "" ? items[i].firstChild.nodeValue : getNodeValue(items[i], columns);
                        if (val) list.push(callback ? callback(val) : val);
                    }
                } else {
                    list.push(callback ? callback(items[i]) : items[i]);
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
        return this.getItems(item, "groupSet", "item", ["groupId", "groupName"], function(obj) { return new Group(obj.groupId, obj.groupName)});
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

        this.queryEC2("RegisterImage", params, this, false, "onComplete", callback);
    },

    deregisterImage : function(imageId, callback)
    {
        this.queryEC2("DeregisterImage", [ [ "ImageId", imageId ] ], this, false, "onComplete", callback);
    },

    createSnapshot : function(volumeId, callback)
    {
        this.queryEC2("CreateSnapshot", [ [ "VolumeId", volumeId ] ], this, false, "onComplete:snapshotId", callback);
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
        if (size != null) params.push([ "Size", size ]);
        if (snapshotId != null) params.push([ "SnapshotId", snapshotId ]);
        if (zone != null) params.push([ "AvailabilityZone", zone ]);
        this.queryEC2("CreateVolume", params, this, false, "onComplete:volumeId", callback);
    },

    deleteSnapshot : function(snapshotId, callback)
    {
        this.queryEC2("DeleteSnapshot", [ [ "SnapshotId", snapshotId ] ], this, false, "onComplete", callback);
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
            var id = getNodeValue(item, "volumeId");
            var type = getNodeValue(item, "volumeType");
            var size = getNodeValue(item, "size");
            var snapshotId = getNodeValue(item, "snapshotId");

            var zone = getNodeValue(item, "availabilityZone");
            var status = getNodeValue(item, "status");
            var createTime = new Date(getNodeValue(item, "createTime"));

            // Zero out the values for attachment
            var aitem = this.getItems(item, "attachmentSet", "item");
            var instanceId = getNodeValue(aitem[0], "instanceId");
            var device = getNodeValue(aitem[0], "device");
            var attachStatus = getNodeValue(aitem[0], "status");
            var deleteOnTermination = getNodeValue(aitem[0], "deleteOnTermination");
            var attachTime = new Date(getNodeValue(aitem[0], "attachTime"));
            var tags = this.getTags(item);
            list.push(new Volume(id, type, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, deleteOnTermination, tags));
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

            var volumeId = getNodeValue(item, "volumeId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var status = getNodeValue(item, "status");

            var vitems = this.getItems(item, "eventSet", "item");
            var eventId = vitems.length ? getNodeValue(vitems[0], "eventId") : "";
            var eventType = vitems.length ? getNodeValue(vitems[0], "eventType") : "";
            var edescr = vitems.length ? getNodeValue(vitems[0], "description") : "";
            var startTime = vitems.length ? getNodeValue(vitems[0], "notBefore") : "";
            var endTime = vitems.length ? getNodeValue(vitems[0], "notAfter") : "";

            var aitems = this.getItems(item, "actionSet", "item");
            var action = aitems.length ? getNodeValue(aitems[0], "code") : "";
            var adescr = aitems.length ? getNodeValue(aitems[0], "description") : "";

            list.push(new VolumeStatusEvent(volumeId, status, availabilityZone, eventId, eventType, edescr, startTime, endTime, action, adescr));
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
            var id = getNodeValue(item, "snapshotId");
            var volumeId = getNodeValue(item, "volumeId");
            var status = getNodeValue(item, "status");
            var startTime = new Date(getNodeValue(item, "startTime"));
            var progress = getNodeValue(item, "progress");
            var volumeSize = getNodeValue(item, "volumeSize");
            var description = getNodeValue(item, "description");
            var ownerId = getNodeValue(item, "ownerId")
            var ownerAlias = getNodeValue(item, "ownerAlias")
            var tags = this.getTags(item);
            list.push(new Snapshot(id, volumeId, status, startTime, progress, volumeSize, description, ownerId, ownerAlias, tags));
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
                list.push({ id: group, type: 'Group', snapshotId: snapshotId })
            } else
            if (user != '') {
                list.push({ id: user, type: 'UserId', snapshotId: snapshotId })
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
            var id = getNodeValue(item, "vpcId");
            var cidr = getNodeValue(item, "cidrBlock");
            var state = getNodeValue(item, "state");
            var dhcpopts = getNodeValue(item, "dhcpOptionsId");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var tags = this.getTags(item);
            list.push(new Vpc(id, cidr, state, dhcpopts, tenancy, tags));
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
            var id = getNodeValue(item, "subnetId");
            var vpcId = getNodeValue(item, "vpcId");
            var cidrBlock = getNodeValue(item, "cidrBlock");
            var state = getNodeValue(item, "state");
            var availableIp = getNodeValue(item, "availableIpAddressCount");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var tags = this.getTags(item);
            list.push(new Subnet(id, vpcId, cidrBlock, state, availableIp, availabilityZone, tags));
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
            var tags = this.getTags(item);
            list.push(new DhcpOptions(id, options.join("; "), tags));
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
            var entryList = [], assocList = []
            var id = getNodeValue(item, "networkAclId");
            var vpcId = getNodeValue(item, "vpcId");
            var dflt = getNodeValue(item, "default");

            var entries = item.getElementsByTagName("entrySet")[0].getElementsByTagName("item");
            for ( var j = 0; j < entries.length; j++) {
                var num = getNodeValue(entries[j], "ruleNumber");
                var proto = getNodeValue(entries[j], "protocol");
                var action = getNodeValue(entries[j], "ruleAction");
                var egress = getNodeValue(entries[j], "egress");
                var cidr = getNodeValue(entries[j], "cidrBlock");

                var icmpList = [], portList = []
                var code = getNodeValue(entries[j], "code");
                var type = getNodeValue(entries[j], "type");
                if (code != "" && type != "") {
                    icmpList.push([code, type])
                }
                var from = getNodeValue(entries[j], "from");
                var to = getNodeValue(entries[j], "to");
                if (from != "" && to != "") {
                    portList.push([from, to])
                }
                entryList.push(new NetworkAclEntry(id, num, proto, action, egress, cidr, icmpList, portList))
            }

            var assoc = item.getElementsByTagName("associationSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < assoc.length; j++) {
                var aid = getNodeValue(assoc[j], "networkAclAssociationId");
                var acl = getNodeValue(assoc[j], "networkAclId");
                var subnet = getNodeValue(assoc[j], "subnetId");
                assocList.push(new NetworkAclAssociation(aid, acl, subnet))
            }
            var tags = this.getTags(item);
            list.push(new NetworkAcl(id, vpcId, dflt, entryList, assocList, tags));
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
            var id = getNodeValue(item, "vpnGatewayId");
            var availabilityZone = getNodeValue(item, "availabilityZone");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var attachments = new Array();

            var atttags = item.getElementsByTagName("attachments")[0].getElementsByTagName("item");
            for ( var j = 0; j < atttags.length; j++) {
                var vpcId = getNodeValue(atttags[j], "vpcId");
                var attstate = getNodeValue(atttags[j], "state");
                var att = new VpnGatewayAttachment(vpcId, id, attstate);
                attachments.push(att);
            }
            list.push(new VpnGateway(id, availabilityZone, state, type, attachments));
        }
        this.core.setModel('vpnGateways', list);
        response.result = list;
    },

    createVpnGateway : function(type, az, callback)
    {
        this.queryEC2("CreateVpnGateway", [ [ "Type", type ], [ "AvailabilityZone", az ] ], this, false, "onComplete:vpnGatewayId", callback);
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
            var id = getNodeValue(item, "customerGatewayId");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var ipAddress = getNodeValue(item, "ipAddress");
            var bgpAsn = getNodeValue(item, "bgpAsn");
            var tags = this.getTags(item);
            list.push(new CustomerGateway(id, ipAddress, bgpAsn, state, type, tags));
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
            var vpcId = null, tags = []
            var id = getNodeValue(item, "internetGatewayId");

            var etags = item.getElementsByTagName("attachmentSet")[0].getElementsByTagName("item");
            for ( var j = 0; j < etags.length; j++) {
                vpcId = getNodeValue(etags[j], "vpcId");
            }
            var tags = this.getTags(item);
            list.push(new InternetGateway(id, vpcId, tags));
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
            var id = getNodeValue(item, "vpnConnectionId");
            var cgwId = getNodeValue(item, "customerGatewayId");
            var vgwId = getNodeValue(item, "vpnGatewayId");
            var type = getNodeValue(item, "type");
            var state = getNodeValue(item, "state");
            var ipAddress = getNodeValue(item, "ipAddress");
            // Required since Firefox limits nodeValue to 4096 bytes
            var cgwtag = item.getElementsByTagName("customerGatewayConfiguration")
            var config = null;
            if (cgwtag[0]) {
                config = cgwtag[0].textContent;
            }

            var bgpAsn = getNodeValue(item, "bgpAsn");
            var tags = this.getTags(item);
            list.push(new VpnConnection(id, vgwId, cgwId, type, state, config, tags));
        }
        this.core.setModel('vpnConnections', list);
        response.result = list;
    },

    createVpnConnection : function(type, cgwid, vgwid, callback)
    {
        this.queryEC2("CreateVpnConnection", [ [ "Type", type ], [ "CustomerGatewayId", cgwid ], [ "VpnGatewayId", vgwid ] ], this, false, "onComplete:vpnConnectionId", callback);
    },

    deleteVpnConnection : function(id, callback)
    {
        this.queryEC2("DeleteVpnConnection", [ [ "VpnConnectionId", id ] ], this, false, "onComplete", callback);
    },

    unpackImage: function(item)
    {
        if (!item) return null;
        var imageId = getNodeValue(item, "imageId");
        var imageLocation = getNodeValue(item, "imageLocation");
        var imageState = getNodeValue(item, "imageState");
        var owner = getNodeValue(item, "imageOwnerId");
        var isPublic = getNodeValue(item, "isPublic");
        var platform = getNodeValue(item, "platform");
        var aki = getNodeValue(item, "kernelId");
        var ari = getNodeValue(item, "ramdiskId");
        var rdt = getNodeValue(item, "rootDeviceType");
        var rdn = getNodeValue(item, "rootDeviceName");
        var ownerAlias = getNodeValue(item, "imageOwnerAlias");
        var productCodes = this.getItems(item, "productCodes", "item", ["productCode", "type"], function(obj) { return new Group(obj.productCode, obj.type) });
        var name = getNodeValue(item, "name");
        var description = getNodeValue(item, "description");
        var snapshotId = getNodeValue(item, "snapshotId");
        var volumes = [];
        var objs = this.getItems(item, "blockDeviceMapping", "item");
        for (var i = 0; i < objs.length; i++) {
            var vdevice = getNodeValue(objs[i], "deviceName");
            var vname = getNodeValue(objs[i], "virtualName");
            var vid = getNodeValue(objs[i], "ebs", "snapshotId");
            var vsize = getNodeValue(objs[i], "ebs", "volumeSize");
            var vdel = getNodeValue(objs[i], "ebs", "deleteOnTermination");
            var nodev = objs[i].getElementsByTagName("noDevice");
            volumes.push(new BlockDeviceMapping(vdevice, vname, vid, vsize, vdel, nodev.length ? true : false));
        }
        var virtType = getNodeValue(item, 'virtualizationType');
        var hypervisor = getNodeValue(item, 'hypervisor');
        var arch = getNodeValue(item, 'architecture');
        var tags = this.getTags(item);
        return new AMI(imageId, name, description, imageLocation, imageState, (isPublic == 'true' ? 'public' : 'private'), arch, platform, aki, ari, rdt, rdn, owner, ownerAlias, snapshotId, volumes, virtType, hypervisor, productCodes, tags);
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

    describeImages : function( callback)
    {
        this.queryEC2("DescribeImages", [], this, false, "onCompleteDescribeImages", callback);
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

    describeLeaseOfferings : function(callback)
    {
        this.queryEC2("DescribeReservedInstancesOfferings", [], this, false, "onCompleteDescribeLeaseOfferings", callback);
    },

    onCompleteDescribeLeaseOfferings : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var items = this.getItems(xmlDoc, "reservedInstancesOfferingsSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "reservedInstancesOfferingId");
            var type = getNodeValue(item, "instanceType");
            var az = getNodeValue(item, "availabilityZone");
            var duration = secondsToYears(getNodeValue(item, "duration"));
            var fPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            var uPrice = getNodeValue(item, "usagePrice");
            var desc = getNodeValue(item, "productDescription");
            var otype = getNodeValue(item, "offeringType");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var rPrices = this.getItems(item, "recurringCharges", "item", ["frequency", "amount"], function(obj) { return new RecurringCharge(obj.frequency, obj.amount)});

            list.push(new LeaseOffering(id, type, az, duration, fPrice, uPrice, rPrices, desc, otype, tenancy));
        }

        this.core.setModel('offerings', list);
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
            var id = getNodeValue(item, "reservedInstancesId");
            var type = getNodeValue(item, "instanceType");
            var az = getNodeValue(item, "availabilityZone");
            var start = new Date(getNodeValue(item, "start"));
            var duration = secondsToYears(getNodeValue(item, "duration"));
            var fPrice = parseInt(getNodeValue(item, "fixedPrice")).toString();
            var uPrice = getNodeValue(item, "usagePrice");
            var count = getNodeValue(item, "instanceCount");
            var desc = getNodeValue(item, "productDescription");
            var state = getNodeValue(item, "state");
            var tenancy = getNodeValue(item, "instanceTenancy");
            var rPrices = this.getItems(item, "recurringCharges", "item", ["frequency", "amount"], function(obj) { return new RecurringCharge(obj.frequency, obj.amount)});

            list.push(new ReservedInstance(id, type, az, start, duration, fPrice, uPrice, rPrices, count, desc, state, tenancy));
        }

        this.core.setModel('reservedInstances', list);
        response.result = list;
    },

    purchaseOffering : function(id, count, callback)
    {
        this.queryEC2("PurchaseReservedInstancesOffering", [ [ "ReservedInstancesOfferingId", id ], [ "InstanceCount", count ] ], this, false, "onComplete", callback);
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
            var groups = [];
            var objs = this.getItems(item, "groupSet", "item", ["groupId", "groupName"]);
            for (var j = 0; j < objs.length; j++) {
                groups.push(new Group(objs[j].groupId, objs[j].groupName));
            }
            var instancesSet = item.getElementsByTagName("instancesSet")[0];
            var instanceItems = instancesSet.childNodes;
            if (instanceItems) {
                for (var j = 0; j < instanceItems.length; j++) {
                    if (instanceItems[j].nodeName == '#text') continue;
                    var instance = instanceItems[j];
                    var instanceId = getNodeValue(instance, "instanceId");
                    var imageId = getNodeValue(instance, "imageId");
                    var state = getNodeValue(instance, "instanceState", "name");
                    var productCodes = this.getItems(instance, "productCodes", "item", ["productCode", "type"], function(obj) { return new Group(obj.productCode, obj.type) });
                    var securityGroups = groups.concat(this.getGroups(instance));
                    var dnsName = getNodeValue(instance, "dnsName");
                    var privateDnsName = getNodeValue(instance, "privateDnsName");
                    var privateIpAddress = getNodeValue(instance, "privateIpAddress");
                    var vpcId = getNodeValue(instance, "vpcId");
                    var subnetId = getNodeValue(instance, "subnetId");
                    var keyName = getNodeValue(instance, "keyName");
                    var reason = getNodeValue(instance, "reason");
                    var amiLaunchIdx = getNodeValue(instance, "amiLaunchIndex");
                    var instanceType = getNodeValue(instance, "instanceType");
                    var launchTime = new Date(getNodeValue(instance, "launchTime"));
                    var availabilityZone = getNodeValue(instance, "placement", "availabilityZone");
                    var tenancy = getNodeValue(instance, "placement", "tenancy");
                    var monitoringStatus = toBool(getNodeValue(instance, "monitoring", "state"));
                    var stateReason = getNodeValue(instance, "stateReason", "code");
                    var platform = getNodeValue(instance, "platform");
                    var kernelId = getNodeValue(instance, "kernelId");
                    var ramdiskId = getNodeValue(instance, "ramdiskId");
                    var rootDeviceType = getNodeValue(instance, "rootDeviceType");
                    var rootDeviceName = getNodeValue(instance, "rootDeviceName");
                    var virtType = getNodeValue(instance, 'virtualizationType');
                    var hypervisor = getNodeValue(instance, 'hypervisor');
                    var ip = getNodeValue(instance, "ipAddress");
                    var srcDstCheck = getNodeValue(instance, 'sourceDestCheck');
                    var architecture = getNodeValue(instance, "architecture");
                    var instanceLifecycle = getNodeValue(instance, "instanceLifecycle")
                    var clientToken = getNodeValue(instance, "clientToken")
                    var spotId = getNodeValue(instance ,"spotInstanceRequestId");
                    var role = getNodeValue(instance, "iamInstanceProfile", "id");
                    var ebsOpt = toBool(getNodeValue(instance, "ebsOptimized"));
                    var volumes = [];
                    var objs = this.getItems(instance, "blockDeviceMapping", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var vdevice = getNodeValue(objs[i], "deviceName");
                        var vid = getNodeValue(objs[i], "ebs", "volumeId");
                        var vstatus = getNodeValue(objs[i], "ebs", "status");
                        var vtime = new Date(getNodeValue(objs[i], "ebs", "attachTime"));
                        var vdel = getNodeValue(objs[i], "ebs", "deleteOnTermination");
                        volumes.push(new InstanceBlockDeviceMapping(vdevice, vid, vstatus, vtime, vdel));
                    }
                    var enis = [];
                    var objs = this.getItems(instance, "networkInterfaceSet", "item");
                    for (var i = 0; i < objs.length; i++) {
                        var eid = getNodeValue(objs[i], "networkInterfaceId");
                        var estatus = getNodeValue(objs[i], "status");
                        var edescr = getNodeValue(objs[i], "description");
                        var esubnetId = getNodeValue(objs[i], "subnetId");
                        var evpcId = getNodeValue(objs[i], "vpcId");
                        var eownerId = getNodeValue(objs[i], "ownerId");
                        var eprivateIp = getNodeValue(objs[i], "privateIpAddress");
                        var epublicIp = getNodeValue(objs[i], "association", "publicIp");
                        var ednsName = getNodeValue(objs[i], "privateDnsName");
                        var esrcDstCheck = getNodeValue(objs[i], "sourceDestCheck");

                        var attachId = getNodeValue(objs[i], "attachment", "attachmentId");
                        var attachIndex = getNodeValue(objs[i], "attachment", "deviceIndex");
                        var attachStatus = getNodeValue(objs[i], "attachment", "status");
                        var attachDelete = getNodeValue(objs[i], "attachment", "deleteOnTermination");

                        var eips = [];
                        var objs = this.getItems(instance, "privateIpAddressesSet", "item");
                        for (var i = 0; i < objs.length; i++) {
                            var pIp = getNodeValue(objs[i], "privateIpAddress");
                            var pPrimary = getNodeValue(objs[i], "primary");
                            var pPublicIp = getNodeValue(objs[i], "association", "publicIp");
                            eips.push(new PrivateIpAddress(pIp, pPrimary, pPublicIp))
                        }
                        enis.push(new InstanceNetworkInterface(eid, estatus, edescr, esubnetId, evpcId, eownerId, eprivateIp, epublicIp, ednsName, esrcDstCheck, attachId, attachIndex, attachStatus, attachDelete, eips));
                    }
                    var tags = this.getTags(instance);

                    list.push(new Instance(reservationId, ownerId, requesterId, instanceId, imageId, state, productCodes, securityGroups, dnsName, privateDnsName, privateIpAddress,
                                           vpcId, subnetId, keyName, reason, amiLaunchIdx, instanceType, launchTime, availabilityZone, tenancy, monitoringStatus != "", stateReason,
                                           platform, kernelId, ramdiskId, rootDeviceType, rootDeviceName, virtType, hypervisor, ip, srcDstCheck, architecture, instanceLifecycle,
                                           clientToken, spotId, role, ebsOpt, volumes, enis, tags));
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

    runInstances : function(imageId, instanceType, minCount, maxCount, options, callback)
    {
        var params = []
        params.push([ "ImageId", imageId ]);
        params.push([ "InstanceType", instanceType ]);
        params.push([ "MinCount", minCount ]);
        params.push([ "MaxCount", maxCount ]);

        if (options.kernelId) {
            params.push([ "KernelId", options.kernelId ]);
        }
        if (options.ramdiskId) {
            params.push([ "RamdiskId", options.ramdiskId ]);
        }
        if (options.keyName) {
            params.push([ "KeyName", options.keyName ]);
        }
        if (options.instanceProfile) {
            params.push(["IamInstanceProfile.Name", options.instanceProfile])
        }
        for (var i in options.securityGroups) {
            params.push([ "SecurityGroupId." + parseInt(i), typeof options.securityGroups[i] == "object" ? options.securityGroups[i].id : options.securityGroups[i] ]);
        }
        if (options.userData != null) {
            var b64str = "Base64:";
            if (options.userData.indexOf(b64str) != 0) {
                // This data needs to be encoded
                options.userData = Base64.encode(options.userData);
            } else {
                options.userData = options.userData.substring(b64str.length);
            }
            params.push([ "UserData", options.userData ]);
        }
        if (options.additionalInfo) {
            params.push([ "AdditionalInfo", options.additionalInfo ]);
        }
        if (options.clientToken) {
            params.push([ "ClientToken", options.clientToken])
        }
        if (options.ebsOptimized) {
            params.push(["EbsOptimized", "true"]);
        }
        if (options.monitoringEnabled) {
            params.push([ "Monitoring.Enabled", "true"]);
        }
        if (options.disableApiTermination) {
            params.push([ "DisableApiTermination", "true"]);
        }
        if (options.instanceInitiatedShutdownBehaviour) {
            params.push([ "InstanceInitiatedShutdownBehavior", options.instanceInitiatedShutdownBehaviour]);
        }
        if (options.availabilityZone) {
            params.push([ "Placement.AvailabilityZone", options.availabilityZone ]);
        }
        if (options.tenancy) {
            params.push([ "Placement.Tenancy", options.tenancy ]);
        }
        if (options.subnetId) {
            params.push([ "SubnetId", options.subnetId ]);
            if (options.privateIpAddress) {
                params.push([ "PrivateIpAddress", options.privateIpAddress ]);
            }
        }
        if (options.blockDeviceMapping) {
            params.push([ 'BlockDeviceMapping.1.DeviceName', options.blockDeviceMapping.deviceName ]);
            if (options.blockDeviceMapping.virtualName) {
                params.push([ 'BlockDeviceMapping.1.VirtualName', options.blockDeviceMapping.virtualName ]);
            } else
            if (options.blockDeviceMapping.snapshotId) {
                params.push([ 'BlockDeviceMapping.1.Ebs.SnapshotId', options.blockDeviceMapping.snapshotId ]);
                params.push([ 'BlockDeviceMapping.1.Ebs.DeleteOnTermination', options.blockDeviceMapping.deleteOnTermination ? true : false ]);
            } else
            if (options.blockDeviceMapping.volumeSize) {
                params.push([ 'BlockDeviceMapping.1.Ebs.VolumeSize', options.blockDeviceMapping.volumeSize ]);
            }
        }
        if (options.networkInterface) {
            params.push([ "NetworkInterface.0.DeviceIndex", options.networkInterface.deviceIndex])
            if (options.networkInterface.eniId) {
                params.push([ "NetworkInterface.0.NetworkInterfaceId", options.networkInterface.eniId])
            }
            if (options.networkInterface.subnetId) {
                params.push([ "NetworkInterface.0.SubnetId", options.networkInterface.subnetId])
            }
            if (options.networkInterface.description) {
                params.push([ "NetworkInterface.0.Description", options.networkInterface.description])
            }
            if (options.networkInterface.privateIpAddress) {
                params.push([ "NetworkInterface.0.PrivateIpAddresses.0.Primary", "true"])
                params.push([ "NetworkInterface.0.PrivateIpAddresses.0.PrivateIpAddress", options.networkInterface.privateIpAddress])
            }
            for (var i in options.networkInterface.secondaryIpAddresses) {
                params.push([ "NetworkInterface.0.PrivateIpAddresses." + (parseInt(i) + 1) + ".Primary", "false"])
                params.push([ "NetworkInterface.0.PrivateIpAddresses." + (parseInt(i) + 1) + ".PrivateIpAddress", options.networkInterface.secondaryIpAddresses[i]])
            }
            for (var i in options.networkInterface.securityGroups) {
                params.push([ "NetworkInterface.0.SecurityGroupId." + parseInt(i), options.networkInterface.securityGroups[i]])
            }
        }

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

    describeInstanceStatus : function (callback) {
        this.queryEC2("DescribeInstanceStatus", [], this, false, "onCompleteDescribeInstanceStatus", callback);
    },

    onCompleteDescribeInstanceStatus : function (response)
    {
        var xmlDoc = response.responseXML;
        var items = this.getItems(xmlDoc, "instanceStatusSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var list = new Array();
            var instanceId = getNodeValue(item, "instanceId");
            var availabilityZone = getNodeValue(item, "availabilityZone");

            var objs = item.getElementsByTagName("systemStatus");
            for (var j = 0; j < objs.length; j++) {
                var status = getNodeValue(objs[j], "status");
                var details = this.getItems(objs[j], "details", "item");
                for (var k = 0; k < details.length; k++) {
                    var name = getNodeValue(details[k], "name");
                    var code = getNodeValue(details[k], "status");
                    var date = getNodeValue(details[k], "impairedSince");
                    list.push(new InstanceStatusEvent(instanceId, availabilityZone, status, code, name, date, ""));
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
                    list.push(new InstanceStatusEvent(instanceId, availabilityZone, status, code, name, date, ""));
                }
            }

            var objs = this.getItems(item, "eventsSet", "items");
            for (var j = 0; j < objs.length; j++) {
                var code = getNodeValue(objs[j], "code");
                var description = getNodeValue(objs[j], "description");
                var startTime = getNodeValue(objs[j], "notBefore");
                var endTime = getNodeValue(objs[j], "notAfter");
                list.push(new InstanceStatusEvent(instanceId, availabilityZone, "", code, description, startTime, endTime));
            }

            var instance = this.core.findModel('instances', instanceId);
            if (instance) instance.events = list;
        }
    },

    terminateInstances : function(instances, callback)
    {
        var params = []
        for ( var i in instances) {
            params.push([ "InstanceId." + (i + 1), instances[i].id ]);
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
        var s3policy = (policyStr = '{' + '"expiration": "' + expiry.toISOString(5) + '",' + '"conditions": [' + '{"bucket": "' + bucket + '"},' + '{"acl": "ec2-bundle-read"},' + '["starts-with", "$key", "' + prefix + '"]' + ']}');
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
        var instanceId = getNodeValue(item, "instanceId");
        var id = getNodeValue(item, "bundleId");
        var state = getNodeValue(item, "state");

        var startTime = new Date(getNodeValue(item, "startTime"));
        var updateTime = new Date(getNodeValue(item, "updateTime"));
        var storage = item.getElementsByTagName("storage")[0];
        var s3bucket = getNodeValue(storage, "bucket");
        var s3prefix = getNodeValue(storage, "prefix");
        var error = item.getElementsByTagName("error")[0];
        var errorMsg = "";
        if (error) {
            errorMsg = getNodeValue(error, "message");
        }
        var progress = getNodeValue(item, "progress");
        if (progress.length > 0) {
            state += " " + progress;
        }

        return new BundleTask(id, instanceId, state, startTime, updateTime, s3bucket, s3prefix, errorMsg);
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
        if (region) {
            content = "<CreateBucketConstraint><LocationConstraint>" + region + "</LocationConstraint></CreateBucketConstraint>";
        }
        this.queryS3("PUT", bucket, "", "", params, content, this, false, "onComplete", callback);
    },

    listS3Buckets : function(callback)
    {
        this.queryS3("GET", "", "", "", {}, content, this, false, "onCompleteListS3Buckets", callback);
    },

    onCompleteListS3Buckets : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var owner = getNodeValue(xmlDoc, "ID")
        var items = xmlDoc.getElementsByTagName("Bucket");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "Name");
            var date = getNodeValue(items[i], "CreationDate");
            list.push(new S3Bucket(name, date, owner));
        }
        this.core.setModel('s3Buckets', list);

        response.result = list;
    },

    getS3BucketPolicy : function(bucket, callback)
    {
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
    },

    setS3BucketPolicy : function(bucket, policy, callback)
    {
        var params = {}
        params["Content-Type"] = "application/xml; charset=UTF-8";
        this.queryS3("PUT", bucket, "", "?policy", params, policy, this, false, "onComplete", callback);
    },

    getS3BucketAcl : function(bucket, callback)
    {
        this.queryS3("GET", bucket, "", "?acl", {}, content, this, false, "onCompleteGetS3BucketAcl", callback);
    },

    onCompleteGetS3BucketAcl : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];

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
        var bucket = response.params[0];
        var obj = this.core.getS3Bucket(bucket);
        if (obj) obj.acls = null; else obj = { acls: list };

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
        var bucket = response.params[0];

        var region = getNodeValue(xmlDoc, "LocationConstraint");
        var obj = this.core.getS3Bucket(bucket)
        if (obj) obj.region = region;
        response.result = region;
    },

    // Return list in syn cmode
    listS3BucketKeys : function(bucket, params, callback)
    {
        this.queryS3("GET", bucket, "", "", params, null, this, callback ? false : true, "onCompleteListS3BucketKeys", callback);
    },

    onCompleteListS3BucketKeys : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = new Array();
        var bucket = getNodeValue(xmlDoc, "Name");
        var items = xmlDoc.getElementsByTagName("Contents");
        for ( var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "Key");
            var size = getNodeValue(items[i], "Size");
            var type = getNodeValue(items[i], "StorageClass");
            var etag = getNodeValue(items[i], "ETag");
            var mtime = getNodeValue(items[i], "LastModified");
            var owner = getNodeValue(items[i], "ID")
            list.push(new S3BucketKey(bucket, id, type, size, mtime, owner, etag));
        }
        var obj = this.core.getS3Bucket(bucket);
        if (obj) {
            obj.keys = list;
        } else {
            obj = new S3Bucket(bucket);
            obj.keys = list;
        }
        response.result = obj;
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
        var bucket = response.params[0];
        var key = response.params[1];

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
        var bucket = response.params[0];
        var key = response.params[1];

        var obj = this.core.getS3BucketKey(bucket, key)
        if (obj) obj.acls = null;

        response.result = obj;
    },

    getS3BucketWebsite : function(bucket, callback)
    {
        this.queryS3("GET", bucket, "", "?website", {}, null, this, callback ? false : true, "onCompleteGetS3BucketWebsite", callback);
    },

    onCompleteGetS3BucketWebsite : function(response)
    {
        var xmlDoc = response.responseXML;
        var bucket = response.params[0];
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
            var name = getNodeValue(items[i], "keyName");
            var fp = getNodeValue(items[i], "keyFingerprint");
            list.push(new KeyPair(name, fp));
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

        var name = getNodeValue(xmlDoc, "keyName");
        var fp = getNodeValue(xmlDoc, "keyFingerprint");
        var material = getNodeValue(xmlDoc, "keyMaterial");

        response.result = new KeyPair(name, fp, material);
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
            var routes = [], associations = []
            var id = getNodeValue(item, "routeTableId");
            var vpcId = getNodeValue(item, "vpcId");
            var main = getNodeValue(item, "main");

            var routeItems = item.getElementsByTagName("routeSet")[0].childNodes;
            for ( var j = 0; routeItems && j < routeItems.length; j++) {
                if (routeItems.item(j).nodeName == '#text') continue;
                var cidr = getNodeValue(routeItems.item(j), "destinationCidrBlock");
                var gateway = getNodeValue(routeItems.item(j), "gatewayId");
                var instance = getNodeValue(routeItems.item(j), "instanceId");
                var owner = getNodeValue(routeItems.item(j), "instanceOwnerId");
                var eni = getNodeValue(routeItems.item(j), "networkInterfaceId");
                var state = getNodeValue(routeItems.item(j), "state");
                routes.push(new Route(id, cidr, state, gateway, eni, instance, owner));
            }
            var assocSet = item.getElementsByTagName("associationSet")[0];
            var assocItems = assocSet.childNodes;
            if (assocItems) {
                for ( var j = 0; j < assocItems.length; j++) {
                    if (assocItems.item(j).nodeName == '#text') continue;
                    var aid = getNodeValue(assocItems.item(j), "routeTableAssociationId");
                    var table = getNodeValue(assocItems.item(j), "routeTableId");
                    var subnet = getNodeValue(assocItems.item(j), "subnetId");
                    associations.push(new RouteAssociation(aid, table, subnet));
                }
            }
            var tags = this.getTags(item);
            list.push(new RouteTable(id, vpcId, main, routes, associations, tags));
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
            for (var i in groups) {
                params.push(["SecurityGroupId."+(i+1), groups[i]]);
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
        this.queryEC2("DescribeNetworkInterfaces", [], this, false, "onCompleteDescribeNetworkInterfaces", callback);
    },

    onCompleteDescribeNetworkInterfaces : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "networkInterfaceSet", "item");
        for ( var i = 0; i < items.length; i++) {
            var item = items[i];
            var id = getNodeValue(item, "networkInterfaceId");
            var subnetId = getNodeValue(item, "subnetId");
            var vpcId = getNodeValue(item, "vpcId");
            var descr = getNodeValue(item, "description");
            var status = getNodeValue(item, "status");
            var mac = getNodeValue(item, "macAddress");
            var ip = getNodeValue(item, "privateIpAddress");
            var check = getNodeValue(item, "sourceDestCheck");
            var azone = getNodeValue(item, "availabilityZone");
            var tags = [];
            var attachment = null;
            var association = null;

            var aitem = item.getElementsByTagName("attachment")[0];
            if (aitem) {
                var aid = getNodeValue(aitem, "attachmentId");
                var instId = getNodeValue(aitem, "instanceId");
                var owner = getNodeValue(aitem, "instanceOwnerId");
                var index = getNodeValue(aitem, "deviceIndex");
                var astatus = getNodeValue(aitem, "status");
                var time = getNodeValue(aitem, "attachTime");
                var del = getNodeValue(aitem, "deleteOnTermination");
                attachment = new NetworkInterfaceAttachment(aid, instId, owner, index, astatus, time, del);
            }

            aitem = item.getElementsByTagName("association")[0];
            if (aitem) {
                aid = getNodeValue(aitem, "associationId");
                var pubip = getNodeValue(aitem, "publicIp");
                var owner = getNodeValue(aitem, "ipOwnerId");
                var instId = getNodeValue(aitem, "instanceID");
                var attId = getNodeValue(aitem, "attachmentID");
                association = new NetworkInterfaceAssociation(aid, pubip, owner, instId, attId);
            }
            var pips = [];
            var objs = this.getItems(item, "privateIpAddressesSet", "item");
            for (var j = 0; j < objs.length; j++) {
                var pIp = getNodeValue(objs[j], "privateIpAddress");
                var pPrimary = getNodeValue(objs[j], "primary");
                var pPublicIp = getNodeValue(objs[j], "association", "publicIp");
                var pAssoc = getNodeValue(objs[j], "association", "associationId");
                pips.push(new PrivateIpAddress(pIp, pPrimary, pPublicIp, pAssoc))
            }

            var groups = this.getGroups(item);
            var tags = this.getTags(item);
            list.push(new NetworkInterface(id, status, descr, subnetId, vpcId, azone, mac, ip, check, groups, attachment, association, pips, tags));
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
            var ownerId = getNodeValue(item, "ownerId");
            var groupId = getNodeValue(item, "groupId");
            var groupName = getNodeValue(item, "groupName");
            var groupDescription = getNodeValue(item, "groupDescription");
            var vpcId = getNodeValue(item, "vpcId");
            log("Group name [id=" + groupId + ", name=" + groupName + ", vpcId=" + vpcId + "]");

            var ipPermissions = item.getElementsByTagName("ipPermissions")[0];
            var ipPermissionsList = this.parsePermissions('Ingress', [], ipPermissions.childNodes);
            ipPermissions = item.getElementsByTagName("ipPermissionsEgress")[0];
            ipPermissionsList = this.parsePermissions('Egress', ipPermissionsList, ipPermissions.childNodes);
            var tags = this.getTags(item);
            list.push(new SecurityGroup(groupId, ownerId, groupName, groupDescription, vpcId, ipPermissionsList, tags));
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
        var params = typeof group == "object" ? [ [ "GroupId", group.id ] ] : [ [ "GroupName", group ] ]
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
        if (output.textContent) {
            output = Base64.decode(output.textContent);
            output = output.replace(/\x1b/mg, "\n").replace(/\r/mg, "").replace(/\n+/mg, "\n");
        } else {
            output = '';
        }
        response.result = output;
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
            var name = getNodeValue(items[i], "zoneName");
            var state = getNodeValue(items[i], "zoneState");
            var msg = this.getItems(items[i], "messageSet", "item", ["message"], function(obj) { return obj.message; });
            list.push(new AvailabilityZone(name, state, msg));
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
            var publicIp = getNodeValue(items[i], "publicIp");
            var instanceid = getNodeValue(items[i], "instanceId");
            var allocId = getNodeValue(items[i], "allocationId");
            var assocId = getNodeValue(items[i], "associationId");
            var domain = getNodeValue(items[i], "domain");
            var tags = this.getTags(items[i]);
            list.push(new EIP(publicIp, instanceid, allocId, assocId, domain, tags));
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

    associateAddress : function(eip, instanceId, networkInterfaceId, callback)
    {
        var params = eip.allocationId ? [["AllocationId", eip.allocationId]] : [[ 'PublicIp', eip.publicIp ]]
        if (instanceId) {
            params.push([ 'InstanceId', instanceId ])
        }
        if (networkInterfaceId) {
            params.push([ 'NetworkInterfaceId', networkInterfaceId ])
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
            var LoadBalancerName = getNodeValue(items[i], "LoadBalancerName");
            var CreatedTime = getNodeValue(items[i], "CreatedTime");
            var DNSName = getNodeValue(items[i], "DNSName");
            var hostName = getNodeValue(items[i], "CanonicalHostedZoneName");
            var zoneId = getNodeValue(items[i], "CanonicalHostedZoneNameID");
            var Instances = new Array();
            var InstanceId = items[i].getElementsByTagName("InstanceId");
            for ( var j = 0; j < InstanceId.length; j++) {
                Instances.push(InstanceId[j].firstChild.nodeValue);
            }

            var listeners = [];
            var members = this.getItems(items[i], "ListenerDescriptions", "member");
            for ( var k = 0; k < members.length; k++) {
                var Protocol = getNodeValue(members[k], "Protocol");
                var Port = getNodeValue(members[k], "LoadBalancerPort");
                var InstancePort = getNodeValue(members[k], "InstancePort");
                var InstanceProtocol = getNodeValue(members[k], "InstanceProtocol");
                var policies = this.getItems(members[k], "Policies", "member", null, function(obj) { return obj.firstChild.nodeValue; });
                listeners.push(new LoadBalancerListener(Protocol, Port, InstanceProtocol, InstancePort))
            }

            var Target = getNodeValue(items[i], "HealthCheck", "Target");
            var Interval = getNodeValue(items[i], "HealthCheck", "Interval");
            var Timeout = getNodeValue(items[i], "HealthCheck", "Timeout");
            var HealthyThreshold = getNodeValue(items[i], "HealthCheck", "HealthyThreshold");
            var UnhealthyThreshold = getNodeValue(items[i], "HealthCheck", "UnhealthyThreshold");
            var HealthCheck = new LoadBalancerHealthCheck(Target, Interval, Timeout, HealthyThreshold, UnhealthyThreshold);

            var azones = this.getItems(items[i], "AvailabilityZones", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            var apolicies = this.getItems(items[i], "AppCookieStickinessPolicies", "member", ["PolicyName", "CookieName"], function(obj) { return new LoadBalancerPolicy(obj.PolicyName, obj.CookieName) });
            var lbpolicies = this.getItems(items[i], "LBCookieStickinessPolicies", "member", ["PolicyName", "CookieExpirationPeriod"], function(obj) { return new LoadBalancerPolicy(obj.PolicyName, "", obj.CookieExpirationPeriod) });
            var opolicies = this.getItems(items[i], "OtherPolicies", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            var groups = this.getItems(items[i], "SecurityGroups", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            var subnets = this.getItems(items[i], "Subnets", "member", null, function(obj) { return obj.firstChild.nodeValue; });
            var srcGroup = getNodeValue(items[i], "SourceSecurityGroup", "GroupName");
            var vpcId = getNodeValue(items[i], "VPCId");
            var scheme = getNodeValue(items[i], "Scheme");
            list.push(new LoadBalancer(LoadBalancerName, CreatedTime, DNSName, hostName, zoneId, Instances, listeners, HealthCheck, azones, apolicies, lbpolicies, opolicies, vpcId, scheme, subnets, srcGroup, groups));
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
            var Description = getNodeValue(items[i], "Description");
            var State = getNodeValue(items[i], "State");
            var InstanceId = getNodeValue(items[i], "InstanceId");
            var ReasonCode = getNodeValue(items[i], "ReasonCode");

            list.push(new InstanceHealth(Description, State, InstanceId, ReasonCode));
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
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "PolicyTypeDescriptions", "member");
        for (var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "PolicyTypeName");
            var descr = getNodeValue(items[i], "Description");
            var attrs = this.getItems(xmlDoc, "PolicyAttributeTypeDescriptions", "member");
            var attributes = [];
            for (var j = 0; j < attrs.length; j++) {
                var aname = getNodeValue(attrs[j], "AttributeName");
                var atype = getNodeValue(attrs[j], "AttributeType");
                var aval = getNodeValue(attrs[j], "DefaultValue");
                var acard = getNodeValue(attrs[j], "Cardinality");
                var adesc = getNodeValue(attrs[j], "Description");
                attributes.push(new PolicyTypeAttributeDescription(aname, atype, acard, adesc, aval))
            }
            list.push(new PolicyTypeDescription(name, descr, attributes))
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

    createLoadBalancer : function(LoadBalancerName, protocol, elbport, instanceport, azone, subnet, groups, scheme, callback)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "AvailabilityZones.member.1", azone ]);
        if (subnet) {
            params.push(["Subnets.member.1", subnet]);
            for (var i = 0; i < groups.length; i++) {
                params.push(["SecurityGroups.member." + (i + 1), groups[i]]);
            }
        }
        params.push([ "Listeners.member.Protocol", protocol ]);
        if (protocol == "HTTPS") {
            params.push([ "Listeners.member.SSLCertificateId", "arn:aws:iam::322191361670:server-certificate/testCert" ]);
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

    setLoadBalancerPoliciesForBackendServer: function(LoadBalancerName, InstancePort, PolicyNames, callbcak)
    {
        var params = []
        params.push([ "LoadBalancerName", LoadBalancerName ]);
        params.push([ "InstancePort", InstancePort ]);
        for (var i = 0; i < PolicyNames.length; i++) {
            params.push([ "PolicyNames.member." + (i + 1), PolicyNames[i] ]);
        }
        this.queryELB("SetLoadBalancerPoliciesForBackendServer", params, this, false, "onComplete", callback);
    },

    setLoadBalancerPoliciesOfListener: function(LoadBalancerName, LoadBalancerPort, PolicyNames, callbcak)
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

    createLoadBalancerPolicy: function(LoadBalancerName, PolicyName, PolicyType, PolicyAttributes, callbcak)
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

    deleteLoadBalancerListeners: function(LoadBalancerName, LoadBalancerPorts, callbcak)
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

        var user = getNodeValue(xmlDoc, "UserName");
        var key = getNodeValue(xmlDoc, "AccessKeyId");
        var secret = getNodeValue(xmlDoc, "SecretAccessKey");
        var status = getNodeValue(xmlDoc, "Status");
        debug("Access key = " + key + ", secret = " + secret)

        response.result = new AccessKey(key, secret, status, user);
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
            var id = getNodeValue(items[i], "AccessKeyId");
            var status = getNodeValue(items[i], "Status");
            var date = getNodeValue(items[i], "CreateDate");
            list.push(new AccessKey(id, "", status, user, date));
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
            var serial = getNodeValue(items[i], "SerialNumber");
            var arn = getNodeValue(items[i], "Arn");
            var date = getNodeValue(items[i], "EnableDate");
            var user = getNodeValue(items[i], "UserName");
            list.push(new MFADevice(serial, date, arn.split(/[:\/]+/).pop(), user));
            debug(i + " " + serial)
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
        if (user) params.push(["UserName", user]);
        this.queryIAM("ListMFADevices", params, this, false, "onCompleteListMFADevices", callback);
    },

    onCompleteListMFADevices : function(response)
    {
        var xmlDoc = response.responseXML;
        var params = response.params;

        var list = this.getItems(xmlDoc, "MFADevices", "member", ["SerialNumber", "EnableDate"], function(obj) { return new MFADevice(obj.SerialNumber, obj.EnableDate)});

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
        var arn = getNodeValue(item, "Arn");
        var path = getNodeValue(item, "Path");
        var id = getNodeValue(item, "InstanceProfileId");
        var name = getNodeValue(item, "InstanceProfileName");
        var date = getNodeValue(item, "CreateDate");
        var roles = [];
        var objs = this.getItems(item, "Roles", "member");
        for (var i = 0; i < objs.length; i++) {
            roles.push(this.unpackRole(objs[i]));
        }
        return new InstanceProfile(id, name, arn, path, roles, date)
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
        this.queryIAM("GetInstanceProfile", [ ["InstanceProfileName", user] ], this, false, "onCompleteGetInstanceProfile", callback);
    },

    onCompleteGetInstanceProfile : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackInstanceProfile(xmlDoc);
    },

    unpackRole: function(item)
    {
        var arn = getNodeValue(item, "Arn");
        var path = getNodeValue(item, "Path");
        var id = getNodeValue(item, "RoleId");
        var name = getNodeValue(item, "RoleName");
        var policy = decodeURIComponent(getNodeValue(item, "AssumeRolePolicyDocument"));
        var date = getNodeValue(item, "CreateDate");
        return new Role(id, name, arn, path, policy, date)
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
        this.queryIAM("GetRole", [ ["RoleName", user] ], this, false, "onCompleteGetRole", callback);
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
        var id = getNodeValue(item, "UserId");
        var name = getNodeValue(item, "UserName");
        var path = getNodeValue(item, "Path");
        var arn = getNodeValue(item, "Arn");
        return new User(id, name, path, arn)
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
        if (name) params.push(["UserName", user])
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
        this.queryIAM("DeleteUserPolicy", [ ["UserName", user], [ "PolicyName", policy ] ], this, false, "onComplete", callback);
    },

    onCompleteGetPolicy : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = decodeURIComponent(getNodeValue(xmlDoc, "PolicyDocument"));
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
        var path = getNodeValue(item, "Path");
        var name = getNodeValue(item, "GroupName");
        var id = getNodeValue(item, "GroupId");
        var arn = getNodeValue(item, "Arn");
        return new UserGroup(id, name, path, arn);
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

        var users = this.getItems(xmlDoc, 'Users', 'member', ["UserId", "UserName", "Path", "Arn"], function(obj) { return new User(obj.UserId, obj.UserName, obj.Path, obj.Arn); });

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
            params.push([ p, obj[p]])
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
            var id = getNodeValue(items[i], "CertificateId");
            var body = getNodeValue(items[i], "CertificateBody");
            var user = getNodeValue(items[i], "UserName");
            list.push(new Certificate(id, user, body));
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
        if (path) params.push([["Path", user]])
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
        var id = getNodeValue(item, "ServerCertificateId");
        var name = getNodeValue(item, "ServerCertificateName");
        var arn = getNodeValue(item, "Arn");
        var path = getNodeValue(item, "Path");
        var date = getNodeValue(item, "UploadDate");
        var body = getNodeValue(item, "CertificateBody");
        return new ServerCertificate(id, name, arn, path, date, body);
    },

    onCompleteGetServerCertificate : function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.unpackServerCertificate(xmlDoc);
    },

    listServerCertificates : function(callback)
    {
        var params = [];
        this.queryIAM("ListServerCertificates", params, this, false, "onCompleteListServerCertificates", callback);
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
        var arn = getNodeValue(item, "AlarmArn");
        var name = getNodeValue(item, "AlarmName");
        var enabled = getNodeValue(item, "ActionsEnabled");
        var actions = getNodeValue(item, "AlarmActions");
        var descr = getNodeValue(item, "AlarmDescription");
        var stateReason = getNodeValue(item, "StateReason");
        var stateReasonData = getNodeValue(item, "StateReasonData");
        var stateValue = getNodeValue(item, "StateValue");
        var date = new Date(getNodeValue(item, "StateUpdatedTimestamp"));
        var namespace = getNodeValue(item, "Namespace");
        var period = getNodeValue(item, "Period");
        var unit = getNodeValue(item, "Unit");
        var threshold = getNodeValue(item, "Threshold");
        var statistic = getNodeValue(item, "Statistic");
        var oper = getNodeValue(item, "ComparisonOperator");
        var metricName = getNodeValue(item, "MetricName");
        var evalPeriods = getNodeValue(item, "EvaluationPeriods");
        var insufActions = getNodeValue(item, "InsufficientDataActions");
        var okActions = getNodeValue(item, "OKActions");
        var dims = this.getItems(item, "Dimensions", "member", ["Name", "Value"], function(obj) { return new Tag(obj.Name, obj.Value)});
        var actions = this.getItems(item, "AlarmActions", "member", "");
        return new MetricAlarm(name, arn, descr, stateReason, stateReasonData, stateValue, date, namespace, period, unit, threshold, statistic, oper, metricName, evalPeriods, dims, enabled, actions, insufActions, okActions);
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
            var name = getNodeValue(items[i], "AlarmName");
            var type = getNodeValue(items[i], "HistoryItemType");
            var data = getNodeValue(items[i], "HistoryData");
            var descr = getNodeValue(items[i], "HistorySummary");
            var date = new Date(getNodeValue(items[i], "Timestamp"));
            list.push(new AlarmHistory(name, type, data, descr, date));
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
        if (dimensions instanceof Array)
        for (var i = 0; i < dimensions.length; i++) {
            params.push(["Dimensions.member." + (i + 1) + ".Name", dimensions[i].name]);
            params.push(["Dimensions.member." + (i + 1) + ".Value", dimensions[i].value]);
        }
        this.queryCloudWatch("ListMetrics", params, this, false, "onCompleteListMetrics", callback);
    },

    onCompleteListMetrics : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = new Array();
        var items = this.getItems(xmlDoc, "Metrics", "member");
        for ( var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "MetricName");
            var nm = getNodeValue(items[i], "Namespace");
            var dims = this.getItems(items[i], "Dimensions", "member", ["Name", "Value"], function(obj) { return new Tag(obj.Name, obj.Value)});
            list.push(new Metric(name, nm, dims));
        }
        this.getNext(response, this.queryCloudWatch, list, "metrics");
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
            var tm = new Date(getNodeValue(items[i], "Timestamp"));
            var u = getNodeValue(items[i], "Unit");
            var a = getNodeValue(items[i], "Average");
            var s = getNodeValue(items[i], "Sum");
            var c = getNodeValue(items[i], "SampleCount");
            var x = getNodeValue(items[i], "Maximum");
            var m = getNodeValue(items[i], "Minimum");
            list.push(new Datapoint(tm, u, a, s, c, x, m));
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
        var arn = getNodeValue(xmlDoc, "FederatedUser", "Arn");

        var token = getNodeValue(item, "SessionToken");
        var key = getNodeValue(item, "AccessKeyId");
        var secret = getNodeValue(item, "SecretAccessKey");
        var expire = getNodeValue(item, "Expiration");
        var name = getParam(params, "Name");
        var obj = new TempAccessKey(key, secret, token, expire, name || this.core.user.name, id || this.core.user.id, arn || this.core.user.arn);

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
                configXml = new DOMParser().parseFromString(params, "text/xml");
                var proc = new XSLTProcessor;
                proc.importStylesheet(xmlDoc);
                var resultXml = proc.transformToDocument(configXml);
                response.result = getNodeValue(resultXml, "transformiix:result");
            } catch (e) {
                debug("Exception while processing XSLT: "+e)
            }
        }
    },

    listQueues : function(callback)
    {
        this.querySQS(null, "ListQueues", [], this, false, "onCompleteListQueues", callback);
    },

    onCompleteListQueues : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "ListQueuesResult", "QueueUrl", null, function(node) { return new Queue(node.firstChild.nodeValue); });
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
        var list = this.getItems(xmlDoc, "GetQueueAttributesResult", "Attribute", ["Name", "Value"], function(obj) { return new Tag(obj.Name,obj.Value)});
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

    receiveMessage : function(url, max, visibility, callback)
    {
        var params = [ [ "AttributeName", "All"] ];
        if (max) params.push(["MaxNumberOfMessages", max]);
        if (visibility) params.push(["VisibilityTimeout", visibility]);
        this.querySQS(url, "ReceiveMessage", params, this, false, "onCompleteReceiveMessage", callback);
    },

    onCompleteReceiveMessage : function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "ReceiveMessageResult", "Message");
        for (var i = 0; i < items.length; i++) {
            var id = getNodeValue(items[i], "MessageId");
            var handle = getNodeValue(items[i], "ReceiptHandle");
            var body = getNodeValue(items[i], "Body");
            var msg = new Message(id, body, handle, response.url);

            var attrs = items[i].getElementsByTagName('Attribute');
            for (var j = 0; j < attrs.length; j++) {
                var name = getNodeValue(attrs[j], "Name");
                var value = getNodeValue(attrs[j], "Value");
                switch (name) {
                case "":
                    break;
                case "SentTimestamp":
                case "ApproximateFirstReceiveTimestamp":
                    msg[name] = new Date(value * 1000);
                    break;
                default:
                    msg[name] = value;
                }
            }
            list.push(msg);
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

        var list = this.getItems(xmlDoc, "Topics", "member", ["TopicArn"], function(obj) { return new Topic(obj.TopicArn); });
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
        this.querySNS("ListSubscriptions", [], this, false, "onCompleteListSubscriptions", callback);
    },

    listSubscriptionsByTopic : function(id, callback)
    {
        this.querySNS("ListSubscriptionsByTopic", [["TopicArn", id]], this, false, "onCompleteListSubscriptions", callback);
    },

    onCompleteListSubscriptions : function(response)
    {
        var xmlDoc = response.responseXML;

        var list = this.getItems(xmlDoc, "Subscriptions", "member", ["TopicArn","Protocol","SubscriptionArn","Owner","Endpoint"], function(obj) { return new Subscription(obj.TopicArn,obj.SubscriptionArn,obj.Protocol,obj.Endpoint,obj.Owner); });

        if (response.action == "ListSubscriptions") {
            this.core.setModel('subscriptions', list);
            var topics = this.core.getModel('topics')
            for (var i in topics) {
                topics[i].subscriptions = this.core.queryModel('subscriptions', 'TopicArn', topics[i].id);
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
        var descr = getNodeValue(item,"DBSubnetGroupDescription");
        var status = getNodeValue(item, "DBSubnetGroupStatus");
        var vpcId = getNodeValue(item, "VpcId");
        var subnets = this.getItems(item, "Subnets", "Subnet", ["SubnetIdentifier","Name","SubnetStatus"], function(obj) { return new DBSubnet(onj.SubnetIdentifier,obj.Name,obj.SubnetStatus) });
        return new DBSubnetGroup(name, descr, status, vpcId, subnets);
    },

    unpackDBInstance: function(item)
    {
        var id = getNodeValue(item, "DBInstanceIdentifier");
        var name = getNodeValue(item, "DBName");
        var engine = getNodeValue(item, "Engine");
        var ver = getNodeValue(item, "EngineVersion");
        var host = getNodeValue(item, "Endpoint", "Address");
        var port = getNodeValue(item, "Endpoint", "Port");
        var user = getNodeValue(item, "MasterUsername");
        var dbclass = getNodeValue(item, "DBInstanceClass");
        var status = getNodeValue(item, "DBInstanceStatus");
        var azone = getNodeValue(item, "AvailabilityZone");
        var space = getNodeValue(item, "AllocatedStorage");
        var created = getNodeValue(item, "InstanceCreateTime");
        var license = getNodeValue(item, "LicenseModel");
        var autoupgrade = getNodeValue(item, "AutoMinorVersionUpgrade");
        var brperiod = getNodeValue(item, "BackupRetentionPeriod");
        var charset = getNodeValue(item, "CharacterSetName");
        var lrtime = getNodeValue(item, "LatestRestorableTime");
        var multiAZ = getNodeValue(item, "MultiAZ");
        var bkwin = getNodeValue(item, "PreferredBackupWindow");
        var prefwin = getNodeValue(item, "PreferredMaintenanceWindow");
        var replicas = getNodeValue(item, "ReadReplicaDBInstanceIdentifiers");
        var srcreplica = getNodeValue(item, "ReadReplicaSourceDBInstanceIdentifier");
        var optstatus = getNodeValue(item, "OptionGroupMembership", "Status");
        var optname = getNodeValue(item, "OptionGroupMembership", "OptionGroupName");
        var pendingMods = this.getItems(item, "PendingModifiedValues", null, null, function(obj) { return new Tag(obj.tagName, obj.firstChild.nodeValue); });
        var sgroups = this.getItems(item, "DBSecurityGroups", "DBSecurityGroup", ["DBSecurityGroupName"], function(obj) { return obj.DBSecurityGroupName; })
        var pgroups = this.getItems(item, "DBParameterGroups", "DBParameterGroup", ["ParameterApplyStatus","DBParameterGroupName"], function(obj) { return new Tag(obj.DBParameterGroupName,obj.ParameterApplyStatus)});
        var subnetGroup = this.unpackDBSubnetGroup(item.getElementsByTagName("DBSubnetGroup")[0])

        return new DBInstance(id, name, engine, ver, host, port, user, dbclass, status, azone, space, created, license, autoupgrade,
                              brperiod, charset, lrtime, multiAZ, bkwin, prefwin, replicas, srcreplica, optname, optstatus,
                              pendingMods, subnetGroup, sgroups, pgroups);
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

        this.core.setModel('dbinstances', list);
        response.result = list;
    },

    deleteDBInstance : function(id, snapshotId, callback)
    {
        var params = [ [ "DBInstanceIdentifier", id ]];
        if (snapshotId) {
            params.push([ "FinalDBSnapshotIdentifier", snapshotId]);
            params.push([ "SkipFinalSnapshot", false]);
        }

        this.queryRDS("DeleteDBInstance", params, this, false, "onComplete", callback);
    },

    createDBInstance : function(id, AllocatedStorage, DBInstanceClass, Engine, MasterUserName, MasterUserPassword, options, callback)
    {
        var params = []
        params.push([ "DBInstanceIdentifier", id ]);
        params.push([ "AllocatedStorage", storage ]);
        params.push([ "DBInstanceClass", DBInstanceClass ]);
        params.push([ "Engine", Engine ]);
        params.push([ "MasterUserName", MasterUserName])
        params.push([ "MasterUserPassword", MasterUserPassword])

        if (options.AutoMinorVersionUpgrade) {
            params.push([ "AutoMinorVersionUpgrade", options.AutoMinorVersionUpgrade ]);
        }
        if (options.availabilityZone) {
            params.push([ "AvailabilityZone", options.availabilityZone ]);
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

    rebootDBInstance: function(id, ForceFailover, callback)
    {
        var params = [];
        params.push(["DBInstanceIdentifier", id])
        if (ForceFailover) params.push(["ForceFailover", "true"])
        this.queryRDS("RebootDBInstance", params, this, false, "onCompleteCreateDBInstance", callback);
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
        this.queryRDS("DescribeDBParameterGroups", params, this, false, "onCompleteDescribeDBParameterGroups", callback);
    },

    onCompleteDescribeDBParameterGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.getItems(xmlDoc, "DBParameterGroups", "DBParameterGroup", ["DBParameterGroupFamily","Description","DBParameterGroupName"], function(obj) { return new DBParameterGroup(obj.DBParameterGroupName,obj.Description,obj.DBParameterGroupName)});
    },

    describeDBParameters: function(name, callback)
    {
        this.queryRDS("DescribeDBParameters", [ [ "DBParameterGroupName", name]], this, false, "onCompleteDescribeDBParameters", callback);
    },

    describeEngineDefaultParameters: function(family, callback)
    {
        this.queryRDS("DescribeEngineDefaultParameters", [ [ "DBParameterGroupFamily", family]], this, false, "onCompleteDescribeDBParameters", callback);
    },

    onCompleteDescribeDBParameters: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "Parameters", "Parameter");
        for (var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "ParameterName")
            var name = getNodeValue(items[i], "ParameterName")
            var type = getNodeValue(items[i], "DataType")
            var descr = getNodeValue(items[i], "Description")
            var mver = getNodeValue(items[i], "MinimumEngineVersion")
            var mod = getNodeValue(items[i], "IsModifiable")
            var atype = getNodeValue(items[i], "ApplyType")
            var amethod = getNodeValue(items[i], "ApplyMethod")
            var values = getNodeValue(items[i], "AllowedValues")
            var src = getNodeValue(items[i], "Source")

            list.push(new DBParameter(name, value, type, descr, mver, mod, atype, amethod, values, src))
        }
        response.result = list;
    },

    describeDBEngineVersions: function(family, callback)
    {
        this.queryRDS("DescribeDBEngineVersions", [], this, false, "onCompleteDescribeDBEngineVersions", callback);
    },

    onCompleteDescribeDBEngineVersions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "DBEngineVersions", "DBEngineVersion");
        for (var i = 0; i < items.length; i++) {
            var family = getNodeValue(items[i], "DBParameterGroupFamily");
            var descr = getNodeValue(items[i], "DBEngineDescription");
            var vdescr = getNodeValue(items[i], "DBEngineVersionDescription");
            var engne = getNodeValue(items[i], "Engine");
            var vengime = getNodeValue(items[i], "EngineVersion");
            var chars = getNodeValue(items[i], "SupportedCharacterSets");
            list.push(new DBEngine(family, engine, vengine, descr, vdescr, chars))
        }
        response.result = list;
    },

    modifyDBParameterGroup: function(name, options, callback)
    {
        var params =  [ [ "DBParameterGroupName", name]];
        for (var i  = 0; i < options.length; i++) {
            params.push(["Parameters.member." + i + ".ParameterName", options[i].name]);
            params.push(["Parameters.member." + i + ".ParameterValue", options[i].value]);
            params.push(["Parameters.member." + i + ".ApplyMethod", options[i].applyMethod]);
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

    describeEvents: function(duration, name, callback)
    {
        this.queryRDS("DescribeEvents", [ [ "Duration", duration || 60]], this, false, "onCompleteDescribeEvents", callback);
    },

    onCompleteDescribeEvents: function(response)
    {
        var xmlDoc = response.responseXML;
        response.result = this.getItems(xmlDoc, "Events", "Event", ["SourceIdentifier","SourceType","Date","Message"], function(obj) { return new DBEventp(obj.SourceIdentifier,obj.SourceType,obj.Date,obj.Message)});
    },

    createDBSubnetGroup: function(name, descr, subnets, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        params.push([ "DBSubnetGroupDescription", descr]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["SubnetIds.member." + i, typeof subnets[i] == "object" ? subnets[i].id : subnets[i]])
        }
        this.queryRDS("createDBSubnetGroup", params, this, false, "onComplete", callback);
    },

    modifyDBSubnetGroup: function(name, descr, subnets, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        if (descr) params.push([ "DBSubnetGroupDescription", descr]);
        for (var i = 0; i < subnets.length; i++) {
            params.push(["SubnetIds.member." + i, typeof subnets[i] == "object" ? subnets[i].id : subnets[i]])
        }
        this.queryRDS("modifyDBSubnetGroup", params, this, false, "onComplete", callback);
    },

    deleteDBSubnetGroup: function(name, callback)
    {
        var params = [ ["DBSubnetGroupName", name]];
        this.queryRDS("deleteDBSubnetGroup", params, this, false, "onComplete", callback);
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
            list.push(new this.unpackDBSubnetGroup(item));
        }
        response.result = list;
    },

    describeOrderableDBInstanceOptions: function(engine, callback)
    {
        this.queryRDS("DescribeOrderableDBInstanceOptions", [ ["Engine", engine]], this, false, "onCompleteDescribeOrderableDBInstanceOptions", callback);
    },

    onCompleteDescribeOrderableDBInstanceOptions: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "OrderableDBInstanceOptions", "OrderableDBInstanceOption");
        for (var i = 0; i < items.length; i++) {
            var dbclass = getNodeValue(items[i], "DBInstanceClass");
            var engine = getNodeValue(items[i], "Engine");
            var ver = getNodeValue(items[i], "EngineVersion");
            var license = getNodeValue(items[i], "LicenseModel");
            var maz = getNodeValue(items[i], "MultiAZCapable");
            var replica = getNodeValue(items[i], "ReadReplicaCapable");
            var vpc = getNodeValue(items[i], "VpcCapable");
            var vpcmaz = getNodeValue(items[i], "VpcMultiAZCapable");
            var vpcreplica = getNodeValue(items[i], "VpcReadReplicaCapable");
            var azones = this.getItem(items[i], "AvailabilityZones", "AvailabilityZone", ["Name"], function(obj) {return obj.Name;});
            list.push(new DBOrderableOption(dbclass, engine, ver, license, maz, replica, vpc, vpcmaz, vpcreplica, azone));
        }
        response.result = list;
    },

    unpackHostedZone: function(item)
    {
        if (!item) return null;
        var id = getNodeValue(item, "Id");
        var name = getNodeValue(item, "Name")
        var ref = getNodeValue(item, "CallerReference")
        var count = getNodeValue(item, "ResourceRecordSetCount");
        var comment = getNodeValue(item, "Config", "Comment");
        return new HostedZone(id, name, ref, count, comment);
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
            var type = getNodeValue(items[i], "Type");
            var name = getNodeValue(items[i], "Name")
            var ttl = getNodeValue(items[i], "TTL")
            var zone = getNodeValue(items[i], "AliasTarget", "HostedZoneId");
            var dns = getNodeValue(items[i], "AliasTarget", "DNSName");
            var setid = getNodeValue(items[i], "SetIdentifier");
            var weight = getNodeValue(items[i], "Weight");
            var region = getNodeValue(items[i], "Region");
            var values = this.getItems(items[i], "ResourceRecords", "ResourceRecord", ["Value"], function(obj) { return obj.Value; })

            list.push(new HostedRecord(name, type, ttl, values, zone, dns, setid, weight, region));
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

    onCompleteDescribeAutoScalingGroups: function(response)
    {
        var xmlDoc = response.responseXML;
        var list = [];
        var items = this.getItems(xmlDoc, "AutoScalingGroups", "member");
        for (var i = 0; i < items.length; i++) {
            var name = getNodeValue(items[i], "AutoScalingGroupName");
            var arn = getNodeValue(items[i], "AutoScalingGroupARN");
            var date = new Date(getNodeValue(items[i], "CreatedTime"));
            var capacity = getNodeValue(items[i], "DesiredCapacity");
            var min = getNodeValue(items[i], "MinSize");
            var max = getNodeValue(items[i], "MaxSize");
            var cooldown = getNodeValue(items[i], "DefaultCooldown");
            var status = getNodeValue(items[i], "Status");
            var healthType = getNodeValue(items[i], "HealthCheckType");
            var healthGrace = getNodeValue(items[i], "HealthCheckGracePeriod");
            var vpczone = getNodeValue(items[i], "VPCZoneIdentifier");
            var placement = getNodeValue(items[i], "PlacementGroup");
            var elbs = this.getItems(items[i], "LoadBalancerNames", "member", "");
            var azones = this.getItems(items[i], "AvailabilityZones", "member", "");
            var metric = getNodeValue(items[i], "EnabledMetric", "Metric");
            var granularity = getNodeValue(items[i], "EnabledMetric", "Granularity");
            var instances = this.getItems(items[i], "Instances", "member", ["HealthStatus","AvailabilityZone","InstanceId","LaunchConfigurationName","LifecycleState"], function(obj) { return new ASInstance(obj.HealthStatus,obj.AvailabilityZone,obj.InstanceId,obj.LaunchConfigurationName,obj.LifecycleState)})
            var suspended = this.getItems(items[i], "SuspendedProcesses", "member", ["ProcessName","SuspensionReason"], function(obj) { return new Tag(obj.ProcessName,obj.SuspensionReason)})
            var tags = this.getItems(items[i], "Tags", "member", ["Key","Value","ResourceId","ResourceType","PropagateAtLaunch"], function(obj) { return new ASTag(obj.Key,obj.Value,obj.ResourceId,obj.ResourceType,obj.PropagateAtLaunch)})
            list.push(new AutoScalingGroup(name, arn, date, capacity, min, max, cooldown, status, healthType, healthGrace, vpczone, placement, elbs, azones, metric, granularity, instances, suspended, tags));
        }
        this.core.setModel('asgroups', list);
        response.result = list;
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
            var name = getNodeValue(items[i], "LaunchConfigurationName");
            var arn = getNodeValue(items[i], "LaunchConfigurationARN");
            var date = new Date(getNodeValue(items[i], "CreatedTime"));
            var type = getNodeValue(items[i], "InstanceType");
            var key = getNodeValue(items[i], "KeyName");
            var profile = getNodeValue(items[i], "IamInstanceProfile");
            var image = getNodeValue(items[i], "ImageId");
            var kernel = getNodeValue(items[i], "KernelId");
            var ramdisk = getNodeValue(items[i], "RamdiskId");
            var userdata = getNodeValue(items[i], "UserData");
            var spotprice = getNodeValue(items[i], "SpotPrice");
            var monitoring = toBool(getNodeValue(items[i], "InstanceMonitoring", "Enabled"));
            var groups = this.getItems(items[i], "SecurityGroups", "member", "");
            var devices = [];
            var objs = this.getItems(items[i], "BlockDeviceMappings", "member");
            for (var i = 0; i < objs.length; i++) {
                var vdevice = getNodeValue(objs[i], "DeviceName");
                var vname = getNodeValue(objs[i], "VirtualName");
                var vid = getNodeValue(objs[i], "ebs", "SnapshotId");
                var vsize = getNodeValue(objs[i], "ebs", "VolumeSize");
                devices.push(new BlockDeviceMapping(vdevice, vname, vid, vsize, 0, 0));
            }
            list.push(new LaunchConfiguration(name, arn, date, type, key, profile, image, kernel, ramdisk, userdata, spotprice, monitoring, groups, devices));
        }
        this.core.setModel('asconfigs', list);
        response.result = list;
    },

};
