"use strict";

var Promise = require("./Promise");
var ResolutionPropagator = require("./ResolutionPropagator");

// when() takes promises, thenables and values and will ensure the appropriate
// callback is invoked with the appropriate value, depending on the state of
// the promise/thenable, or whether a non-thenable value was received.
//
// The return value depends on the received value and the presence or behavior
// of the callbacks.
//
// When no callbacks are passed:
//
// * If a promise was received, it's returned as-is.
// * If a thenable was received, a promise adopting its state [^1] is returned.
// * If a value was received, a promise fulfilled with that value is returned.
//
// If (at least) the `onFulfilled` callback is passed:
//
// * If a promise was received, the result of passing the `onFulfilled`
//   callback to its then() method is returned
// * If a thenable was received, its state is adopted into a promise, and the
//   result of passing the `onFulfilled` callback to the promise's then()
//   method is returned.
// * If a non-thenable was received, it's passed to the `onFulfilled` callback.
//   If the callback throws, a rejected promise is returned with the thrown
//   exception as rejection reason. If the callback returns a promise or value,
//   this result is returned as-is. If the callback returns a thenable, a
//   promise adopting its state [^1] is returned instead.
//
// If (at least) the `onRejected` callback is passed:
//
// * If a promise was received, the result of passing the `onRejected`
//   callback to its then() method is returned
// * If a thenable was received, its state is adopted into a promise, and the
//   result of passing the `onRejected` callback to the promise's then()
//   method is returned.
//
// If the `onFulfilled` callback is not passed, but `onRejected` callback is,
// and a non-thenable was received, it's returned as-is.
//
// [1] Note that this promise only assumes the state of the thenable when its
// then() method is invoked.

function when(value, onFulfilled, onRejected){
  if(value instanceof Promise && arguments.length === 1){
    return value;
  }

  var propagator = new ResolutionPropagator().resolve(false, value);
  if(arguments.length <= 1){
    return propagator.promise();
  }
  return propagator.transformSync(onFulfilled, onRejected);
}
module.exports = when;
