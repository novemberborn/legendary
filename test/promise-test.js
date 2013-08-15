'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

var Promise = require('../').Promise;

describe('Promise.from(value)', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.from(sentinels.one), Promise);
  });

  it('return a promise fulfilled with `value`, if not a promise or thenable',
      function() {
        return assert.eventually.strictEqual(
            Promise.from(sentinels.one), sentinels.one);
      });

  it('returns a new promise adopting the state of the promise `value`',
      function() {
        var promise = Promise.from(new Promise(function(resolve) {
          Promise.from(sentinels.one).then(resolve);
        }));
        return assert.eventually.strictEqual(promise, sentinels.one);
      });

  it('returns a new promise adopting the state of the thenable `value`',
      function() {
        var promise = Promise.from({
          then: function(resolve) {
            resolve(sentinels.one);
          }
        });
        return assert.eventually.strictEqual(promise, sentinels.one);
      });
});

describe('Promise.rejected(reason)', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.rejected(sentinels.one), Promise);
  });

  it('returns a promise rejected with `reason`', function() {
    var result = Promise.rejected(sentinels.one);
    return assert.isRejected(result).then(function() {
      return result.then(null, function(reason) {
        assert.strictEqual(reason, sentinels.one);
      });
    });
  });
});

describe('Promise#to(constructor)', function() {
  it('Creates a new promise by calling \'from\' on `constructor`',
      function() {
        var constructor = function() {};
        constructor.from = function() {
          return sentinels.one;
        };
        var spy = sinon.spy(constructor, 'from');

        var promise = Promise.from();
        var result = promise.to(constructor);

        assert.strictEqual(result, sentinels.one);
        assert.calledOnce(spy);
        assert.calledWithExactly(spy, promise);
      });
});
