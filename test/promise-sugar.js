'use strict';

var sinon = require('sinon');

var Promise = require('../').Promise;
var CancellationError = require('../').CancellationError;
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
    blessObject(this, executor, true);
  }
}
extendConstructor(SubPromise, Promise);

var slice = [].slice;

function identity(x) { return x; }

function resultsInCorrectSubclass(method) {
  var args = slice.call(arguments, 1);
  it('results in a correct instance when called on a subclass', function() {
    var p = SubPromise.from(sentinels.foo);
    assert.instanceOf(p[method].apply(p, args), SubPromise);
  });
}

describe('Promise.join(...args)', function() {
  it('returns a promise of the same subclass', function() {
    assert.instanceOf(SubPromise.join(), SubPromise);
  });

  it('resolves when passed zero arguments', function() {
    return assert.eventually.deepEqual(Promise.join(), []);
  });

  it('resolves with joined value arguments', function() {
    var arr = sentinels.stubArray();
    return assert.eventually.matchingSentinels(
      Promise.join.apply(Promise, arr), arr);
  });

  it('resolves with joined promise arguments', function() {
    var arr = sentinels.stubArray();
    return assert.eventually.matchingSentinels(
      Promise.join.apply(Promise, arr.map(Promise.from)), arr);
  });

  it('resolves with joined mixed arguments', function() {
    var arr = sentinels.stubArray();
    var args = arr.slice();
    args[1] = Promise.from(args[1]);
    return assert.eventually.matchingSentinels(
      Promise.join.apply(Promise, args), arr);
  });

  it('rejects if any argument promise rejects', function() {
    var arr = sentinels.stubArray();
    var args = arr.slice();
    args[1] = Promise.rejected(args[1]);
    var result = Promise.join.apply(Promise, args);
    return assert.isRejected(result).then(function() {
      return result.then(null, function(reason) {
        assert.matchingSentinels(reason, arr[1]);
      });
    });
  });
});

describe('Promise.denodeify(func, callbackNotDeclared)', function() {
  it('returns a function', function() {
    assert.isFunction(Promise.denodeify(function() {}));
  });

  describe('the returned function', function() {
    it('results in a Promise', function() {
      assert.instanceOf(Promise.denodeify(function() {})(), Promise);
    });

    it('returns a promise of the same subclass', function() {
      assert.instanceOf(SubPromise.denodeify(function() {})(), SubPromise);
    });

    it('invokes original method', function() {
      var spy = sinon.spy(function(arg1, arg2, cb) {
        /*jshint unused:false*/
      });
      var wrapped = Promise.denodeify(spy);
      wrapped.call(sentinels.foo, sentinels.bar, sentinels.baz);

      assert.calledOnce(spy);
      assert.calledOn(spy, sentinels.foo);
      assert.calledWithMatch(spy,
        sinon.match.same(sentinels.bar),
        sinon.match.same(sentinels.baz),
        sinon.match.func);
    });

    it('rejects if the callback is invoked with truthy error', function() {
      return assert.isRejected(
        Promise.denodeify(function(cb) { cb(sentinels.foo); })(),
        sentinels.Sentinel);
    });

    it('resolves if the callback is invoked with a falsy error', function() {
      return assert.eventually.matchingSentinels(
        Promise.denodeify(function(cb) { cb(null, sentinels.foo); })(),
        sentinels.foo);
    });

    it('resolves with an array if the callback is invoked with a falsy error ' +
      'and multiple values',
      function() {
        var arr = sentinels.stubArray();
        return assert.eventually.matchingSentinels(
          Promise.denodeify(function(cb) {
            cb.apply(null, [null].concat(arr));
          })(),
          arr);
      });
  });

  it('correctly wraps functions that don’t declare their callback argument',
      function() {
        function func(v) { arguments[arguments.length - 1](null, v); }
        return assert.eventually.matchingSentinels(
          Promise.denodeify(func, true)(sentinels.foo),
          sentinels.foo);
      });
});

describe('Promise#yield(value)', function() {
  resultsInCorrectSubclass('yield');

  it('yields a promise fulfilled with `value`', function() {
    return assert.eventually.matchingSentinels(
        Promise.from(sentinels.foo).yield(sentinels.bar),
        sentinels.bar);
  });
});

describe('Promise#yieldReason(reason)', function() {
  resultsInCorrectSubclass('yieldReason');

  it('yields a promise rejected with `reason`', function() {
    return assert.isRejected(
        Promise.from(null).yieldReason(sentinels.bar),
        sentinels.Sentinel);
  });
});

