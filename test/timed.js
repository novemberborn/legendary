'use strict';

var sinon = require('sinon');

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;
var timed = require('../').timed;
var TimeoutError = require('../').TimeoutError;

function assertPending(p) {
  assert.deepEqual(p.inspectState(), {
    isFulfilled: false,
    isRejected: false
  });
}

function assertFulfilled(p, value) {
  assert.deepEqual(p.inspectState(), {
    isFulfilled: true,
    isRejected: false,
    value: value
  });
}

describe('timed.delay(milliseconds, x)', function() {
  var clock;
  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });
  afterEach(function() {
    clock.restore();
  });

  it('returns a Promise instance', function() {
    assert.instanceOf(timed.delay(0), Promise);
  });

  it('resolves after a delay of `milliseconds`', function() {
    var delayed = timed.delay(50);
    process.nextTick(function() {
      assertPending(delayed);
      clock.tick(50);
      assertFulfilled(delayed);
    });
  });

  it('resolves "immediately" a falsy delay', function() {
    var delayed = timed.delay();
    process.nextTick(function() {
      assertPending(delayed);
      clock.tick();
      assertFulfilled(delayed);
    });
  });

  it('resolves with provided value after delay', function() {
    var delayed = timed.delay(50, sentinels.foo);
    process.nextTick(function() {
      assertPending(delayed);
      clock.tick(50);
      assertFulfilled(delayed, sentinels.foo);
    });
  });

  it('resolves after input promise plus delay', function(done) {
    var input = new Promise(function(resolve) {
      setTimeout(resolve, 50, sentinels.foo);
    });
    var delayed = timed.delay(50, input);

    assertPending(input);
    assertPending(delayed);

    clock.tick(50);
    process.nextTick(function() {
      assertFulfilled(input, sentinels.foo);
      assertPending(delayed);

      clock.tick(50);
      process.nextTick(function() {
        assertFulfilled(delayed, sentinels.foo);
        done();
      });
    });
  });

  it('does not delay if input promise is rejected', function() {
    var result = timed.delay(50, Promise.rejected(sentinels.foo));
    return assert.isRejected(result, sentinels.Sentinel);
  });

  it('resolves after input thenable plus delay', function(done) {
    var thenable = Thenable.defer();
    var delayed = timed.delay(50, thenable.it);
    assertPending(delayed);

    clock.tick(50);
    thenable.resolve(sentinels.foo);

    process.nextTick(function() {
      assertPending(delayed);

      clock.tick(50);
      process.nextTick(function() {
        assertFulfilled(delayed, sentinels.foo);
        done();
      });
    });
  });

  it('does not delay if input thenable is rejected', function() {
    var result = timed.delay(50, new Thenable(function(resolve, reject) {
      reject(sentinels.foo);
    }));
    return assert.isRejected(result, sentinels.Sentinel);
  });
});

describe('timed.timeout(milliseconds, x)', function() {
  var clock;
  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });
  afterEach(function() {
    clock.restore();
  });

  it('returns a Promise instance', function() {
    assert.instanceOf(timed.timeout(0), Promise);
  });

  it('rejects after a timeout of a promise', function() {
    var p = timed.timeout(50, new Promise(function() {}));
    clock.tick(50);
    return assert.isRejected(p, TimeoutError);
  });

  it('rejects after a timeout of a thenable', function() {
    var p = timed.timeout(50, Thenable.defer().it);
    clock.tick(50);
    return assert.isRejected(p, TimeoutError);
  });

  it('rejects "immediately" with a falsy timeout', function() {
    var p = timed.timeout(0, new Promise(function() {}));
    clock.tick();
    return assert.isRejected(p, TimeoutError);
  });

  it('rejects with a nice error message', function() {
    var p = timed.timeout(50, new Promise(function() {})).then(null,
        function(reason) { return reason.message; });
    clock.tick(50);
    return assert.eventually.match(p, /^Timed out after \d+ms$/);
  });

  it('does not time out when passed value', function() {
    return assert.eventually.matchingSentinels(
      timed.timeout(50, sentinels.foo), sentinels.foo);
  });

  it('does not time out when passed promise that fulfills in time', function() {
    var p = timed.timeout(100, new Promise(function(resolve) {
      setTimeout(resolve, 50, sentinels.foo);
    }));
    clock.tick(50);
    return assert.eventually.matchingSentinels(p, sentinels.foo);
  });

  it('does not time out when passed thenable that fulfills in time',
    function() {
      var p = timed.timeout(100, new Thenable(function(resolve) {
        setTimeout(resolve, 50, sentinels.foo);
      }));
      clock.tick(50);
      return assert.eventually.matchingSentinels(p, sentinels.foo);
    });

  it('does not time out when passed promise that rejects in time', function() {
    var p = timed.timeout(100, new Promise(function(_, reject) {
      setTimeout(reject, 50, sentinels.foo);
    }));
    clock.tick(50);
    return assert.isRejected(p, sentinels.Sentinel);
  });

  it('does not time out when passed thenable that rejects in time', function() {
    var p = timed.timeout(100, new Thenable(function(_, reject) {
      setTimeout(reject, 50, sentinels.foo);
    }));
    clock.tick(50);
    return assert.isRejected(p, sentinels.Sentinel);
  });
});
