'use strict';

var assert = require('chai').assert;
var clock = require('./clock');
var sentinels = require('./sentinels');

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

describe('timed.delay(milliseconds, promiseOrValue)', function() {
  clock.use();

  it('returns a Promise instance', function() {
    assert.instanceOf(timed.delay(0), Promise);
  });

  it('resolves after a delay of `milliseconds`', function() {
    var delayed = timed.delay(50);
    assertPending(delayed);
    clock.tick(50);
    assertFulfilled(delayed);
  });

  it('resolves "immediately" a falsy delay', function() {
    var delayed = timed.delay();
    assertPending(delayed);
    clock.immediate();
    assertFulfilled(delayed);
  });

  it('resolves with provided value after delay', function() {
    var delayed = timed.delay(50, sentinels.one);
    assertPending(delayed);
    clock.tick(50);
    assertFulfilled(delayed, sentinels.one);
  });

  it('resolves after input promise plus delay', function(done) {
    var input = new Promise(function(resolve) {
      setTimeout(resolve, 50, sentinels.one);
    });
    var delayed = timed.delay(50, input);

    assertPending(input);
    assertPending(delayed);

    clock.tick(50);
    process.nextTick(function() {
      assertFulfilled(input, sentinels.one);
      assertPending(delayed);

      clock.tick(50);
      process.nextTick(function() {
        assertFulfilled(delayed, sentinels.one);
        done();
      });
    });
  });

  it('does not delay if input promise is rejected', function() {
    var result = timed.delay(50, Promise.rejected(sentinels.one));
    return assert.isRejected(result, sentinels.Sentinel);
  });
});

describe('timed.timeout(milliseconds, promiseOrValue)', function() {
  clock.use();

  it('returns a Promise instance', function() {
    assert.instanceOf(timed.timeout(0), Promise);
  });

  it('rejects after a timeout', function() {
    var p = timed.timeout(50, new Promise(function() {}));
    clock.tick(50);
    return assert.isRejected(p, TimeoutError);
  });

  it('rejects "immediately" with a falsy timeout', function() {
    var p = timed.timeout(0, new Promise(function() {}));
    clock.immediate();
    return assert.isRejected(p, TimeoutError);
  });

  it('rejects with a nice error message', function() {
    var p = timed.timeout(50, new Promise(function() {})).then(null,
        function(reason) { return reason.message; });
    clock.tick(50);
    return assert.eventually.match(p, /^Timed out after \d+ms$/);
  });

  it('does not time out when passed value', function() {
    return assert.eventually.strictEqual(timed.timeout(50, sentinels.one),
        sentinels.one);
  });

  it('does not time out when passed promise that fulfills in time', function() {
    var p = timed.timeout(100, new Promise(function(resolve) {
      setTimeout(resolve, 50, sentinels.one);
    }));
    clock.tick(50);
    return assert.eventually.strictEqual(p, sentinels.one);
  });

  it('does not time out when passed promise that rejects in time', function() {
    var p = timed.timeout(100, new Promise(function(_, reject) {
      setTimeout(reject, 50, sentinels.one);
    }));
    clock.tick(50);
    return assert.isRejected(p, sentinels.Sentinel);
  });
});
