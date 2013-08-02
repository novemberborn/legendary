'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');

var Promise = require('../').Promise;
var CancelError = require('../').CancelError;

var adapter = require('./adapter');
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;
var pending = adapter.pending;

var sentinel = {};

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
  describe('#cancel()', function() {
    it('is a no-op on a fulfilled promise', function() {
      var promise = fulfilled(sentinel);
      promise.cancel();
      return assert.eventually.strictEqual(promise, sentinel);
    });

    it('is a no-op on a rejected promise', function() {
      var promise = rejected(sentinel);
      promise.cancel();
      return assert.eventually.strictEqual(invert(promise), sentinel);
    });

    it('rejects a pending promise with a CancelError', function() {
      var promise = pending().promise;
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
            return function() { throw sentinel; };
          });
          promise.cancel();
          return assert.eventually.strictEqual(invert(promise), sentinel);
        });
  });

  describe('under complex propagation scenarios', function() {
    it('cancels a derived promise', function() {
      var promise = pending().promise;
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

          var promise = fulfilled();
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
        var derived = fulfilled().then(constant(inner));
        return fulfilled().then(function() {
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
        var derived = fulfilled().then(constant({
          then: function(resolvePromise) { resolveThenable = resolvePromise; }
        })).then(identity);
        return fulfilled().then(function() {
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

  describe('#fork()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = fulfilled(sentinel);
      var forked = promise.fork();
      assert.notStrictEqual(promise, forked);
      return assert.eventually.strictEqual(forked, sentinel);
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

  describe('#uncancellable()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = fulfilled(sentinel);
      var uncancellable = promise.uncancellable();
      assert.notStrictEqual(promise, uncancellable);
      return assert.eventually.strictEqual(uncancellable, sentinel);
    });

    it('creates a new promise that cannot be cancelled', function() {
      var resolvePromise;
      var promise = new Promise(function(resolve) {
        resolvePromise = resolve;
      });
      var uncancellable = promise.uncancellable();
      uncancellable.cancel();
      resolvePromise(sentinel);
      return assert.eventually.strictEqual(uncancellable, sentinel);
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
          resolvePromise(sentinel);
          return assert.eventually.strictEqual(uncancellable, sentinel).then(
              function() {
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
          resolvePromise(sentinel);
          return assert.eventually.strictEqual(derived, sentinel);
        });
  });
});
