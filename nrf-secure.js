'use strict';

let assert = require('assert');
let crypto = require('crypto');

let NRFComms = require('./nrf-comms');

class NRFSecure extends NRFComms {
  constructor(config, key) {
    super(config);
    this.key = key;
  }

  * _getNonce() {
    let response = yield this._unsignedRequest(new Buffer([0xff]));

    let type = response.readUIntLE(0, 1);
    let len = response.readUIntLE(1, 1);
    let payload = response.slice(2, 2 + len);

    assert(type == 0xff, 'BADNONCE');

    return payload;
  }

  _createHmac(nonce, buf) {
    let hmac = crypto.createHmac('sha256', this.key);
    hmac.write(nonce);
    hmac.end(buf);
    return hmac.read();
  }

  * _unsignedRequest(buf) {
    return yield super.request(buf);
  }

  * _packageMessage(buf) {
    if (buf.length > 3) {
      throw new Error('Maximum message length (3b) exceeded.');
    }

    let nonce = yield this._getNonce();
    let hmac = this._createHmac(nonce, buf).slice(0, 24);

    return Buffer.concat([new Buffer([0xaa]), hmac, nonce, buf]);
  }

  * request(buf) {
    return yield super.request(yield this._packageMessage(buf));
  }

  * send(buf) {
    super.send(yield this._packageMessage(buf));
  }
}

module.exports = NRFSecure;
