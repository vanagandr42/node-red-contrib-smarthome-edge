module.exports = function (RED) {
    'use strict';

    function createMessage(topicPrefix, topicPostfix, value, ts, msgid, extendedData, payloadOutput, lastPayloads) {
        let msg = { _msgid: msgid, retain: false, qos: 0 };
        let lastPayload = lastPayloads.get(topicPostfix) || {};
        let payload;

        if (payloadOutput === 'plain') {
            payload = value;
        }
        else {
            let lastValue = lastPayload.val;
            let lastLc = lastPayload.lc || ts;
            let lc;
            if (lastValue === value) {
                lc = lastLc;
            }
            else {
                lc = ts;
            }
            payload = { val: value, ts: ts, lc: lc };
        }
        if (payloadOutput === 'mqsh-extended') {
            payload.fritzhost = extendedData;
        }

        msg.topic = topicPrefix + topicPostfix;
        msg.payload = payload;
        return msg;
    }

    function FritzHosts2Mqtt(config) {
        RED.nodes.createNode(this, config);

        var payloadOutput = config.payloadOutput || 'mqsh-extended';
        var topicPrefix = config.topicOutputPrefix || '';
        if (!topicPrefix.endsWith('/')) {
            topicPrefix += '/';
        }

        var node = this;
        var nodeContext = this.context();

        this.on('input', function (msg, send, done) {
            let err;

            let value = msg.payload;
            if (!value || !value.List || !value.List.Item) {
                err = RED._("mqtt.error.invalidpayload");
            }

            let ts = msg.payload.ts || Date.now();

            let lastPayloads = nodeContext.get("lastPayloads");
            if (!lastPayloads) {
                lastPayloads = new Map();
            }

            // If an error is hit, report it to the runtime
            if (err) {
                if (done) {
                    // Node-RED 1.0 compatible
                    done(err);
                } else {
                    // Node-RED 0.x compatible
                    node.error(err, msg);
                }
            }
            else {
                let hosts = value.List.Item;
                let newMsgs = [];
                let newLastPayloads = new Map();
                hosts.forEach(function (item, index) {
                    let macAddress = item.MACAddress[0];
                    if (macAddress && macAddress.length > 0) {
                        let extendedHostname = item.HostName[0];
                        let extendedInterfaceType = item.InterfaceType[0];
                        let extendedSpeed = item['X_AVM-DE_Speed'][0];
                        let extendedData = { hostName: extendedHostname, interfaceType: extendedInterfaceType, speed: extendedSpeed };

                        let ipTopicPostfix = `${macAddress}/IP_ADDRESS`;
                        let ipMsg = createMessage(topicPrefix, ipTopicPostfix, item.IPAddress[0], ts, msg._msgid, extendedData, payloadOutput, lastPayloads)
                        newMsgs.push(ipMsg);
                        newLastPayloads.set(ipTopicPostfix, ipMsg.payload);

                        let activeTopicPostfix = `${macAddress}/ACTIVE`;
                        let activeMsg = createMessage(topicPrefix, activeTopicPostfix, item.Active[0] == '1' ? true : false, ts, msg._msgid, extendedData, payloadOutput, lastPayloads)
                        newMsgs.push(activeMsg);
                        newLastPayloads.set(activeTopicPostfix, activeMsg.payload);
                    }
                });
                nodeContext.set("lastPayloads", newLastPayloads);

                // For maximum backwards compatibility, check that send exists.
                // If this node is installed in Node-RED 0.x, it will need to
                // fallback to using `node.send`
                send = send || function () { node.send.apply(node, arguments) };
                send([newMsgs]);

                // Once finished, call 'done'.
                // This call is wrapped in a check that 'done' exists
                // so the node will work in earlier versions of Node-RED (<1.0)
                if (done) {
                    done();
                }
            }
        });
    }
    RED.nodes.registerType("fritzhosts mqtt", FritzHosts2Mqtt);
}