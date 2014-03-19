'use strict';

var sinon = require('sinon');

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;
var CancellationError = require('../').CancellationError;

function identity(x) { return x; }
function thrower(x) { throw x; }

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
  return assert.isRejected(promise, CancellationError);
}

describe('Cancellation', function() {
  describe('Promise#cancel()', function() {
    it('is a no-op on a fulfilled promise', function() {
      var promise = Promise.from(sentinels.foo);
      promise.cancel();
      return assert.eventually.matchingSentinels(promise, sentinels.foo);
    });

    it('is a no-op on a rejected promise', function() {
      var promise = Promise.rejected(sentinels.foo);
      promise.cancel();
      return assert.eventually.matchingSentinels(
        invert(promise), sentinels.foo);
    });

    it('rejects a pending promise with a CancellationError', function() {
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
            return function() { throw sentinels.foo; };
          });
          promise.cancel();
          return assert.eventually.matchingSentinels(
            invert(promise), sentinels.foo);
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
            assert.calledOnce(fulfilledSpy);
            assert.notCalled(rejectedSpy);
            return assertCancelled(derived);
          }).then(function() {
            assert.calledOnce(rejectedSpy);
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
        var thenable = Thenable.defer();
        var assimilationSpy = sinon.spy(thenable.it, 'then');

        var derived = Promise.from().then(
          constant(thenable.it)
        ).then(identity);
        return Promise.from().then(function() {
          assert.calledOnce(assimilationSpy);
          derived.cancel();
          thenable.resolve('thenable result');
          return assertCancelled(derived);
        });
      });

      it('ignores assimilation when resolved directly', function() {
        var thenable = Thenable.defer();
        var assimilationSpy = sinon.spy(thenable.it, 'then');

        var outer = new Promise(function(resolve) {
          resolve(thenable.it);
        });
        assert.calledOnce(assimilationSpy);
        outer.cancel();
        thenable.resolve('thenable result');
        return assertCancelled(outer);
      });
    });
  });

  describe('Promise#fork()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = Promise.from(sentinels.foo);
      var forked = promise.fork();
      assert.notStrictEqual(promise, forked);
      return assert.eventually.matchingSentinels(forked, sentinels.foo);
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

    it('creates a new promise that can be cancelled after a callback is added',
      function() {
        var spy = sinon.spy();
        var promise = new Promise(constant(spy));
        var forked = promise.fork();
        var derived = forked.then(identity, thrower);
        forked.cancel();
        return assertCancelled(derived);
      });
  });

  describe('Promise#uncancellable()', function() {
    it('creates a new promise that assumes the same state', function() {
      var promise = Promise.from(sentinels.foo);
      var uncancellable = promise.uncancellable();
      assert.notStrictEqual(promise, uncancellable);
      return assert.eventually.matchingSentinels(uncancellable, sentinels.foo);
    });

    it('creates a new promise that cannot be cancelled', function() {
      var resolvePromise;
      var promise = new Promise(function(resolve) {
        resolvePromise = resolve;
      });
      var uncancellable = promise.uncancellable();
      uncancellable.cancel();
      resolvePromise(sentinels.foo);
      return assert.eventually.matchingSentinels(uncancellable, sentinels.foo);
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
          resolvePromise(sentinels.foo);
          return assert.eventually.matchingSentinels(
            uncancellable, sentinels.foo
          ).then(function() {
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
          resolvePromise(sentinels.foo);
          return assert.eventually.matchingSentinels(derived, sentinels.foo);
        });
  });
});
