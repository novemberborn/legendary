'use strict';

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;
var blessObject = require('../').blessObject;
var extendConstructor = require('../').extendConstructor;

function SubPromise(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubPromise)) {
    return new SubPromise(executor);
  }

  if (executor !== blessObject) {
    blessObject(this, executor);
  }
}
SubPromise.prototype = new Promise(blessObject);
SubPromise.prototype.constructor = SubPromise;

function defer(constructor) {
  var deferred = {};
  deferred.promise = constructor(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

function identity(x) { return x; }

describe('Subclassing', function() {
  describe('Promise#then()', function() {
    it('preserves subclass when called on a pending promise', function() {
      var chain = defer(SubPromise).promise.then(identity);
      assert.instanceOf(chain, SubPromise);
    });

    it('preserves subclass when called on a pending promise chain', function() {
      // Internally, the first then() creates an initialized propagator.
      // The second then() transitions it to a delegated state, creating
      // a new promise. That last promise must still be of the same subclass.
      var chain = defer(SubPromise).promise.then(identity).then(identity);
      assert.instanceOf(chain, SubPromise);
    });

    it('preserves subclass when onFulfilled callback returns value',
        function() {
          var dfd = defer(SubPromise);
          dfd.resolve(sentinels.foo);
          // Internally, the first then creates a fulfilled propagator.
          // The second then() also creates a fulfilled propagator which
          // must yield a promise of the same subclass.
          var chain = dfd.promise.then(identity).then(identity);
          assert.instanceOf(chain, SubPromise);
        });

    it('preserves subclass when onFulfilled callbacks returns a different ' +
        'pending promise',
        function() {
          var dfd = defer(SubPromise);
          dfd.resolve();
          // Internally, the first then creates a delegated propagator.
          // The second then() also creates a pending propagator which
          // must yield a promise of the same subclass.
          var chain = dfd.promise.then(function() {
            return defer(Promise).promise;
          }).then(identity);
          assert.instanceOf(chain, SubPromise);
        });

    it('preserves subclass when onFulfilled callbacks returns a thenable',
        function() {
          var dfd = defer(SubPromise);
          dfd.resolve();
          // Internally, the first then creates a pending propagator.
          // The second then() transitions it to a delegated state, creating
          // a new promise. That last promise must still be of the same
          // subclass.
          var chain = dfd.promise.then(function() {
            return Thenable.defer().it;
          }).then(identity);
          assert.instanceOf(chain, SubPromise);
        });

    describe('can be configured to return a different subclass', function() {
      var OtherPromise = extendConstructor(function(executor) {
        if (executor !== blessObject) {
          blessObject(this, executor, true, SubPromise);
        }
      });

      it('duly returns an instance of that other class', function() {
        var p1 = new OtherPromise(function(resolve) {
          resolve(sentinels.foo);
        });
        var p2 = p1.then(identity);

        assert.notInstanceOf(p2, OtherPromise);
        assert.instanceOf(p2, SubPromise);

        return assert.eventually.matchingSentinels(p2, sentinels.foo);
      });

      it('does not shortcut when called without callbacks', function() {
        var p1 = new OtherPromise(function(resolve) {
          resolve(sentinels.foo);
        });
        var p2 = p1.then();

        assert.notStrictEqual(p1, p2);
        assert.notInstanceOf(p2, OtherPromise);
        assert.instanceOf(p2, SubPromise);
      });
    });
  });

  describe('resolve()', function() {
    it('synchronously adopts state of a promise of the same subclass',
        function() {
          var dfd1 = defer(SubPromise);
          var dfd2 = defer(SubPromise);
          dfd2.resolve(sentinels.foo);
          dfd1.resolve(dfd2.promise);
          var state = dfd1.promise.inspectState();
          assert(state.isFulfilled);
          assert.matchingSentinels(state.value, sentinels.foo);
        });

    it('synchronously adopts state of a promise of a different subclass',
        function() {
          var dfd1 = defer(SubPromise);
          var dfd2 = defer(Promise);
          dfd2.resolve(sentinels.foo);
          dfd1.resolve(dfd2.promise);
          var state = dfd1.promise.inspectState();
          assert(state.isFulfilled);
          assert.matchingSentinels(state.value, sentinels.foo);
        });

  });

  describe('extendConstructor helper', function() {
    it('sets up inheritance', function() {
      var Extended = extendConstructor(function() {});
      assert.instanceOf(new Extended(), Promise);
    });

    it('keeps the constructor reference intact', function() {
      var Extended = extendConstructor(function() {});
      assert.strictEqual(new Extended().constructor, Extended);
    });

    it('copies constructor methods from Promise', function() {
      var Extended = extendConstructor(function() {});
      assert.strictEqual(Extended.from, Promise.from);
      assert.strictEqual(Extended.rejected, Promise.rejected);
      assert.strictEqual(Extended.all, Promise.all);
      assert.strictEqual(Extended.any, Promise.any);
      assert.strictEqual(Extended.some, Promise.some);
      assert.strictEqual(Extended.join, Promise.join);
      assert.strictEqual(Extended.denodeify, Promise.denodeify);
    });

    it('sets up an `isInstance()` helper', function() {
      var Extended = extendConstructor(function() {});
      assert.isTrue(Extended.isInstance(new Extended()));
      assert.isFalse(Extended.isInstance(Promise.from()));
    });

    it('takes a base class argument', function() {
      var Base = extendConstructor(function() {});
      var Extended = extendConstructor(function() {}, Base);
      assert.instanceOf(new Extended(), Promise);
      assert.instanceOf(new Extended(), Base);
    });
  });
});
