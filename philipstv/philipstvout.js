module.exports = function (RED) {
    'use strict';

    function PhilipsTvOut(config) {
        RED.nodes.createNode(this, config);

        this.configNode = RED.nodes.getNode(config.config);

        var node = this;

        this.on('input', function (msg, send, done) {
            let err;
            let payload = msg.payload;
            if (typeof payload === 'undefined') {
                err = RED._('common.errors.invalidcommand');
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
                node.status({ fill: 'blue', shape: 'dot', text: 'node-red:common.status.connecting' });

                node.configNode.request(payload.method, payload.path, payload.body)
                    .then(response => {
                        let timestamp = Date.now();
                        let msg = { payload: payload };
                        msg.payload.result = response.data;
                        msg.payload.ts = timestamp;

                        node.status({});

                        // For maximum backwards compatibility, check that send exists.
                        // If this node is installed in Node-RED 0.x, it will need to
                        // fallback to using `node.send`
                        send = send || function () { node.send.apply(node, arguments) };
                        send(msg);

                        if (done) {
                            done();
                        }
                    })
                    .catch(error => {
                        if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                            node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                        else if (error.response && error.response.status) {
                            node.status({ fill: 'red', shape: 'ring', text: 'HTTP status: ' + error.response.status });
                        }
                        else {
                            node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }

                        if (done) {
                            // Node-RED 1.0 compatible
                            done(error);
                        } else {
                            // Node-RED 0.x compatible
                            node.error(error, msg);
                        }
                    });
            }
        });

        this.on('close', function () {
            node.status({});
        });
    }
    RED.nodes.registerType('philipstv out', PhilipsTvOut);
}