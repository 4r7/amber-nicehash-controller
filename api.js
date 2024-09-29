const crypto = require('crypto');
const querystring = require('querystring');
const axios = require('axios');

function createNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function getAuthHeader(apiKey, apiSecret, time, nonce, organizationId = '', request = {}) {
  const hmac = crypto.createHmac('sha256', apiSecret);

  hmac.update(apiKey);
  hmac.update('\0');
  hmac.update(time);
  hmac.update('\0');
  hmac.update(nonce);
  hmac.update('\0');
  hmac.update('\0');
  if (organizationId) hmac.update(organizationId);
  hmac.update('\0');
  hmac.update('\0');
  hmac.update(request.method);
  hmac.update('\0');
  hmac.update(request.path);
  hmac.update('\0');
  if (request.query) hmac.update(typeof request.query == 'object' ? querystring.stringify(request.query) : request.query);
  if (request.body) {
    hmac.update('\0');
    hmac.update(typeof request.body == 'object' ? JSON.stringify(request.body) : request.body);
  }

  return apiKey + ':' + hmac.digest('hex');
}

class Api {
  constructor({ locale, apiHost, apiKey, apiSecret, orgId }) {
    this.locale = locale || 'en';
    this.host = apiHost;
    this.key = apiKey;
    this.secret = apiSecret;
    this.org = orgId;
    this.localTimeDiff = null;
  }

  async getTime() {
    try {
      const res = await axios.get(`${this.host}/api/v2/time`);
      this.localTimeDiff = res.data.serverTime - Date.now();
      this.time = res.data.serverTime;
      return res.data;
    } catch (error) {
      throw new Error('Failed to get server time: ' + error.message);
    }
  }

  async apiCall(method, path, { query, body, time } = {}) {
    if (this.localTimeDiff === null) {
      throw new Error('Get server time first using .getTime()');
    }

    // query in path
    let [pathOnly, pathQuery] = path.split('?');
    if (pathQuery) query = { ...querystring.parse(pathQuery), ...query };

    const nonce = createNonce();
    const timestamp = (time || Date.now() + this.localTimeDiff).toString();

    const headers = {
      'X-Request-Id': nonce,
      'X-User-Agent': 'NHNodeClient',
      'X-Time': timestamp,
      'X-Nonce': nonce,
      'X-User-Lang': this.locale,
      'X-Organization-Id': this.org,
      'X-Auth': getAuthHeader(this.key, this.secret, timestamp, nonce, this.org, {
        method,
        path: pathOnly,
        query,
        body,
      }),
    };

    const url = `${this.host}${pathOnly}${query ? `?${querystring.stringify(query)}` : ''}`;

    try {
      const response = await axios({
        method,
        url,
        headers,
        data: body,
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : error;
    }
  }

  get(path, options) {
    return this.apiCall('GET', path, options);
  }

  post(path, options) {
    return this.apiCall('POST', path, options);
  }

  put(path, options) {
    return this.apiCall('PUT', path, options);
  }

  delete(path, options) {
    return this.apiCall('DELETE', path, options);
  }
}

module.exports = Api;
