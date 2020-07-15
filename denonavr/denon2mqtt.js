module.exports = function (RED) {
    "use strict";

    function DenonAvr2Mqtt(config) {
        RED.nodes.createNode(this, config);

        var payloadOutput = config.payloadOutput || "mqsh-extended";
        var topicPrefix = config.topicOutputPrefix || "";
        if (!topicPrefix.endsWith("/")) {
            topicPrefix += "/";
        }

        var node = this;
        var nodeContext = this.context();

        this.on('input', function (msg, send, done) {
            var err;

            var topicPostfix = msg.payload.command || "";
            if (topicPostfix.length === 0) {
                err = RED._("mqtt.error.notopicpostfix");
            }

            var value = msg.payload.parameter || "";
            var ts = msg.payload.ts || Date.now();
            var device = msg.device;

            var lastPayloads = nodeContext.get("lastPayloads");
            if (!lastPayloads) {
                lastPayloads = new Map();
                nodeContext.set("lastPayloads", lastPayloads);
            }
            var lastPayload = lastPayloads.get(topicPostfix) || {};

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
                var topic = topicPrefix + topicPostfix;
                var denon = { device: device };

                var payload;
                if (payloadOutput === "plain") {
                    payload = value;
                }
                else {
                    var lastValue = lastPayload.val;
                    var lastLc = lastPayload.lc || ts;
                    var lc;
                    if (lastValue === value) {
                        lc = lastLc;
                    }
                    else {
                        lc = ts;
                    }
                    payload = { val: value, ts: ts, lc: lc };
                }

                var newMsg = { _msgid: msg._msgid, topic: topic, payload: payload, retain: true, qos: 0 };
                if (payloadOutput === "mqsh-extended") {
                    newMsg.payload.denon = denon;
                }

                // For maximum backwards compatibility, check that send exists.
                // If this node is installed in Node-RED 0.x, it will need to
                // fallback to using `node.send`
                send = send || function () { node.send.apply(node, arguments) };
                send(newMsg);

                lastPayloads.set(topicPostfix, payload);

                // Once finished, call 'done'.
                // This call is wrapped in a check that 'done' exists
                // so the node will work in earlier versions of Node-RED (<1.0)
                if (done) {
                    done();
                }
            }
        });
    }
    RED.nodes.registerType("denon mqtt", DenonAvr2Mqtt);
}