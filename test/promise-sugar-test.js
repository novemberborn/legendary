'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var clock = require('./clock');
var sentinels = require('./sentinels');

var Promise = require('../').Promise;
var CancellationError = require('../').CancellationError;

var blessed = require('../lib/blessed');
function SubPromise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubPromise)) {
    return new SubPromise(resolver);
  }

  if (resolver !== blessed.be) {
    blessed.be(this, resolver, true);
  }
}
blessed.extended(SubPromise, Promise);

var slice = [].slice;

function identity(x) { return x; }

function resultsInCorrectSubclass(method) {
  var args = slice.call(arguments, 1);
  it('results in a correct instance when called on a subclass', function() {
    var p = SubPromise.from(sentinels.one);
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
    return assert.eventually.deepEqual(
        Promise.join.apply(Promise, sentinels.arr()),
        sentinels.arr());
  });

  it('resolves with joined promise arguments', function() {
    var args = sentinels.arr(function(s) { return Promise.from(s); });
    return assert.eventually.deepEqual(
        Promise.join.apply(Promise, args),
        sentinels.arr());
  });

  it('resolves with joined mixed arguments', function() {
    var args = sentinels.arr();
    args[1] = Promise.from(args[1]);
    return assert.eventually.deepEqual(
        Promise.join.apply(Promise, args),
        sentinels.arr());
  });

  it('rejects if any argument promise rejects', function() {
    var args = sentinels.arr();
    args[1] = Promise.rejected(args[1]);
    var result = Promise.join.apply(Promise, args);
    return assert.isRejected(result).then(function() {
      return result.then(null, function(reason) {
        assert.strictEqual(reason, sentinels.two);
      });
    });
  });
});

describe('Promise#yield(value)', function() {
  resultsInCorrectSubclass('yield');

  it('yields a promise fulfilled with `value`', function() {
    return assert.eventually.strictEqual(
        Promise.from(sentinels.one).yield(sentinels.two),
        sentinels.two);
  });
});

describe('Promise#yieldReason(reason)', function() {
  resultsInCorrectSubclass('yieldReason');

  it('yields a promise rejected with `reason`', function() {
    return assert.isRejected(
        Promise.from(null).yieldReason(sentinels.two),
        sentinels.Sentinel);
  });
});

describe('Promise#otherwise(onRejected)', function() {
  resultsInCorrectSubclass('otherwise', identity);

  it('does not call `onRejected` for a fulfilled promise', function() {
    var spy = sinon.spy();
    return Promise.from(sentinels.one).otherwise(spy).then(function() {
      assert.notCalled(spy);
    });
  });

  it('calls `onRejected` for a rejected promise', function() {
    var spy = sinon.spy();
    return Promise.rejected(sentinels.one).otherwise(spy).then(function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, sentinels.one);
    });
  });
});

