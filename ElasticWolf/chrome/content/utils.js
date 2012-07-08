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

var instanceTypes = [
    { name: "t1.micro", value: "t1.micro" },
    { name: "m1.small (32-bit only)", value: "m1.small" },
    { name: "c1.medium (32-bit only)", value: "c1.medium" },
    { name: "m1.large (64-bit only)", value: "m1.large" },
    { name: "m1.xlarge (64-bit only)", value: "m1.xlarge" },
    { name: "m2.xlarge (64-bit only)", value: "m2.xlarge" },
    { name: "m2.2xlarge (64-bit only)", value: "m2.2xlarge" },
    { name: "m2.4xlarge (64-bit only)", value: "m2.4xlarge" },
    { name: "c1.xlarge (64-bit only)", value: "c1.xlarge" },
    { name: "cc1.4xlarge (64-bit only)", value: "cc1.4xlarge" },
    { name: "cg1.4xlarge (64-bit only)", value: "cg1.4xlarge" },
];

Function.prototype.className = function()
{
    if ("name" in this) return this.name;
    return this.name = this.toString().match(/function\s*([^(]*)\(/)[1];
}

String.prototype.trim = function()
{
    return this.replace(/^\s+|\s+$/g, "");
}

//With thanks to http://delete.me.uk/2005/03/iso8601.html
Date.prototype.setISO8601 = function(string)
{
    var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" + "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" + "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
    var d = string.match(new RegExp(regexp));
    if (d == null) {
        this.setTime(null);
        return;
    }
    var offset = 0;
    var date = new Date(d[1], 0, 1);
    if (d[3]) {
        date.setMonth(d[3] - 1);
    }
    if (d[5]) {
        date.setDate(d[5]);
    }
    if (d[7]) {
        date.setHours(d[7]);
    }
    if (d[8]) {
        date.setMinutes(d[8]);
    }
    if (d[10]) {
        date.setSeconds(d[10]);
    }
    if (d[12]) {
        date.setMilliseconds(Number("0." + d[12]) * 1000);
    }
    if (d[14]) {
        offset = (Number(d[16]) * 60) + Number(d[17]);
        offset *= ((d[15] == '-') ? 1 : -1);
    }
    offset -= date.getTimezoneOffset();
    var time = (Number(date) + (offset * 60 * 1000));
    this.setTime(Number(time));
}

Date.prototype.strftime = function(fmt, utc)
{
    /* With due thanks to http://whytheluckystiff.net */
    /* other support functions -- thanks, ecmanaut! */
    var strftime_funks = {
        zeropad : function(n) { return n > 9 ? n : '0' + n; },
        a : function(t) { return [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ][utc ? t.getUTCDay() : t.getDay()] },
        A : function(t) { return [ 'Sunday', 'Monday', 'Tuedsay', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ][utc ? t.getUTCDay() : t.getDay()] },
        b : function(t) { return [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][utc ? t.getUTCMonth() : t.getMonth()] },
        B : function(t) { return [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ][utc ? t.getUTCMonth() : t.getMonth()] },
        c : function(t) { return utc ? t.toUTCString() : t.toString() },
        d : function(t) { return this.zeropad(utc ? t.getUTCDate() : t.getDate()) },
        H : function(t) { return this.zeropad(utc ? t.getUTCHours() : t.getHours()) },
        I : function(t) { return this.zeropad(((utc ? t.getUTCHours() : t.getHours()) + 12) % 12) },
        m : function(t) { return this.zeropad((utc ? t.getUTCMonth() : t.getMonth()) + 1) }, // month-1
        M : function(t) { return this.zeropad(utc ? t.getUTCMinutes() : t.getMinutes()) },
        p : function(t) { return this.H(t) < 12 ? 'AM' : 'PM'; },
        S : function(t) { return this.zeropad(utc ? t.getUTCSeconds() : t.getSeconds()) },
        w : function(t) { return utc ? t.getUTCDay() : t.getDay() }, // 0..6 == sun..sat
        y : function(t) { return this.zeropad(this.Y(t) % 100); },
        Y : function(t) { return utc ? t.getUTCFullYear() : t.getFullYear() },
        '%' : function(t) { return '%' },
    };
    var t = this;
    for ( var s in strftime_funks) {
        if (s.length == 1) fmt = fmt.replace('%' + s, strftime_funks[s](t));
    }
    return fmt;
};

Date.prototype.toISO8601String = function(format, offset)
{
    /*
     * accepted values for the format [1-6]: 1 Year: YYYY (eg 1997) 2 Year and
     * month: YYYY-MM (eg 1997-07) 3 Complete date: YYYY-MM-DD (eg 1997-07-16) 4
     * Complete date plus hours and minutes: YYYY-MM-DDThh:mmTZD (eg
     * 1997-07-16T19:20+01:00) 5 Complete date plus hours, minutes and seconds:
     * YYYY-MM-DDThh:mm:ssTZD (eg 1997-07-16T19:20:30+01:00) 6 Complete date
     * plus hours, minutes, seconds and a decimal fraction of a second
     * YYYY-MM-DDThh:mm:ss.sTZD (eg 1997-07-16T19:20:30.45+01:00)
     */
    if (!format) {
        var format = 6;
    }
    if (!offset) {
        var offset = 'Z';
        var date = this;
    } else {
        var d = offset.match(/([-+])([0-9]{2}):([0-9]{2})/);
        var offsetnum = (Number(d[2]) * 60) + Number(d[3]);
        offsetnum *= ((d[1] == '-') ? -1 : 1);
        var date = new Date(Number(Number(this) + (offsetnum * 60000)));
    }

    var zeropad = function(num)
    {
        return ((num < 10) ? '0' : '') + num;
    }

    var str = "";
    str += date.getUTCFullYear();
    if (format > 1) {
        str += "-" + zeropad(date.getUTCMonth() + 1);
    }
    if (format > 2) {
        str += "-" + zeropad(date.getUTCDate());
    }
    if (format > 3) {
        str += "T" + zeropad(date.getUTCHours()) + ":" + zeropad(date.getUTCMinutes());
    }
    if (format > 5) {
        var secs = Number(date.getUTCSeconds() + "." + ((date.getUTCMilliseconds() < 100) ? '0' : '') + zeropad(date.getUTCMilliseconds()));
        str += ":" + zeropad(secs);
    } else
        if (format > 4) {
            str += ":" + zeropad(date.getUTCSeconds());
        }

    if (format > 3) {
        str += offset;
    }
    return str;
}

function formatDuration(duration)
{
    if (duration > 0) {
        var h = Math.floor(duration/3600)
        var m = Math.floor((duration - h * 3600) / 60)
        if (h > 0) {
            return h + " hour" + (h > 1 ? "s" :"") + (m > 0 ? (" " + m + " min" + (m > 1 ? "s" : "")) : "")
        } else
        if (m > 0) {
            return m + " min" + (m > 1 ? "s" : "")
        } else {
            return Math.floor(duration) + " secs"
        }
    }
    return ""
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
    for (i in obj) {
        if (obj[i] && typeof obj[i] == "object") {
            newObj[i] = cloneObject(obj[i]);
        } else {
            newObj[i] = obj[i]
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

function readPublicKey(file)
{
    var body = ""
    var lines = FileIO.toString(file).split("\n");
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("---") == -1) {
            body += lines[i].trim()
        }
    }
    return Base64.encode(body.trim())
}

function newWindow()
{
    window.openDialog("chrome://ew/content/ew_window.xul");
}

function log(msg)
{
    if (ew_core.getBoolPrefs("ew.debug.enabled", false)) {
        debug(msg)
    }
}

function debug(msg)
{
    try {
        if (this.consoleService == null) {
            this.consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
        }
        this.consoleService.logStringMessage("[ ew ] [" + (new Date()).strftime("%Y-%m-%d %H:%M:%S") + "] " + msg);
    }
    catch (e) {
        alert("debug:" + e)
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

function byteArrayToString(arr)
{
    return eval("String.fromCharCode(" + arr.join(",") + ")");
}

function isWindows(platform)
{
    return platform.match(regExs['win']);
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

function clearListbox(list)
{
    for (var i = list.itemCount - 1; i >= 0; i--) {
        list.removeItemAt(i);
    }
}
