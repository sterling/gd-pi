var router = require('koa-router')({prefix: '/gdpi'});

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

module.exports = router.routes();