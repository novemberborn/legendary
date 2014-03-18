'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');
var util = require('./util');

var Promise = require('../').Promise;
var Series = require('../').Series;
var CancellationError = require('../').CancellationError;
var delay = require('../').timed.delay;

var main = require('../');
function SubSeries(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubSeries)) {
    return new SubSeries(executor);
  }

  if (executor !== main.blessObject) {
    main.blessObject(this, executor, true);
  }
}
main.extendConstructor(SubSeries, Series);

function identity(x) { return x; }
function thrower(x) { throw x; }
function truthy(x) { return Promise.isInstance(x) ? x.then(truthy) : !!x; }

function determineMaxConcurrent(method) {
  if (/Parallel$/.test(method)) {
    return 2;
  } else {
    return 1;
  }
}

function makeCallMethod(method, maxConcurrent) {
  return function(series, iterator) {
    if (/Parallel$/.test(method)) {
      return series[method](maxConcurrent, iterator);
    } else {
      return series[method](iterator);
    }
  };
}

function resultsInSeries(callMethod) {
  it('results in a Series instance', function() {
    assert.instanceOf(callMethod(Series.from([]), identity), Series);
  });

  it('results in a correct instance when called on a subclass', function() {
    assert.instanceOf(callMethod(SubSeries.from([]), identity),
        SubSeries);
  });
}

function resultsInPromise(callMethod) {
  describe('results in a Promise instance, not Series', function() {
    it('does so on success', function() {
      var result = callMethod(Series.from([]), identity);
      assert.instanceOf(result, Promise);
      assert.notInstanceOf(result, Series);
    });

    it('does so on failure', function() {
      var result = callMethod(Series.from([42]), thrower);
      assert.instanceOf(result, Promise);
      assert.notInstanceOf(result, Series);
    });
  });
}

function usesMapParallel(callMethod, maxConcurrent) {
  it('uses #mapParallel(' + maxConcurrent + ', iterator) under the hood',
      function() {
        var series = Series.from([42]);
        var spy = sinon.spy(series, 'mapParallel');
        callMethod(series, identity);
        assert.calledOnce(spy);
        assert.calledWithExactly(spy, maxConcurrent, sinon.match.func);
      });
}

describe('Series', function() {
  util.testConstructor(Series);
});

