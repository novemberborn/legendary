'use strict';

var sinon = require('sinon');

var Thenable = require('./support/Thenable');

var Promise = require('../').Promise;
var fn = require('../').fn;
var concurrent = require('../').concurrent;

function identity(x) { return x; }

[
  'fn.call(normalFunction)',
  'fn.apply(normalFunction, args)'
].forEach(function(title) {
  var callMethod;
  if (/call/.test(title)) {
    callMethod = function(func, args, thisArg) {
      return fn.call.apply(thisArg || fn, [func].concat(args || []));
    };
  } else {
    callMethod = function(func, args, thisArg) {
      return fn.apply.call(thisArg || fn, func, args || []);
    };
  }

  describe(title, function() {
    it('returns a Promise instance', function() {
      assert.instanceOf(callMethod(identity), Promise);
    });

    it('preserves thisArg', function() {
      var spy = sinon.spy();
      return callMethod(spy, [], sentinels.foo).then(function() {
        assert.calledOn(spy, sentinels.foo);
      });
    });

    it('accepts values for arguments', function() {
      var spy = sinon.spy();
      return callMethod(spy, [sentinels.foo, sentinels.bar]).then(function() {
        assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
      });
    });

    it('accepts promises for arguments', function() {
      var spy = sinon.spy();
      return callMethod(
        spy,
        [
          Promise.from(sentinels.foo),
          Promise.from(sentinels.bar)
        ]
      ).then(function() {
          assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
        });
    });

    it('doesn’t need arguments', function() {
      var spy = sinon.spy();
      return callMethod(spy).then(function() {
        assert.calledWithExactly(spy);
      });
    });

    it('rejects when the function throws', function() {
      return assert.isRejected(callMethod(function() {
        throw sentinels.foo;
      }), sentinels.Sentinel);
    });

    it('rejects when the function returns a rejected promise', function() {
      return assert.isRejected(callMethod(function() {
        return Promise.rejected(sentinels.foo);
      }), sentinels.Sentinel);
    });

    it('resolves with the function’s return value', function() {
      return assert.eventually.matchingSentinels(callMethod(function() {
        return sentinels.foo;
      }), sentinels.foo);
    });
  });
});

describe('fn.lift(normalFunction)', function() {
  it('returns a function', function() {
    assert.isFunction(fn.lift(identity));
  });

  describe('the returned function', function() {
    it('returns a Promise instance', function() {
      assert.instanceOf(fn.lift(identity)(), Promise);
    });

    it('preserves thisArg', function() {
      var spy = sinon.spy();
      return fn.lift(spy).call(sentinels.foo).then(function() {
        assert.calledOn(spy, sentinels.foo);
      });
    });

    it('accepts values for arguments', function() {
      var spy = sinon.spy();
      return fn.lift(spy)(sentinels.foo, sentinels.bar).then(function() {
        assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
      });
    });

    it('accepts promises for arguments', function() {
      var spy = sinon.spy();
      return fn.lift(spy)(
        Promise.from(sentinels.foo),
        Promise.from(sentinels.bar)
      ).then(function() {
        assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
      });
    });

    it('rejects when the function throws', function() {
      return assert.isRejected(fn.lift(function() {
        throw sentinels.foo;
      })(), sentinels.Sentinel);
    });

    it('rejects when the function returns a rejected promise', function() {
      return assert.isRejected(fn.lift(function() {
        return Promise.rejected(sentinels.foo);
      })(), sentinels.Sentinel);
    });

    it('resolves with the function’s return value', function() {
      return assert.eventually.matchingSentinels(fn.lift(function() {
        return sentinels.foo;
      })(), sentinels.foo);
    });
  });

  it('accepts leading arguments', function() {
    var spy = sinon.spy();
    return fn.lift(spy, sentinels.foo)(sentinels.bar).then(function() {
      assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
    });
  });

  it('accepts promises as leading arguments', function() {
    var spy = sinon.spy();
    return fn.lift(spy, Promise.from(sentinels.foo))(sentinels.bar)
        .then(function() {
          assert.calledWithExactly(spy, sentinels.foo, sentinels.bar);
        });
  });
});

describe('fn.compose()', function() {
  it('returns a function', function() {
    assert.isFunction(fn.compose(identity));
  });

  describe('the returned function', function() {
    it('returns a Promise instance', function() {
      assert.instanceOf(fn.compose(identity)(), Promise);
    });

    it('relies on concurrent.pipeline', function() {
      var pipelineSpy = sinon.spy(concurrent, 'pipeline');
      var composed = fn.compose(identity, identity);
      var sentinelPromise = Promise.from(sentinels.baz);
      composed.call(sentinels.foo, sentinels.bar, sentinelPromise);

      assert.calledOnce(pipelineSpy);

      var args = pipelineSpy.firstCall.args;
      assert.lengthOf(args, 3);
      assert.isArray(args[0]);
      assert.lengthOf(args[0], 2);
      assert.isFunction(args[0][0]);
      assert.isFunction(args[0][1]);

      assert.matchingSentinels(args[1], sentinels.bar);
      assert.strictEqual(args[2], sentinelPromise);
    });

    it('calls composed functions with correct arguments ' +
        'and thisArg',
        function() {
          var compositionSpy = sinon.spy(identity);
          var composed = fn.compose(compositionSpy, compositionSpy);
          var sentinelPromise = Promise.from(sentinels.baz);
          var result = composed.call(
              sentinels.foo, sentinels.bar, sentinelPromise);

          return assert.eventually.matchingSentinels(result, sentinels.bar)
              .then(function() {
                assert.calledTwice(compositionSpy);
                assert.alwaysCalledOn(compositionSpy, sentinels.foo);
                assert.matchingSentinels(compositionSpy.firstCall.args,
                    [sentinels.bar, sentinels.baz]);
                assert.matchingSentinels(compositionSpy.secondCall.args,
                    [sentinels.bar]);
              });
        });

    it('assimilates thenables', function() {
      var composed = fn.compose(
        function() {
          return new Thenable(function(resolve) { resolve(sentinels.foo); });
        },
        function(prevResult) {
          assert.strictEqual(prevResult, sentinels.foo);
          return new Thenable(function(resolve) { resolve(sentinels.bar); });
        }
      );

      return assert.eventually.matchingSentinels(composed(), sentinels.bar);
    });
  });
});
