module.exports = function (RED) {
    "use strict";

    function Mqtt2DenonAvr(config) {
        RED.nodes.createNode(this, config);

        var node = this;

        this.on('input', function (msg, send, done) {
            var err;

            var commandKeyword = config.commandKeyword || "command";

            var topic = msg.topic || "";
            var topicElements = topic.split("/").reverse();
            if (topicElements.length < 2 || topicElements[1] !== commandKeyword) {
                err = RED._("mqtt.error.nocommandkeyword");
            }
            var command = topicElements[0];

            var parameter;
            var payload = msg.payload || "";
            if (typeof payload === "string") {
                try {
                    let payloadObj = JSON.parse(payload);
                    if (typeof payloadObj === "object") {
                        parameter = payloadObj.val || "";
                    }
                    else {
                        parameter = payloadObj;
                    }
                }
                catch (e) {
                    parameter = payload;
                }
            }
            else {
                parameter = payload;
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
                var newPayload = { command: command, parameter: parameter };
                var newMsg = { _msgid: msg._msgid, payload: newPayload };

                // For maximum backwards compatibility, check that send exists.
                // If this node is installed in Node-RED 0.x, it will need to
                // fallback to using `node.send`
                send = send || function () { node.send.apply(node, arguments) };
                send(newMsg);

                // Once finished, call 'done'.
                // This call is wrapped in a check that 'done' exists
                // so the node will work in earlier versions of Node-RED (<1.0)
                if (done) {
                    done();
                }
            }
        });
    }
    RED.nodes.registerType("mqtt denon", Mqtt2DenonAvr);
}