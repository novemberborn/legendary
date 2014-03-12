'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

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
      return callMethod(spy, [], sentinels.one).then(function() {
        assert.calledOn(spy, sentinels.one);
      });
    });

    it('accepts values for arguments', function() {
      var spy = sinon.spy();
      return callMethod(spy, [sentinels.one, sentinels.two]).then(function() {
        assert.calledWithExactly(spy, sentinels.one, sentinels.two);
      });
    });

    it('accepts promises for arguments', function() {
      var spy = sinon.spy();
      return callMethod(
        spy,
        [
          Promise.from(sentinels.one),
          Promise.from(sentinels.two)
        ]
      ).then(function() {
          assert.calledWithExactly(spy, sentinels.one, sentinels.two);
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
        throw sentinels.one;
      }), sentinels.Sentinel);
    });

    it('rejects when the function returns a rejected promise', function() {
      return assert.isRejected(callMethod(function() {
        return Promise.rejected(sentinels.one);
      }), sentinels.Sentinel);
    });

    it('resolves with the function’s return value', function() {
      return assert.eventually.strictEqual(callMethod(function() {
        return sentinels.one;
      }), sentinels.one);
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
      return fn.lift(spy).call(sentinels.one).then(function() {
        assert.calledOn(spy, sentinels.one);
      });
    });

    it('accepts values for arguments', function() {
      var spy = sinon.spy();
      return fn.lift(spy)(sentinels.one, sentinels.two).then(function() {
        assert.calledWithExactly(spy, sentinels.one, sentinels.two);
      });
    });

    it('accepts promises for arguments', function() {
      var spy = sinon.spy();
      return fn.lift(spy)(
        Promise.from(sentinels.one),
        Promise.from(sentinels.two)
      ).then(function() {
        assert.calledWithExactly(spy, sentinels.one, sentinels.two);
      });
    });

    it('rejects when the function throws', function() {
      return assert.isRejected(fn.lift(function() {
        throw sentinels.one;
      })(), sentinels.Sentinel);
    });

    it('rejects when the function returns a rejected promise', function() {
      return assert.isRejected(fn.lift(function() {
        return Promise.rejected(sentinels.one);
      })(), sentinels.Sentinel);
    });

    it('resolves with the function’s return value', function() {
      return assert.eventually.strictEqual(fn.lift(function() {
        return sentinels.one;
      })(), sentinels.one);
    });
  });

  it('accepts leading arguments', function() {
    var spy = sinon.spy();
    return fn.lift(spy, sentinels.one)(sentinels.two).then(function() {
      assert.calledWithExactly(spy, sentinels.one, sentinels.two);
    });
  });

  it('accepts promises as leading arguments', function() {
    var spy = sinon.spy();
    return fn.lift(spy, Promise.from(sentinels.one))(sentinels.two)
        .then(function() {
          assert.calledWithExactly(spy, sentinels.one, sentinels.two);
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
      var sentinelPromise = Promise.from(sentinels.three);
      composed.call(sentinels.one, sentinels.two, sentinelPromise);

      assert.calledOnce(pipelineSpy);

      var args = pipelineSpy.firstCall.args;
      assert.lengthOf(args, 3);
      assert.isArray(args[0]);
      assert.lengthOf(args[0], 2);
      assert.isFunction(args[0][0]);
      assert.isFunction(args[0][1]);

      assert.strictEqual(args[1], sentinels.two);
      assert.strictEqual(args[2], sentinelPromise);
    });

    it('calls composed functions with correct arguments ' +
        'and thisArg',
        function() {
          var compositionSpy = sinon.spy(identity);
          var composed = fn.compose(compositionSpy, compositionSpy);
          var sentinelPromise = Promise.from(sentinels.three);
          var result = composed.call(
              sentinels.one, sentinels.two, sentinelPromise);

          return assert.eventually.strictEqual(result, sentinels.two)
              .then(function() {
                assert.calledTwice(compositionSpy);
                assert.alwaysCalledOn(compositionSpy, sentinels.one);
                assert.deepEqual(compositionSpy.firstCall.args,
                    [sentinels.two, sentinels.three]);
                assert.deepEqual(compositionSpy.secondCall.args,
                    [sentinels.two]);
              });
        });

    it('assimilates thenables', function() {
      var composed = fn.compose(
        function() {
          return {
            then: function(resolve) { resolve(sentinels.one); }
          };
        },
        function(prevResult) {
          assert.strictEqual(prevResult, sentinels.one);
          return {
            then: function(resolve) { resolve(sentinels.two); }
          };
        }
      );

      return assert.eventually.strictEqual(composed(), sentinels.two);
    });
  });
});