describe('Promise#otherwise(onRejected)', function() {
  resultsInCorrectSubclass('otherwise', identity);

  it('does not call `onRejected` for a fulfilled promise', function() {
    var spy = sinon.spy();
    return Promise.from(sentinels.foo).otherwise(spy).then(function() {
      assert.notCalled(spy);
    });
  });

  it('calls `onRejected` for a rejected promise', function() {
    var spy = sinon.spy();
    return Promise.rejected(sentinels.foo).otherwise(spy).then(function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, sentinels.foo);
    });
  });
});

describe('Promise#ensure(onFulfilledOrRejected)', function() {
  resultsInCorrectSubclass('ensure', identity);

  describe('returns a promise with the same state', function() {
    it('does so for a fulfilled promise', function() {
      return assert.eventually.matchingSentinels(
          Promise.from(sentinels.foo).ensure(identity),
          sentinels.foo);
    });

    it('does so for a rejected promise', function() {
      return assert.isRejected(
          Promise.rejected(sentinels.foo).ensure(identity),
          sentinels.Sentinel);
    });
  });

  it('calls `onFulfilledOrRejected` for a fulfilled promise', function() {
    var spy = sinon.spy();
    return Promise.from(sentinels.foo).ensure(spy).then(function() {
      assert.calledOnce(spy);
      assert.lengthOf(spy.firstCall.args, 0);
    });
  });

  it('is called for a rejected promise', function() {
    var spy = sinon.spy();
    return assert.isRejected(Promise.rejected(sentinels.foo).ensure(spy))
        .then(function() {
          assert.calledOnce(spy);
          assert.lengthOf(spy.firstCall.args, 0);
        });
  });
});

describe('Promise#tap(onFulfilledSideEffect, onRejectedSideEffect)',
    function() {
      resultsInCorrectSubclass('tap', identity);

      describe('returns a promise with the same state', function() {
        it('does so for a fulfilled promise', function() {
          return assert.eventually.matchingSentinels(
              Promise.from(sentinels.foo).tap(identity, identity),
              sentinels.foo);
        });

        it('does so for a rejected promise', function() {
          return assert.isRejected(
              Promise.rejected(sentinels.foo).tap(identity, identity),
              sentinels.Sentinel);
        });
      });

      it('calls `onFulfilledSideEffect` for a fulfilled promise', function() {
        var spy = sinon.spy();
        return Promise.from(sentinels.foo).tap(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledWithExactly(spy, sentinels.foo);
        });
      });

      it('does not call `onFulfilledSideEffect` for a rejected promise',
          function() {
            var spy = sinon.spy();
            var result = Promise.rejected(sentinels.foo).tap(spy);
            return assert.isRejected(result).then(function() {
              assert.notCalled(spy);
            });
          });

      it('does not call `onRejectedSideEffect` for a fulfilled promise',
          function() {
            var spy = sinon.spy();
            return Promise.from(sentinels.foo).tap(null, spy)
                .then(function() {
                  assert.notCalled(spy);
                });
          });

      it('calls `onRejectedSideEffect` for a rejected promise',
          function() {
            var spy = sinon.spy();
            var result = Promise.rejected(sentinels.foo).tap(null, spy);
            return assert.isRejected(result).then(function() {
              assert.calledOnce(spy);
              assert.calledWithExactly(spy, sentinels.foo);
            });
          });
    });

describe('Promise#spread(variadicOnFulfilled)', function() {
  resultsInCorrectSubclass('spread');

  it('applies `variadicOnFulfilled` with array as argument list',
      function() {
        var spy = sinon.spy();
        var arr = sentinels.stubArray();
        return Promise.from(arr).spread(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledOn(spy, undefined);
          assert.calledWithExactly.apply(assert,
              [spy].concat(arr));
        });
      });

  it('applies `variadicOnFulfilled` with resolved array contents as ' +
      'argument list',
      function() {
        var spy = sinon.spy();
        var arr = sentinels.stubArray();
        return Promise.from(arr.map(Promise.from)).spread(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledOn(spy, undefined);
          assert.calledWithExactly.apply(assert, [spy].concat(arr));
        });
      });

  it('rejects if any item in the array rejects', function() {
    var spy = sinon.spy();
    var result = Promise.from([Promise.rejected(sentinels.foo)]).spread(spy);
    return assert.isRejected(result, sentinels.Sentinel).then(function() {
      assert.notCalled(spy);
    });
  });

  it('rejects with TypeError if promise resolves in a ' +
      'non-array-non-object value',
      function() {
        var spy = sinon.spy();
        var result = Promise.from(1).spread(spy);
        return assert.isRejected(result, TypeError).then(function() {
          assert.notCalled(spy);
        });
      });

  it('rejects with TypeError if promise resolves in a ' +
      'non-array-object value',
      function() {
        var spy = sinon.spy();
        var result = Promise.from({ foo: 'bar' }).spread(spy);
        return assert.isRejected(result, TypeError).then(function() {
          assert.notCalled(spy);
        });
      });
});