describe('Series#mapParallel()', function() {
  describe('promises an empty array unless it receives a ' +
      'non-empty array value',
      function() {
        it('does so for an empty array', function() {
          var result = Series.from([]).mapParallel(1, identity);
          return assert.eventually.deepEqual(result, []);
        });

        it('does so for a non-array', function() {
          var result = Series.from(42).mapParallel(1, identity);
          return assert.eventually.deepEqual(result, []);
        });
      });

  resultsInSeries(function(series, iterator) {
    return series.mapParallel(2, iterator);
  });

  it('returns a rejected promise if `maxConcurrent` isn’t a number',
      function() {
        return assert.isRejected(Series.from([1]).mapParallel(), TypeError);
      });

  it('returns a rejected promise if `iterator` isn’t a function',
      function() {
        return assert.isRejected(Series.from([1]).mapParallel(1), TypeError);
      });

  it('promises rejection if the iterator throws', function() {
    var result = Series.from([sentinels.one]).mapParallel(1, thrower);
    return assert.isRejected(result, sentinels.Sentinel);
  });

  it('promises rejection with the reason of the first rejected promise ' +
      'returned by the iterator',
      function() {
        var arr = [null, Promise.rejected(sentinels.one), Promise.rejected()];
        var result = Series.from(arr).mapParallel(1, identity);
        return assert.isRejected(result, sentinels.Sentinel);
      });

  it('calls iterator with item, in order', function() {
    var spy = sinon.spy();
    return Series.from(sentinels.arr()).mapParallel(1, spy)
      .then(function() {
        assert.calledThrice(spy);
        assert.deepEqual(spy.firstCall.args, [sentinels.one]);
        assert.deepEqual(spy.secondCall.args, [sentinels.two]);
        assert.deepEqual(spy.thirdCall.args, [sentinels.three]);
      });
  });

  it('returns the result of the map operation', function() {
    var arr = [2, 4, 8];
    var result = Series.from(arr).mapParallel(1, function(value) {
      if (value < 8) {
        return value * value;
      }
      return Promise.from(value * value);
    });
    return assert.eventually.deepEqual(result, [4, 16, 64]);
  });

  it('respects the max concurrency', function() {
    function testIteration(iterationIndex, allSpies) {
      // Only previous iterators should have been called.
      allSpies.forEach(function(spy, spyIndex) {
        if (spyIndex < iterationIndex) {
          assert.called(spy);
        } else if (spyIndex > iterationIndex) {
          assert.notCalled(spy);
        }
      });

      return delay().then(function() {
        // Given concurrency of 2, previous and the *next*
        // iterator should have been called.
        allSpies.forEach(function(spy, spyIndex) {
          if (spyIndex < iterationIndex || spyIndex === iterationIndex + 1) {
            assert.called(spy);
          } else if (spyIndex > iterationIndex) {
            assert.notCalled(spy);
          }
        });
      });
    }

    var spies = [];
    for (var i = 0; i < 10; i++) {
      spies.push(sinon.spy(testIteration));
    }

    var index = 0;
    return Series.from(spies).mapParallel(2, function(spy) {
      return spy(index++, spies);
    });
  });

  it('stops iteration when cancelled', function() {
    var arr = sentinels.arr();
    var spy = sinon.spy(function(item) {
      if (item === sentinels.two) {
        result.cancel();
      }
    });
    var result = Series.from(arr).mapParallel(1, spy);
    return assert.isRejected(result, CancellationError).then(function() {
      assert.calledTwice(spy);
    });
  });

  it('propagates cancellation to iterator-returned promises', function() {
    var p1 = new Promise(function() {});
    var p2 = new Promise(function() {});
    var arr = sentinels.arr();
    var result = Series.from(arr).mapParallel(3, function(x) {
      if (x === sentinels.one) {
        return x;
      }
      if (x === sentinels.two) {
        return p1;
      }
      if (x === sentinels.three) {
        setImmediate(result.cancel);
        return p2;
      }
    });
    return assert.isRejected(result, CancellationError).then(function() {
      return assert.isRejected(p1, CancellationError);
    }).then(function() {
      return assert.isRejected(p2, CancellationError);
    });
  });
});

function testIterators(methods, describeMore, doesResultInSeries) {
  methods.forEach(function(method) {
    var maxConcurrent = determineMaxConcurrent(method);
    var callMethod = makeCallMethod(method, maxConcurrent);

    describe('Series#' + method + '()', function() {
      usesMapParallel(callMethod, maxConcurrent);

      if (doesResultInSeries !== false) {
        resultsInSeries(callMethod);
      } else {
        resultsInPromise(callMethod);
      }

      if (describeMore) {
        describeMore(callMethod, method, maxConcurrent);
      }
    });
  });
}

testIterators(['each', 'eachParallel'], function(callMethod) {
  describe('promises undefined regardless of value', function() {
    it('does so for an empty array', function() {
      var result = callMethod(Series.from([]), identity);
      return assert.eventually.isUndefined(result);
    });

    it('does so for a non-empty array', function() {
      var result = callMethod(Series.from([42]), identity);
      return assert.eventually.isUndefined(result);
    });

    it('does so for a non-array', function() {
      var result = callMethod(Series.from(42), identity);
      return assert.eventually.isUndefined(result);
    });
  });
}, false);

testIterators(['map']);

testIterators(
    ['filter', 'filterParallel'],
    function(callMethod) {
      it('returns the filtered items', function() {
        var arr = [
          '', 'foo', 0, 1, {}, [], null, undefined, true, false,
          Promise.from('bar'), Promise.from(false)
        ];
        var result = callMethod(Series.from(arr), truthy);
        return assert.eventually.deepEqual(
            result, ['foo', 1, {}, [], true, 'bar']);
      });
    });

