module.exports = function (RED) {
    'use strict';

    function getMethods(obj) {
        var result = [];
        for (var id in obj) {
            try {
                if (typeof (obj[id]) == "function") {
                    result.push(id + ": " + obj[id].toString());
                }
            } catch (err) {
                result.push(id + ": inaccessible");
            }
        }
        return result;
    }

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
                        promises.push(devices.filter(device => device.Coordinator.Uuid === device.Uuid).map(device => device.Pause()));
                        break;
                    case 'stop':
                        promises.push(devices.filter(device => device.Coordinator.Uuid === device.Uuid).map(device => device.Stop()));
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
                                promises.push(devices[0].AVTransportService.SetAVTransportURI({ InstanceID: 0, CurrentURI: `x-rincon:${deviceToJoin.Coordinator.Uuid}`, CurrentURIMetaData: '' }));
                            }
                        }
                        break;
                    case 'leave_group':
                        promises.push(devices.map(device => device.AVTransportService.BecomeCoordinatorOfStandaloneGroup()));
                        break;
                    case 'change_coordinator':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else {
                            let coordinator = devices[0].Coordinator;
                            if (devices[0].Uuid === coordinator.Uuid) {
                                warn = RED._('sonos.warnings.devicealreadycoordinator');
                            }
                            else {
                                promises.push(coordinator.AVTransportService.DelegateGroupCoordinationTo({ InstanceID: 0, NewCoordinator: devices[0].Uuid, RejoinGroup: true }));
                            }
                        }
                        break;
                    case 'play_uri':
                        if (devices.length !== 1) {
                            err = RED._('sonos.errors.toomanydevices');
                        }
                        else if (typeof parameter === 'string') {
                            let coordinator = devices[0].Coordinator;
                            promises.push(coordinator.SetAVTransportURI(parameter).then(() => coordinator.Play()));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
                        }
                        break;
                    case 'play_notification':
                        if (typeof parameter === 'string') {
                            promises.push(devices.filter(device => device.Coordinator.Uuid === device.Uuid).map(device => device.PlayNotification({ trackUri: parameter, onlyWhenPlaying: false })));
                        }
                        else {
                            err = RED._('common.errors.invalidparameter');
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