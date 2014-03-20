'use strict';

var promise = require('./promise');

var blessed = require('./private/blessed');
var trampoline = require('./private/trampoline');
var util = require('./private/util');

// # Series
// A subclass of [`Promise`](./promise.js.html) that makes it easier
// to interact with promises-for-arrays. Thus, a `Series` promise is expected to
// be fulfilled with an array.

// The instance methods listed below all return promises. Unless noted otherwise
// they'll return a new `Series` promise. If the original promise is fulfilled
// with a value other than an array, the returned promise will (unless noted
// otherwise), be fulfilled with a new, empty array. If the original promise
// is rejected, the returned promise will be rejected with the same reason.

// Iterator callbacks are called with items from the array. No other arguments
// are passed. The callbacks may return a value or a `Promise` instance.
// `thenables` are *not* assimilated.

// Parallelization controls the number of pending promises (as returned by
// an iterator callback) an operation is waiting on. Per operation no new
// callbacks are invoked when this number reaches the maximum concurrency.
function Series(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Series)) {
    return new Series(executor);
  }

  if (executor !== blessed.be) {
    blessed.be(this, executor, true);
  }
}

// Besides instance methods, the following class methods are inherited from
// `Promise`:

// * `Series.isInstance()`
// * `Series.from()`
// * `Series.rejected()`
// * `Series.all()`
// * `Series.any()`
// * `Series.some()`
// * `Series.join()`
// * `Series.denodeify()`
exports.Series = blessed.extended(Series);

function nextTurn(func, value) {
  trampoline.nextTurn({
    resolve: function() {
      func(value);
    }
  });
}

function produceValue(promiseOrValue) {
  if (promise.Promise.isInstance(promiseOrValue)) {
    return promiseOrValue.inspectState().value;
  } else {
    return promiseOrValue;
  }
}

function invokeCancel(promiseOrValue) {
  if (promise.Promise.isInstance(promiseOrValue)) {
    promiseOrValue.cancel();
  }
}

function prepForSort(iterator) {
  var index = 0;
  return function(item) {
    var wrapped = { sourceIndex: index++ };

    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(sortValue) {
        wrapped.sortValue = sortValue;
        return wrapped;
      });
    } else {
      wrapped.sortValue = result;
      return wrapped;
    }
  };
}

function sortInstructions(a, b) {
  return a.sortValue < b.sortValue ? -1 : 1;
}

// ## Series#map(iterator)
// Maps each value in the array using `iterator`, eventually resulting in an
// array with the returned (promise fulfillment) values.
Series.prototype.map = function(iterator) {
  return this.mapParallel(1, iterator);
};

// ## Series#mapParallel(maxConcurrent, iterator)
// See `Series#map(iterator)`.

// (You may notice all other operations build on top of this method.)
Series.prototype.mapParallel = function(maxConcurrent, iterator) {
  return util.guardArray(this, [], function(arr) {
    if (typeof maxConcurrent !== 'number') {
      throw new TypeError('Missing max concurrency number.');
    }
    if (typeof iterator !== 'function') {
      throw new TypeError('Missing iterator function.');
    }

    return new Series(function(resolve, reject) {
      var index = 0, stopAt = arr.length;
      var acc = new Array(stopAt);

      var reachedEnd = false;
      var running = 0;
      function oneCompleted() {
        running--;
        runConcurrent();
      }
      function oneFailed(reason) {
        reachedEnd = true;
        running = -1;
        reject(reason);
      }
      function runConcurrent() {
        if (reachedEnd) {
          if (running === 0) {
            resolve(acc.map(produceValue));
          }
          return;
        }

        if (running >= maxConcurrent) {
          return;
        }

        try {
          running++;
          var result = acc[index] = iterator(arr[index]);
          index++;
          reachedEnd = reachedEnd || index === stopAt;
          if (promise.Promise.isInstance(result)) {
            result.then(oneCompleted, oneFailed);
          } else {
            oneCompleted();
          }
          runConcurrent();
        } catch (error) {
          oneFailed(error);
        }
      }

      nextTurn(runConcurrent);

      return function() {
        reachedEnd = true;
        running = -1;
        acc.forEach(invokeCancel);
      };
    });
  });
};

