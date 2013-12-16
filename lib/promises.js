'use strict';

var legendary = require('./legendary');
var blessed = require('./blessed');
var ResolutionPropagator = require('./ResolutionPropagator');
var CancellationError = require('./CancellationError');

var slice = [].slice;

// # Promise
// Promise/A+ compatible promise constructor.
function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }

  if (resolver !== blessed.be) {
    blessed.be(this, resolver, true);
  }
}

exports.Promise = Promise;

function prepRace(Constructor, retry, input, race) {
  if (Promise.isInstance(input)) {
    return input.then(function(input) {
      return retry.call(Constructor, input);
    });
  }

  var queue, result;
  var size = 0;
  if (Array.isArray(input)) {
    result = [];
    queue = input.map(function(item, index) {
      size++;
      return {
        value: item,
        key: index
      };
    });
  } else if (input && typeof input === 'object') {
    var keys = Object.keys(input);
    result = {};
    size = keys.length;
    queue = keys.map(function(key) {
      return {
        value: input[key],
        key: key
      };
    });
  } else {
    return Constructor.rejected(
        new TypeError('Can\'t get values of non-object or array'));
  }

  return new Constructor(function(resolve, reject) {
    race(queue, size, result, resolve, reject);
  });
}

function ttrue() {
  return true;
}

function invokeCancel(promise) {
  promise.cancel();
}

// ## Promise.isInstance(x)
// Checks whether a given value is an instance of this Promise class.
Promise.isInstance = function(x) {
  return x instanceof Promise;
};

// ## Promise.from(value)
// Given any value, promise or thenable, returns a promise that is fulfilled
// with the value, adopts the promise state, or assimilates the thenable,
// respectively.
Promise.from = function(value) {
  return new ResolutionPropagator(this, null, true).resolve(
      false, value
  ).promise();
};

// ## Promise.rejected(reason)
// Returns a rejected promise, with `reason` as its rejection reason.
Promise.rejected = function(reason) {
  return new ResolutionPropagator(this, null, true).resolve(
      true, reason, legendary.unhandledRejection(reason)
  ).promise();
};

// ## Promise Races
// Often when composing multiple promises you want to race them against each
// other. Legendary provides various types of races.

// For the following methods please keep in mind these assumptions on the
// `input` argument:

// * You may pass a promise if the actual input is not yet available. The race
// will start with the fulfillment value of that promise, but if it is rejected
// so will be the returned promise.

// * The input must either be an array or an object. For any other input type
// the returned promise is rejected.

// * If `input` is an array each item is considered for the race. If it is an
// object, each own value is considered.

// * Only promises are considered for the race; non-promises are treated as if
// they are promises fulfilled with that non-promise value. In other words, the
// non-promise is considered to be the fulfillment value of a promise that would
// otherwise have participated in the race.

// * **Thenables are not assimilated, but instead treated as objects**. So if
// `input` is a thenable, the race result may be an object with a `then`
// function (but not the same thenable). Or if a thenable is an item in an input
// array, or an own value if an input object, it's returned as-is.

// ### Promise.all(input)
// The first promise to be rejected causes the returned promise to be rejected
// with that same reason. Otherwise fulfills with a mapping of fulfillment
// values for the input, according to its type.
Promise.all = function(input) {
  return prepRace(this, this.all, input,
      function(queue, winsRequired, result, resolve, lose) {
        if (winsRequired === 0) {
          return resolve(result);
        }

        function win(key, value) {
          result[key] = value;
          if (--winsRequired === 0) {
            resolve(result);
          }
        }

        queue.forEach(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(function(value) {
              win(descriptor.key, value);
            }, lose);
          } else {
            win(descriptor.key, descriptor.value);
          }
        });
      });
};

