module.exports = function (RED) {
    'use strict';

    const miio = require('miio');

    function RoborockDeviceNode(config) {
        RED.nodes.createNode(this, config);

        this.users = {};
        this.interval_id = null;
        this.device = null;

        var deviceSyncInterval = parseInt(config.deviceSyncInterval);
        var node = this;

        miio.device({ address: config.deviceIP, token: config.deviceToken })
            .then(device => {
                this.device = device;
                this.device.updatePollDuration(Math.pow(2, 31) - 1);
                this.device.updateMaxPollFailures(-1);
                this.device.poll(true);
            })
            .catch(err => node.error(err));

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
        }

        this.on('close', function () {
            if (node.interval_id != null) {
                clearInterval(node.interval_id);
            }
            if (node.device) {
                node.device.destroy();
            }
        });
    }
    RED.nodes.registerType('roborock device', RoborockDeviceNode);
}