testIterators(
    ['filterOut', 'filterOutParallel'],
    function(callMethod) {
      it('returns the non-filtered-out items', function() {
        var arr = [
          '', 'foo', 0, 1, {}, [], null, undefined, true, false,
          Promise.from('bar'), Promise.from(false)
        ];
        var result = callMethod(Series.from(arr), truthy);
        return assert.eventually.deepEqual(
            result, ['', 0, null, undefined, false, false]);
      });
    });

testIterators(
    ['concat', 'concatParallel'],
    function(callMethod) {
      it('returns the concatenated items', function() {
        var arr = ['foo', ['bar'], ['baz', 'thud']];
        var result = callMethod(Series.from(arr), identity);
        return assert.eventually.deepEqual(
            result, ['foo', 'bar', 'baz', 'thud']);
      });
    });

['foldl', 'foldr'].forEach(function(method) {
  var fromLeft = method === 'foldl';

  describe('Series#' + method + '()', function() {
    resultsInPromise(function(series, iterator) {
      return Series.from([])[method](null, iterator);
    });

    describe('promises the initial value unless it receives a ' +
        'non-empty array value, without calling the iterator',
        function() {
          it('does so for an empty array', function() {
            var spy = sinon.spy();
            var result = Series.from([])[method](sentinels.one, spy);
            return assert.eventually.strictEqual(result, sentinels.one).then(
                function() {
                  return assert.notCalled(spy);
                });
          });

          it('does so for a non-array', function() {
            var spy = sinon.spy();
            var result = Series.from(42)[method](sentinels.one, spy);
            return assert.eventually.strictEqual(result, sentinels.one).then(
                function() {
                  return assert.notCalled(spy);
                });
          });
        });

    describe('accepts a promise for the initial value', function() {
      it('waits until it’s resolved', function() {
        var spy = sinon.spy(identity);
        var initialValue = Promise.from(sentinels.one);
        var result = Series.from([true])[method](initialValue, spy);
        return result.then(function() {
          assert.calledOnce(spy);
          assert.calledWithExactly(spy, sentinels.one, true);
        });
      });

      it('rejects if the initial value rejects', function() {
        var spy = sinon.spy(identity);
        var initialValue = Promise.rejected(sentinels.one);
        var result = Series.from([true])[method](initialValue, spy);
        return assert.isRejected(result, sentinels.Sentinel);
      });

      it('propagates cancellation to the promise', function() {
        var initialValue = new Promise(function() {});
        var result = Series.from([true])[method](initialValue, identity);
        setImmediate(result.cancel);
        return assert.isRejected(initialValue, CancellationError);
      });
    });

    it('calls iterator with initial value and item, in order',
        function() {
          var spy = sinon.spy(identity);
          var arr = sentinels.arr();
          var result = Series.from(arr)[method](sentinels.one, spy);
          return result.then(function() {
            assert.calledThrice(spy);
            if (fromLeft) {
              assert.deepEqual(spy.firstCall.args,
                  [sentinels.one, sentinels.one]);
              assert.deepEqual(spy.secondCall.args,
                  [sentinels.one, sentinels.two]);
              assert.deepEqual(spy.thirdCall.args,
                  [sentinels.one, sentinels.three]);
            } else {
              assert.deepEqual(spy.firstCall.args,
                  [sentinels.one, sentinels.three]);
              assert.deepEqual(spy.secondCall.args,
                  [sentinels.one, sentinels.two]);
              assert.deepEqual(spy.thirdCall.args,
                  [sentinels.one, sentinels.one]);
            }
          });
        });

    it('returns the result of the operation', function() {
      var arr = [0, 2, 2, 3];
      var result = Series.from(arr)[method]([1], function(initialValue, item) {
        return initialValue.concat(
          initialValue[initialValue.length - 1] + item);
      });
      var expected;
      if (fromLeft) {
        expected = [1, 1, 3, 5, 8];
      } else {
        expected = [1, 4, 6, 8, 8];
      }
      return assert.eventually.deepEqual(result, expected);
    });

    describe('rejects if iterator throws', function() {
      function doAsTold(_, told) {
        if (told instanceof Promise) {
          return told;
        }
        if (told === Error) {
          throw sentinels.one;
        }
      }

      it('does so at the first iteration', function() {
        var result = Series.from([Error])[method](null,
            doAsTold);
        return assert.isRejected(result, sentinels.Sentinel);
      });

      it('does so at the second iteration', function() {
        var result = Series.from([false, Error])[method](null,
            doAsTold);
        return assert.isRejected(result, sentinels.Sentinel);
      });

      it('does so if the first iteration returned a promise', function() {
        var result = Series.from([Promise.from(1), Error])[method](null,
            doAsTold);
        return assert.isRejected(result, sentinels.Sentinel);
      });
    });

    it('stops iteration when cancelled', function() {
      var arr = sentinels.arr();
      var spy = sinon.spy(function(_, item) {
        if (item !== sentinels.two) {
          result.cancel();
        }
      });
      var result = Series.from(arr)[method](null, spy);
      return assert.isRejected(result, CancellationError).then(function() {
        assert.calledOnce(spy);
      });
    });

    it('propagates cancellation to iterator-returned promises', function() {
      var p = new Promise(function() {});
      var result = Series.from([p])[method](null, function() {
        setImmediate(result.cancel);
        return p;
      });
      return assert.isRejected(result, CancellationError).then(function() {
        return assert.isRejected(p, CancellationError);
      });
    });
  });
});

