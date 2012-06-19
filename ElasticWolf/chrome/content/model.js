
function Endpoint(name, url)
{
    if (!name || name == "") {
        this.name = url.replace(/(https?:\/\/|ec2|amazonaws|com|\.)/g, "")
    } else {
        this.name = name;
    }
    this.url = url;

    this.toString = function() {
        return this.name;
    }
}

function Certificate(id, user, body)
{
    this.id = id
    this.userName = user
    this.body = body
    this.toString = function() {
        return this.id;
    }
}

function KeyPair(name, fingerprint, material)
{
    this.name = name;
    this.fingerprint = fingerprint;
    this.material = material;
    this.toString = function() {
        return this.name;
    }
}

function AccessKey(id, secret, status, user)
{
    this.id = id;
    this.status = status;
    this.userName = user || "";
    this.secret = secret || "";
    this.state = "";

    this.toString = function() {
        return this.id + ew_model.separator + this.userName + (this.state ? ew_model.separator + this.state : "");
    }
}

function TempAccessKey(id, secret, securityToken, expire, userName, userId, arn)
{
    this.id = id;
    this.status = "Temporary";
    this.secret = secret || "";
    this.state = "";
    this.securityToken = typeof securityToken == "string" ? securityToken : "";
    this.expire = expire || "";
    this.userName = userName || "";
    this.userId = userId || "";
    this.arn = arn || "";

    if (typeof this.expire == "string") {
        this.expire = new Date();
        this.expire.setISO8601(expire);
    }

    this.toString = function() {
        return this.id + ew_model.separator + this.userName + (this.state ? ew_model.separator + this.state : "");
    }
}

function Credential(name, accessKey, secretKey, url, securityToken)
{
    this.name = name;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.url = typeof url == "string" ? url : "";
    this.securityToken = typeof securityToken == "string" ? securityToken : "";
    this.status = "";

    this.toString = function() {
        return this.accessKey + ";;" + this.secretKey + ";;" + this.url + ";;" + this.securityToken;
    }
}

function User(id, name, path, arn)
{
    this.id = id
    this.name = name;
    this.path = path;
    this.arn = arn;
    this.groups = null;
    this.policies = null;
    this.keys = null;
    this.devices = null;
    this.loginProfileDate = null;

    this.toString = function() {
        return this.name + (this.groups && this.groups.length ? ew_model.separator + this.groups : "");
    }
}

function UserGroup(id, name, path, arn)
{
    this.id = id
    this.name = name
    this.path = path
    this.arn = arn
    this.users = null;
    this.policies = null;

    this.toString = function() {
        return this.name;
    }
}

function MFADevice(id, date, user, arn)
{
    this.id = id
    this.date = date
    this.userName = user
    this.arn = arn

    this.toString = function() {
        return this.id + (this.userName ? ew_model.separator + this.userName : "");
    }
}

function S3Bucket(name, mtime, owner)
{
    this.name = name
    this.mtime = mtime
    this.owner = owner
    this.region = ""
    this.acls = null
    this.keys = []
    this.indexSuffix = "";
    this.errorKey = "";
    this.toString = function() {
        return this.name;
    }
}

function S3BucketAcl(id, type, name, permission)
{
    this.id = id
    this.type = type
    this.name = name
    this.permission = permission
    this.toString = function() {
       return (this.name ? this.name : this.id ? this.id : "ALL") + "=" + this.permission;
    }
}

function S3BucketKey(bucket, name, type, size, mtime, owner, etag)
{
    this.bucket = bucket
    this.name = name
    this.type = type
    this.size = size
    this.mtime = mtime
    this.etag = etag
    this.owner = owner
    this.toString = function() {
        return this.bucket + "/" + this.name;
    }
}

function Tag(name, value, id)
{
    this.name = name || "";
    this.value = value || "";
    this.resourceId = id || "";
    this.toString = function() {
        return this.name + ":" + (this.value.match(/[,:]+/) ? '"' + this.value + '"' : this.value);
    }
}

function Group(id, name)
{
    this.id = id
    this.name = name
    this.toString = function() {
        return this.name + ew_model.separator + this.id;
    }
}

function ProductCode(code, type)
{
    this.productCode = code
    this.type = type
    this.toString = function() {
        return this.productCode + ew_model.separator + this.type;
    }
}

function NetworkInterface(id, status, descr, subnetId, vpcId, availabilityZone, macAddress, privateIpAddress, sourceDestCheck, groups, attachment, association, tags)
{
    this.id = id
    this.status = status
    this.descr = descr || "";
    this.subnetId = subnetId
    this.vpcId = vpcId
    this.availabilityZone = availabilityZone
    this.macAddress = macAddress
    this.privateIpAddress = privateIpAddress
    this.sourceDestCheck = sourceDestCheck
    this.groups = groups || [];
    this.attachment = attachment
    this.association = association
    this.tags = tags
    ew_model.processTags(this, "descr")

    this.toString = function() {
        return this.privateIpAddress + ew_model.separator + this.status + ew_model.separator + this.id + ew_model.separator +  this.descr +
               " (" + ew_model.modelValue("subnetId", this.subnetId) + ")";
    }
}

