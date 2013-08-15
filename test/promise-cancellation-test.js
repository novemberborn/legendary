'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

var Promise = require('../').Promise;
var CancelError = require('../').CancelError;

function identity(x) { return x; }

function invert(promise) {
  return promise.then(function(value) {
    throw value;
  }, function(reason) {
    return reason;
  });
}

function constant(value) {
  return function() {
    return value;
  };
}

function assertCancelled(promise) {
  return assert.isRejected(promise, CancelError);
}

describe('Cancellation', function() {
  describe('Promise#cancel()', function() {
    it('is a no-op on a fulfilled promise', function() {
      var promise = Promise.from(sentinels.one);
      promise.cancel();
      return assert.eventually.strictEqual(promise, sentinels.one);
    });

    it('is a no-op on a rejected promise', function() {
      var promise = Promise.rejected(sentinels.one);
      promise.cancel();
      return assert.eventually.strictEqual(invert(promise), sentinels.one);
    });

    it('rejects a pending promise with a CancelError', function() {
      var promise = new Promise(function() {});
      promise.cancel();
      return assertCancelled(promise);
    });
  });

  describe('with an onCancelled() callback', function() {
    it('is not invoked when a fulfilled promise is cancelled', function() {
      var spy = sinon.spy();
      new Promise(function(resolve) {
        resolve();
        return spy;
      }).cancel();
      assert.notCalled(spy);
    });

    it('is not invoked when a rejected promise is cancelled', function() {
      var spy = sinon.spy();
      new Promise(function(_, reject) {
        reject();
        return spy;
      }).cancel();
      assert.notCalled(spy);
    });

    it('is invoked when a pending promise is cancelled', function() {
      var spy = sinon.spy();
      var promise = new Promise(constant(spy));
      promise.cancel();
      assert.calledOnce(spy);
    });

    it('rejects the pending promise with an exception if it throws',
        function() {
          var promise = new Promise(function() {
            return function() { throw sentinels.one; };
          });
          promise.cancel();
          return assert.eventually.strictEqual(invert(promise), sentinels.one);
        });
  });

  describe('under complex propagation scenarios', function() {
    it('cancels a derived promise', function() {
      var promise = new Promise(function() {});
      var derived = promise.then(identity);
      derived.cancel();
      return assertCancelled(derived);
    });

    it('propagates when cancelling a derived promise', function() {
      var spy = sinon.spy();
      var promise = new Promise(constant(spy));
      var derived = promise.then(identity);
      derived.cancel();
      assert.calledOnce(spy);
      return assertCancelled(promise);
    });

    it('cancels the returned promise, but does not stop the callback ' +
        '(who’s return value is what’s promised) from being executed',
        function() {
          var fulfilledSpy = sinon.spy();
          var rejectedSpy = sinon.spy();

          var promise = Promise.from();
          var derived = promise.then(fulfilledSpy);
          derived.cancel();
          derived.then(null, rejectedSpy);

          return promise.then(function() {
            assert.callOrder(fulfilledSpy, rejectedSpy);
            return assertCancelled(derived);
          });
        });

    describe('adopting promise state', function() {
      it('cancels adoption when returned in promise chain', function() {
        var spy = sinon.spy();
        var inner = new Promise(constant(spy));
        var derived = Promise.from().then(constant(inner));
        return Promise.from().then(function() {
          derived.cancel();
          assert.calledOnce(spy);
          return assertCancelled(inner);
        });
      });

      it('cancels adoption when resolved directly', function() {
        var spy = sinon.spy();
        var inner = new Promise(constant(spy));
        var outer = new Promise(function(resolve) { resolve(inner); });
        outer.cancel();
        assert.calledOnce(spy);
        return assertCancelled(outer);
      });
    });

    describe('assimilating thenables, upon cancellation', function() {
      it('ignores assimilation when returned in promise chain', function() {
        var resolveThenable;
        var derived = Promise.from().then(constant({
          then: function(resolvePromise) { resolveThenable = resolvePromise; }
        })).then(identity);
        return Promise.from().then(function() {
          assert(resolveThenable);
          derived.cancel();
          resolveThenable('thenable result');
          return assertCancelled(derived);
        });
      });

      it('ignores assimilation when resolved directly', function() {
        var resolveThenable;
        var outer = new Promise(function(resolve) {
          resolve({
            then: function(resolvePromise) {
              resolveThenable = resolvePromise;
            }
          });
        });
        assert(resolveThenable);
        outer.cancel();
        resolveThenable('thenable result');
        return assertCancelled(outer);
      });
    });
  });

  describe('Promise#fork()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = Promise.from(sentinels.one);
      var forked = promise.fork();
      assert.notStrictEqual(promise, forked);
      return assert.eventually.strictEqual(forked, sentinels.one);
    });

    it('creates a new promise that does not propagate cancellation to its ' +
        'origin',
        function() {
          var spy = sinon.spy();
          var promise = new Promise(constant(spy));
          var forked = promise.fork();
          forked.cancel();
          return assertCancelled(forked).then(function() {
            assert.notCalled(spy);
          });
        });
  });

  describe('Promise#uncancellable()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = Promise.from(sentinels.one);
      var uncancellable = promise.uncancellable();
      assert.notStrictEqual(promise, uncancellable);
      return assert.eventually.strictEqual(uncancellable, sentinels.one);
    });

    it('creates a new promise that cannot be cancelled', function() {
      var resolvePromise;
      var promise = new Promise(function(resolve) {
        resolvePromise = resolve;
      });
      var uncancellable = promise.uncancellable();
      uncancellable.cancel();
      resolvePromise(sentinels.one);
      return assert.eventually.strictEqual(uncancellable, sentinels.one);
    });

    it('creates a new promise that does not propagate cancellation to its ' +
        'origin',
        function() {
          var spy = sinon.spy();
          var resolvePromise;
          var promise = new Promise(function(resolve) {
            resolvePromise = resolve;
            return spy;
          });
          var uncancellable = promise.uncancellable();
          uncancellable.cancel();
          resolvePromise(sentinels.one);
          return assert.eventually.strictEqual(uncancellable, sentinels.one)
              .then(function() {
                assert.notCalled(spy);
              });
        });

    it('creates a new promise, of which derived promises can’t be cancelled ' +
        'either',
        function() {
          var resolvePromise;
          var promise = new Promise(function(resolve) {
            resolvePromise = resolve;
          });
          var uncancellable = promise.uncancellable();
          var derived = uncancellable.then(identity);
          derived.cancel();
          resolvePromise(sentinels.one);
          return assert.eventually.strictEqual(derived, sentinels.one);
        });
  });
});
