'use strict';

// # fn
// Provides helper methods for functional composition.

var promise = require('./promise');
var concurrent = require('./concurrent');

var slice = [].slice;

function exec(func, thisArg, args) {
  return promise.Promise.all(args).then(function(args) {
    return func.apply(thisArg, args);
  });
}

// ## call(normalFunction, ...args)
// Invokes `normalFunction` in a future turn, returning a `Promise` instance for
// its result. This will be rejected with any error thrown by `normalFunction`,
// or resolved with its return value. If a promise or thenable is returned its
// state will be adopted.

// `normalFunction` is applied to the `thisArg` of the `call()` invocation:

//     var sentinel = {};
//     call.call(sentinel, function() {
//       assert(this === sentinel); // true
//     });

// `normalFunction` will be invoked with the other arguments that are passed.
// These arguments may also be promises, however instead of invoking
// `normalFunction` with the promises, it'll be invoked with the fulfillment
// values. If an argument promise is rejected, the returned promise will be
// rejected with the same reason.
function call(normalFunction) {
  /*jshint validthis:true*/
  return exec(normalFunction, this, slice.call(arguments, 1));
}

exports.call = call;

// ## apply(normalFunction, args)
// Invokes `normalFunction` in a future turn, returning a `Promise` instance for
// its result. This will be rejected with any error thrown by `normalFunction`,
// or resolved with its return value. If a promise or thenable is returned its
// state will be adopted.

// `normalFunction` is applied to the `thisArg` of the `apply()` invocation:

//     var sentinel = {};
//     apply.call(sentinel, function() {
//       assert(this === sentinel); // true
//     });

// `normalFunction` will be invoked with the arguments that are passed in the
// `args` array. `args` may be a promise, or it can be an array containing
// promises, or a promise for such an array. However instead of invoking
// `normalFunction` with the promises, it'll be invoked with the fulfillment
// values. If an argument promise is rejected, the returned promise will be
// rejected with the same reason.
function apply(normalFunction, args) {
  /*jshint validthis:true*/
  return exec(normalFunction, this, args);
}

exports.apply = apply;

// ## lift(normalFunction, ...args)
// Returns a new function that will invoke `normalFunction` when invoked:

//     function foo() {
//       return 'bar';
//     }
//
//     var promisingFoo = lift(foo);
//     promisingFoo().then(function(value) {
//       assert(value === 'bar'); // true
//     });

// The lifted function will return a `Promise` instance for the result of
// `normalFunction`. This will be rejected with any error thrown by
// `normalFunction`, or resolved with its return value. If a promise or thenable
// is returned its state will be adopted.

// `normalFunction` is applied to the `thisArg` of the listed function's
// invocation:

//     var sentinel = {};
//     lift(function() {
//       assert(this === sentinel); // true
//     }).call(sentinel);

// Supports partial application by combining other arguments passed to `lift()`
// with those passed when invoking the lifted function. These arguments may also
// be promises, however instead of invoking `normalFunction` with the promises,
// it'll be invoked with the fulfillment values. If an argument promise is
// rejected, the returned promise will be rejected with the same reason.
function lift(normalFunction) {
  var args = slice.call(arguments, 1);
  var resolvedArgs = args.length === 0;

  var invoke = function() {
    var thisArg = this;
    var additionalArgs = slice.call(arguments);

    if (!resolvedArgs) {
      return promise.Promise.all(args).then(function(resolved) {
        args = resolved;
        resolvedArgs = true;
        return invoke.apply(thisArg, additionalArgs);
      });
    }

    return promise.Promise.all(additionalArgs).then(function(additionalArgs) {
      return normalFunction.apply(thisArg, args.concat(additionalArgs));
    });
  };

  return invoke;
}

exports.lift = lift;

// ## compose(...funcs)
// Returns a new function that, when invoked, will invoke each original function
// `func` in order, passing the (fulfilled) return value from one to the next:

//     compose(
//       function() { return 2; },
//       function(x) { return x * x; }
//     )().then(function(value) {
//       assert(value === 4); // true
//     });

// The composed function will return a `Promise` instance for the (fulfilled)
// result of the final `func`. This will be rejected with any error thrown by
// any `func`, or the rejection reason of any promise or thenable that is
// returned. If no `func`s are specified, the promise will be fulfilled with
// `undefined`.

// Each function is invoked with the `thisArg` of the composed function's
// invocation:

//     var sentinel = {};
//     compose(
//       function() {
//         assert(this === sentinel); // true
//       },
//       function() {
//         assert(this === sentinel); // true
//       }
//     ).call(sentinel);

// The first `func` will be invoked with the other arguments that are passed.
// These arguments may also be promises, however instead of invoking `func` with
// the promises, it'll be invoked with the fulfillment values. If an argument
// promise is rejected, the returned promise will be rejected with the same
// reason.
function compose() {
  var funcs = slice.call(arguments);

  return function() {
    var thisArg = this;
    var boundFuncs = funcs.map(function(func) {
      return function() {
        return promise.Promise.from(func.apply(thisArg, arguments));
      };
    });

    var args = slice.call(arguments);
    args.unshift(boundFuncs);

    return concurrent.pipeline.apply(concurrent, args);
  };
}

exports.compose = compose;