function NetworkInterfaceAttachment(id, instanceId, instanceOwnerId, deviceIndex, status, attachTime, deleteOnTermination)
{
    this.id = id;
    this.instanceId = instanceId;
    this.instanceOwnerId = instanceOwnerId;
    this.deviceIndex = deviceIndex;
    this.status = status;
    this.attachTime = attachTime;
    this.deleteOnTermination = deleteOnTermination;

    this.toString = function() {
        return this.deviceIndex + ew_model.separator + this.status + ew_model.separator + this.id +
               (this.instanceId ? " (" + ew_model.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function NetworkInterfaceAssociation(id, publicIp, ipOwnerId, instanceId, attachmentId)
{
    this.id = id;
    this.publicIp = publicIp
    this.ipOwnerId = ipOwnerId
    this.instanceId = instanceId
    this.attachmentId = attachmentId
    this.toString = function() {
        return this.publicIp + ew_model.separator + this.id +
               (this.instanceId ? " (" + ew_model.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function NetworkAclAssociation(id, acl, subnet)
{
    this.id = id
    this.aclId = acl
    this.subnetId = subnet
    this.toString = function() {
        return this.id + ew_model.separator + ew_model.modelValue("subnetId", this.subnetId);
    }
}

function NetworkAclEntry(num, proto, action, egress, cidr, icmp, ports)
{
    this.num = num
    this.proto = proto
    this.action = action
    this.egress = egress
    this.cidr = cidr
    this.icmp = icmp ? icmp : []
    this.ports = ports ? ports : []
    this.toString = function() {
        return this.num + ew_model.separator + this.proto + ew_model.separator + this.action + ew_model.separator + (this.egress ? "Egress" + ew_model.separator : "") + this.cidr;
    }
}

function NetworkAcl(id, vpcId, dflt, rules, assocs)
{
    this.id = id
    this.vpcId = vpcId
    this.dflt = dflt
    this.rules = rules
    this.associations = assocs
    this.toString = function() {
        return this.id + ew_model.separator + (dflt ? "default" : "") + " (" + ew_model.modelValue("vpcId", this.vpcId) + ")";
    }
}

function AMI(id, name, description, location, state, status, arch, platform, aki, ari, rootDeviceType, rootDeviceName, owner, ownerAlias, snapshotId, volumes, virtType, hypervisor, productCodes, tags)
{
    this.id = id;
    this.location = location;
    this.state = state;
    this.owner = owner;
    this.status = status;
    this.arch = arch;
    this.platform = platform;
    this.tags = tags;
    this.aki = aki;
    this.ari = ari;
    this.rootDeviceType = rootDeviceType;
    this.rootDeviceName = rootDeviceName;
    this.ownerAlias = ownerAlias;
    this.name = name;
    this.description = description;
    this.snapshotId = snapshotId;
    this.volumes = volumes;
    this.virtualizationType = virtType;
    this.hypervisor = hypervisor;
    this.productCodes = productCodes;
    ew_model.processTags(this)

    this.toString = function() {
        return (this.name ? this.name + ew_model.separator : "") + this.id + ew_model.separator + this.state + ew_model.separator + this.status + ew_model.separator + this.rootDeviceType;
    }
}

function Snapshot(id, volumeId, status, startTime, progress, volumeSize, description, owner, ownerAlias, tags)
{
    this.id = id;
    this.volumeId = volumeId;
    this.status = status;
    this.startTime = startTime.strftime('%Y-%m-%d %H:%M:%S');
    this.progress = progress;
    this.description = description;
    this.volumeSize = volumeSize;
    this.owner = owner;
    this.ownerAlias = ownerAlias;
    this.tags = tags;
    ew_model.processTags(this);

    this.toString = function() {
        return (this.description ? this.description + ew_model.separator : this.name ? this.name + ew_model.separator : "") + this.id + ew_model.separator +
               (this.status != "completed" ? this.status + ew_model.separator : "") +
               (this.progress != "100%" ? this.progress : this.volumeSize + "GB");
    }
}

function Volume(id, size, snapshotId, zone, status, createTime, instanceId, device, attachStatus, attachTime, tags)
{
    this.id = id;
    this.size = size;
    this.snapshotId = snapshotId;
    this.availabilityZone = zone;
    this.status = status;
    this.createTime = createTime.strftime('%Y-%m-%d %H:%M:%S');
    this.instanceId = instanceId;
    this.device = device;
    this.attachStatus = attachStatus;
    if (attachStatus != "") {
        this.attachTime = attachTime.strftime('%Y-%m-%d %H:%M:%S');
    }
    this.tags = tags;
    ew_model.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + ew_model.separator : "") + this.id + ew_model.separator + this.device + ew_model.separator + this.status + ew_model.separator + this.size + "GB" +
               (this.instanceId ? " (" + ew_model.modelValue("instanceId", this.instanceId) + ")" : "");
    }
}

function VolumeStatusEvent(volumeId, availabilityZone, eventId, eventType, description, startTime, endTime)
{
    this.volumeId = volumeId;
    this.availabilityZone = availabilityZone;
    this.eventId = eventId;
    this.eventType = eventType;
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;

    this.toString = function() {
        return this.volumeId + ew_model.separator + this.description;
    }
}

function BlockDeviceMapping(deviceName, virtualName, snapshotId, volumeSize, deleteOnTermination, noDevice)
{
    this.snapshotId = snapshotId;
    this.deviceName = deviceName;
    this.virtualName = virtualName;
    this.volumeSize = volumeSize
    this.deleteOnTermination = deleteOnTermination;
    this.noDevice = noDevice;

    this.toString = function() {
        return this.deviceName +
               (this.virtualName ? ew_model.separator + this.virtualName : "") +
               (this.volumeSize ? ew_model.separator + this.volumeSize + "GB" : "") +
               (this.snapshotId ? ew_model.separator + this.snapshotId : "") +
               (this.deleteOnTermination ? ew_model.separator + "DeleteOnTermination" : "") +
               (this.noDevice ? ew_model.separator + "noDevice" : "");
    }
}

function InstanceBlockDeviceMapping(deviceName, volumeId, status, attachTime, deleteOnTermination)
{
    this.volumeId = volumeId;
    this.deviceName = deviceName;
    this.status = status;
    this.attachTime = attachTime;
    this.deleteOnTermination = deleteOnTermination;

    this.toString = function() {
        return this.deviceName + ew_model.separator + this.status + ew_model.separator + this.volumeId + (this.deleteOnTermination ? ew_model.separator + "DeleteOnTermination" : "");
    }
}

function InstanceNetworkInterface(id, status, descr, subnetId, vpcId, ownerId, privateIp, publicIp, dnsName, srcDstCheck)
{
    this.id = id
    this.status = status
    this.descr = descr || "";
    this.subnetId = subnetId
    this.vpcId = vpcId
    this.ownerId = ownerId
    this.privateIp = privateIp
    this.publicIp = publicIp
    this.sourceDestCheck = srcDstCheck
    this.dnsName = dnsName

    this.toString = function() {
        return this.privateIp + ew_model.separator + this.publicIp + ew_model.separator + this.status + ew_model.separator + this.id + ew_model.separator +  this.descr +
               " (" + ew_model.modelValue("subnetId", this.subnetId) + ")";
    }
}

function Instance(reservationId, ownerId, requesterId, instanceId, imageId, state, productCodes, groups, dnsName, privateDnsName, privateIpAddress, vpcId, subnetId, keyName, reason,
                  amiLaunchIdx, instanceType, launchTime, availabilityZone, tenancy, monitoringStatus, stateReason, platform, kernelId, ramdiskId, rootDeviceType, rootDeviceName,
                  virtualizationType, hypervisor, ipAddress, sourceDestCheck, architecture, instanceLifecycle, clientToken, spotId, volumes, enis, tags)
{
    this.id = instanceId;
    this.reservationId = reservationId;
    this.ownerId = ownerId;
    this.requesterId = requesterId;
    this.elasticIp = '';
    this.imageId = imageId;
    this.state = state;
    this.productCodes = productCodes;
    this.groups = uniqueList(groups, 'id');
    this.dnsName = dnsName;
    this.privateDnsName = privateDnsName;
    this.privateIpAddress = privateIpAddress;
    this.vpcId = vpcId;
    this.subnetId = subnetId;
    this.keyName = keyName;
    this.reason = reason;
    this.amiLaunchIdx = amiLaunchIdx;
    this.instanceType = instanceType;
    this.launchTime = launchTime;
    this.availabilityZone = availabilityZone;
    this.tenancy = tenancy;
    this.monitoringStatus = monitoringStatus;
    this.stateReason = stateReason;
    this.platform = platform;
    this.kernelId = kernelId;
    this.ramdiskId = ramdiskId;
    this.rootDeviceType = rootDeviceType;
    this.rootDeviceName = rootDeviceName;
    this.virtualizationType = virtualizationType;
    this.hypervisor = hypervisor;
    this.ipAddress = ipAddress;
    this.sourceDestCheck = sourceDestCheck;
    this.architecture = architecture;
    this.instanceLifecycle = instanceLifecycle;
    this.clientToken = clientToken;
    this.spotInstanceRequestId = spotId;
    this.volumes = volumes;
    this.enis = enis;
    this.tags = tags;
    this.name = '';
    ew_model.processTags(this);

    this.toString = function() {
        return (this.name ? this.name + ew_model.separator : "") + this.id + ew_model.separator + this.state;
    }

    this.validate = function() {
        if (!this.ipAddress && this.dnsName) {
            var parts = this.dnsName.split('-');
            this.ipAddress = parts[1] + "." + parts[2] + "." + parts[3] + "." + parseInt(parts[4]);
        }
        if (this.elasticIp == '') {
            var eip = ew_session.model.get('addresses', 'instanceId', this.id);
            this.elasticIp = eip && eip.length ? eip[0].publicIp : '';
        }
    }
}

function InstanceStatusEvent(instanceId, availabilityZone, code, description, startTime, endTime)
{
    this.instanceId = instanceId;
    this.availabilityZone = availabilityZone;
    this.code = code;
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;

    this.toString = function() {
        return this.instanceId + ew_model.separator + this.description;
    }
}

function SecurityGroup(id, ownerId, name, description, vpcId, permissions, tags)
{
    this.id = id
    this.ownerId = ownerId;
    this.name = name;
    this.description = description;
    this.vpcId = vpcId;
    this.permissions = permissions;
    this.tags = tags
    ew_model.processTags(this)
    this.toString = function() {
        return this.name + ew_model.separator + this.id + (this.vpcId ? " (" + ew_model.modelValue("vpcId", this.vpcId) + ")" : "");
    }
}

function Permission(type, protocol, fromPort, toPort, srcGroup, cidrIp)
{
    this.type = type
    this.protocol = protocol;
    this.fromPort = fromPort;
    this.toPort = toPort;
    this.srcGroup = srcGroup;
    if (srcGroup) {
        this.srcGroup.toString = function() {
            return srcGroup.id + ew_model.separator + srcGroup.name;
        }
    }
    this.cidrIp = cidrIp;
    this.toString = function() {
        return this.type + ew_model.separator + this.protocol + ew_model.separator + this.fromPort + ":" + this.toPort + ew_model.separator + (this.cidrIp ? this.cidrIp : this.srcGroup ? this.srcGroup.toString() : "");
    }
}

function Route(tableId, cidr, state, gatewayId, eniId, instanceId, instanceOwner)
{
    this.tableId = tableId
    this.cidr = cidr
    this.gatewayId = gatewayId
    this.instanceId = instanceId
    this.instanceOwnerId = instanceOwner
    this.networkInterfaceId = eniId
    this.state = state
    this.toString = function() {
        return this.cidr + ew_model.separator + ew_model.modelValue("gatewayId", this.gatewayId);
    }
}

function RouteAssociation(id, tableId, subnetId)
{
    this.id = id
    this.tableId = tableId || ""
    this.subnetId = subnetId || ""
    this.toString = function() {
        return this.id;
    }
}

function RouteTable(id, vpcId, routes, associations, tags)
{
    this.id = id
    this.vpcId = vpcId
    this.routes = routes
    this.associations = associations
    this.tags = tags
    ew_model.processTags(this);

    this.toString = function() {
        var str = this.id || "";
        if (this.routes && this.routes.length > 0) {
            str += " ("
            for (var i in this.routes) {
                str += (i > 0 ? "," : "") + this.routes[i].cidr;
            }
            str += ")"
        }
        return str;
    }
}

function AvailabilityZone(name, state)
{
    this.name = name;
    this.state = state;

    this.toString = function() {
        return this.name + ew_model.separator + this.state;
    }
}

function EIP(publicIp, instanceid, allocId, assocId, domain, tags)
{
    this.publicIp = publicIp;
    this.instanceId = instanceid;
    this.allocationId = allocId || "";
    this.associationId = assocId || "";
    this.domain = domain || "";
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.publicIp + (this.instanceId ?  " (" + ew_model.modelValue('instanceId', this.instanceId) + ")" : "");
    }
}

function BundleTask(id, instanceId, state, startTime, updateTime, s3bucket, s3prefix, errorMsg)
{
    this.id = id;
    this.instanceId = instanceId;
    this.state = state;
    this.startTime = startTime.strftime('%Y-%m-%d %H:%M:%S');
    this.updateTime = updateTime.strftime('%Y-%m-%d %H:%M:%S');
    this.s3bucket = s3bucket;
    this.s3prefix = s3prefix;
    this.errorMsg = errorMsg;

    this.toString = function() {
        return this.id
    }
}

function RecurringCharge(frequency, amount)
{
    this.frequency = frequency
    this.amount = amount

    this.toString = function() {
        return this.frequency + ew_model.separator + this.amount
    }
}

function LeaseOffering(id, type, az, duration, fPrice, uPrice, rPrices, desc, offering, tenancy)
{
    this.id = id;
    this.instanceType = type;
    this.azone = az;
    this.duration = duration;
    this.fixedPrice = fPrice;
    this.usagePrice = uPrice;
    this.recurringCharges = rPrices;
    this.description = desc;
    this.offering = offering;
    this.tenancy = tenancy;

    this.toString = function() {
        return this.id
    }
}

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
    this.description = desc;
    this.state = state;
    this.tenancy = tenancy

    this.toString = function() {
        return this.id
    }
}

function Vpc(id, cidr, state, dhcpOptionsId, tags)
{
    this.id = id;
    this.cidr = cidr;
    this.state = state;
    this.dhcpOptionsId = dhcpOptionsId;
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.cidr + ew_model.separator + this.id;
    }
}

function Subnet(id, vpcId, cidr, state, availableIp, availabilityZone, tags)
{
    this.id = id;
    this.vpcId = vpcId;
    this.cidr = cidr;
    this.state = state;
    this.availableIp = availableIp;
    this.availabilityZone = availabilityZone;
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.cidr + ew_model.separator + this.id + ew_model.separator + this.availableIp + ew_model.separator + this.availabilityZone;
    }
}

