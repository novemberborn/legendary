'use strict';

var blessed = require('./private/blessed');

// # main

// ## Promise
// A [Promise/A+](http://promisesaplus.com/) compatible promise constructor,
// with additional functionality such as support for subclassing, helper methods
// on the constructor and extra instance methods.
// [Read more](./promise.js.html).
exports.Promise = require('./promise').Promise;

// ## Series
// A subclass of [`Promise`](./promise.js.html) that makes it easier
// to interact with promises-for-arrays.
// [Read more](./series.js.html#series).
exports.Series = require('./series').Series;

// ## CancellationError
// An error constructor, instances of which are used as rejection reasons when
// a promise is cancelled. [Read more](./CancellationError.js.html).
exports.CancellationError = require('./CancellationError');

// ## TimeoutError
// Extends `Error`. Instances of this class are used as rejection reasons when
// a promise times out.
// [Read more](./TimeoutError.js.html).
exports.TimeoutError = require('./TimeoutError');

// ## timed
// Provides helper methods for delaying fulfillment and guarding against
// indefinitely pending promises or thenables.
// [Read more](./timed.js.html).
exports.timed = require('./timed');

// ## concurrent
// Provides helper methods for orchestrating task execution.
// [Read more](./concurrent.js.html).
exports.concurrent = require('./concurrent');

// ## fn
// Provides helper methods for functional composition.
// [Read more](./fn.js.html).
exports.fn = require('./fn');

// ## unhandledRejection(reason)
// Callback for when a promise is about to be rejected. All rejections start
// as unhandled. Should return a function that can be used to signal when
// the rejection is handled. Placeholder for debugging tools.
exports.unhandledRejection = function() {};

// ## blessObject(object, executor, cancellable, propagationConstructor)
// Bless an object with Legendary's promise functionality. Assigns
// `object.then`, `object.inspectState`, and if applicable `object.cancel`.
// Invokes the `executor` function with appropriate `resolve` and `reject`
// methods.

// If `cancellable` is truey, cancellation is enabled for the object. Specify
// `propagationConstructor` to control the instances of promises returned by
// calling `object.then()`. Defaults to `object.constructor`.
exports.blessObject = blessed.be;

// ## extendConstructor(Constructor, Base)
// Set up `Constructor` so it correctly extends from `Base`. Defaults to
// extending from `Promise`. Returns `Constructor`.
exports.extendConstructor = blessed.extended;