// ### Promise.any(input)
// The first promise to be fulfilled causes the returned promise to be fulfilled
// with that same value. Otherwise rejects with a mapping of rejection reasons
// for the input, according to its type.
Promise.any = function(input) {
  return prepRace(this, this.any, input,
      function(queue, lossesNeeded, reasons, resolve, reject) {
        if (lossesNeeded === 0) {
          return resolve(undefined);
        }

        var isWon = false;
        function win(value) {
          if (!isWon) {
            isWon = true;
            resolve(value);
          }
        }
        function lose(key, reason) {
          reasons[key] = reason;
          if (!isWon && --lossesNeeded === 0) {
            reject(reasons);
          }
        }

        queue.some(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(win, function(reason) {
              lose(descriptor.key, reason);
            });
          } else {
            win(descriptor.value);
          }
          return isWon;
        });
      });
};

// ### Promise.some(input, winsRequired)
// Like `Promise.all()`, but the returned promise won't be rejected until it's
// no longer possible to get a number of fulfillment values equivalent to
// `winsRequired`. The returned promise is fulfilled once the total number of
// fulfillment values is equivalent to `winsRequired`.

// The returned promise is fulfilled with a mapping of fulfillment values for
// the input, according to its type, and similarly rejected with
// a mapping of rejection reasons. Note that the value/reason may be a sparse
// array, or an object with fewer keys than `input`.
Promise.some = function(input, winsRequired) {
  return prepRace(
      this,
      function(input) {
        return this.some(input, winsRequired);
      },
      input,
      function(queue, queueSize, result, resolve, reject) {
        if (queueSize === 0) {
          return resolve(undefined);
        }

        var lossesNeeded = queueSize - winsRequired + 1;
        var reasons = Array.isArray(result) ? [] : {};
        function win(key, value) {
          result[key] = value;
          if (--winsRequired === 0) {
            if (Array.isArray(result)) {
              resolve(result.filter(ttrue));
            } else {
              resolve(result);
            }
          }
        }
        function lose(key, reason) {
          reasons[key] = reason;
          if (--lossesNeeded === 0) {
            if (Array.isArray(reasons)) {
              reject(reasons.filter(ttrue));
            } else {
              reject(reasons);
            }
          }
        }

        queue.some(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(function(value) {
              win(descriptor.key, value);
            }, function(reason) {
              lose(descriptor.key, reason);
            });
          } else {
            win(descriptor.key, descriptor.value);
          }
          return winsRequired === 0;
        });
      });
};

// ### Promise.join(...input)
// Applies `Promise.all()` to the arguments array.
Promise.join = function() {
  return this.all(slice.call(arguments));
};

// ## Promise#then(onFulfilled, onRejected)
// `then` method according to [Promises/A+](http://promisesaplus.com/).

// Can be called as a free function, without the promise instance as a
// `thisArg`. For example:

//      var then = promise.then;
//      then(function(value) {
//        console.log('value:', value);
//      });

// Behaves the same as:

//      promise.then(function(value) {
//        console.log('value:', value);
//      });

// **Please note that only those methods documented as free functions can be
// called as such.**
Promise.prototype.then = function() {
  return new Promise(function() {});
};

// ## Promise#inspectState()
// Synchronously inspects the state of the promise. Returns an object with
// `isFulfilled` and `isRejected` properties, and depending on state `value`
// or `reason`:

// * If both are `isFulfilled` and `isRejected` are `false`, the promise
// is *pending*.

// * If `isFulfilled` is `true`, then `isRejected` will be `false`, and the
// promise is *fulfilled*. The fulfillment value is available via the `value`
// property, which does *not* exist when the promise is pending or rejected.

// * If `isRejected` is `true`, then `isFulfilled` will be `false`, and the
// promise is *rejected*. The rejection reason is available via the `reason`
// property, which does *not* exist when the promise is pending or fulfilled.

// Like `then`, can be called as a free function.
Promise.prototype.inspectState = function() {
  return {
    isFulfilled: false,
    isRejected: false
  };
};

// ## Promise#cancel()
// Cancels a pending promise. If the promise is no longer pending then invoking
// this method will have no side-effects.

