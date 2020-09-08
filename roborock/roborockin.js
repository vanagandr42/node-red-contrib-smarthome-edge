module.exports = function (RED) {
    'use strict';

    function RoborockIn(config) {
        RED.nodes.createNode(this, config);

        this.nodeId = config.id;
        this.deviceNode = RED.nodes.getNode(config.device);

        var node = this;

        if (this.deviceNode) {
            this.deviceNode.register(this);
        }

        this.on('input', function (msg, send, done) {
            msg.payload.ts = Date.now();

            // For maximum backwards compatibility, check that send exists.
            // If this node is installed in Node-RED 0.x, it will need to
            // fallback to using `node.send`
            send = send || function () { node.send.apply(node, arguments) };
            send(msg);

            if (done) {
                done();
            }
        });

        this.on('close', function () {
            if (node.deviceNode) {
                node.deviceNode.deregister(node);
            }
        });
    }
    RED.nodes.registerType('roborock in', RoborockIn);
}