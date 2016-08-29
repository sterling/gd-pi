'use strict';

let NRF24 = require('nrf');

class NRFComms {
  constructor(config) {
    this._onresponse = null;
    this._ontxerror = null;
    this.ondata = null;
    this.tx = null;
    this.rx = null;
    this.txAddr = config.tx;
    this.rxAddr = config.rx;

    this.nrf = NRF24.connect(config.spiDev, config.ce, config.irq);

    this.nrf.channel(config.channel || 0x4c);
    this.nrf.transmitPower(config.power || 'PA_MAX');
    this.nrf.dataRate(config.rate || '1Mbps');
    this.nrf.crcBytes(config.crc || 2);
    this.nrf.autoRetransmit(config.retransmit || {count: 15, delay: 15});
  }

  _rxData(buf) {
    buf = buf.reverse();
    if (this._onresponse) {
      this._onresponse(buf);
      this._clearResponseListener();
    } else {
      this.ondata && this.ondata(buf);
    }
  }

  _txError(e) {
    //console.warn('.', e);
    this._clearResponseListener();
    this._ontxerror && this._ontxerror(e);
  }

  _clearResponseListener() {
    this._setResponseListener(null, null);
  }

  _setResponseListener(fn, efn) {
    this._onresponse = fn;
    this._ontxerror = efn;
  }

  _write(buf) {
    //console.log('writing', buf)
    let write = new Buffer(buf);
    write.reverse();
    this.tx.write(write);
  }

  _writeWait(buf) {
    return new Promise((resolve, reject) => {
      this._write(buf);

      setTimeout(() => {
        this._clearResponseListener();
        reject(new Error('ERESPTIMEOUT'));
      }, 300);

      this._setResponseListener(data => {
        this._clearResponseListener();
        resolve(data);
      }, err => {
        this._clearResponseListener();
        reject(err);
      });
    });
  }

  _transmit(buf) {

  }

  onData(fn) {
    this.ondata = fn;
  }

  send(buf) {
    this._write(buf);
  }

  /**
   * Sends a message and waits for a reply
   * @param {Buffer} buf
   * @returns {Buffer}
   */
  * request(buf) {
    for (let i = 0; i < 15; i++) {
      try {
        return yield this._writeWait(buf);
      } catch (e) {
        if (e.message != 'ERESPTIMEOUT') {
          throw e;
        }
      }
    }

    throw new Error('ERESPTIMEOUTFULL');
  }

  setup() {
    return new Promise(resolve => {
      this.nrf.begin(() => {
        this.tx = this.nrf.openPipe('tx', this.txAddr);
        this.rx = this.nrf.openPipe('rx', this.rxAddr);

        //this.nrf.printDetails();

        this.rx.on('data', this._rxData.bind(this));
        this.tx.on('error', this._txError.bind(this));

        resolve(true);
      });
    });
  }
}

module.exports = NRFComms;
