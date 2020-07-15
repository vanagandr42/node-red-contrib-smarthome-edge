module.exports = function (RED) {
    'use strict';

    const https = require('https');
    const axios = require('axios');
    const axiosDigest = require('./lib/axios-digest');

    function PhilipsTvReq(config) {
        RED.nodes.createNode(this, config);

        var host = config.host;
        var port = config.port * 1;
        var apiv = config.apiv * 1;
        var username = this.credentials.username;
        var password = this.credentials.password;

        var node = this;

        var httpsAgent = new https.Agent({ rejectUnauthorized: false, maxSockets: 5 });
        var baseUrl = `https://${host}:${port}/${apiv}`;
        var headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        var client = axios.create({ httpsAgent: httpsAgent, baseURL: baseUrl, headers: headers });
        axiosDigest(client, { username: username, password: password });

        this.on("input", function (msg, send, done) {
            let err;

            let payload = msg.payload || {};
            let command = payload.command || '';
            let path = payload.path || '';
            let body = payload.body || {};

            let options = {};
            if (command === 'get') {
                options.method = 'get';
                options.url = path;
                options.data = {};
            }
            else if (command === 'post') {
                options.method = 'post';
                options.url = path;
                if (typeof body === "object") {
                    options.data = body;
                }
                else {
                    try {
                        let bodyObj = JSON.parse(body);
                        if (typeof bodyObj === "object") {
                            options.data = bodyObj;
                        }
                        else {
                            err = RED._("common.errors.notjson");
                        }
                    }
                    catch (e) {
                        err = RED._("common.errors.notjson");
                    }
                }
            }
            else {
                err = RED._("common.errors.invalidcommand", { command: command });
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
                client(options)
                    .then(function (response) {
                        msg.payload.result = response.data;
                    })
                    .catch(function (error) {
                        err = error;
                    })
                    .then(function () {
                        // If an error is hit, report it to the runtime
                        if (err) {
                            if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                                err = RED._("httpout.errors.no-response", { host: node.host, port: node.port });
                                node.status({ fill: "red", shape: "ring", text: "common.status.no-response" });
                            }
                            else if (err.response && error.response.status) {
                                node.status({ fill: 'red', shape: 'dot', text: 'HTTP status: ' + error.response.status });
                            }
                            else {
                                node.status({ fill: 'red', shape: 'dot', text: 'HTTP error' });
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

                            // For maximum backwards compatibility, check that send exists.
                            // If this node is installed in Node-RED 0.x, it will need to
                            // fallback to using `node.send`
                            send = send || function () { node.send.apply(node, arguments) };
                            send(msg);

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
    RED.nodes.registerType("philips req", PhilipsTvReq, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}