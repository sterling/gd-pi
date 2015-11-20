'use strict';

let co = require('co');
let Events = require('events');

let doorStates = {
  0: 'closed',
  1: 'open',
  2: 'transitioning'
};

class GarageDoor extends Events {
  constructor() {
    super();
    this.comms = null;
    this._currentState = null;
  }

  /**
   * setup communications module
   * @param {NRFSecure} comms
   */
  * connect(comms) {
    console.log('connecting...');
    this.comms = comms;
    yield this.comms.setup();
    console.log('connected');
  }

  * monitor() {
    while (true) {
      yield new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });

      try {
        this.updateDoorState(yield this._getDoorState());
      } catch (e) {}
    }
  }

  * openDoor() {
    yield this.comms.send(new Buffer([0x02]));
  }

  * closeDoor() {
    yield this.comms.send(new Buffer([0x02]));
  }

  getDoorStatus() {
    let status = doorStates[this._currentState];
    return status ? status : 'unknown';
  }

  updateDoorState(newState) {
    if (this._currentState !== null && this._currentState != newState) {

    }

    this._currentState = newState;
    console.log(this.getDoorStatus());
  }

  * _getDoorState() {
    let response = yield this.comms.request(new Buffer([0x01]));
    return response.readUIntLE(0, 1);
  }
}

module.exports = GarageDoor;
