'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');

var Promise = require('../').Promise;

var sentinel = {};

describe('Promise.from()', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.from(sentinel), Promise);
  });

  it('return a promise fulfilled with the non-thenable-non-promise-value ' +
      'passed originally',
      function() {
        return assert.eventually.strictEqual(Promise.from(sentinel), sentinel);
      });

  it('returns a new promise adopting the state of the promise passed',
      function() {
        var promise = Promise.from(new Promise(function(resolve) {
          Promise.from(sentinel).then(resolve);
        }));
        return assert.eventually.strictEqual(promise, sentinel);
      });
});

describe('Promise.rejected()', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.rejected(sentinel), Promise);
  });

  it('returns a rejected promise', function() {
    var Sentinel = function() {};
    return assert.isRejected(Promise.rejected(new Sentinel()), Sentinel);
  });
});

describe('Promise#to()', function() {
  it('Creates a new promise by calling \'from\' on the passed constructor',
      function() {
        var constructor = function() {};
        constructor.from = function() {
          return sentinel;
        };
        var spy = sinon.spy(constructor, 'from');

        var promise = Promise.from();
        var result = promise.to(constructor);

        assert.strictEqual(result, sentinel);
        assert.calledOnce(spy);
        assert.calledWithExactly(spy, promise);
      });
});