// ## Series#each(iterator)
// Iterates over each item in the array. Returns a
// `Promise` that is fulfilled with `undefined` when the iteration
// has completed.
Series.prototype.each = function(iterator) {
  return this.mapParallel(1, iterator)
      .then(util.makeUndefined).to(promise.Promise);
};

// ## Series#eachParallel(maxConcurrent, iterator)
// See `Series#each(iterator)`.
Series.prototype.eachParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, iterator)
      .then(util.makeUndefined).to(promise.Promise);
};

// ## Series#filter(iterator)
// Filters the array, eventually resulting in an array containing the items for
// which `iterator` returned a truey (promise fulfillment) value.
Series.prototype.filter = function(iterator) {
  return this.mapParallel(1, util.skipIfFalsy(iterator))
      .then(util.removeSkipped);
};

// ## Series#filterParallel(maxConcurrent, iterator)
// See `Series#filter(iterator)`.
// The resulting array retains the order of the original array.
Series.prototype.filterParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, util.skipIfFalsy(iterator))
      .then(util.removeSkipped);
};

// ## Series#filterOut(iterator)
// Filters the array, eventually resulting in an array containing the items for
// which `iterator` returned a falsey (promise fulfillment) value.
Series.prototype.filterOut = function(iterator) {
  return this.mapParallel(1, util.skipIfTruthy(iterator))
      .then(util.removeSkipped);
};

// ## Series#filterOutParallel(maxConcurrent, iterator)
// See `Series#filterOut(iterator)`.
// The resulting array retains the order of the original array.
Series.prototype.filterOutParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, util.skipIfTruthy(iterator))
      .then(util.removeSkipped);
};

// ## Series#concat(iterator)
// Iterates over each item in the array, eventually resulting in an flattened
// array containing the returned (promise fulfillment) values.
Series.prototype.concat = function(iterator) {
  return this.mapParallel(1, iterator).then(util.flatten);
};

// ## Series#concatParallel(maxConcurrent, iterator)
// See `Series#concat(iterator)`.
// The items in the resulting array are ordered by when the iterator that
// returned them was invoked, not when its returned promise fulfilled.
Series.prototype.concatParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, iterator).then(util.flatten);
};

// ## Series#foldl(initialValue, iterator)
// Folds the array into another value, starting with the first item. At each
// stage, `iterator` is called with the result of the folding operation at that
// point, and an item from the array. Returns a `Promise` instance for the
// result of the folding operation.

// Unlike `Array#reduce()` the initial value must be passed as the first
// argument. `initialValue` may be a promise, `iterator` won't be called until
// `initialValue` has fulfilled. If it rejects, the returned promise is rejected
// with the same reason.

// This method has no parallel equivalent. Use `Series#mapParallel()` to collect
// values concurrently, and then use this method with a synchronous iterator.
Series.prototype.foldl = function(initialValue, iterator) {
  return util.guardArray(this, initialValue, function(arr) {
    return new promise.Promise(function(resolve, reject) {
      var index = 0, stopAt = arr.length;
      var reachedEnd = false;
      var currentPromise;

      function applyIterator(value) {
        if (reachedEnd) {
          resolve(value);
          return;
        }

        try {
          value = iterator(value, arr[index]);
          index++;
          reachedEnd = reachedEnd || index === stopAt;
          if (promise.Promise.isInstance(value)) {
            currentPromise = value;
            value.then(applyIterator, reject);
          } else {
            applyIterator(value);
          }
        } catch (error) {
          reject(error);
        }
      }

      if (promise.Promise.isInstance(initialValue)) {
        currentPromise = initialValue.then(applyIterator, reject);
      } else {
        nextTurn(applyIterator, initialValue);
      }

      return function() {
        if (currentPromise) {
          currentPromise.cancel();
        }
        reachedEnd = true;
      };
    });
  }).to(promise.Promise);
};

