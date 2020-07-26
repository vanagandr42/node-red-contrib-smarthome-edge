module.exports = function (RED) {
    "use strict";

    var reconnectTime = RED.settings.socketReconnectTime || 10000;
    var net = require('net');

    var connectionPool = {};

    function parseTcpData(data) {
        var command = "";
        var parameter = "";

        if (data.startsWith("Z2")) {
            command = "Z2";
            data = data.substring(2);
        }
        else if (data.startsWith("Z3")) {
            command = "Z3";
            data = data.substring(2);
        }

        ["SLP", "NSA", "NSE"].forEach(function (item, index) {
            if (data.startsWith(item)) {
                command += item;
                parameter = data.substring(3);
                return { command: command, parameter: parameter };
            }
        });

        if (data.startsWith("PSMODE") || data.startsWith("PSMULTEQ") || data.startsWith("PSSP")) {
            let parts = data.split(":");
            command += parts[0];
            parameter = parts[1];
            return { command: command, parameter: parameter };
        }

        if (data.startsWith("PS") || data.startsWith("CV") || data.startsWith("SS") || data.startsWith("MVMAX")) {
            let parts = data.split(" ");
            command += parts[0];
            parameter = parts.slice(1).join(" ");
            return { command: command, parameter: parameter };
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
                    msg = { payload: parseTcpData(parts[i]) };
                    msg.payload.ts = Date.now();
                    msg.device = { host: node.host, port: node.port };
                    msg._session = { type: "tcp", id: id };
                    node.send(msg);
                }
                buffer = parts[parts.length - 1];
            });
            client.on('end', function () {
                if (buffer.length > 0) {
                    var msg = { payload: parseTcpData(buffer) };
                    msg.payload.ts = Date.now();
                    msg.device = { host: node.host, port: node.port };
                    msg._session = { type: "tcp", id: id };

                    end = true; // only ask for fast re-connect if we actually got something
                    node.send(msg);

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
            this.closing = true;
            if (client) { client.destroy(); }
            clearTimeout(reconnectTimeout);
            if (!node.connected) { done(); }
        });
    }
    RED.nodes.registerType("denon in", DenonAvrIn);
}