// When cancelled, the pending promise is rejected with a
// [`CancellationError`](./CancellationError.html). If the promise is in the
// process of adopting the state of *another* promise, the cancellation is
// propagated by invoking the `cancel` method on *that* promise. If instead the
// promise is assimilating a thenable, it merely gives up on the assimilation,
// but does not attempt to invoke a `cancel` method on that thenable.

// Like `then`, can be called as a free function.
Promise.prototype.cancel = function() {};

// ## Promise#fork()
// Forks the promise so that resolution will propagate into the returned
// promise, but cancellation of that promise will not affect the original
// promise:

//      var forked = promise.fork();
//      promise.then(null, function(reason) {
//        console.log("original promise rejected:", reason.name);
//      });
//      forked.then(null, function(reason) {
//        console.log("returned promise rejected:", reason.name);
//      });
//      forked.cancel(); // Logs: returned promise rejected: cancel
Promise.prototype.fork = function() {
  //For `fork()` and `uncancellable()` we resolve the propagator with a
  //thenable. Passing a promise would lead it to attempt to adopt state
  //synchonously, and propagate cancellation to the current promise.
  return new ResolutionPropagator(this.constructor, null, true).resolve(
    false, { then: this.then }
  ).promise();
};

// ## Promise#uncancellable()
// Forks the promise so that resolution will propagate into the returned
// promise, but that returned promise nor any promise derived from it can be
// cancelled.

//      var uncancellable = promise.uncancellable();
//      promise.then(null, function(reason) {
//        console.log("original promise rejected:", reason.name);
//      });
//      uncancellable.then(null, function(reason) {
//        console.log("returned promise rejected:", reason.name);
//      });
//      uncancellable.cancel(); // Logs nothing
Promise.prototype.uncancellable = function() {
  return new ResolutionPropagator(this.constructor, null, false).resolve(
    false, { then: this.then }
  ).promise();
};

// ## Promise#to(constructor)
// Returns a promise of type `constructor` which will adopt the state of the
// current promise. Useful for type conversions, for example if we have a
// promise for an array we can convert it into a `Collection` promise like this:

//      var promise = Promise.from([0, 1, 2, 3, 4]);
//      var collection = promise.to(Collection);

// And then we can use the helper methods from `Collection` to filter the array:

//      var odd = collection.filter(function(n) {
//        return n % 2;
//      });
//      odd.then(console.log); // Logs: [ 1, 3 ]

// Assumes `constructor` has a `from` method, like
// [`Promise.from()`](#promisefromvalue).
Promise.prototype.to = function(constructor) {
  return constructor.from(this);
};

// ## Promise#trace(label, meta)
// Essentially a no-op, in that it returns the current promise, but provides a
// hook for debugging tools. Should report both transitions to fulfilled and
// rejected states.

// `label` is expected to be a string. `meta` can be any value.
Promise.prototype.trace = function() {
  return this;
};

// ## Promise#traceFulfilled(label, meta)
// Like `trace`, but should only report transitions to the fulfilled state.
Promise.prototype.traceFulfilled = function() {
  return this;
};

// ## Promise#traceRejected(label, meta)
// Like `trace`, but should only report transitions to the rejected state.
Promise.prototype.traceRejected = function() {
  return this;
};

// ## Promise#yield(value)
// Returns a new promise which will fulfill with `value`, provided the original
// promise is fulfilled.
Promise.prototype.yield = function(value) {
  return this.then(function() {
    return value;
  });
};

// ## Promise#yieldReason(reason)
// Returns a new promise which will reject with `reason`, provided the original
// promise is fulfilled.

//      var fulfilled = Promise.from(42);
//      var rejected = fulfilled.yieldReason(
//        new Error("We apologise for the inconvenience"));
//      rejected.then(null, function(reason) {
//        console.log(reason.message);
//      }); // Logs: We apologise for the inconvenience
Promise.prototype.yieldReason = function(reason) {
  return this.then(function() {
    throw reason;
  });
};

// ## Promise#otherwise(onRejected)
// Shorthand for `then(null, onRejected)`.
Promise.prototype.otherwise = function(onRejected) {
  return this.then(null, onRejected);
};

