'use strict';

let co = require('co');

let doorStates = {
  0: 'closed',
  1: 'open',
  2: 'transitioning'
};

class GarageDoor {
  constructor() {
    this.comms = null;
  }

  /**
   * setup communications module
   * @param {NRFSecure} comms
   */
  * connect(comms) {
    this.comms = comms;
    yield this.comms.setup();
  }

  * monitor() {
    try {
      //console.log('nonce', yield this.comms._getNonce());
      //console.log('door status', yield this.getDoorStatus());
      console.log('toggling door'); this.openDoor();
    } catch (e) {
      console.error(e);
    }
  }

  openDoor() {
    this.comms.send(new Buffer([0x02]));
  }

  closeDoor() {

  }

  * getDoorStatus() {
    let response = yield this.comms.request(new Buffer([0x01]));
    let state = response.readUIntLE(0, 1);
    console.log('door state', response, state);
    let status = doorStates[state];
    return status ? status : 'unknown';
  }
}

module.exports = GarageDoor;
