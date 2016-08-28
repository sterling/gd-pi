'use strict';

let assert = require('assert');
let co = require('co');
let app = require('koa')();
let koaLogger = require('koa-logger');
let koaBody = require('koa-bodyparser');

let routes = require('./routes');
let NRFSecure = require('./nrf-secure');
let GarageDoor = require('./garage-door-ctl');

function *main() {
  let door = new GarageDoor();

  let secretArg = process.argv[2];

  assert(secretArg, 'Missing secret key');

  let secret = secretArg.split(',').map(v => {
    return parseInt(v, 16);
  });

  yield door.connect(new NRFSecure({
    spiDev: '/dev/spidev0.0',
    ce: 22,
    irq: 25,
    tx: 0x65646f4e31,
    rx: 0x65646f4e32
  }, new Buffer(secret)));

  app.use(koaLogger());
  app.use(koaBody());
  app.use(routes(door));
  app.listen(3000);

  yield door.monitor();
}

co(main).catch(err => {
  console.error(err);
});
