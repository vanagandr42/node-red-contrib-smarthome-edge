module.exports = function (RED) {
    'use strict';

    function SonosOut(config) {
        RED.nodes.createNode(this, config);

        this.deviceNode = RED.nodes.getNode(config.config);

        var node = this;

        this.on('input', function (msg, send, done) {
            let err;
            let warn;

            let manager = node.deviceNode.manager;
            if (!manager) {
                err = RED._('sonos.errors.nomanager');
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
            }

            let uuid = msg.payload.uuid;
            let command = msg.payload.command || '';
            let parameter = msg.payload.parameter;

            let devices = [];
            if (typeof uuid != 'undefined') {
                let device = manager.Devices.find(device => device.Uuid === uuid);
                if (typeof device != 'undefined') {
                    devices.push(device);
                }
            }
            else {
                devices = manager.Devices;
            }

            let promises = [];
            if (devices.length === 0) {
                err = RED._('sonos.errors.nodevice');
            }
            else {
                switch (command) {
                    case 'play':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            promises.push(devices[0].Coordinator.Play());
                        }
                        break;
                    case 'pause':
                        promises.push(devices
                            .map(device => device.Coordinator)
                            .filter((device, index, self) => self.indexOf(device) === index)
                            .filter(device => device.CurrentTransportState === 'PLAYING')
                            .map(device => device.Pause()));
                        break;
                    case 'stop':
                        promises.push(devices
                            .map(device => device.Coordinator)
                            .filter((device, index, self) => self.indexOf(device) === index)
                            .map(device => device.Stop()));
                        break;
                    case 'next':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            promises.push(devices[0].Coordinator.Next());
                        }
                        break;
                    case 'previous':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            promises.push(devices[0].Coordinator.Previous());
                        }
                        break;
                    case 'set_mute':
                        if (typeof parameter === 'boolean') {
                            promises.push(devices.map(device => device.RenderingControlService.SetMute({ InstanceID: 0, Channel: 'Master', DesiredMute: parameter })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_crossfade':
                        if (typeof parameter === 'boolean') {
                            promises.push(devices.map(device => device.AVTransportService.SetCrossfadeMode({ InstanceID: 0, CrossfadeMode: parameter })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_loudness':
                        if (typeof parameter === 'boolean') {
                            promises.push(devices.map(device => device.RenderingControlService.SetLoudness({ InstanceID: 0, Channel: 'Master', DesiredLoudness: parameter })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_playMode':
                        if (['NORMAL', 'REPEAT_ALL', 'REPEAT_ONE', 'SHUFFLE', 'SHUFFLE_NOREPEAT', 'SHUFFLE_REPEAT_ONE'].includes(parameter)) {
                            promises.push(devices.map(device => device.AVTransportService.SetPlayMode({ InstanceID: 0, NewPlayMode: parameter })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_volume':
                        if (typeof parameter === 'number') {
                            promises.push(devices.map(device => device.SetVolume(parameter)));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_speechEnhancement':
                        if (typeof parameter === 'boolean') {
                            promises.push(devices.map(device => device.SetSpeechEnhancement(parameter)));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'set_nightMode':
                        if (typeof parameter === 'boolean') {
                            promises.push(devices.map(device => device.SetNightMode(parameter)));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'join_group':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            if (typeof parameter === 'string') {
                                let deviceToJoin = manager.Devices.find(device => device.Uuid === parameter);
                                if (typeof deviceToJoin === 'undefined') {
                                    err = RED._('sonos.errors.nodevice');
                                }
                                else if (devices[0].Coordinator.Uuid === deviceToJoin.Coordinator.Uuid) {
                                    warn = RED._('sonos.warnings.devicealreadyjoined');
                                }
                                else {
                                    promises.push(devices[0].AVTransportService.SetAVTransportURI({ InstanceID: 0, CurrentURI: `x-rincon:${deviceToJoin.Coordinator.Uuid}`, CurrentURIMetaData: '' }));
                                }
                            }
                            else {
                                err = RED._('common.errors.invalidparameter');
                            }
                        }
                        break;
                    case 'join_playing_group':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else if (devices[0].Coordinator.CurrentTransportState === 'PLAYING') {
                            warn = RED._('sonos.warnings.devicealreadyplaying');
                        }
                        else {
                            let deviceToJoin = manager.Devices.find(device => device.Uuid === device.Coordinator.Uuid && device.CurrentTransportState === 'PLAYING');
                            if (typeof deviceToJoin === 'undefined') {
                                // TODO: Play adopted uri from last stopped device (considering timeout)
                                warn = RED._('sonos.warnings.nodevice');
                            }
                            else {
                                promises.push(devices[0].AVTransportService.SetAVTransportURI({ InstanceID: 0, CurrentURI: `x-rincon:${deviceToJoin.Uuid}`, CurrentURIMetaData: '' }));
                            }
                        }
                        break;
                    case 'leave_group':
                        promises.push(devices.map(device => device.AVTransportService.BecomeCoordinatorOfStandaloneGroup()));
                        break;
                    case 'others_leave_group':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            let leaveDevices = manager.Devices.filter(device => device.Coordinator.Uuid === devices[0].Coordinator.Uuid && device.Uuid !== devices[0].Uuid);
                            if (devices[0].Uuid === devices[0].Coordinator.Uuid) {
                                promises.push(leaveDevices.map(device => device.AVTransportService.BecomeCoordinatorOfStandaloneGroup()));
                            }
                            else {
                                if (leaveDevices.length > 0) {
                                    promises.push(devices[0].Coordinator.AVTransportService.DelegateGroupCoordinationTo({ InstanceID: 0, NewCoordinator: devices[0].Uuid, RejoinGroup: true })
                                        .then(() => Promise.all(leaveDevices.map(device => device.AVTransportService.BecomeCoordinatorOfStandaloneGroup()))));
                                }
                            }
                        }
                        break;
                    case 'take_over':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else if (devices[0].Coordinator.CurrentTransportState === 'PLAYING') {
                            warn = RED._('sonos.warnings.devicealreadyplaying');
                        }
                        else {
                            let deviceToTakeOver = manager.Devices.find(device => device.Uuid === device.Coordinator.Uuid && device.CurrentTransportState === 'PLAYING');
                            if (typeof deviceToTakeOver === 'undefined') {
                                warn = RED._('sonos.warnings.nodevice');
                            }
                            else {
                                promises.push(devices[0].AVTransportService.BecomeCoordinatorOfStandaloneGroup()
                                    .then(() => deviceToTakeOver.AVTransportService.DelegateGroupCoordinationTo({ InstanceID: 0, NewCoordinator: devices[0].Uuid, RejoinGroup: true })));
                            }
                        }
                        break;
                    case 'play_uri':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else if (typeof parameter === 'string') {
                            promises.push(devices[0].Coordinator.SetAVTransportURI(parameter).then(() => coordinator.Play()));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'play_notification':
                        if (typeof parameter === 'string') {
                            promises.push(devices
                                .map(device => device.Coordinator)
                                .filter((device, index, self) => self.indexOf(device) === index)
                                .map(device => device.PlayNotification({ trackUri: parameter, onlyWhenPlaying: false })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'toggle_or_take_over':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            // if device/group is playing
                            if (devices[0].Coordinator.CurrentTransportState === 'PLAYING') {
                                // stop playback for device/group
                                promises.push(devices[0].Coordinator.Stop());
                            }
                            // if device/group is stopped
                            else {
                                // if another device/group is playing
                                let coordinatorPlaying = manager.Devices.find(device => device.Uuid === device.Coordinator.Uuid && device.CurrentTransportState === 'PLAYING');
                                if (typeof coordinatorPlaying !== 'undefined') {
                                    // take over playback
                                    promises.push(coordinatorPlaying.AVTransportService.DelegateGroupCoordinationTo({ InstanceID: 0, NewCoordinator: devices[0].Uuid, RejoinGroup: true }));
                                }
                                // if no device/group is playing
                                else {
                                    // start playback for device/group
                                    promises.push(devices[0].Coordinator.Play());
                                }
                            }
                        }
                        break;
                    case 'join_or_leave_group':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            if (devices[0].Coordinator.CurrentTransportState === 'PLAYING') {
                                // if device is playing
                                if (manager.Devices.filter(device => device.Coordinator.Uuid === devices[0].Coordinator.Uuid).length === 1) {
                                    // stop playback for device
                                    promises.push(devices[0].Coordinator.Stop());
                                }
                                // if group is playing
                                else {
                                    // leave the group
                                    promises.push(devices.map(device => device.AVTransportService.BecomeCoordinatorOfStandaloneGroup()));
                                }
                            }
                            // if device/group is stopped
                            else {
                                // if another device/group is playing
                                let coordinatorPlaying = manager.Devices.find(device => device.Uuid === device.Coordinator.Uuid && device.CurrentTransportState === 'PLAYING');
                                if (typeof coordinatorPlaying !== 'undefined') {
                                    // join this group
                                    promises.push(devices[0].AVTransportService.SetAVTransportURI({ InstanceID: 0, CurrentURI: `x-rincon:${coordinatorPlaying.Uuid}`, CurrentURIMetaData: '' }));
                                }
                                // if no device/group is playing
                                else {
                                    // continue last played playlist
                                    let lastPlayingDevice = manager.Devices.find(device => device.Uuid === node.deviceNode.lastPlayingDeviceUuid);
                                    if (typeof lastPlayingDevice !== 'undefined') {
                                        if (devices[0].Coordinator.Uuid === lastPlayingDevice.Coordinator.Uuid) {
                                            promises.push(devices[0].Coordinator.Play());
                                        }
                                        else {
                                            promises.push(lastPlayingDevice.Coordinator.AVTransportService.DelegateGroupCoordinationTo({ InstanceID: 0, NewCoordinator: devices[0].Coordinator.Uuid, RejoinGroup: true })
                                                .then(() => devices[0].Coordinator.Play()));
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    default:
                        err = RED._('common.errors.invalidcommand');
                }
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
            else if (warn) {
                node.warn(warn, msg);
                if (done) {
                    done();
                }
            }
            else {
                node.status({ fill: 'blue', shape: 'dot', text: 'node-red:common.status.connecting' });

                Promise.all(promises)
                    .then(results => {
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
    RED.nodes.registerType('sonos out', SonosOut);
}