module.exports = function (RED) {
    'use strict';

    const exec = require('child_process').exec;
    const isUtf8 = require('is-utf8');

    function PhilipsTvReq(config) {
        RED.nodes.createNode(this, config);

        var host = config.host;
        var port = config.port * 1;
        var apiv = config.apiv * 1;
        var username = this.credentials.username;
        var password = this.credentials.password;

        this.activeProcesses = {};
        this.execOpt = { encoding: 'binary', maxBuffer: 10000000, shell: '/bin/bash' };

        var node = this;

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
                if (typeof body === "string") {
                    try {
                        body = JSON.parse(body);
                    }
                    catch (e) {
                        err = 'invalid JSON string';
                    }
                }
                if (typeof body === "object") {
                    options.data = JSON.stringify(body);
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
                var cl = `curl -s --digest --insecure -u ${username}:${password} ${options.method === 'post' ? `-d '${options.data}' ` : ''} https://${host}:${port}/${apiv}/${options.url}`;
                var child = exec(cl, node.execOpt, function (error, stdout, stderr) {
                    if (error !== null) {
                        err = error;

                        if (error.code === null) { node.status({ fill: 'red', shape: 'dot', text: 'curl killed' }); }
                        else { node.status({ fill: 'red', shape: 'dot', text: 'curl error: ' + error.code }); }
                    }
                    else {
                        let result = Buffer.from(stdout, 'binary');
                        if (isUtf8(result)) { result = result.toString(); }
                        try {
                            msg.payload.result = JSON.parse(result);
                            node.status({});
                        }
                        catch (e) {
                            err = 'invalid response';
                            node.status({ fill: 'yellow', shape: 'dot', text: 'curl response' });
                        }
                    }

                    delete node.activeProcesses[child.pid];

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

                node.status({ fill: 'blue', shape: 'dot', text: 'curl pid: ' + child.pid });
                child.on('error', function () { });
                node.activeProcesses[child.pid] = child;
            }
        });

        this.on('close', function () {
            for (var pid in node.activeProcesses) {
                if (node.activeProcesses.hasOwnProperty(pid)) {
                    var process = node.activeProcesses[pid];
                    node.activeProcesses[pid] = null;
                    process.kill();
                }
            }
            node.activeProcesses = {};
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