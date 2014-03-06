'use strict';

// # TimeoutError
// Extends `Error`. Instances of this class are used as rejection reasons when
// a promise times out.
function TimeoutError(message) {
  this.name = 'timeout';
  this.message = message;
}

TimeoutError.prototype = new Error();
TimeoutError.prototype.constructor = TimeoutError;
// Each instance will have a `name` property with a value of `"timeout"`.
// However, the instances will not have stack traces.
TimeoutError.prototype.name = 'timeout';
TimeoutError.prototype.stack = null;
// Node should log the error as `[TimeoutError]`.
TimeoutError.prototype.inspect = function() {
  return '[TimeoutError]';
};

module.exports = TimeoutError;
