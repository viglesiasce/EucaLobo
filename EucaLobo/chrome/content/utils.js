//
//  Author: Vlad Seryakov vseryakov@gmail.com
//  May 2012
//

var fieldSeparator = " | ";

var protPortMap = {
    any: "-1",
    other: "-1",
    ssh : "22",
    rdp : "3389",
    http : "80",
    https : "443",
    pop3 : "110",
    imap : "143",
    spop : "995",
    simap : "993",
    dns : "53",
    mysql : "3306",
    mssql : "1433",
    smtp : "25",
    smtps : "465",
    ldap : "389",
};

var fileCopyStatus = {
    FAILURE : 0,
    SUCCESS : 1,
    FILE_EXISTS : 2,
};

var regExs = {
    "ami" : new RegExp("^ami-[0-9a-f]{8}$"),
    "aki" : new RegExp("^aki-[0-9a-f]{8}$"),
    "ari" : new RegExp("^ari-[0-9a-f]{8}$"),
    "all" : new RegExp("^a[kmr]i-[0-9a-f]{8}$"),
    "win" : new RegExp(/^Win/i),
    "mac" : new RegExp(/^Mac/),
};

Function.prototype.className = function()
{
    if ("name" in this) return this.name;
    return this.name = this.toString().match(/function\s*([^(]*)\(/)[1];
};

String.prototype.trim = function()
{
    return this.replace(/^\s+|\s+$/g, "");
};

String.prototype.trimAll = function()
{
    return this.trim().replace(/\s+/g, ' ');
};

Date.prototype.strftime = function(fmt, utc)
{
    /* With due thanks to http://whytheluckystiff.net */
    /* other support functions -- thanks, ecmanaut! */
    var strftime_funks = {
        zeropad : function(n) { return n > 9 ? n : '0' + n; },
        a : function(t) { return [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ][utc ? t.getUTCDay() : t.getDay()]; },
        A : function(t) { return [ 'Sunday', 'Monday', 'Tuedsay', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ][utc ? t.getUTCDay() : t.getDay()]; },
        b : function(t) { return [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][utc ? t.getUTCMonth() : t.getMonth()]; },
        B : function(t) { return [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ][utc ? t.getUTCMonth() : t.getMonth()]; },
        c : function(t) { return utc ? t.toUTCString() : t.toString(); },
        d : function(t) { return this.zeropad(utc ? t.getUTCDate() : t.getDate()); },
        H : function(t) { return this.zeropad(utc ? t.getUTCHours() : t.getHours()); },
        I : function(t) { return this.zeropad(((utc ? t.getUTCHours() : t.getHours()) + 12) % 12); },
        m : function(t) { return this.zeropad((utc ? t.getUTCMonth() : t.getMonth()) + 1); }, // month-1
        M : function(t) { return this.zeropad(utc ? t.getUTCMinutes() : t.getMinutes()); },
        p : function(t) { return this.H(t) < 12 ? 'AM' : 'PM'; },
        S : function(t) { return this.zeropad(utc ? t.getUTCSeconds() : t.getSeconds()); },
        w : function(t) { return utc ? t.getUTCDay() : t.getDay(); }, // 0..6 == sun..sat
        y : function(t) { return this.zeropad(this.Y(t) % 100); },
        Y : function(t) { return utc ? t.getUTCFullYear() : t.getFullYear(); },
        '%' : function(t) { return '%'; },
    };
    var t = this;
    for ( var s in strftime_funks) {
        if (s.length == 1) fmt = fmt.replace('%' + s, strftime_funks[s](t));
    }
    return fmt;
};

function formatDuration(duration)
{
    if (duration > 0) {
        var h = Math.floor(duration/3600);
        var m = Math.floor((duration - h * 3600) / 60);
        if (h > 0) {
            return h + " hour" + (h > 1 ? "s" :"") + (m > 0 ? (" " + m + " min" + (m > 1 ? "s" : "")) : "");
        } else
        if (m > 0) {
            return m + " min" + (m > 1 ? "s" : "");
        } else {
            return Math.floor(duration) + " secs";
        }
    }
    return "";
}

function formatSize(size)
{
    if (size > 1073741824) {
        return Math.round(size / 1073741824) + "Gb";
      } else
    if (size > 1048576) {
        return Math.round(size / 1048576) + "Mb";
    } else
    if (size > 1024) {
        return Math.round(size/1024) + "Kb";
    }
    return size;
}

function formatJSON(obj, indent)
{
    // Shortcut to parse and format json from the string
    if (typeof obj == "string" && obj != "") {
        obj = JSON.parse(obj);
    }
    if (!indent) indent = "";
    var style = "    ";
    var type = typeName(obj);
    var count = 0;
    var text = type == "array" ? "[" : "{";

    for (var p in obj) {
        var val = obj[p];
        if (count > 0) text += ",";
        if (type == "array") {
            text += ("\n" + indent + style);
        } else {
            text += ("\n" + indent + style + "\"" + p + "\"" + ": ");
        }
        switch (typeName(val)) {
        case "array":
        case "object":
            text += formatJSON(val, (indent + style));
            break;
        case "boolean":
        case "number":
            text += val.toString();
            break;
        case "null":
            text += "null";
            break;
        case "string":
            text += ("\"" + val + "\"");
            break;
        default:
            text += ("unknown: " + typeof(val));
        }
        count++;
    }
    text += type == "array" ? ("\n" + indent + "]") : ("\n" + indent + "}");
    return text;
}

// Return element by name, if given more than 1 arguments, return list of elements
function $(element)
{
    if (arguments.length > 1) {
        for ( var i = 0, elements = [], length = arguments.length; i < length; i++) {
            elements.push(document.getElementById(arguments[i]));
        }
        return elements;
    }
    return document.getElementById(String(element));
}

// Sleep without blocking the UI main thread
function sleep(ms)
{
    var thread = Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager).currentThread;
    var start = new Date().getTime();
    while (new Date().getTime() - start < ms) {
        thread.processNextEvent(true);
    }
}

// Loop until file appear or timeout expired
function waitForFile(file, ms)
{
    var thread = Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager).currentThread;
    var start = new Date().getTime();
    while (!FileIO.exists(file) && new Date().getTime() - start < ms) {
        thread.processNextEvent(true);
    }
    return FileIO.exists(file);
}