function DhcpOptions(id, options, tags)
{
    this.id = id;
    this.options = options;
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.options + ew_model.separator + this.id;
    }
}

function VpnConnection(id, vgwId, cgwId, type, state, config, tags)
{
    this.id = id;
    this.vgwId = vgwId;
    this.cgwId = cgwId;
    this.type = type;
    this.state = state;
    this.config = config;
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.id + ew_model.separator + this.state + " (" + ew_model.modelValue("vgwId", this.vgwId) + ")";
    }
}

function InternetGateway(id, vpcId, tags)
{
    this.id = id
    this.vpcId = vpcId;
    this.tags = tags
    ew_model.processTags(this)

    this.toString = function() {
        return this.id + ew_model.separator + ew_model.modelValue("vpcId", this.vpcId);
    }
}

function VpnGateway(id, availabilityZone, state, type, attachments, tags)
{
    this.id = id;
    this.availabilityZone = availabilityZone;
    this.state = state;
    this.type = type;
    this.attachments = attachments || [];
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        var text = this.id + ew_model.separator + this.state
        for (var i in this.attachments) {
            text += ", " + this.attachments[i].toString();
        }
        return text;
    }
}

function VpnGatewayAttachment(vpcId, vgwId, state)
{
    this.vpcId = vpcId;
    this.vgwId = vgwId;
    this.state = state;
    this.toString = function() {
        return this.state + ew_model.separator + ew_model.modelValue("vpcId", this.vpcId);
    }
}

