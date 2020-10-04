module.exports = function (RED) {
    'use strict';

    function PhilipsTvIn(config) {
        RED.nodes.createNode(this, config);

        this.nodeId = config.id;
        this.configNode = RED.nodes.getNode(config.config);

        var node = this;

        if (this.configNode) {
            this.configNode.register(this);
        }

        this.on('input', function (msg, send, done) {
            let timestamp = Date.now();
            
            msg.periodical = true;
            msg.payload.ts = timestamp

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
            if (node.configNode) {
                node.configNode.deregister(node);
            }
        });
    }
    RED.nodes.registerType('philipstv in', PhilipsTvIn);
}