'use strict';

const crypto = require('crypto');
const _ = require('underscore');

const namespace = 'axios-digest';

/**
 * Returns the axios-digest options for the current request
 * @param  {AxiosRequestConfig} config
 * @param  {AxiosDigestConfig} defaultOptions
 * @return {AxiosDigestConfig}
 */
function getRequestOptions(config, defaultOptions) {
    return Object.assign({}, defaultOptions, config[namespace]);
}

function getDigestParams(username, password, realm, uri, domain, nonce, method, nonceCount, cnonce, qop) {
    let ha1 = md5(username + ':' + realm + ':' + password);
    let ha2 = md5(method + ':' + uri);
    let response = md5(ha1 + ':' + nonce + ':' + nonceCount + ':' + cnonce + ':' + qop + ':' + ha2);

    return {
        username: username,
        realm: realm,
        nonce: nonce,
        uri: uri,
        algorithm: "MD5",
        qop: qop,
        nc: nonceCount,
        cnonce: cnonce,
        response: response
    }
}

function parseDigestHeader(header) {
    return _(header.substring(7).split(/,\s+/)).reduce(function (obj, s) {
        let key = s.substr(0, s.indexOf('='));
        let value = s.substr(s.indexOf('=') + 1);

        obj[key] = value.replace(/"/g, '');
        return obj;
    }, {})
}

function renderDigest(params) {
    var s = _(_.keys(params)).reduce(function (s1, ii) {
        return s1 + ', ' + ii + '="' + params[ii] + '"'
    }, '');
    return 'Digest ' + s.substring(2);
}

function md5(data) {
    return crypto.createHash('md5').update(data).digest("hex");
}

function generateCNONCE() {
    return md5(Math.random().toString(36)).substr(0, 8);
}

function generateNC() {
    return '00000001';
}

/**
 * Adds response interceptors to an axios instance to implement digest authentication
 *
 * @example
 *
 * const axios = require('axios');
 * const axiosDigest = require('./axios-digest');
 *
 * axiosDigest(axios, { username: 'guest', password: 'guest' });
 *
 * axios.get('http://example.com/test')
 *   .then(result => {
 *     result.data; // 'ok'
 *   });
 *
 * @param {Axios} axios An axios instance (the axios object or one created from axios.create)
 * @param {Object} [defaultOptions]
 * @param {number} [defaultOptions.username] Username
 * @param {boolean} [defaultOptions.password] Password
 */
module.exports = function (axios, defaultOptions) {
    axios.interceptors.response.use(null, error => {
        if (typeof error.response !== "undefined" && error.response.status === 401 && typeof error.response.headers['www-authenticate'] !== "undefined") {
            let config = error.config;

            // If we have no information to retry the request
            if (!config) {
                return Promise.reject(error);
            }

            const {
                username = '',
                password = ''
            } = getRequestOptions(config, defaultOptions);

            let digestHeader = parseDigestHeader(error.response.headers['www-authenticate']);
            let nonceCount = generateNC();
            let cnonce = generateCNONCE();
            let digest = getDigestParams(
                username,
                password,
                digestHeader.realm,
                error.response.request.path,
                digestHeader.domain,
                digestHeader.nonce,
                error.config.method.toUpperCase(),
                nonceCount,
                cnonce,
                digestHeader.qop
            );

            config.headers.Authorization = renderDigest(digest);
            return axios(config);
        }
        else {
            return Promise.reject(error);
        }
    });
}