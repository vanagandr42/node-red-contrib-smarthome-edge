module.exports = function (RED) {
    'use strict';

    const https = require('https');
    const axios = require('axios');
    const axiosDigest = require('./lib/axios-digest');

    function PhilipsTVConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.closing = false;
        this.users = {};
        this.interval_id = null;
        this.syncInterval = config.syncInterval;

        var host = config.host;
        var port = config.port * 1;
        var apiv = config.apiv * 1;
        var username = this.credentials.username;
        var password = this.credentials.password;

        var httpsAgent = new https.Agent({ rejectUnauthorized: false, maxSockets: 5 });
        var baseUrl = `https://${host}:${port}/${apiv}`;
        var headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        this.client = axios.create({ httpsAgent: httpsAgent, baseURL: baseUrl, headers: headers });
        axiosDigest(this.client, { username: username, password: password });

        var node = this;

        this.register = function (philipsTvNode) {
            node.users[philipsTvNode.id] = philipsTvNode;
            philipsTvNode.status({});
            if (Object.keys(node.users).length === 1) {
                node.interval_id = setInterval(function () {
                    node.poll();
                }, node.syncInterval);
            }
        };

        this.deregister = function (philipsTvNode) {
            philipsTvNode.status({});
            delete node.users[philipsTvNode.id];
            if (Object.keys(node.users).length === 0 && node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        };

        this.request = async function (method, path, body) {
            let options = {};
            if (method === 'get') {
                options.method = 'get';
                options.url = path;
                options.data = {};
            }
            else if (method === 'post') {
                options.method = 'post';
                options.url = path;
                if (typeof body === 'object') {
                    options.data = body;
                }
                else {
                    try {
                        let bodyObj = JSON.parse(body);
                        if (typeof bodyObj === 'object') {
                            options.data = bodyObj;
                        }
                        else {
                            throw new TypeError('common.errors.notjson');
                        }
                    }
                    catch (e) {
                        throw new TypeError('common.errors.notjson');
                    }
                }
            }
            else {
                throw new TypeError('common.errors.invalidmethod');
            }

            return await node.client(options);
        }

        this.poll = async function () {
            let requestData = [];
            requestData.push({ method: 'post', path: 'menuitems/settings/current', body: { nodes: [{ nodeid: 2131230838 }, { nodeid: 2131230764 }] } });
            requestData.push({ method: 'post', path: 'notifychange', body: { notification: { 'system/nettvversion': '', 'applications/version': null, powerstate: { powerstate: '' }, 'activities/tv': { channel: {} }, 'activities/current': {} } } });
            requestData.push({ method: 'get', path: 'audio/volume' });

            for (let data of requestData) {
                for (let user in node.users) {
                    node.users[user].status({ fill: 'blue', shape: 'dot', text: 'node-red:common.status.connecting' });
                }

                try {
                    let response = await node.request(data.method, data.path, data.body);
                    let msg = {payload: data};
                    msg.payload.result = response.data;

                    for (let user in node.users) {
                        node.users[user].status({});
                        node.users[user].emit('input', msg);
                    }
                }
                catch (error) {
                    node.error(error);
                    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                    }
                    else if (error.response && error.response.status) {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'HTTP status: ' + error.response.status });
                        }
                    }
                    else {
                        for (let user in node.users) {
                            node.users[user].status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected' });
                        }
                    }
                }
            }
        }

        this.on('close', function () {
            node.closing = true;
            if (node.interval_id != null) {
                clearInterval(node.interval_id);
            }
        });
    }
    RED.nodes.registerType('philipstv config', PhilipsTVConfigNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}