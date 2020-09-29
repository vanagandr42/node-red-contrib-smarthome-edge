module.exports = function (RED) {
    'use strict';

    function getRGBFromXYState(x, y, brightness) {
        var Y = brightness
            , X = (Y / y) * x
            , Z = (Y / y) * (1 - x - y)
            , rgb = [
                X * 1.612 - Y * 0.203 - Z * 0.302,
                -X * 0.509 + Y * 1.412 + Z * 0.066,
                X * 0.026 - Y * 0.072 + Z * 0.962
            ];

        rgb = rgb.map(function (x) {
            return (x <= 0.0031308) ? (12.92 * x) : ((1.0 + 0.055) * Math.pow(x, (1.0 / 2.4)) - 0.055);
        });

        rgb = rgb.map(function (x) { return Math.max(0, x); });
        var max = Math.max(rgb[0], rgb[1], rgb[2]);
        if (max > 1) {
            rgb = rgb.map(function (x) { return x / max; });
        }

        rgb = rgb.map(function (x) { return Math.floor(x * 255); });

        return rgb;
    }

    function PhilipsHueIn(config) {
        RED.nodes.createNode(this, config);

        this.nodeId = config.id;
        this.bridgeNode = RED.nodes.getNode(config.bridge);
        this.onlyChanges = config.onlychanges;

        var node = this;

        this.lastLightStatus = [];
        this.lastGroupStatus = [];
        this.lastSensorStatus = [];

        if (this.bridgeNode) {
            this.bridgeNode.register(this);
        }

        this.on('input', function (rawMsg, send, done) {
            let msgs = [];

            let config = rawMsg.config;
            let bridge = { name: config.name, zigbeechannel: config.zigbeechannel, mac: config.mac, ipaddress: config.ipaddress, modelid: config.modelid, swversion: config.swversion };

            if (rawMsg.lightsupdated) {
                rawMsg.lights.forEach(light => {
                    let id = light.id;
                    let timestamp = Date.now();

                    let info = { name: light.name, type: light.type, modelid: light.modelid };
                    rawMsg.groups.forEach(group => {
                        if (group.type === 'Room' && group.lights.map(x => parseInt(x)).includes(id)) {
                            info.room = group.name;
                        }
                    });

                    let state = light.state;
                    if (state.xy) {
                        state.rgb = getRGBFromXYState(state.xy[0], state.xy[1], state.bri);
                    }

                    let msg = { payload: { id: id, type: 'light', ts: timestamp, state: state, info: info, capabilities: light.capabilities, bridge: bridge } };

                    let uniqueStatus = ((state.on) ? '1' : '0') + state.bri + state.hue + state.sat + state.ct + state.reachable;
                    if (id in node.lastLightStatus) {
                        if (!node.onlyChanges || node.lastLightStatus[id] !== uniqueStatus) {
                            node.lastLightStatus[id] = uniqueStatus;
                            msgs.push(msg);
                        }
                    }
                    else {
                        node.lastLightStatus[id] = uniqueStatus;
                    }
                });
            }

            if (rawMsg.groupsupdated) {
                rawMsg.groups.forEach(group => {
                    let id = group.id;
                    let timestamp = Date.now();

                    if (group.type === 'Room' || group.type === 'Zone') {
                        let info = { name: group.name, type: group.type, class: group.class, lights: group.lights.map(x => parseInt(x)), sensors: group.sensors.map(x => parseInt(x)) };
                        let state = group.state;
                        let action = group.action;

                        let msg = { payload: { id: id, type: 'group', ts: timestamp, state: state, info: info, bridge: bridge } };

                        let uniqueStatus = ((action.on) ? '1' : '0') + action.bri + action.hue + action.sat + action.ct + ((state.any_on) ? '1' : '0') + ((state.all_on) ? '1' : '0');
                        if (id in node.lastGroupStatus) {
                            if (!node.onlyChanges || node.lastGroupStatus[id] !== uniqueStatus) {
                                node.lastGroupStatus[id] = uniqueStatus;
                                msgs.push(msg);
                            }
                        }
                        else {
                            node.lastGroupStatus[id] = uniqueStatus;
                        }
                    }
                    else if (group.type === 'Entertainment') {
                        let info = { name: group.name, type: group.type, class: group.class, lights: group.lights, locations: group.locations };
                        let state = group.state;
                        let action = group.action;

                        let msg = { payload: { id: id, type: 'entertainment', ts: timestamp, state: group.state, stream: group.stream, info: info, bridge: bridge } };

                        let uniqueStatus = ((action.on) ? '1' : '0') + action.bri + action.hue + action.sat + action.ct + ((state.any_on) ? '1' : '0') + ((state.all_on) ? '1' : '0');
                        if (id in node.lastGroupStatus) {
                            if (!node.onlyChanges || node.lastGroupStatus[id] !== uniqueStatus) {
                                node.lastGroupStatus[id] = uniqueStatus;
                                msgs.push(msg);
                            }
                        }
                        else {
                            node.lastGroupStatus[id] = uniqueStatus;
                        }
                    }
                });
            }

            if (rawMsg.sensorsupdated) {
                rawMsg.sensors.forEach(sensor => {
                    let id = sensor.id;
                    let timestamp = Date.parse(sensor.lastupdated);

                    if (sensor.type === 'ZLLSwitch') {
                        let info = { name: sensor.name, type: sensor.type, modelid: sensor.modelid };
                        let state = { buttonevent: sensor.buttonevent, battery: sensor.battery, reachable: sensor.reachable };

                        let msg = { payload: { id: id, type: 'switch', ts: timestamp, state: state, info: info, capabilities: sensor.capabilities, bridge: bridge } };

                        let uniqueStatus = timestamp + sensor.buttonevent;
                        if (id in node.lastSensorStatus) {
                            if (node.lastSensorStatus[id] !== uniqueStatus) {
                                node.lastSensorStatus[id] = uniqueStatus;
                                msgs.push(msg);
                            }
                            else if (!node.onlyChanges && rawMsg.lightsupdated) {
                                delete msg.payload.state.buttonevent;
                                msg.payload.ts = Date.now();
                                msgs.push(msg);
                            }
                        }
                        else {
                            node.lastSensorStatus[id] = uniqueStatus;
                        }
                    }
                });
            }

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
            if (node.bridgeNode) {
                node.bridgeNode.deregister(node);
            }
        });
    }
    RED.nodes.registerType('philipshue in', PhilipsHueIn);
}