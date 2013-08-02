'use strict';

function CancellationError() {
  this.name = 'cancel';
}

CancellationError.prototype = new Error();
CancellationError.prototype.constructor = CancellationError;
CancellationError.prototype.name = 'cancel';
CancellationError.prototype.stack = null;
CancellationError.prototype.inspect = function() {
  return '[CancellationError]';
};

module.exports = CancellationError;
