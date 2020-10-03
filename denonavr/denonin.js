module.exports = function (RED) {
    "use strict";

    var reconnectTime = RED.settings.socketReconnectTime || 10000;
    var net = require('net');

    var connectionPool = {};

    function parseTcpData(data) {
        var command = '';
        var parameter = '';

        if (['Z2', 'Z3'].map(value => data.startsWith(value)).some(value => value === true) && !['ON', 'OFF'].includes(data.substring(2))) {
            return { command: command, parameter: parameter };
        }

        if (['VIALL', 'SY'].map(value => data.startsWith(value)).some(value => value === true)) {
            return { command: command, parameter: parameter };
        }

        if (['CVEND'].includes(data)) {
            return { command: command, parameter: parameter };
        }

        if (['VSMONI'].map(value => data.startsWith(value)).some(value => value === true)) {
            command += data.substring(0, 6);
            parameter = data.substring(6);
            return { command: command, parameter: parameter };
        }

        if (['VSASP', 'VSSCH', 'VSVPM'].map(value => data.startsWith(value)).some(value => value === true)) {
            command += data.substring(0, 5);
            parameter = data.substring(5);
            return { command: command, parameter: parameter };
        }

        if (['VSSC'].map(value => data.startsWith(value)).some(value => value === true)) {
            command += data.substring(0, 4);
            parameter = data.substring(4);
            return { command: command, parameter: parameter };
        }

        if (['SLP', 'NSA', 'NSE'].map(value => data.startsWith(value)).some(value => value === true)) {
            command += data.substring(0, 3);
            parameter = data.substring(3);
            return { command: command, parameter: parameter };
        }

        if (['PSMODE', 'PSMULTEQ', 'PSFH', 'PSSP'].map(value => data.startsWith(value)).some(value => value === true)) {
            let parts = data.split(':');
            command += parts[0];
            parameter = parts[1];
            return { command: command, parameter: parameter };
        }

        if (['PS', 'CV', 'SS', 'MVMAX', 'VSAUDIO', 'VSVST'].map(value => data.startsWith(value)).some(value => value === true)) {
            let parts = data.split(' ');
            command += parts[0];
            parameter = parts.slice(1).join(' ');
            return { command: command, parameter: parameter };
        }

        if (['PV'].map(value => data.startsWith(value)).some(value => value === true)) {
            let parts = data.split(' ');
            if (parts.length > 1) {
                command += parts[0];
                parameter = parts.slice(1).join(' ');
                return { command: command, parameter: parameter };
            }
        }

        command += data.substring(0, 2);
        parameter = data.substring(2);
        return { command: command, parameter: parameter };
    }

    function DenonAvrIn(config) {
        RED.nodes.createNode(this, config);

        this.host = config.host;
        this.port = config.port * 1;
        this.closing = false;
        this.connected = false;
        var node = this;

        var buffer = null;
        var client;
        var reconnectTimeout;
        var end = false;

        var setupTcpClient = function () {
            node.log(RED._("tcpin.status.connecting", { host: node.host, port: node.port }));
            node.status({ fill: "grey", shape: "dot", text: "common.status.connecting" });
            var id = (1 + Math.random() * 4294967295).toString(16);
            client = net.connect(node.port, node.host, function () {
                buffer = "";
                node.connected = true;
                node.log(RED._("tcpin.status.connected", { host: node.host, port: node.port }));
                node.status({ fill: "green", shape: "dot", text: "common.status.connected", _session: { type: "tcp", id: id } });
            });
            client.setKeepAlive(true, 5000);
            connectionPool[id] = client;

            client.on('data', function (data) {
                data = data.toString("utf8");
                buffer = buffer + data;

                var msg;
                var parts = buffer.split("\r");
                for (var i = 0; i < parts.length - 1; i += 1) {
                    let payload = parseTcpData(parts[i]);
                    if (payload.command.length > 0) {
                        msg = { payload: payload };
                        msg.payload.ts = Date.now();
                        msg.device = { host: node.host, port: node.port };
                        msg._session = { type: "tcp", id: id };
                        node.send(msg);
                    }
                }
                buffer = parts[parts.length - 1];
            });
            client.on('end', function () {
                if (buffer.length > 0) {
                    let payload = parseTcpData(buffer);
                    let msg;
                    if (payload.command.length > 0) {
                        msg = { payload: payload };
                        msg.payload.ts = Date.now();
                        msg.device = { host: node.host, port: node.port };
                        msg._session = { type: "tcp", id: id };
                    }

                    end = true; // only ask for fast re-connect if we actually got something
                    if (typeof msg != 'undefined') {
                        node.send(msg);
                    }

                    buffer = null;
                }
            });
            client.on('close', function () {
                delete connectionPool[id];
                node.connected = false;
                node.status({ fill: "red", shape: "ring", text: "common.status.disconnected", _session: { type: "tcp", id: id } });
                if (!node.closing) {
                    if (end) { // if we were asked to close then try to reconnect once very quick.
                        end = false;
                        reconnectTimeout = setTimeout(setupTcpClient, 20);
                    }
                    else {
                        node.log(RED._("tcpin.errors.connection-lost", { host: node.host, port: node.port }));
                        reconnectTimeout = setTimeout(setupTcpClient, reconnectTime);
                    }
                } else {
                    if (node.doneClose) { node.doneClose(); }
                }
            });
            client.on('error', function (err) {
                node.log(err);
            });
        }
        setupTcpClient();

        this.on('close', function (done) {
            node.doneClose = done;
            node.closing = true;
            if (client) { client.destroy(); }
            clearTimeout(reconnectTimeout);
            if (!node.connected) { done(); }
        });
    }
    RED.nodes.registerType("denon in", DenonAvrIn);
}