// ## Series#foldr(initialValue, iterator)
// Like `Series#foldl()`, but starts with the last item in the array.
Series.prototype.foldr = function(initialValue, iterator) {
  return util.guardArray(this, initialValue, function(arr) {
    return new promise.Promise(function(resolve, reject) {
      var index = arr.length - 1;
      var reachedEnd = false;
      var currentPromise;

      function applyIterator(value) {
        if (reachedEnd) {
          resolve(value);
          return;
        }
        try {
          value = iterator(value, arr[index]);
          index--;
          reachedEnd = reachedEnd || index < 0;
          if (promise.Promise.isInstance(value)) {
            currentPromise = value;
            value.then(applyIterator, reject);
          } else {
            applyIterator(value);
          }
        } catch (error) {
          reject(error);
        }
      }

      if (promise.Promise.isInstance(initialValue)) {
        currentPromise = initialValue.then(applyIterator, reject);
      } else {
        nextTurn(applyIterator, initialValue);
      }

      return function() {
        if (currentPromise) {
          currentPromise.cancel();
        }
        reachedEnd = true;
      };
    });
  }).to(promise.Promise);
};

// ## Series#detect(iterator)
// Iterates over the array, returning a `Promise` instance that will be
// fulfilled with the item for which `iterator` first returned a truey
// (promise fulfillment) value. If no match is found, the promise will be
// fulfilled with `undefined`.

// Iteration is stopped when the promise is fulfilled.
Series.prototype.detect = function(iterator) {
  return this.detectParallel(1, iterator);
};

// ## Series#detectParallel(maxConcurrent, iterator)
// See `Series#detect(iterator)`. Each promise returned by the iterator is
// racing the other promises to fulfill with a truey value first. The returned
// promise will be fulfilled with the item for which that promise was returned
// from `iterator`.
Series.prototype.detectParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, util.shortcutDetect(iterator))
      .to(promise.Promise)
      .then(util.makeUndefined, util.extractShortcutValue);
};

// ## Series#some(iterator)
// Iterates over the array, returning a `Promise` instance that will be
// fulfilled with `true` if an iterator returns a truey (promise fulfillment)
// value, or `false` if no iterator does so.

// Iteration is stopped when the promise is fulfilled.
Series.prototype.some = function(iterator) {
  return this.someParallel(1, iterator);
};

// ## Series#someParallel(maxConcurrent, iterator)
// See `Series#some(iterator)`.
Series.prototype.someParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, util.shortcutSome(iterator))
      .to(promise.Promise)
      .then(util.strictlyTrue, util.extractShortcutValue);
};

// ## Series#every(iterator)
// Iterates over the array, returning a `Promise` instance that will be
// fulfilled with `true` if all iterations return a truey (promise fulfillment)
// value, or `false` when the an iteration does not.

// Iteration is stopped when the promise is fulfilled.
Series.prototype.every = function(iterator) {
  return this.everyParallel(1, iterator);
};

// ## Series#everyParallel(maxConcurrent, iterator)
// See `Series#every(iterator)`.
Series.prototype.everyParallel = function(maxConcurrent, iterator) {
  return this.mapParallel(maxConcurrent, util.shortcutNotEvery(iterator))
      .to(promise.Promise)
      .then(util.makeTrue, util.extractShortcutValue);
};

// ## Series#sortBy(iterator)
// Sorts the array, using `iterator` to map each item to a sort value.
// Relies on `Array#sort(compareFunction)`, with each sort value being passed
// to the compare function:

//      function compareFunction(a, b) {
//        return a < b ? -1 : 1;
//      }

// Eventually modifies and returns the original array.
Series.prototype.sortBy = function(iterator) {
  return this.sortByParallel(1, iterator);
};

// ## Series#sortByParallel(maxConcurrent, iterator)
// See `Series#sortBy(iterator)`.
Series.prototype.sortByParallel = function(maxConcurrent, iterator) {
  var self = this;
  return self.then(function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return arr;
    }

    return self.mapParallel(maxConcurrent, prepForSort(iterator))
        .then(function(instructions) {
          instructions.sort(sortInstructions);
          var copy = arr.slice();
          for (var i = 0, l = arr.length; i < l; i++) {
            arr[i] = copy[instructions[i].sourceIndex];
          }
          return arr;
        });
  });
};
