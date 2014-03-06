'use strict';

// # CancellationError
// Extends `Error`. Instances of this class are used as rejection reasons when
// a promise is cancelled.
function CancellationError() {
  this.name = 'cancel';
}

CancellationError.prototype = new Error();
CancellationError.prototype.constructor = CancellationError;
// Each instance will have a `name` property with a value of `"cancel"`.
// However, the instances will not have stack traces.
CancellationError.prototype.name = 'cancel';
CancellationError.prototype.stack = null;
// Node should log the error as `[CancellationError]`.
CancellationError.prototype.inspect = function() {
  return '[CancellationError]';
};

module.exports = CancellationError;
