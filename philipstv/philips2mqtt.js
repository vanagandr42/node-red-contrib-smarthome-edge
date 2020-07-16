module.exports = function (RED) {
    'use strict';

    function PhilipsTv2Mqtt(config) {
        RED.nodes.createNode(this, config);

        var payloadOutput = config.payloadOutput || 'mqsh-extended';
        var topicPrefix = config.topicOutputPrefix || '';
        if (!topicPrefix.endsWith('/')) {
            topicPrefix += '/';
        }

        var node = this;
        var nodeContext = this.context();

        this.on('input', function (msg, send, done) {
            let err;

            let path = msg.payload.path;
            let result = msg.payload.result || {};
            if (!result) {
                err = RED._("common.errors.noresult");
            }
            let ts = msg.payload.ts || Date.now();
            let periodical = msg.periodical || false;

            let lastPayloads = nodeContext.get('lastPayloads');
            if (!lastPayloads) {
                lastPayloads = new Map();
                nodeContext.set('lastPayloads', lastPayloads);
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
                let resultEntries;
                if (path === 'menuitems/settings/current') {
                    resultEntries = Object.entries(result.values);
                }
                else {
                    resultEntries = Object.entries(result);
                }
                for (let [property, data] of resultEntries) {
                    let topicPostfix;
                    let value;
                    switch (path) {
                        case 'audio/volume':
                            topicPostfix = `volume${property}`;
                            value = data;
                            break;
                        case 'notifychange':
                            switch (property) {
                                case 'powerstate':
                                    topicPostfix = property;
                                    value = data.powerstate;
                                    break;
                                case 'activities/tv':
                                    topicPostfix = 'activitiestv';
                                    value = data.channel.name;
                                    break;
                                case 'system/nettvversion':
                                    topicPostfix = 'nettvversion';
                                    value = data;
                                    break;
                                case 'applications/version':
                                    topicPostfix = 'appversion';
                                    value = data;
                                    break;
                                case 'activities/current':
                                    topicPostfix = 'activitiescurrent';
                                    value = data.component.className;
                                    break;
                            }
                            break;
                        case 'menuitems/settings/current':
                            if (data.value.data.selected_item) {
                                topicPostfix = data.value.Nodeid;
                                value = data.value.data.selected_item;
                            }
                            break;
                    }

                    // For maximum backwards compatibility, check that send exists.
                    // If this node is installed in Node-RED 0.x, it will need to
                    // fallback to using `node.send`
                    send = send || function () { node.send.apply(node, arguments) };

                    if (topicPostfix) {
                        let payload;
                        if (payloadOutput === "plain") {
                            payload = value;
                        }
                        else {
                            var lastPayload = lastPayloads.get(topicPostfix) || {};
                            let lastValue = lastPayload.val;
                            let lastLc = lastPayload.lc || ts;
                            let lc;
                            if (lastValue === value) {
                                lc = lastLc;
                            }
                            else {
                                lc = ts;
                            }
                            payload = { val: value, ts: ts, lc: lc };
                        }

                        let topic = topicPrefix + topicPostfix;
                        let newMsg = { _msgid: msg._msgid, topic: topic, payload: payload, retain: periodical, qos: 0 };
                        if (payloadOutput === "mqsh-extended") {
                            //newMsg.payload.denon = denon;
                        }

                        send(newMsg);

                        lastPayloads.set(topicPostfix, payload);
                    }

                    if (!periodical) {
                        let topic = `${topicPrefix}lastcommand`;
                        let payload = msg.payload;
                        let newMsg = { _msgid: msg._msgid, topic: topic, payload: payload, retain: false, qos: 0 };

                        send(newMsg);
                    }
                }

                // Once finished, call 'done'.
                // This call is wrapped in a check that 'done' exists
                // so the node will work in earlier versions of Node-RED (<1.0)
                if (done) {
                    done();
                }
            }
        });
    }
    RED.nodes.registerType("philips mqtt", PhilipsTv2Mqtt);
}