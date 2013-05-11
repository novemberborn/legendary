"use strict";

function CancellationError(){
  Error.captureStackTrace(this, CancellationError);
  this.name = "cancel";
}

CancellationError.prototype = new Error();
CancellationError.prototype.constructor = CancellationError;
CancellationError.prototype.name = "cancel";
CancellationError.prototype.inspect = function(){
  return "[CancellationError]";
};

module.exports = CancellationError;
