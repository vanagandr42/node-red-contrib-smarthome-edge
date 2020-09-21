module.exports = function (RED) {
    'use strict';

    function RoborockOut(config) {
        RED.nodes.createNode(this, config);

        this.deviceNode = RED.nodes.getNode(config.device);

        var node = this;

        this.on('input', function (msg, send, done) {
            let err;

            let device = node.deviceNode.device;
            if (!device) {
                err = RED._('miio.errors.nodevice');
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
            }

            let command = msg.payload.command || '';
            let parameter = msg.payload.parameter || '';

            switch (command) {
                case 'app_start':
                case 'app_stop':
                case 'app_spot':
                case 'app_pause':
                case 'app_charge':
                case 'find_me':
                case 'stop_segment_clean':
                case 'resume_segment_clean':
                    parameter = [];
                    break;
                case 'app_goto_target':
                    if (!Array.isArray(parameter) || parameter.length !== 2 || isNaN(parameter[0]) || isNaN(parameter[1])) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'app_segment_clean':
                    if (isNaN(parameter)) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                default:
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
                if (typeof (parameter) !== 'object') parameter = [parameter];
                device.call(command, parameter)
                    .then(result => {
                        node.status({});

                        if (done) {
                            done();
                        }
                    })
                    .catch(error => {
                        node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });

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
    RED.nodes.registerType('roborock out', RoborockOut);
}