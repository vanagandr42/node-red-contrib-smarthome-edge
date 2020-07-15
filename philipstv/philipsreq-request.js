module.exports = function (RED) {
    'use strict';

    const https = require('https');
    const request = require('request');

    function PhilipsTvReq(config) {
        RED.nodes.createNode(this, config);

        var host = config.host;
        var port = config.port * 1;
        var apiv = config.apiv * 1;
        var username = this.credentials.username;
        var password = this.credentials.password;

        var node = this;

        var httpsAgent = new https.Agent({ rejectUnauthorized: false, maxSockets: 1 });

        this.on("input", function (msg, send, done) {
            let err;

            let payload = msg.payload || {};
            let command = payload.command || '';
            let path = payload.path || '';
            let body = payload.body || {};

            let options = { url: `https://${host}:${port}/${apiv}/${path}`, agent: httpsAgent, auth: { user: username, pass: password, sendImmediately: false } };
            if (command === 'get') {
                options.method = 'GET';
                options.body = '{}';
            }
            else if (command === 'post') {
                options.method = 'POST';
                if (typeof body === "string") {
                    try {
                        body = JSON.parse(body);
                    }
                    catch (e) {
                        err = 'invalid JSON string';
                    }
                }
                if (typeof body === "object") {
                    options.body = JSON.stringify(body);
                }
                else {
                    err = 'invalid data type';
                }
            }
            else {
                err = 'invalid command';
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
                request(options, (error, response, body) => {
                    if (error) {
                        err = error;
                    }
                    else {
                        if (response.statusCode === 200) {
                            try {
                                msg.payload.result = JSON.parse(body);
                            }
                            catch (e) {
                                err = 'invalid response';
                            }
                        }
                        else {
                            err = 'some other error';
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
                    else {
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
    }
    RED.nodes.registerType("philips req", PhilipsTvReq, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}