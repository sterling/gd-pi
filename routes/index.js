var router = require('koa-router')({prefix: '/gdpi/v1'});

module.exports = function(door) {
  router.get('/open', function*() {
    this.body = 'opening\n';
    yield door.openDoor();
  });

  router.get('/close', function*() {
    this.body = 'closing\n';
    yield door.closeDoor();
  });

  router.get('/door', function*() {
    this.body = door.getDoorStatus().toUpperCase();
  });

  router.post('/door', function*() {
    console.log(this.request.body);
  });

  router.get('/', function*() {
    this.body = 'gdpi';
  });

  return router.routes();
}