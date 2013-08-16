'use strict';

function TimeoutError(message) {
  this.name = 'timeout';
  this.message = message;
}

TimeoutError.prototype = new Error();
TimeoutError.prototype.constructor = TimeoutError;
TimeoutError.prototype.name = 'timeout';
TimeoutError.prototype.stack = null;
TimeoutError.prototype.inspect = function() {
  return '[TimeoutError]';
};

module.exports = TimeoutError;
