'use strict';

let assert = require('assert');
let co = require('co');
var app = require('koa')();
var router = require('koa-router')({prefix: '/gdpi'});

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


  router.get('/open', function*() {
    this.body = 'opening\n';
    yield door.openDoor();
  });

  router.get('/close', function*() {
    this.body = 'closing\n';
    yield door.closeDoor();
  });

  router.get('/state', function*() {
    this.body = door.getDoorStatus();
  });

  router.get('/', function*() {
    this.body = 'gdpi';
  });

  app.use(router.routes());
  app.listen(3000);

  yield door.monitor();
}

co(main).catch(err => {
  console.error(err);
});
