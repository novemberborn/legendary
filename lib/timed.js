'use strict';

var promise = require('./promise');
var TimeoutError = require('./TimeoutError');

// # timed
// Provides helper methods for delaying fulfillment and guarding against
// indefinitely pending promises or thenables.

function timer(ms, func) {
  var ref;
  if (ms) {
    ref = setTimeout(func, ms);
  } else {
    ref = setImmediate(func);
  }
  return function abortTimer() {
    if (ms) {
      clearTimeout(ref);
    } else {
      clearImmediate(ref);
    }
  };
}

// ## delay(milliseconds, x)
// Returns a `Promise` instance which is fulfilled after at least `milliseconds`
// have passed.

// If `x` is a thenable it is first assimilated into a promise.

// If `x` is a `Promise` instance or a thenable, the clock won't start running
// until it has fulfilled. The returned promise will be fulfilled with the same
// value, or `x` if it was not a `Promise` instance or thenable.

// If `x` rejects, the returned promise will be rejected with the same rejection
// reason. Note that the rejection propagation is not delayed.

// To start the clock straight away, without waiting for `x` to be fulfilled,
// you could use:

//     delay(5000).yield(promise)
function delay(milliseconds, x) {
  return promise.Promise.from(x).then(function(value) {
    return new promise.Promise(function(resolve) {
      return timer(milliseconds, function() {
        resolve(value);
      });
    });
  });
}

exports.delay = delay;

// ## timeout(milliseconds, x)
// Guards against indefinitely pending promises. Returns a `Promise` instance.

// If `x` is neither a `Promise` instance or a thenable, the returned promise
// is fulfilled immediately.

// If `x` is a thenable it is first assimilated into a promise.

// If the promise fulfills or rejects before `milliseconds` have passed, the
// returned promise is fulfilled or rejected with the same value or reason,
// respectively. Otherwise the returned promise is rejected with a
// [`TimeoutError`](./TimeoutError.js.html) instance.
function timeout(milliseconds, x) {
  return new promise.Promise(function(resolve, reject) {
    var abort = timer(milliseconds, function() {
      reject(new TimeoutError('Timed out after ' + milliseconds + 'ms'));
    });

    promise.Promise.from(x)
      .tap(resolve, reject)
      .ensure(abort);

    return abort;
  });
}

exports.timeout = timeout;