describe('Promise#ensure(onFulfilledOrRejected)', function() {
  resultsInCorrectSubclass('ensure', identity);

  describe('returns a promise with the same state', function() {
    it('does so for a fulfilled promise', function() {
      return assert.eventually.strictEqual(
          Promise.from(sentinels.one).ensure(identity),
          sentinels.one);
    });

    it('does so for a rejected promise', function() {
      return assert.isRejected(
          Promise.rejected(sentinels.one).ensure(identity),
          sentinels.Sentinel);
    });
  });

  it('calls `onFulfilledOrRejected` for a fulfilled promise', function() {
    var spy = sinon.spy();
    return Promise.from(sentinels.one).ensure(spy).then(function() {
      assert.calledOnce(spy);
      assert.lengthOf(spy.firstCall.args, 0);
    });
  });

  it('is called for a rejected promise', function() {
    var spy = sinon.spy();
    return assert.isRejected(Promise.rejected(sentinels.one).ensure(spy))
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
          return assert.eventually.strictEqual(
              Promise.from(sentinels.one).tap(identity, identity),
              sentinels.one);
        });

        it('does so for a rejected promise', function() {
          return assert.isRejected(
              Promise.rejected(sentinels.one).tap(identity, identity),
              sentinels.Sentinel);
        });
      });

      it('calls `onFulfilledSideEffect` for a fulfilled promise', function() {
        var spy = sinon.spy();
        return Promise.from(sentinels.one).tap(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledWithExactly(spy, sentinels.one);
        });
      });

      it('does not call `onFulfilledSideEffect` for a rejected promise',
          function() {
            var spy = sinon.spy();
            var result = Promise.rejected(sentinels.one).tap(spy);
            return assert.isRejected(result).then(function() {
              assert.notCalled(spy);
            });
          });

      it('does not call `onRejectedSideEffect` for a fulfilled promise',
          function() {
            var spy = sinon.spy();
            return Promise.from(sentinels.one).tap(null, spy)
                .then(function() {
                  assert.notCalled(spy);
                });
          });

      it('calls `onRejectedSideEffect` for a rejected promise',
          function() {
            var spy = sinon.spy();
            var result = Promise.rejected(sentinels.one).tap(null, spy);
            return assert.isRejected(result).then(function() {
              assert.calledOnce(spy);
              assert.calledWithExactly(spy, sentinels.one);
            });
          });
    });

describe('Promise#spread(variadicOnFulfilled)', function() {
  resultsInCorrectSubclass('spread');

  it('applies `variadicOnFulfilled` with array as argument list',
      function() {
        var spy = sinon.spy();
        return Promise.from(sentinels.arr()).spread(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledOn(spy, undefined);
          assert.calledWithExactly.apply(assert,
              [spy].concat(sentinels.arr()));
        });
      });

  it('applies `variadicOnFulfilled` with resolved array contents as ' +
      'argument list',
      function() {
        var spy = sinon.spy();
        var arr = sentinels.arr(function(s) { return Promise.from(s); });
        return Promise.from(arr).spread(spy).then(function() {
          assert.calledOnce(spy);
          assert.calledOn(spy, undefined);
          assert.calledWithExactly.apply(assert, [spy].concat(sentinels.arr()));
        });
      });

  it('rejects if any item in the array rejects', function() {
    var spy = sinon.spy();
    var result = Promise.from([Promise.rejected(sentinels.one)]).spread(spy);
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
    var p = Promise.from(sentinels.one);
    assert.strictEqual(p.nodeify(), p);
  });

  it('returns undefined when called with a callback function', function() {
    assert.isUndefined(Promise.from(sentinels.one).nodeify(identity));
  });

  it('eventually invokes the callback with the fulfilled value', function() {
    var spy = sinon.spy();
    var p = Promise.from(sentinels.one);
    p.nodeify(spy);
    return p.then(function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, null, sentinels.one);
    });
  });

  it('eventually invokes the callback with the rejected value', function() {
    var spy = sinon.spy();
    var p = Promise.rejected(sentinels.one);
    p.nodeify(spy);
    return p.then(null, function() {
      assert.calledOnce(spy);
      assert.calledWithExactly(spy, sentinels.one);
    });
  });
});

describe('Promise#cancelAfter(milliseconds)', function() {
  clock.use();

  it('returns the same promise', function() {
    var p = Promise.from(sentinels.one);
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
            return sentinels.three;
          })
        };

        var result = Promise.from(obj).send('spy',
            sentinels.one, sentinels.two);

        return assert.eventually.strictEqual(result, sentinels.three)
            .then(function() {
              assert.calledOnce(obj.spy);
              assert.calledOn(obj.spy, obj);
              assert.calledWithExactly(obj.spy, sentinels.one, sentinels.two);
            });
      });
});

describe('Promise#prop(name)', function() {
  resultsInCorrectSubclass('prop', 'noop');

  it('returns the property named `name` from the eventual promise value',
      function() {
        return assert.eventually.strictEqual(
            Promise.from({ foo: sentinels.one }).prop('foo'),
            sentinels.one);
      });
});
