module.exports = function (RED) {
    'use strict';

    const miio = require('miio');

    function RoborockDeviceNode(config) {
        RED.nodes.createNode(this, config);

        this.closing = false;
        this.users = {};
        this.interval_id = null;
        this.timeout_id = null;
        this.device = null;

        var deviceSyncInterval = parseInt(config.deviceSyncInterval);
        var node = this;

        this.createMiioDevice = function () {
            miio.device({ address: config.deviceIP, token: config.deviceToken })
                .then(device => {
                    node.device = device;
                    node.device.updatePollDuration(Math.pow(2, 31) - 1);
                    node.device.updateMaxPollFailures(-1);
                    node.device.poll(true);
                    for (let user in node.users) {
                        node.users[user].status({});
                    }
                })
                .catch(err => {
                    node.error(err);
                    for (let user in node.users) {
                        node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                    }
                    if (!node.closing) {
                        node.timeout_id = setTimeout(function () {
                            node.createMiioDevice();
                        }, 10000);
                    }
                });
        }
        this.createMiioDevice();

        this.register = function (roborockNode) {
            node.users[roborockNode.id] = roborockNode;
            roborockNode.status({});
            if (Object.keys(node.users).length === 1 && deviceSyncInterval > 0) {
                node.interval_id = setInterval(function () {
                    node.poll();
                }, deviceSyncInterval);
            }
        };

        this.deregister = function (roborockNode) {
            roborockNode.status({});
            delete node.users[roborockNode.id];
            if (Object.keys(node.users).length === 0 && node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        };

        this.poll = function () {
            if (node.device) {
                node.device.call('get_status', [])
                    .then(result => {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                            node.users[user].emit('input', { request: { command: 'get_status', payload: [] }, payload: result[0] });
                        }
                    })
                    .catch(error => {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                    });

                node.device.call('get_consumable', [])
                    .then(result => {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                            node.users[user].emit('input', { request: { command: 'get_consumable', payload: [] }, payload: result[0] });
                        }
                    })
                    .catch(error => {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                    });
            }
            else {
                for (let user in node.users) {
                    node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
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
            if (node.device) {
                node.device.destroy();
            }
        });
    }
    RED.nodes.registerType('roborock device', RoborockDeviceNode);
}