'use strict';
var router = require('koa-router')({prefix: '/gdpi/v1'});

module.exports = function(door) {
  router.get('/door', function*() {
    this.body = door.getDoorStatus().toUpperCase();
  });

  router.post('/door', function*() {
    let state = this.request.body.toLowerCase();

    this.status = 200;

    if (state == 'open') {
      yield door.openDoor();
      this.body = 'opening';
    } else if (state == 'closed') {
      yield door.closeDoor();
      this.body = 'closing';
    } else {
      this.status = 400;
      this.body = 'unexpected state';
    }
  });

  router.get('/', function*() {
    this.body = 'gdpi';
  });

  return router.routes();
}
