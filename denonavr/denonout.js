module.exports = function (RED) {
    "use strict";

    var request = require("request");
    var querystring = require("querystring");

    function DenonAvrOut(config) {
        RED.nodes.createNode(this, config);

        this.host = config.host;
        this.port = config.port * 1;
        var node = this;

        if (RED.settings.httpRequestTimeout) {
            this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
        }
        else {
            this.reqTimeout = 120000;
        }

        this.on("input", function (msg, send, done) {
            var error;

            var command = msg.payload.command || "";
            if (command.length === 0) {
                err = RED._("common.errors.emptypayload");
            }
            var parameter = msg.payload.parameter || "";

            // If an error is hit, report it to the runtime
            if (error) {
                if (done) {
                    // Node-RED 1.0 compatible
                    done(error);
                } else {
                    // Node-RED 0.x compatible
                    node.error(error, msg);
                }
            }
            else {
                node.status({ fill: "blue", shape: "dot", text: "common.status.requesting" });

                var data;
                if (command === "PSMODE" || command === "PSMULTEQ") {
                    data = command + ":" + parameter;
                }
                else if (command.startsWith("PS") || command.startsWith("CV") || command.startsWith("SS") || command.startsWith("MVMAX")) {
                    data = command + " " + parameter;
                }
                else {
                    data = command + parameter;
                }

                var endpoint = "http://" + node.host + ":" + node.port + "/goform/formiPhoneAppDirect.xml";
                var opts = {};
                opts.url = endpoint + "?" + querystring.escape(data);
                opts.timeout = node.reqTimeout;
                opts.method = "GET";
                opts.maxRedirects = 21;

                request(opts, function (err, res, body) {
                    if (err) {
                        if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                            err = RED._("httpout.errors.no-response", { host: node.host, port: node.port });
                            node.status({ fill: "red", shape: "ring", text: "common.status.no-response" });
                        } else {
                            node.status({ fill: "red", shape: "ring", text: err.code });
                        }

                        if (done) {
                            // Node-RED 1.0 compatible
                            done(err);
                        } else {
                            // Node-RED 0.x compatible
                            node.error(err, msg);
                        }
                    }
                    else {
                        node.status({});

                        if (done) {
                            done();
                        }
                    }
                });
            }
        });

        this.on("close", function () {
            node.status({});
        });
    }
    RED.nodes.registerType("denon out", DenonAvrOut);
}