function testCheckers(methods, describeMore) {
  methods.forEach(function(method) {
    var maxConcurrent = determineMaxConcurrent(method);
    var callMethod = makeCallMethod(method, maxConcurrent);

    describe('Series#' + method + '()', function() {
      resultsInPromise(callMethod);

      if (/Parallel$/.test(method)) {
        it('uses #mapParallel(maxConcurrent, func) under the hood', function() {
          var series = Series.from([42]);
          var spy = sinon.spy(series, 'mapParallel');
          callMethod(series, identity);
          assert.calledOnce(spy);
          assert.lengthOf(spy.firstCall.args, 2);
          assert.equal(spy.firstCall.args[0], maxConcurrent);
          assert.isFunction(spy.firstCall.args[1]);
        });
      } else {
        var parallelMethod = method + 'Parallel';
        it('uses #' + parallelMethod + '(' + maxConcurrent + ', iterator) ' +
            'under the hood',
            function() {
              var series = Series.from([42]);
              var spy = sinon.spy(series, parallelMethod);
              callMethod(series, identity);
              assert.calledOnce(spy);
              assert.calledWithExactly(spy, maxConcurrent, identity);
            });
      }

      if (describeMore) {
        describeMore(callMethod, method, maxConcurrent);
      }
    });
  });
}

testCheckers(['detect', 'detectParallel'],
    function(callMethod, method) {
      it('returns the detected item', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function(item) { return item === sentinels.two; });
        return assert.eventually.strictEqual(result, sentinels.two);
      });

      it('returns undefined if it can’t detect the item', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function() { return false; });
        return assert.eventually.isUndefined(result);
      });

      it('handles the iterator returning a promise', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function(item) { return Promise.from(item === sentinels.two); });
        return assert.eventually.strictEqual(result, sentinels.two);
      });

      if (method === 'detect') {
        it('indeed stops iteration once an item is detected', function() {
          var spy = sinon.spy(function(item) {
            return item === sentinels.two;
          });
          var result = callMethod(Series.from(sentinels.arr()), spy);
          return assert.eventually.strictEqual(result, sentinels.two)
              .then(function() {
                assert.calledTwice(spy);
                assert.deepEqual(spy.firstCall.args, [sentinels.one]);
                assert.deepEqual(spy.secondCall.args, [sentinels.two]);
              });
        });
      }
    });

