'use strict';

var sinon = require('sinon');

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;

describe('Thenable support:', function() {
  describe('Thenable(executor)', function() {
    it('throws TypeError when called without an `executor` function',
      function() {
        assert.throws(function() {
          return new Thenable(null);
        }, TypeError);
      });

    it('can be called without new', function() {
      /*jshint newcap:false*/
      assert.instanceOf(Thenable(function() {}), Thenable);
    });

    it('does not return Promise instances', function() {
      assert.isFalse(Promise.isInstance(new Thenable(function() {})));
    });
  });

  describe('Thenable#then(onFulfilled, onRejected)', function() {
    it('is a function', function() {
      assert.isFunction(new Thenable(function() {}).then);
    });

    it('invokes `onFulfilled` if the executor resolves', function() {
      var onFulfilled = sinon.spy();
      var onRejected = sinon.spy();
      var thenable = new Thenable(function(resolve) {
        resolve(sentinels.foo);
      });

      thenable.then(onFulfilled, onRejected);

      return Promise.from().then(function() {
        assert.calledWithExactly(onFulfilled, sentinels.foo);
        assert.notCalled(onRejected);
      });
    });

    it('invokes `onRejected` if the executor resolves', function() {
      var onFulfilled = sinon.spy();
      var onRejected = sinon.spy();
      var thenable = new Thenable(function(_, reject) {
        reject(sentinels.foo);
      });

      thenable.then(onFulfilled, onRejected);

      return Promise.from().then(function() {
        assert.calledWithExactly(onRejected, sentinels.foo);
        assert.notCalled(onFulfilled);
      });
    });
  });

  describe('Thenable#cancel()', function() {
    it('is undefined', function() {
      assert.isUndefined(new Thenable(function() {}).cancel);
    });
  });

  describe('Thenable.defer()', function() {
    it('returns an object with a thenable, resolve() and reject()', function() {
      var thenable = Thenable.defer();
      assert.instanceOf(thenable.it, Thenable);
      assert.isFunction(thenable.resolve);
      assert.isFunction(thenable.reject);
    });

    it('resolve() fulfills the thenable', function() {
      var thenable = Thenable.defer();
      thenable.resolve(sentinels.foo);
      return assert.eventually.matchingSentinels(thenable.it, sentinels.foo);
    });

    it('reject() rejects the thenable', function() {
      var thenable = Thenable.defer();
      thenable.reject(sentinels.foo);
      return assert.isRejected(thenable.it, sentinels.Sentinel);
    });
  });
});
