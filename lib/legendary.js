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
exports.TimeoutError = require('./TimeoutError');

exports.timed = require('./timed');
exports.concurrent = require('./concurrent');
exports.fn = require('./fn');

// ## unhandledRejection(reason)
// Callback for when a promise is about to be rejected. All rejections start
// as unhandled. Should return a function that can be used to signal when
// the rejection is handled. Placeholder for debugging tools.
exports.unhandledRejection = function() {};
