module.exports = function (RED) {
    "use strict";

    function Connected(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var nodeContext = this.context();

        this.on('input', function (msg, send, done) {
            var err;

            var source = config.source || "";
            if (source.length === 0) {
                err = RED._("common.error.nosource");
            }

            var topicConnected = config.topicConnected || "";
            if (topicConnected.length === 0) {
                err = RED._("mqtt.error.notopicconnected");
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
                var msgSource = msg.status.source.type;
                var msgStatusFill = msg.status.fill;
                if (msgSource && msgSource === source && msgStatusFill) {
                    nodeContext.set("fill", msgStatusFill);
                }

                var newMsg = { topic: topicConnected, retain: true, qos: 1 };;
                var contextFill = nodeContext.get("fill") || "";
                if (contextFill === "green") {
                    newMsg.payload = 2;
                }
                else {
                    newMsg.payload = 1;
                }

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
    RED.nodes.registerType("connected", Connected);
}