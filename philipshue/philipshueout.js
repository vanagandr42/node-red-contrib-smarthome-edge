module.exports = function (RED) {
    'use strict';

    function PhilipsHueOut(config) {
        RED.nodes.createNode(this, config);

        this.deviceNode = RED.nodes.getNode(config.bridge);

        var node = this;

        this.on('input', function (msg, send, done) {
            let err;

            let bridge = node.deviceNode.bridge;
            if (!bridge) {
                err = RED._('hue.errors.nobridge');
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
            }

            let command = msg.payload.command || '';
            let id = msg.payload.id;
            let parameters = msg.payload.parameters;

            switch (command) {
                case 'set_light_state':
                    if (typeof parameters !== 'object' || typeof id !== 'number') {
                        err = RED._('common.errors.invalidparameter');
                    }
                    else {
                        for (const [key, value] of Object.entries(parameters)) {
                            switch (key) {
                                case 'on':
                                    if (typeof value !== 'boolean') {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'bri':
                                case 'hue':
                                case 'sat':
                                case 'ct':
                                    if (typeof value !== 'number') {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'xy':
                                    if (!Array.isArray(value) || value.length !== 2 || isNaN(parameter[0]) || isNaN(parameter[1])) {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'rgb':
                                    if (!Array.isArray(value) || value.length !== 3 || isNaN(parameter[0]) || isNaN(parameter[1]) || isNaN(parameter[2])) {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                default:
                                    err = RED._('common.errors.invalidparameter');
                            }
                        }
                    }
                    break;
                case 'set_group_state':
                    if (typeof parameters !== 'object' || typeof id !== 'number') {
                        err = RED._('common.errors.invalidparameter');
                    }
                    else {
                        for (const [key, value] of Object.entries(parameters)) {
                            switch (key) {
                                case 'on':
                                    if (typeof value !== 'boolean') {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'bri':
                                case 'hue':
                                case 'sat':
                                case 'ct':
                                    if (typeof value !== 'number') {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'xy':
                                    if (!Array.isArray(value) || value.length !== 2) {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                case 'scene':
                                    if (typeof value !== 'string') {
                                        err = RED._('common.errors.invalidparameter');
                                    }
                                    break;
                                default:
                                    err = RED._('common.errors.invalidparameter');
                            }
                        }
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
                let cmdPromise;
                switch (command) {
                    case 'set_light_state':
                        cmdPromise = bridge.lights.setLightState(id, parameters);
                        break;
                    case 'set_group_state':
                        cmdPromise = bridge.groups.setGroupState(id, parameters);
                        break;
                }

                cmdPromise
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
    RED.nodes.registerType('philipshue out', PhilipsHueOut);
}