testCheckers(['some', 'someParallel'],
    function(callMethod, method) {
      it('returns `true` if an iterator returns a truthy value', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function(item) { return item === sentinels.two; });
        return assert.eventually.isTrue(result);
      });

      it('returns `false` if no iterator returns a truthy value', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function() { return false; });
        return assert.eventually.isFalse(result);
      });

      it('handles the iterator returning a promise', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function(item) { return Promise.from(item === sentinels.two); });
        return assert.eventually.isTrue(result);
      });

      if (method === 'some') {
        it('indeed stops iteration once an iterator returns a truthy value',
            function() {
              var spy = sinon.spy(function(item) {
                return item === sentinels.two;
              });
              var result = callMethod(Series.from(sentinels.arr()), spy);
              return assert.eventually.isTrue(result)
                  .then(function() {
                    assert.calledTwice(spy);
                    assert.deepEqual(spy.firstCall.args, [sentinels.one]);
                    assert.deepEqual(spy.secondCall.args, [sentinels.two]);
                  });
            });
      }
    });

testCheckers(['every', 'everyParallel'],
    function(callMethod, method) {
      it('returns `true` if all iterators return a truthy value', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function() { return true; });
        return assert.eventually.isTrue(result);
      });

      it('returns `false` if an iterator returns a falsy value', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function(item) { return item !== sentinels.two; });
        return assert.eventually.isFalse(result);
      });

      it('handles the iterator returning a promise', function() {
        var result = callMethod(Series.from(sentinels.arr()),
            function() { return Promise.from(true); });
        return assert.eventually.isTrue(result);
      });

      if (method === 'every') {
        it('indeed stops iteration once an iterator returns a falsy value',
            function() {
              var spy = sinon.spy(function(item) {
                return item !== sentinels.two;
              });
              var result = callMethod(Series.from(sentinels.arr()), spy);
              return assert.eventually.isFalse(result)
                  .then(function() {
                    assert.calledTwice(spy);
                    assert.deepEqual(spy.firstCall.args, [sentinels.one]);
                    assert.deepEqual(spy.secondCall.args, [sentinels.two]);
                  });
            });
      }
    });

['sortBy', 'sortByParallel'].forEach(function(method) {
  var maxConcurrent = determineMaxConcurrent(method);
  var callMethod = makeCallMethod(method, maxConcurrent);

  describe('Series#' + method + '()', function() {
    resultsInSeries(callMethod);

    if (/Parallel$/.test(method)) {
      it('uses #mapParallel(maxConcurrent, func) under the hood', function() {
        var series = Series.from([42]);
        var spy = sinon.spy(series, 'mapParallel');
        callMethod(series, identity);
        return Promise.from().then(function() {
          assert.calledOnce(spy);
          assert.lengthOf(spy.firstCall.args, 2);
          assert.equal(spy.firstCall.args[0], maxConcurrent);
          assert.isFunction(spy.firstCall.args[1]);
        });
      });
    } else {
      var parallelMethod = method + 'Parallel';
      it('uses #' + parallelMethod + '(' + maxConcurrent + ', iterator) ' +
          'under the hood',
          function() {
            var series = Series.from([42]);
            var spy = sinon.spy(series, parallelMethod);
            callMethod(series, identity);
            assert.calledOnce(spy);
            assert.calledWithExactly(spy, maxConcurrent, identity);
          });
    }

    it('results in a correctly sorted array', function() {
      var four = new sentinels.Sentinel();
      var arr = [sentinels.three, sentinels.two, four, sentinels.one];
      var result = callMethod(Series.from(arr), function(item) {
        if (item !== four) {
          return Promise.from(item.id);
        }
        return item.id;
      });
      return assert.eventually.strictEqual(result, arr).then(function() {
        var expected = [sentinels.one, sentinels.two, sentinels.three, four];
        assert.deepEqual(arr, expected);
      });
    });
  });
});
