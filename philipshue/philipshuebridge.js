module.exports = function (RED) {
    'use strict';

    const hueapi = require('node-hue-api').v3;

    const poll_counter_max = 600;

    function PhilipsHueBridgeNode(config) {
        RED.nodes.createNode(this, config);

        this.closing = false;
        this.users = {};
        this.interval_id = null;
        this.timeout_id = null;
        this.poll_counter = 0;
        this.bridge = null;
        this.syncIntervalSensors = parseInt(config.syncIntervalSensors);
        this.syncFactorLamps = parseInt(config.syncFactorLamps);

        var node = this;

        this.sensors = null;
        this.bridgeConfig = null;
        this.lights = null;
        this.groups = null;

        this.createBridgeApi = function () {
            hueapi.api.createLocal(config.bridgeIP).connect(config.bridgeKey)
                .then(api => {
                    this.bridge = api;
                    for (let user in this.users) {
                        this.users[user].status({});
                    }
                })
                .catch(err => {
                    node.error(err);
                    for (let user in this.users) {
                        this.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                    }
                    if (!this.closing) {
                        this.timeout_id = setTimeout(function () {
                            this.createBridgeApi();
                        }, 10000);
                    }
                });
        }
        this.createBridgeApi();

        this.register = function (philipsHueNode) {
            node.users[philipsHueNode.id] = philipsHueNode;
            philipsHueNode.status({});
            if (Object.keys(node.users).length === 1) {
                node.interval_id = setInterval(function () {
                    node.poll();
                }, node.syncIntervalSensors);
            }
        };

        this.deregister = function (philipsHueNode) {
            philipsHueNode.status({});
            delete node.users[philipsHueNode.id];
            if (Object.keys(node.users).length === 0 && node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        };

        this.poll = function () {
            if (node.poll_counter > poll_counter_max) {
                node.poll_counter = 0;
            }
            node.poll_counter++;

            if (node.bridge) {
                let promises = [];

                let promiseSensors = node.bridge.sensors.getAll();
                promises.push(promiseSensors);

                let promiseLights = null;
                let promiseGroups = null;
                if (!node.lights || !node.groups || (node.poll_counter - 1) % node.syncFactorLamps === 0) {
                    promiseLights = node.bridge.lights.getAll();
                    promiseGroups = node.bridge.groups.getAll();
                    promises.push(promiseLights);
                    promises.push(promiseGroups);
                }

                let promiseConfig = null;
                if (!node.bridgeConfig || node.poll_counter === 1) {
                    promiseConfig = node.bridge.configuration.getConfiguration();
                    promises.push(promiseConfig);
                }

                Promise.all(promises)
                    .then(results => {
                        let msg = { sensorsupdated: false, lightsupdated: false, groupsupdated: false, configupdated: false };
                        promises.forEach(function (promise, index) {
                            switch (promise) {
                                case promiseSensors:
                                    node.sensors = results[index];
                                    msg.sensorsupdated = true;
                                    break;
                                case promiseLights:
                                    node.lights = results[index];
                                    msg.lightsupdated = true;
                                    break;
                                case promiseGroups:
                                    node.groups = results[index];
                                    msg.groupsupdated = true;
                                    break;
                                case promiseConfig:
                                    node.bridgeConfig = results[index];
                                    msg.configupdated = true;
                                    break;
                            }
                        });

                        msg.sensors = node.sensors;
                        msg.lights = node.lights;
                        msg.groups = node.groups;
                        msg.config = node.bridgeConfig;

                        for (let user in node.users) {
                            node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                            node.users[user].emit('input', msg);
                        }
                    })
                    .catch(error => {
                        node.error(error);
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                    });
            }
            else {
                for (let user in this.users) {
                    this.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                }
            }
        }

        this.on('close', function () {
            node.closing = true;
            if (node.interval_id != null) {
                clearInterval(node.interval_id);
            }
            if (node.timeout_id != null) {
                clearTimeout(node.timeout_id);
            }
        });
    }
    RED.nodes.registerType('philipshue bridge', PhilipsHueBridgeNode);
}