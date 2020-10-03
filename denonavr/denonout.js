module.exports = function (RED) {
    'use strict';

    const axios = require('axios');

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

        this.on('input', function (msg, send, done) {
            let err;

            let command = msg.payload.command || '';
            if (command.length === 0) {
                err = RED._('common.errors.emptypayload');
            }
            let parameter = msg.payload.parameter || '';

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
                node.status({ fill: 'blue', shape: 'dot', text: 'common.status.requesting' });

                let data;
                if (['PSMODE', 'PSMULTEQ', 'PSFH', 'PSSP'].includes(command)) {
                    data = command + ':' + parameter;
                }
                else if ( ['PS', 'CV', 'SS', 'MVMAX', 'VSAUDIO', 'VSVST'].map(value => command.startsWith(value)).some(value => value === true)) {
                    data = command + ' ' + parameter;
                }
                else if ( ['PV'].map(value => command.startsWith(value) && command !== value).some(value => value === true)) {
                    data = command + ' ' + parameter;
                }
                else {
                    data = command + parameter;
                }

                let config = { timeout: node.reqTimeout, maxRedirects: 0 };
                axios.get(`http://${node.host}:${node.port}/goform/formiPhoneAppDirect.xml?${encodeURIComponent(data)}`, config)
                    .then(function (response) {
                        node.status({});

                        if (done) {
                            done();
                        }
                    })
                    .catch(function (error) {
                        if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.code === 'ECONNABORTED' || error.message === 'Network error') {
                            error = RED._("httpout.errors.no-response", { host: node.host, port: node.port });
                            node.status({ fill: 'red', shape: 'ring', text: 'common.status.no-response' });
                        } else {
                            node.status({ fill: 'red', shape: 'ring', text: error.code });
                        }

                        if (done) {
                            // Node-RED 1.0 compatible
                            done(error);
                        } else {
                            // Node-RED 0.x compatible
                            node.error(error, msg);
                        }
                    })
            }
        });

        this.on("close", function () {
            node.status({});
        });
    }
    RED.nodes.registerType("denon out", DenonAvrOut);
}