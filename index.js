'use strict';

let co = require('co');

let NRFSecure = require('./nrf-secure');
let GarageDoor = require('./garage-door-ctl');

function *main() {
  let door = new GarageDoor();

  let secret = process.argv[2].split(',').map(v => {
    return parseInt(v, 16);
  });

  yield door.connect(new NRFSecure({
    spiDev: '/dev/spidev0.0',
    ce: 22,
    irq: 25,
    tx: 0x65646f4e31,
    rx: 0x65646f4e32
  }, new Buffer(secret)));


  while (true) {
    yield new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });

    yield door.monitor();
  }
}

co(main).catch(err => {
  console.error(err);
});
