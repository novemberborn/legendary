'use strict';

// # Legendary

// ## Promise
// A [Promise/A+](http://promisesaplus.com/) compatible promise constructor,
// with additional functionality such as support for subclassing, helper methods
// on the constructor and extra instance methods.
// [Read more](./promises.js.html#promise).
exports.Promise = require('./promises').Promise;

// ## Series
// A subclass of [`Promise`](./promises.js.html#promise) that makes it easier
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