describe('Promise#nodeify(callback)', function() {
  it('is a noop when called without a callback function', function() {
    var p = Promise.from(sentinels.foo);
    assert.strictEqual(p.nodeify(), p);
  });

  it('returns undefined when called with a callback function', function() {
    assert.isUndefined(Promise.from(sentinels.foo).nodeify(identity));
  });

  it('eventually invokes the callback with the fulfilled value', function() {
    var spy = sinon.spy();
    var p = Promise.from(sentinels.foo);
    p.nodeify(spy);
    return p.then(function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, null, sentinels.foo);
    });
  });

  it('eventually invokes the callback with the rejected value', function() {
    var spy = sinon.spy();
    var p = Promise.rejected(sentinels.foo);
    p.nodeify(spy);
    return p.then(null, function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, sentinels.foo);
    });
  });
});

describe('Promise#cancelAfter(milliseconds)', function() {
  var clock;
  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });
  afterEach(function() {
    clock.restore();
  });

  it('returns the same promise', function() {
    var p = Promise.from(sentinels.foo);
    assert.strictEqual(p.cancelAfter(1), p);
  });

  it('invokes cancel() after at least `milliseconds` have passed',
      function() {
        var p = new Promise(function() {});
        var stub = sinon.stub(p, 'cancel', function() {});
        p.cancelAfter(50);

        clock.tick(50);

        assert.calledOnce(stub);
        assert.lengthOf(stub.firstCall.args, 0);
      });
});

describe('Promise#alsoCancels(other)', function() {
  it('cancels the other promise when cancelled', function() {
    var p1 = new Promise(function() {});
    var p2 = new Promise(function() {});
    p1.alsoCancels(p2);
    p1.cancel();
    return assert.isRejected(p2, CancellationError);
  });

  it('cancels the other promise when rejected with a CancellationError',
      function() {
        var p1 = Promise.rejected(new CancellationError());
        var p2 = new Promise(function() {});
        p1.alsoCancels(p2);
        return assert.isRejected(p2, CancellationError);
      });

  it('accepts an array of potential promises that will be cancelled',
      function() {
        var p1 = new Promise(function() {});
        var p2 = new Promise(function() {});
        var p3 = new Promise(function() {});
        var fakeSpy = sinon.spy();
        p1.alsoCancels([{ cancel: fakeSpy }, p2, p3]);
        p1.cancel();
        return assert.isRejected(p2, CancellationError).then(function() {
          return assert.isRejected(p3, CancellationError);
        }).then(function() {
          return assert.notCalled(fakeSpy);
        });
      });

  it('accepts an object of potential promises that will be cancelled',
      function() {
        var p1 = new Promise(function() {});
        var p2 = new Promise(function() {});
        var p3 = new Promise(function() {});
        var fakeSpy = sinon.spy();
        p1.alsoCancels({
          one: { cancel: fakeSpy },
          two: p2,
          three: p3
        });
        p1.cancel();
        return assert.isRejected(p2, CancellationError).then(function() {
          return assert.isRejected(p3, CancellationError);
        }).then(function() {
          return assert.notCalled(fakeSpy);
        });
      });

  it('returns the original promise', function() {
    var p1 = Promise.from();
    assert.strictEqual(p1.alsoCancels(), p1);
  });
});

describe('Promise#send(methodName, ...args)', function() {
  resultsInCorrectSubclass('send', 'noop');

  it('invokes the method named `methodName` on the eventual promise value, ' +
      'passing the args, and returning the result',
      function() {
        var obj = {
          spy: sinon.spy(function() {
            return sentinels.baz;
          })
        };

        var result = Promise.from(obj).send('spy',
            sentinels.foo, sentinels.bar);

        return assert.eventually.matchingSentinels(result, sentinels.baz)
            .then(function() {
              assert.calledOnce(obj.spy);
              assert.calledOn(obj.spy, obj);
              assert.calledWithExactly(obj.spy, sentinels.foo, sentinels.bar);
            });
      });
});

describe('Promise#prop(name)', function() {
  resultsInCorrectSubclass('prop', 'noop');

  it('returns the property named `name` from the eventual promise value',
      function() {
        return assert.eventually.matchingSentinels(
            Promise.from({ foo: sentinels.foo }).prop('foo'),
            sentinels.foo);
      });
});