// ## Promise#ensure(onFulfilledOrRejected)
// Invokes `onFulfilledOrRejected` when the promise leaves the pending state,
// but without any arguments. Returns a promise that adopts the original state,
// unless `onFulfilledOrRejected` throws, or returns a rejected promise, in
// which case the returned promise is rejected with that exception or reason.
Promise.prototype.ensure = function(onFulfilledOrRejected) {
  var handler = function() {
    return onFulfilledOrRejected();
  };

  return this.then(handler, handler).yield(this);
};

// ## Promise#tap(onFulfilledSideEffect, onRejectedSideEffect)
// Adds `onFulfilledSideEffect` and `onRejectedSideEffect` as callbacks, like
// if `then` was used, but unless those functions throw, returns a promise that
// adopts the original state. If the callbacks do throw, the returned promise is
// rejected with that exception.
Promise.prototype.tap = function(onFulfilledSideEffect, onRejectedSideEffect) {
  return this.then(onFulfilledSideEffect, onRejectedSideEffect).yield(this);
};

// ## Promise#spread(variadicOnFulfilled)
// Assuming the current promise will be fulfilled with an array, uses
// `Promise.all()` to collect the fulfillment values and invokes
// `variadicOnFulfilled` with multiple arguments.

// The returned promise will be rejected if the original promise is not
// fulfilled with an array; rejects; or if not all fulfillment values can be
// collected. See [`Promise.all`](#promiseallinput) for more detail on the
// semantics.
Promise.prototype.spread = function(variadicOnFulfilled) {
  return this.constructor.all(this).then(function(args) {
    if (!Array.isArray(args)) {
      throw new TypeError('Can\'t spread non-array value');
    }

    return variadicOnFulfilled.apply(undefined, args);
  });
};

// ## Promise#nodeify(callback)
// Takes a Node-style callback and if the promise is fullfilled calls it with
// two arguments: `null` and the fulfillment value, and otherwise with a single
// argument: the rejection reason.
Promise.prototype.nodeify = function(callback) {
  if (typeof callback !== 'function') {
    return this;
  }

  this.then(function(value) {
    callback(null, value);
  }, callback);
};

// ## Promise#cancelAfter(milliseconds)
// Returns the original promise, but schedules `cancel` to be invoked after
// `milliseconds`.
Promise.prototype.cancelAfter = function(milliseconds) {
  setTimeout(this.cancel, milliseconds);
  return this;
};

// ## Promise#alsoCancels(other)
// Ties the cancellation fate of `other` to that of the current promise.

// * If `other` is a promise, and the current promise is cancelled, so
// will `other`.

// * If `other` is an array, each item that is a promise is cancelled when the
// current promise is cancelled.

// * If `other` is an object, each own value that is a promise is cancelled
// when the current promise is cancelled.
Promise.prototype.alsoCancels = function(other) {
  var promises;
  if (Promise.isInstance(other)) {
    promises = [other];
  } else if (Array.isArray(other)) {
    promises = other.filter(Promise.isInstance);
  } else if (other && typeof other === 'object') {
    promises = Object.keys(other).reduce(function(promises, key) {
      var promiseOrValue = other[key];
      if (Promise.isInstance(promiseOrValue)) {
        promises.push(promiseOrValue);
      }
      return promises;
    }, []);
  }

  if (promises && promises.length > 0) {
    this.then(null, function(reason) {
      if (reason instanceof CancellationError) {
        promises.forEach(invokeCancel);
      }
    });
  }

  return this;
};

// ## Promise#send(methodName, ...args)
// Invokes the method `methodName` of the fulfillment value of the current
// promise with arguments `args`, returning a promise for the result.
Promise.prototype.send = function(methodName) {
  var args = slice.call(arguments, 1);
  return this.then(function(value) {
    return value[methodName].apply(value, args);
  });
};

// ## Promise#prop(name)
// Returns a promise for the property `name` of the fulfillment value of the
// current promise.
Promise.prototype.prop = function(name) {
  return this.then(function(value) {
    return value[name];
  });
};