function CustomerGateway(id, ipAddress, bgpAsn, state, type, tags)
{
    this.id = id;
    this.ipAddress = ipAddress;
    this.bgpAsn = bgpAsn;
    this.state = state;
    this.type = type;
    this.tags = tags;
    ew_model.processTags(this)

    this.toString = function() {
        return this.ipAddress + ew_model.separator + this.bgpAsn;
    }
}

function LoadBalancer(name, CreatedTime, DNSName, Instances, Protocol, LoadBalancerPort, InstancePort, Interval, Timeout, HealthyThreshold, UnhealthyThreshold, Target, availabilityZones, CookieName, APolicyName, CookieExpirationPeriod, CPolicyName, vpcId, subnets, groups)
{
    this.name = name;
    this.CreatedTime = CreatedTime;
    this.DNSName = DNSName;
    this.Instances = Instances;
    this.Protocol = Protocol;
    this.LoadBalancerPort = LoadBalancerPort;
    this.InstancePort = InstancePort;
    this.Interval = Interval;
    this.Timeout = Timeout;
    this.HealthyThreshold = HealthyThreshold;
    this.UnhealthyThreshold = UnhealthyThreshold;
    this.Target = Target;
    this.zones = availabilityZones;
    this.CookieName = CookieName;
    this.APolicyName = APolicyName;
    this.CookieExpirationPeriod = CookieExpirationPeriod;
    this.CPolicyName = CPolicyName;
    this.vpcId = vpcId
    this.subnets = subnets
    this.groups = groups

    this.toString = function() {
        return this.name;
    }
}

