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
                    this.device = device;
                    this.device.updatePollDuration(Math.pow(2, 31) - 1);
                    this.device.updateMaxPollFailures(-1);
                    this.device.defineProperty('power');
                    this.device.defineProperty('ac_power');
                    this.device.defineProperty('battery');
                    this.device.defineProperty('angle_enable');
                    this.device.defineProperty('angle');
                    this.device.defineProperty('speed_level');
                    this.device.defineProperty('natural_level');
                    this.device.defineProperty('temp_dec');
                    this.device.defineProperty('humidity');
                    this.device.defineProperty('buzzer');
                    this.device.defineProperty('child_lock');
                    this.device.defineProperty('led_b');
                    this.device.defineProperty('poweroff_time');
                    this.device.defineProperty('use_time');
                    this.device.defineProperty('speed');
                    this.device.poll(true);
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
                            this.createMiioDevice();
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
                for (let user in this.users) {
                    this.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
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