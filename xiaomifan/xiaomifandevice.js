module.exports = function (RED) {
    'use strict';

    const miio = require('miio');

    function XiaomiFanDeviceNode(config) {
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
                    node.device.defineProperty('power');
                    node.device.defineProperty('ac_power');
                    node.device.defineProperty('battery');
                    node.device.defineProperty('angle_enable');
                    node.device.defineProperty('angle');
                    node.device.defineProperty('speed_level');
                    node.device.defineProperty('natural_level');
                    node.device.defineProperty('temp_dec');
                    node.device.defineProperty('humidity');
                    node.device.defineProperty('buzzer');
                    node.device.defineProperty('child_lock');
                    node.device.defineProperty('led_b');
                    node.device.defineProperty('poweroff_time');
                    node.device.defineProperty('use_time');
                    node.device.defineProperty('speed');
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

        this.register = function (xiaomiFanNode) {
            node.users[xiaomiFanNode.id] = xiaomiFanNode;
            xiaomiFanNode.status({});
            if (Object.keys(node.users).length === 1 && deviceSyncInterval > 0) {
                node.interval_id = setInterval(function () {
                    node.poll();
                }, deviceSyncInterval);
            }
        };

        this.deregister = function (xiaomiFanNode) {
            xiaomiFanNode.status({});
            delete node.users[xiaomiFanNode.id];
            if (Object.keys(node.users).length === 0 && node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        };

        this.poll = function () {
            if (node.device) {
                node.device.poll(false)
                    .then(result => {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                            node.users[user].emit('input', {});
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

        this.callsuccessful = function () {
            for (let user in node.users) {
                node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                node.users[user].emit('input', {});
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
    RED.nodes.registerType('xiaomifan device', XiaomiFanDeviceNode);
}