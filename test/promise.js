'use strict';

var sinon = require('sinon');

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;

describe('Promise.isInstance(value)', function() {
  it('returns true for Promise instances', function() {
    assert.isTrue(Promise.isInstance(Promise.from()));
  });

  it('returns false for non-Promise instances', function() {
    assert.isFalse(Promise.isInstance(Thenable.defer().it));
  });
});

describe('Promise.from(value)', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.from(sentinels.foo), Promise);
  });

  it('return a promise fulfilled with `value`, if not a promise or thenable',
      function() {
        return assert.eventually.matchingSentinels(
            Promise.from(sentinels.foo), sentinels.foo);
      });

  it('returns a new promise adopting the state of the promise `value`',
      function() {
        var promise = Promise.from(new Promise(function(resolve) {
          Promise.from(sentinels.foo).then(resolve);
        }));
        return assert.eventually.matchingSentinels(promise, sentinels.foo);
      });

  it('returns a new promise adopting the state of the thenable `value`',
      function() {
        var promise = Promise.from(new Thenable(function(resolve) {
          resolve(sentinels.foo);
        }));
        return assert.eventually.matchingSentinels(promise, sentinels.foo);
      });
});

describe('Promise.rejected(reason)', function() {
  it('returns a promise that is an instance of Promise', function() {
    assert.instanceOf(Promise.rejected(sentinels.foo), Promise);
  });

  it('returns a promise rejected with `reason`', function() {
    var result = Promise.rejected(sentinels.foo);
    return assert.isRejected(result).then(function() {
      return result.then(null, function(reason) {
        assert.matchingSentinels(reason, sentinels.foo);
      });
    });
  });
});

describe('Promise#to(constructor)', function() {
  it('Creates a new promise by calling \'from\' on `constructor`',
      function() {
        var constructor = function() {};
        constructor.from = function() {
          return sentinels.foo;
        };
        var spy = sinon.spy(constructor, 'from');

        var promise = Promise.from();
        var result = promise.to(constructor);

        assert.matchingSentinels(result, sentinels.foo);
        assert.calledOnce(spy);
        assert.calledWithExactly(spy, promise);
      });
});
