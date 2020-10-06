module.exports = function (RED) {
    'use strict';

    const Xhtml = require('html-entities').XmlEntities;

    function SonosIn(config) {
        RED.nodes.createNode(this, config);

        this.nodeId = config.id;
        this.configNode = RED.nodes.getNode(config.config);

        var node = this;

        this.xhtml = new Xhtml();

        if (this.configNode) {
            this.configNode.register(this);
        }

        this.on('input', function (rawMsg, send, done) {
            let msgs = [];
            let timestamp = Date.now();

            let mdevice = rawMsg.device;
            let uuid = mdevice.Uuid;
            let device = { name: mdevice.Name, host: mdevice.Host, port: mdevice.Port };

            let isCoordinator = false;
            if (uuid === mdevice.Coordinator.Uuid) {
                isCoordinator = true;
            }
            let group = { name: mdevice.GroupName, isCoordinator: isCoordinator, coordinator: mdevice.Coordinator.Uuid };

            let transport = { transportState: mdevice.Coordinator.CurrentTransportState };
            if (typeof mdevice.volume !== 'undefined') {
                transport.volume = mdevice.Volume;
            }
            let msg = { _msgid: rawMsg._msgid, payload: { uuid: uuid, ts: timestamp, device: device, group: group, transport: transport } };

            if (typeof rawMsg.groupname !== 'undefined') {
                msg.payload.type = 'group';
            }

            if (typeof rawMsg.avtransport !== 'undefined') {
                let avtransport = rawMsg.avtransport;

                msg.payload.type = 'avtransport';
                msg.payload.transport.crossfadeMode = avtransport.CurrentCrossfadeMode;
                msg.payload.transport.playMode = avtransport.CurrentPlayMode;

                if (avtransport.TransportState === 'PLAYING' && typeof avtransport.CurrentTrackMetaData !== 'undefined') {
                    let trackMetadata = avtransport.CurrentTrackMetaData;
                    let track = { artist: node.xhtml.decode(trackMetadata.Artist), albumArtUri: trackMetadata.AlbumArtUri };
                    if (trackMetadata.Title.startsWith('x-sonosapi')) {
                        track.title = '';
                    }
                    else {
                        track.title = node.xhtml.decode(trackMetadata.Title);
                    }
                    if (typeof trackMetadata.Album !== 'undefined') {
                        track.album = trackMetadata.Album;
                    }
                    if (typeof trackMetadata.Duration !== 'undefined') {
                        track.duration = trackMetadata.Duration;
                    }
                    msg.payload.track = track;
                }
            }

            if (typeof rawMsg.renderingcontrol !== 'undefined') {
                let renderingcontrol = rawMsg.renderingcontrol;

                msg.payload.type = 'renderingcontrol';
                if (typeof renderingcontrol.Loudness !== 'undefined') {
                    msg.payload.transport.loudness = renderingcontrol.Loudness;
                }
                if (typeof renderingcontrol.Mute !== 'undefined') {
                    msg.payload.transport.mute = renderingcontrol.Mute.Master;
                }
                if (typeof renderingcontrol.DialogLevel !== 'undefined') {
                    msg.payload.transport.speechEnhancement = renderingcontrol.DialogLevel === '1';
                }
                if (typeof renderingcontrol.NightMode !== 'undefined') {
                    msg.payload.transport.nightMode = renderingcontrol.NightMode;
                }
            }

            msgs.push(msg);

            // For maximum backwards compatibility, check that send exists.
            // If this node is installed in Node-RED 0.x, it will need to
            // fallback to using `node.send`
            send = send || function () { node.send.apply(node, arguments) };
            send([msgs]);

            if (done) {
                done();
            }
        });

        this.on('close', function () {
            if (node.configNode) {
                node.configNode.deregister(node);
            }
        });
    }
    RED.nodes.registerType('sonos in', SonosIn);
}