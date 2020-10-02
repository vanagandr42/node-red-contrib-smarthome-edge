module.exports = function (RED) {
    'use strict';

    const SonosManager = require('@svrooij/sonos').SonosManager;
    const SonosEvents = require('@svrooij/sonos').SonosEvents;

    function SonosConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.closing = false;
        this.users = {};
        this.interval_id = null;
        this.timeout_id = null;

        var node = this;

        this.manager = new SonosManager();
        this.lastPlayingDeviceUuid;

        this.createSonosApi = function () {
            node.manager.InitializeWithDiscovery()
                .then(success => {
                    if (success && node.manager.Devices.length > 0) {
                        node.manager.Devices.forEach(device => {
                            node.createDeviceListeners(device);
                        });

                        if (!node.closing) {
                            node.interval_id = setInterval(function () {
                                node.checkSubscriptions();
                            }, 5 * 60 * 1000);
                        }

                        for (let user in node.users) {
                            node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                        }
                    }
                    else {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }

                        if (!node.closing) {
                            node.timeout_id = setTimeout(function () {
                                node.createSonosApi();
                            }, 30000);
                        }
                    }
                })
                .catch(err => {
                    node.error(err);
                    for (let user in node.users) {
                        node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                    }

                    if (!node.closing) {
                        node.timeout_id = setTimeout(function () {
                            node.createSonosApi();
                        }, 30000);
                    }
                });
        }
        this.createSonosApi();

        this.register = function (sonosNode) {
            node.users[sonosNode.id] = sonosNode;
            sonosNode.status({});
        };

        this.deregister = function (sonosNode) {
            sonosNode.status({});
            delete node.users[sonosNode.id];
        };

        this.checkSubscriptions = function () {
            node.manager.CheckAllEventSubscriptions()
                .then(() => {
                    for (let user in node.users) {
                        node.users[user].status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected' });
                    }
                })
                .catch(err => {
                    node.error(err);
                    for (let user in this.users) {
                        node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                    }
                });
        };

        this.createDeviceListeners = function (device) {
            device.Events.on(SonosEvents.GroupName, data => {
                for (let user in node.users) {
                    node.users[user].emit('input', { device: device, groupname: data });
                }
            })

            device.Events.on(SonosEvents.AVTransport, data => {
                if (data.TransportState === 'PLAYING' && device.Coordinator.Uuid === device.Uuid) {
                    node.lastPlayingDeviceUuid = device.Uuid;
                }

                for (let user in node.users) {
                    node.users[user].emit('input', { device: device, avtransport: data });
                }
            });

            device.Events.on(SonosEvents.RenderingControl, data => {
                for (let user in node.users) {
                    node.users[user].emit('input', { device: device, renderingcontrol: data });
                }
            });
        }

        this.on('close', function () {
            node.closing = true;
            if (node.interval_id != null) {
                clearInterval(node.interval_id);
            }
            if (node.timeout_id != null) {
                clearTimeout(node.timeout_id);
            }

            node.manager.Devices.forEach(device => {
                device.CancelEvents()
            })
            node.manager.CancelSubscription()
        });
    }
    RED.nodes.registerType('sonos config', SonosConfigNode);
}