function InstanceHealth(Description, State, InstanceId, ReasonCode)
{
    this.Description = Description;
    this.State = State;
    this.InstanceId = InstanceId;
    this.ReasonCode = ReasonCode;
    this.toString = function() {
        return this.Description + ew_model.separator + this.State + ew_model.separator + ew_model.modelValue("instanceId", this.InstanceId);
    }
}

function MetricAlarm(name, arn, descr, stateReason, stateReasonData, stateValue, namespace, period, threshold, statistic, oper, metricName, evalPeriods, dimensions, actions)
{
    this.name = name;
    this.arn = arn;
    this.descr = descr;
    this.stateReason = stateReason
    this.stateReasonData = stateReasonData
    this.stateValue = stateValue
    this.namespace = namespace
    this.period = period
    this.threshold = threshold
    this.statistic = statistic
    this.oper = oper
    this.metricName = metricName
    this.evaluationPeriods = evalPeriods
    this.dimensions = dimensions
    this.actions = actions

    this.toString = function() {
        return this.name + em_model.separator + this.descr;
    }
}

var ew_model = {
    components : {},
    progress: {},
    separator: " | ",

    accesskeys: null,
    certs: null,
    volumes : null,
    images : null,
    snapshots : null,
    instances : null,
    keypairs : null,
    availabilityZones : null,
    securityGroups : null,
    addresses : null,
    bundleTasks : null,
    offerings : null,
    reservedInstances : null,
    loadBalancers : null,
    subnets : null,
    vpcs : null,
    dhcpOptions : null,
    vpnConnections : null,
    vpnGateways : null,
    customerGateways : null,
    internetGateways : null,
    routeTables: null,
    networkAcls: null,
    networkInterfaces: null,
    s3Buckets: null,
    regions: null,
    users: null,
    groups: null,
    vmfas: null,
    alarms: null,

    // Refresh model list by name, this is primary interface to use in the lists and trees
    refresh: function(name)
    {
        var now = (new Date).getTime();
        if (this.progress[name] > 0 && now - this.progress[name] < 30000) {
            log('refresh: ' + name + ' in progress')
            return;
        }
        log('refresh model ' + name)
        this.progress[name] = now;
        var me = this;

        switch (name) {
        case "certs":
            ew_session.controller.listSigningCertificates(null, function(list) { me.set(name, list); });
            break;
        case "accesskeys":
            ew_session.controller.listAccessKeys(null, function(list) { me.set(name, list); });
            break;
        case "alarms":
            ew_session.controller.describeAlarms();
            break;
        case "vmfas":
            ew_session.controller.listVirtualMFADevices();
            break;
        case "regions":
            ew_session.controller.describeRegions();
            break;
        case "instanceStatus":
            ew_session.controller.describeInstanceStatus();
            break;
        case "volumeStatus":
            ew_session.controller.describeVolumeStatus();
            break;
        case "volumes":
            ew_session.controller.describeVolumes();
            break;
        case "images":
            ew_session.controller.describeImages();
            break;
        case "snapshots":
            ew_session.controller.describeSnapshots();
            break;
        case "instances":
            ew_session.controller.describeInstances();
            break;
        case "keypairs":
            ew_session.controller.describeKeypairs();
            break;
        case "availabilityZones":
            ew_session.controller.describeAvailabilityZones();
            break;
        case "securityGroups":
            ew_session.controller.describeSecurityGroups();
            break;
        case "addresses":
            ew_session.controller.describeAddresses();
            break;
        case "bundleTasks":
            ew_session.controller.describeBundleTasks();
            break;
        case "offerings":
            ew_session.controller.describeLeaseOfferings();
            break;
        case "reservedInstances":
            ew_session.controller.describeReservedInstances();
            break;
        case "loadBalancers":
            ew_session.controller.describeLoadBalancers();
            break;
        case "subnets":
            ew_session.controller.describeSubnets();
            break;
        case "vpcs":
            ew_session.controller.describeVpcs();
            break;
        case "dhcpOptions":
            ew_session.controller.describeDhcpOptions();
            break;
        case "vpnConnections":
            ew_session.controller.describeVpnConnections();
            break;
        case "vpnGateways":
            ew_session.controller.describeVpnGateways();
            break;
        case "customerGateways":
            ew_session.controller.describeCustomerGateways();
            break;
        case "internetGateways":
            ew_session.controller.describeInternetGateways();
            break;
        case "routeTables":
            ew_session.controller.describeRouteTables();
            break;
        case "networkAcls":
            ew_session.controller.describeNetworkAcls();
            break;
        case "networkInterfaces":
            ew_session.controller.describeNetworkInterfaces();
            break;
        case "s3Buckets":
            ew_session.controller.listS3Buckets();
            break;
        case "users":
            ew_session.controller.listUsers();
            break;
        case "groups":
            ew_session.controller.listGroups();
            break;
        }
        return []
    },

    // Return direct list
    getModel: function(name)
    {
        if (!this.hasOwnProperty(name)) debug('model ' + name + ' not found');
        return this[name];
    },

    // Return list or initiate refresh if it is empty, perform search if arguments specified
    get: function()
    {
        var list = this.getModel(arguments[0]);
        if (list == null) {
            this.refresh(arguments[0]);
        }
        var args = [];
        for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
        return this.getObjects(list, args);
    },

    // Update model list and notify components
    set: function(name, list)
    {
        log('set model ' + name + ' ' + (list ? list.length : 0))
        this.progress[name] = 0;
        this[name] = list;
        this.notifyComponents(name);
    },

    // Find object in the model list, optional field can be used first before comparing id and name fields
    find: function(model, id, field)
    {
        return this.findObject(this.getModel(model), id, field);
    },

    // Update field of an object in the model
    update: function(model, id, field, value)
    {
        if (!model || !id || !field) return null;
        var obj = this.findObject(this.getModel(model), id);
        if (obj) {
            obj[field] = value;
        }
        return obj;
    },

    // Clean up all lists, mostly in credentials switch
    invalidate: function()
    {
        for (var p in this) {
            if (this[p] instanceof Array) {
                this.set(p, null);
            }
        }
    },

    // Common replacement for cells by name, builds human readable value
    modelValue: function(name, value)
    {
        var idMap = { vpcId: this.vpcs,
                      subnetId: this.subnets,
                      instanceId: this.instances,
                      tableId: this.routeTables,
                      imageId: this.images,
                      gatewayId: this.internetGateways,
                      cgwId: this.customerGateways,
                      vgwId: this.vpnGateways,
                      igwId: this.internetGateways,
                      dhcpOptionsId: this.dhcpOptions,
                      networkInterfaceId: this.networkInterfaces,
                      groups: this.securityGroups,
                      subnets: this.subnets };

        var list = idMap[name];
        if (list) {
            if (value instanceof Array) {
                var rc = [];
                for (var i in value) {
                    if (typeof value[i] == "object") {
                        rc.push(value[i].toString());
                    } else {
                        var obj = this.findObject(list, value[i]);
                        rc.push(obj ? obj.toString() : value[i]);
                    }
                }
                return rc.join(",");
            } else {
                var obj = this.findObject(list, value);
                if (obj) {
                    return obj.toString()
                }
            }
        }
        return value;
    },

    // Convert object into string, used in listboxes, can use list of columns to limit what properties to show
    toString: function(obj, columns)
    {
        if (obj == null) return null;
        if (typeof obj == "object") {
            var item = "";
            // Show class name as the first column for mutli object lists
            if (columns && columns.indexOf("__class__") >= 0) {
                item = className(obj)
            }
            if (!columns && obj.hasOwnProperty('toString')) {
                item = obj.toString()
            } else {
                for (p in obj) {
                    if (typeof obj[p] == "function") {
                        if (p != "toString") continue;
                        item += (item != "" ? this.separator : "") + obj.toString();
                    } else
                    if (!columns || columns.indexOf(p) >= 0) {
                        item += (item != "" ? this.separator : "") + this.modelValue(p, obj[p]);
                    }
                }
            }
            return item
        }
        return obj;
    },

    // Assign tags to the object and parse it
    setTags: function(obj, tags)
    {
        obj.tags = this.parseTags(tags);
        this.processTags(obj);
    },

    // Extract common tags from the list and updater the object
    processTags: function(obj, name)
    {
        if (!obj || !obj.tags) return;
        for (var i in obj.tags) {
            switch (obj.tags[i].name) {
            case "Name":
                obj[name || "name"] = obj.tags[i].value;
                return;
            }
        }
    },

    // If tag is string, parse and return list of tags, if it is already a list, return as it is
    parseTags: function(tag)
    {
        var list = [];
        if (!tag) return list;

        if (typeof tag == "string") {
            tag += ',';
            var pairs = (tag.match(/\s*[^,":]+\s*:\s*("(?:[^"]|"")*"|[^,]*)\s*,\s*/g) || []);
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split(/\s*:\s*/, 2);
                var key = (pair[0] || "").trim();
                var value = (pair[1] || "").trim();
                value = value.replace(/,\s*$/, '').trim();
                value = value.replace(/^"/, '').replace(/"$/, '').replace(/""/, '"');
                if (key.length == 0 || value.length == 0) continue;
                list.push(new Tag(key, value));
            }
        } else
        if (tag instanceof Array) {
            list = tag;
        }
        return list;
    },

    // Find object in the list by id or name
    findObjectIndex: function(list, id, field)
    {
        for (var i in list) {
            if (field && list[i][field] == id) return i;
            if (list[i].id && list[i].id == id) return i;
            if (list[i].name && list[i].name == id) return i;
        }
        return -1;
    },

    // Find object in the list by id or name
    findObject: function(list, id, field)
    {
        var i = this.findObjectIndex(list, id, field);
        return i >= 0 ? list[i] : null;
    },

    // Remove object in the list by id or name
    removeObject: function(list, id, field)
    {
        var i = this.findObjectIndex(list, id, field);
        if (i >= 0) {
            list.splice(i, 1);
            return true;
        }
        return false;
    },

    // Return objects if all arguments match
    getObjects: function(items, args)
    {
        if (!args.length) return items || [];
        var list = [];
        if (items) {
            for (var i in items) {
                var matches = 0;
                for (var j = 0; j < args.length - 1; j += 2) {
                    if (items[i][args[j]] == args[j + 1]) matches++;
                }
                if (matches == args.length/2) {
                    list.push(items[i])
                }
            }
        }
        return list;
    },

    sortObjects: function(list, col, ascending)
    {
        if (!(list instanceof Array)) return;

        var sortFunc = function(a, b) {
            var aVal = a[col] || "";
            var bVal = b[col] || "";
            var aF = parseFloat(aVal);
            if (!isNaN(aF) && aF.toString() == aVal) {
                aVal = aF;
                bVal = parseFloat(bVal);
            } else {
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
            }
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        };
        list.sort(sortFunc);
    },

    // Send signal about updates model, assume TreeView interface
    notifyComponents: function(interest)
    {
        var comps = this.components[interest] || [];
        for (var i in comps) {
            if (comps[i].isVisible()) {
                comps[i].notifyModelChanged(interest);
            } else {
                comps[i].display([]);
            }
        }
    },

    // Register list of models to watch for updates
    registerInterest: function(component, interest)
    {
        var list = (interest instanceof Array) ? interest : [interest];
        for (var i in list) {
            if (!this.components[list[i]]) {
                this.components[list[i]] = [];
            }
            this.components[list[i]].push(component);
        }
    },

    getUserByName: function(name)
    {
        return this.findObject(this.users, name, 'name');
    },

    getGroupByName: function(name)
    {
        return this.findObject(this.groups, name, 'name');
    },

    getS3Bucket: function(bucket) {
        for (var i in this.s3Buckets) {
            if (bucket == this.s3Buckets[i].name) {
                return this.s3Buckets[i]
            }
        }
        return null;
    },

    getS3BucketKey: function(bucket, key) {
        for (var i in this.s3Buckets) {
            if (bucket == this.s3Buckets[i].name) {
                for (var j in this.s3Buckets[i].keys) {
                    if (this.s3Buckets[i].keys[j].name == key) {
                        return this.s3Buckets[i].keys[j]
                    }
                }
                break;
            }
        }
        return null;
    },

    getVpcById: function(id)
    {
        return this.findObject(this.vpcs, id)
    },

    getSubnetById: function(id)
    {
        return this.findObject(this.subnets, id)
    },

    getNetworkAclsByVpcId: function(vpcId)
    {
        var rc = []
        for (var i in this.networkAcls) {
            if (this.networkAcls[i].vpcId == vpcId) {
                rc.push(this.networkAcls[i])
            }
        }
        return rc
    },

    getNetworkAclAssociation: function(subnetId)
    {
        for (var i in this.networkAcls) {
            for (var j in acls[i].associations) {
                if (acls[i].associations[j].subnetId == subnetId) {
                    return acls[i].associations[j].id
                }
            }
        }
        return null;
    },

    getInstanceById: function(id) {
        return this.findObject(this.instances, id)
    },

    getSecurityGroupById: function(id)
    {
        return this.findObject(this.securityGroups, id)
    },

    getS3Region: function(region)
    {
        var regions = this.getS3Regions();
        for (var i in regions) {
            if (regions[i].region == region) {
                return regions[i]
            }
        }
        return regions[0]
    },

    getS3Regions: function()
    {
        return [ { name: "US Standard",                   url: "s3.amazonaws.com",                region: "" },
                 { name: "US West (Oregon)",              url: "s3-us-west-2.amazonaws.com",      region: "us-west-2" },
                 { name: "US West (Northern California)", url: "s3-us-west-1.amazonaws.com",      region: "us-west-1" },
                 { name: "EU (Ireland)",                  url: "s3-eu-west-1.amazonaws.com",      region: "EU" },
                 { name: "Asia Pacific (Singapore)",      url: "s3-ap-southeast-1.amazonaws.com", region: "ap-southeast-1" },
                 { name: "Asia Pacific (Tokyo)",          url: "s3-ap-northeast-1.amazonaws.com", region: "ap-northeast-1" },
                 { name: "South America (Sao Paulo)",     url: "s3-sa-east-1.amazonaws.com",      region: "sa-east-1" },
                 { name: "GovCloud",                      url: "s3-us-gov-west-1.amazonaws.com",  region: 'us-gov-west-1' } ]
    },

    getEC2Regions: function()
    {
        return [ { name: 'us-east-1',      url: 'https://ec2.us-east-1.amazonaws.com' },
                 { name: 'us-west-1',      url: 'https://ec2.us-west-1.amazonaws.com' },
                 { name: 'us-west-2',      url: 'https://ec2.us-west-2.amazonaws.com' },
                 { name: 'eu-west-1',      url: 'https://ec2.eu-west-1.amazonaws.com' },
                 { name: 'ap-southeast-1', url: 'https://ec2.ap-southeast-1.amazonaws.com' },
                 { name: 'ap-northeast-1', url: 'https://ec2.ap-northeast-1.amazonaws.com' },
                 { name: 'sa-east-1',      url: 'https://ec2.sa-east-1.amazonaws.com' },
                 { name: 'us-gov-west-1',  url: 'https://ec2.us-gov-west-1.amazonaws.com' ,
                   version: '2012-05-01',
                   versionELB: '2011-11-15',
                   versionCW: '2010-08-01',
                   urlIAM: 'https://iam.us-gov.amazonaws.com',
                   versionIAM: '2010-05-08',
                   urlSTS: 'https://sts.us-gov-west-1.amazonaws.com',
                   actionIgnore: ["DescribeAlarms", "DescribeLoadBalancers", "GetLoginProfile", ],
                 },
            ];
    },

    getInstanceTypes: function(arch)
    {
        var types = [
           { name: "t1.micro: Up to 2 EC2 Compute Units (for short periodic bursts), 613 MiB, No storage, Low I/O", id: "t1.micro", x86_64: true, i386: true, },
           { name: "m1.small: 1 EC2 Compute Unit (1 virtual core with 1 EC2 Compute Unit), 1.7 GiB, 150 GiB instance storage,  Moderate I/O", id: "m1.small", x86_64: true, i386: true },
           { name: "m1.medium: 2 EC2 Compute Units (1 virtual core with 2 EC2 Compute Units), 3.75 GiB, 400 GiB instance storage (1 x 400 GiB), Moderate I/O", id: "m1.medium", x86_64: true, i386: true },
           { name: "m1.large: 4 EC2 Compute Units (2 virtual cores with 2 EC2 Compute Units each), 7.5 GiB, 840 GiB instance storage (2 x 420 GiB), High I/O", id: "m1.large", x86_64: true, },
           { name: "m1.xlarge: 8 EC2 Compute Units (4 virtual cores with 2 EC2 Compute Units each), 15 GiB, 1680 GB instance storage (4 x 420 GiB), High I/O", id: "m1.xlarge", x86_64: true, },
           { name: "c1.medium: 5 EC2 Compute Units (2 virtual cores with 2.5 EC2 Compute Units each), 1.7 GiB, 340 GiB instance storage (340 GiB), Moderate I/O", id: "c1.medium", x86_64: true, i386: true },
           { name: "c1.xlarge: 20 EC2 Compute Units (8 virtual cores with 2.5 EC2 Compute Units each), 7 GiB, 1680 GiB instance storage (4 x 420 GiB), High I/O", id: "c1.xlarge", x86_64: true, },
           { name: "m2.xlarge : 6.5 EC2 Compute Units (2 virtual cores with 3.25 EC2 Compute Units each), 17.1 GiB, 410 GiB instance storage (1 x 410 GiB), Moderate I/O", id: "m2.xlarge", x86_64: true, },
           { name: "m2.2xlarge: 13 EC2 Compute Units (4 virtual cores with 3.25 EC2 Compute Units each), 34.2 GiB,  840 GiB instance storage (1 x 840 GiB), High I/O", id: "m2.2xlarge", x86_64: true, },
           { name: "m2.4xlarge: 26 EC2 Compute Units (8 virtual cores with 3.25 EC2 Compute Units each), 68.4 GiB, 1680 GiB instance storage (2 x 840 GiB), High I/O", id: "m2.4xlarge", x86_64: true, },
           { name: "cc1.4xlarge: 33.5 EC2 Compute Units (2 x Intel Xeon X5570, quad-core 'Nehalem' architecture), 23 GiB, 1690 GiB instance 64-bit storage (2 x 840 GiB), Very high (10 Gbps Ethernet)", id: "cc1.4xlarge", x86_64: true, },
           { name: "cc2.8xlarge: 88 EC2 Compute Units (2 x Intel Xeon E5-2670, eight-core 'Sandy Bridge' architecture), 60.5 GiB, 3360 GiB instance (4 x 840 GiB), Very high (10 Gbps Ethernet", id: "cc2.8xlarge", x86_64: true, },
           { name: "cg1.4xlarge: 33.5 EC2 Compute Units (2 x Intel Xeon X5570, quad-core 'Nehalem' architecture), plus 2 NVIDIA Tesla M2050 'Fermi' GPUs, 22 GiB, 1680 GiB instance (2 x 840 GiB), Very high (10 Gbps Ethernet)", id: "cg1.4xlarge", x86_64: true, }
           ];

        var list = [];
        for (var i in types) {
            if (types[i][arch]) list.push(types[i]);
        }
        return list;
    },

}
