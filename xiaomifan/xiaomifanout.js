module.exports = function (RED) {
    'use strict';

    function XiaomiFanOut(config) {
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
                case 'set_power':
                case 'set_angle_enable':
                case 'set_child_lock':
                    if (!['on', 'off'].includes(parameter)) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_move':
                    if (!['left', 'right'].includes(parameter)) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_natural_level':
                case 'set_speed_level':
                    parameter = parseInt(parameter);
                    if (isNaN(parameter) || parameter < 0 || parameter > 100) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_angle':
                    parameter = parseInt(parameter);
                    if (isNaN(parameter) || parameter < 0 || parameter > 120) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_led_b':
                    parameter = parseInt(parameter);
                    if (isNaN(parameter) || parameter < 0 || parameter > 2) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_buzzer':
                    parameter = parseInt(parameter);
                    if (isNaN(parameter) || (parameter !== 0 && parameter !== 2)) {
                        err = RED._('common.errors.invalidparameter');
                    }
                    break;
                case 'set_poweroff_time':
                    parameter = parseInt(parameter);
                    if (isNaN(parameter) || parameter < 0) {
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
                device.call(command, [parameter], { refresh: true })
                    .then(result => {
                        node.status({});
                        node.deviceNode.callsuccessful();

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
    RED.nodes.registerType('xiaomifan out', XiaomiFanOut);
}