// Needed by venkman
function toOpenWindowByType(inType, uri)
{
    window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

// Deep copy of an object
function cloneObject(obj)
{
    if (typeof obj != "object") return obj;
    var newObj = (obj instanceof Array) ? [] : {};
    for (var i in obj) {
        if (obj[i] && typeof obj[i] == "object") {
            newObj[i] = cloneObject(obj[i]);
        } else {
            newObj[i] = obj[i];
        }
    }
    return newObj;
}

function typeName(v)
{
    var t = typeof(v);
    if (v === null) return "null";
    if (t !== "object") return t;
    if (v.constructor == (new Array).constructor) return "array";
    if (v.constructor == (new Date).constructor) return "date";
    if (v.constructor == (new RegExp).constructor) return "regex";
    return "object";
}

// Return name of the class for given object
function className(o)
{
    var t = typeof(o);
    if (o === null) return "null";
    if (t !== "object") return t;
    if ((t = Object.prototype.toString.call(o).slice(8,-1)) !== "Object") return t;
    if (o.constructor && typeof o.constructor === "function" && (t = o.constructor.className())) return t;
    return "Object";
}

// Return value of the parameter in the list of parameters pairs
function getParam(list, name)
{
    for (var i in list) {
        if (list[i][0] == name) return list[i][1];
    }
    return '';
}

// Add or update item in the list
function setParam(list, name, value)
{
    for (var i in list) {
        if (list[i][0] == name) {
            list[i][1] = value;
            return false;
        }
    }
    list.push([name, value]);
    return true;
}

function getNodeValue(item, nodeName, childName)
{
    function _getNodeValue(parent, nodeName) {
        var node = parent ? parent.getElementsByTagName(nodeName)[0] : null;
        return node && node.firstChild ? node.firstChild.nodeValue : "";
    }
    if (!item) return '';
    if (childName) {
        return _getNodeValue(item.getElementsByTagName(nodeName)[0], childName);
    } else {
        return _getNodeValue(item, nodeName);
    }
}

function setNodeValue(obj, item, nodeName, childName)
{
    var name = nodeName + (childName || "");
    obj[name[0].toLowerCase() + name.substr(1)] = getNodeValue(item, nodeName, childName);
}

// From the list of objects return simple list with only specified properties from each object
function plainList(list, id)
{
    var nlist = [];
    for (var i in list) {
        nlist.push(list[i][id]);
    }
    return nlist;
}

// Eliminate duplicates in the list
function uniqueList(list, id)
{
    var nlist = new Array();
    o:for (var i in list) {
        for (var j = 0; j < nlist.length; j++) {
            if (id) {
                if (nlist[j][id] == list[i][id]) continue o;
            } else {
                if (nlist[j] == list[i]) continue o;
            }
        }
        nlist.push(list[i]);
    }
    return nlist;
}

// Return only records that match given regexp
function filterList(list, filter)
{
    if (!list) return [];
    if (!filter) return list;
    var nlist = [];
    var rx = new RegExp(filter, "i");
    for (var i in list) {
        for (var j in list[i]) {
            if (String(list[i][j]).match(rx)) {
                nlist.push(list[i]);
                break;
            }
        }
    }
    return nlist;
}

function parseQuery(str)
{
    var a = str.split("?");
    if (a[1]) {
        a = a[1].split("&");
    }
    var o = {};
    for (var i = 0; i < a.length; ++i) {
        var parts = a[i].split("=");
        o[parts[0]] = parts[1] ? parts[1] : true;
    }
    return o;
}

// Return true if given object represent empty value
function empty(obj)
{
    return !obj || (obj instanceof Array && !obj.length) ? true : false;
}

function trim(s)
{
    return s.replace(/^\s*/, '').replace(/\s*$/, '');
}

function sanitize(val)
{
    return trim(val).replace(/[ ]+/g, "");
}

function escapepath(path)
{
    return path && isWindows(navigator.platform) ? path.replace(/\s/g, "\\ ") : path;
}

function quotepath(path)
{
    return path && path.indexOf(' ') > 0 ? '"' + path + '"' : path;
}

//
// Public keys comes in a number of formats:
// - PEM:            (1st line is -----BEGIN RSA PUBLIC KEY-----)
// - PEM:            (1st line is -----BEGIN PUBLIC KEY-----)
// - RFC 4716 (SSH): (1st line is ---- BEGIN SSH2 PUBLIC KEY ----)
//
function readPublicKey(file)
{
   var body = "";
   var lines = FileIO.toString(file).split("\n");

   // If RFC 4716 (SSH) format then use entire file contents
   if (lines[0].indexOf("---- BEGIN SSH2") != -1)
   {
     body = lines.join("\n");
   }
   // Else do not include the BEGIN/END guards
   else
   {
     for (var i = 0; i < lines.length; i++) {
         if (lines[i].indexOf("---") == -1) {
             body += lines[i].trim();
         }
     }
   }

   return Base64.encode(body.trim());
}

function newWindow()
{
    window.openDialog("chrome://ew/content/ew_window.xul");
}

function log(msg)
{
    if (ew_core.getBoolPrefs("ew.debug.enabled", false)) {
        debug(msg);
    }
}

function debug(msg)
{
    var logfile = ew_core.getBoolPrefs("ew.debug.logfile", false);
    var logfilename = ew_core.getStrPrefs("ew.debug.logfilename", "");
    var logflush = ew_core.getBoolPrefs("ew.debug.logflush", false);

    try {
        // Initialize console logging
        if (this.consoleService == null) {
            this.consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
            this.consoleService.logStringMessage("Debug logging to file: " + logfile);
            this.consoleService.logStringMessage("Debug logging to filename: " + logfilename);
        }

        // If configured, initialize mirroring of console logs to file
        if (logfile && (logfilename != "") && !this.foStream) {
            this.debugFile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Home", Components.interfaces.nsIFile);
            this.debugFile.append(logfilename);
            this.foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
            this.foStream.init(this.debugFile, 0x02 | 0x08 | 0x20, 0666, 0);
            // alert("Start logging to file: " + logfilename);
        }

        // If currently streaming to file but logging option has changed to disable logging to file
        if (this.foStream && !(logfile && (logfilename != ""))) {
            this.foStream.close();
            this.foStream = null;
            // alert("Stop logging to file");
        }

        // Format log with identifier and timestamp
        var smsg = "[ ew ] [" + (new Date()).strftime("%Y-%m-%d %H:%M:%S") + "] " + msg;
        this.consoleService.logStringMessage(smsg);

        // If configured, mirror console log to file
        if (this.foStream) {
            this.foStream.write(smsg + "\n", smsg.length + 1);
            if (logflush) this.foStream.flush();
        }
    }
    catch (e) {
        console.log(e);
    }
}

function toByteArray(str)
{
    var bArray = new Array();
    for ( var i = 0; i < str.length; ++i) {
        bArray.push(str.charCodeAt(i));
    }
    return bArray;
}

function toBool(val)
{
    return !val || val == "false" || val == "FALSE" || val == "f" || val == "F" || val == "0" || val == "disabled"? false : true;
}

function byteArrayToString(arr)
{
    return eval("String.fromCharCode(" + arr.join(",") + ")");
}

function toId(name)
{
    return name[0].toLowerCase() + name.substr(1);
}

function toTitle(name)
{
    return name[0].toUpperCase() + name.substr(1);
}

function toArn(arn)
{
    if (ew_core.isGovCloud()) return arn.replace('arn:aws:', 'arn:aws-us-gov:');
    return arn;
}

function toDynamoDB(value)
{
    if (typeof value === 'number') {
        return { "N": value.toString() };
    } else
    if (typeof value === 'object') {
        var obj = {};
        for (var i in value) {
          if (value.hasOwnProperty(i) && value[i] !== null) {
              obj[i] = toDynamoDB(value[i]);
          }
        }
        return obj;
    } else
    if (Array.isArray(value)) {
        var arr = [];
        var length = value.length;
        var isSS = false;
        for (var i = 0; i < length; ++i) {
            if (typeof value[i] === 'string') {
                arr[i] = value[i];
                isSS = true;
            } else
            if (typeof value[i] === 'number') {
                arr[i] = value[i].toString();
            }
        }
        return isSS ? {"SS": arr} : {"NS": arr};
    }
    return { "S": String(value) };
}

function fromDynamoDB(ddb)
{
    if  (typeof ddb !== 'object') return ddb;
    var res = {};
    for (var i in ddb) {
        if (ddb.hasOwnProperty(i)) {
            if (ddb[i]['S'])
                res[i] = ddb[i]['S'];
            else
            if (ddb[i]['SS'])
                res[i] = ddb[i]['SS'];
            else
            if (ddb[i]['N'])
                res[i] = parseFloat(ddb[i]['N']);
            else
            if (ddb[i]['NS']) {
                res[i] = [];
                for (var j = 0; j < ddb[i]['NS'].length; j ++) {
                    res[i][j] = parseFloat(ddb[i]['NS'][j]);
                }
            }
        }
    }
    return res;
}

function isWindows(platform)
{
    return platform == 'windows';
}

function isMacOS(platform)
{
    return platform.match(regExs['mac']);
}

function isEbsRootDeviceType(rootDeviceType)
{
    return (rootDeviceType == 'ebs');
}

function secondsToDays(secs)
{
    var dur = parseInt(secs);
    // duration is provided in seconds. Let's convert it to years
    dur = Math.floor(dur / (60 * 60 * 24));
    return dur.toString();
}

function secondsToYears(secs)
{
    var dur = parseInt(secondsToDays(secs));
    // duration is provided in days. Let's convert it to years
    dur = dur / (365);
    return dur.toString();
}

function getProperty(key)
{
    try {
        return document.getElementById('ew.properties.bundle').getString(key);
    }
    catch (e) {
        return "";
    }
}

function makeElement()
{
    var obj = document.createElement(arguments[0]);
    for (var i = 1; i < arguments.length; i += 2) {
        obj.setAttribute(arguments[i], arguments[i + 1]);
    }
    return obj;
}

function makeCanvas(core)
{
    if (core.getBoolPrefs("ew.accessibility", false)) {
        var canvas = makeElement('listbox');
        return canvas;
    } else {
        var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
        canvas.setAttribute('class', 'graph');
        return canvas;
    }
}

function clearElement(obj)
{
    if (!obj) return;;
    while (obj.firstChild) {
        obj.removeChild(obj.firstChild);
    }
}

function clearListbox(list)
{
    for (var i = list.itemCount - 1; i >= 0; i--) {
        list.removeItemAt(i);
    }
    list.selectedIndex = -1;
}

function buildListbox(list, items, key)
{
    clearListbox(list);
    for (var i in items) {
        var obj = items[i];
        list.appendItem(ew_core.toString(obj), typeof obj == "object" ? obj[key || "id"] : obj);
    }
    list.selectedIndex = 0;
    list.doCommand();
}
