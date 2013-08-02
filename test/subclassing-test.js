'use strict';

var assert = require('chai').assert;
var sentinels = require('./sentinels');

var blessed = require('../lib/blessed');
var Promise = require('../').Promise;

function SubPromise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubPromise)) {
    return new SubPromise(resolver);
  }

  blessed.be(this, resolver);
}
SubPromise.prototype = new Promise(blessed.be);
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
          dfd.resolve(sentinels.one);
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
            return { then: function() {} };
          }).then(identity);
          assert.instanceOf(chain, SubPromise);
        });
  });

  describe('resolve()', function() {
    it('synchronously adopts state of a promise of the same subclass',
        function() {
          var dfd1 = defer(SubPromise);
          var dfd2 = defer(SubPromise);
          dfd2.resolve(sentinels.one);
          dfd1.resolve(dfd2.promise);
          var state = dfd1.promise.inspectState();
          assert(state.isFulfilled);
          assert.strictEqual(state.value, sentinels.one);
        });

    it('synchronously adopts state of a promise of a different subclass',
        function() {
          var dfd1 = defer(SubPromise);
          var dfd2 = defer(Promise);
          dfd2.resolve(sentinels.one);
          dfd1.resolve(dfd2.promise);
          var state = dfd1.promise.inspectState();
          assert(state.isFulfilled);
          assert.strictEqual(state.value, sentinels.one);
        });

  });

  describe('blessed.extended helper', function() {
    it('sets up inheritance', function() {
      var Extended = blessed.extended(function() {});
      assert.instanceOf(new Extended(), Promise);
    });

    it('keeps the constructor reference intact', function() {
      var Extended = blessed.extended(function() {});
      assert.strictEqual(new Extended().constructor, Extended);
    });

    it('copies constructor methods from Promise', function() {
      var Extended = blessed.extended(function() {});
      assert.strictEqual(Extended.from, Promise.from);
      assert.strictEqual(Extended.rejected, Promise.rejected);
    });

    it('takes a base class argument', function() {
      var Base = blessed.extended(function() {});
      var Extended = blessed.extended(function() {}, Base);
      assert.instanceOf(new Extended(), Promise);
      assert.instanceOf(new Extended(), Base);
    });
  });
});
