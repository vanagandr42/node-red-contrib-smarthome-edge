module.exports = function (RED) {
    'use strict';

    function Connected(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var nodeContext = this.context();

        this.on('input', function (msg, send, done) {
            let err;

            let source = config.source || '';
            if (source.length === 0) {
                err = RED._('common.error.nosource');
            }

            let topicConnected = config.topicConnected || "";
            if (topicConnected.length === 0) {
                err = RED._('mqtt.error.notopicconnected');
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
                let msgSource = msg.status.source.type;
                let msgStatusFill = msg.status.fill || '';
                if (msgSource && msgSource === source && msgStatusFill !== 'blue') {
                    nodeContext.set("fill", msgStatusFill);
                }

                let newMsg = { topic: topicConnected, retain: true, qos: 1 };
                let contextFill = nodeContext.get("fill") || "";
                if (contextFill === "red" || contextFill === "yellow") {
                    newMsg.payload = 1;
                }
                else {
                    newMsg.payload = 2;
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