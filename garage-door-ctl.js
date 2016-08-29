'use strict';

let co = require('co');
let Events = require('events');

const CLOSED = 0;
const OPEN = 1;
const TRANS = 2;

let doorStates = {
  [CLOSED]: 'closed',
  [OPEN]: 'open',
  [TRANS]: 'transitioning'
};

class GarageDoor extends Events {
  constructor() {
    super();
    this.comms = null;
    this._currentState = null;
    this._pendingRequest = null;
    this._pendingStart = null;
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
        yield this.doPendingRequest();
      } catch (e) {}
    }
  }

  clearPendingRequest() {
    this._pendingRequest = null;
    this._pendingStart = null;
  }

  * openDoor() {
    if (this.isOpen()) {
      // nothing to do
      this.clearPendingRequest();
    } else if (this.isClosed()) {
      this.clearPendingRequest();

      let success = yield this._toggleDoor();
      if (!success) {
        this.setPendingRequest(OPEN);
      }
    } else if (this.isTransitioning() || this.isUnknown()) {
      this.setPendingRequest(OPEN);
    }
  }

  * closeDoor() {
    if (this.isClosed()) {
      // nothing to do
      this.clearPendingRequest();
    } else if (this.isOpen()) {
      this.clearPendingRequest();

      let success = yield this._toggleDoor();
      if (!success) {
        this.setPendingRequest(CLOSED);
      }
    } else if (this.isTransitioning() || this.isUnknown()) {
      this.setPendingRequest(CLOSED);
    }
  }

  * _toggleDoor() {
    this._currentState = TRANS;
    try {
      yield this.comms.send(new Buffer([0x02]));
      return true;
    } catch (e) {
      console.error('Failed to toggle door', e);
    }

    return false;
  }

  * doPendingRequest() {
    if (this._pendingRequest !== null) {
      let timeSinceRequest = Date.now() - this._pendingStart;

      if (timeSinceRequest >= 20000 && this.isTransitioning()) {
        // has been pending for a while so the door must be stopped in between.
        if (yield this._toggleDoor()) {
          this._pendingStart = Date.now();
        }
      } else {
        switch (this._pendingRequest) {
          case OPEN:
            yield this.openDoor();
            break;
          case CLOSED:
            yield this.closeDoor();
            break;
          default:
        }
      }
    }
  }

  setPendingRequest(requestedState) {
    this._pendingRequest = requestedState;

    if (this._pendingStart === null) {
      this._pendingStart = Date.now();
    }
  }

  isOpen() {
    return this._currentState == OPEN;
  }

  isClosed() {
   return this._currentState == CLOSED;
  }

  isTransitioning() {
    return this._currentState == TRANS;
  }

  isUnknown() {
    return doorStates[this._currentState] === undefined;
  }

  getDoorStatus() {
    let status = doorStates[this._currentState];
    return status ? status : 'unknown';
  }

  updateDoorState(newState) {
    this._currentState = newState;
  }

  * _getDoorState() {
    let response = yield this.comms.request(new Buffer([0x01]));
    return response.readUIntLE(0, 1);
  }
}

module.exports = GarageDoor;
