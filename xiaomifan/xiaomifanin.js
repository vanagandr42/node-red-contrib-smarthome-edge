module.exports = function (RED) {
    'use strict';

    function XiaomiFanIn(config) {
        RED.nodes.createNode(this, config);

        this.nodeId = config.id;
        this.deviceNode = RED.nodes.getNode(config.device);

        var node = this;

        if (this.deviceNode) {
            this.deviceNode.register(this);
        }

        this.on('input', function (msg, send, done) {
            let device = node.deviceNode.device;
            let payload = {
                power: device.property('power'),
                ac_power: device.property('ac_power'),
                battery: device.property('battery'),
                angle_enable: device.property('angle_enable'),
                angle: device.property('angle'),
                speed_level: device.property('speed_level'),
                natural_level: device.property('natural_level'),
                buzzer: device.property('buzzer'),
                child_lock: device.property('child_lock'),
                led_b: device.property('led_b'),
                poweroff_time: device.property('poweroff_time'),
                use_time: device.property('use_time'),
                speed: device.property('speed')
            };
            msg.payload = payload;

            // For maximum backwards compatibility, check that send exists.
            // If this node is installed in Node-RED 0.x, it will need to
            // fallback to using `node.send`
            send = send || function () { node.send.apply(node, arguments) };
            send(msg);

            if (done) {
                done();
            }
        });

        this.on('close', function () {
            if (node.deviceNode) {
                node.deviceNode.deregister(node);
            }
        });
    }
    RED.nodes.registerType('xiaomifan in', XiaomiFanIn);
}