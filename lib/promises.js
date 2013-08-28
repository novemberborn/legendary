'use strict';

var legendary = require('./legendary');
var blessed = require('./blessed');
var ResolutionPropagator = require('./ResolutionPropagator');

function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }

  if (resolver !== blessed.be) {
    blessed.be(this, resolver, true);
  }
}

exports.Promise = Promise;

Promise.isInstance = function(x) {
  return x instanceof Promise;
};

Promise.from = function(value) {
  return new ResolutionPropagator(this, null, true).resolve(
      false, value
  ).promise();
};

Promise.rejected = function(reason) {
  return new ResolutionPropagator(this, null, true).resolve(
      true, reason, legendary.unhandledRejection(reason)
  ).promise();
};

Promise.prototype.then = function(/*onFulfilled, onRejected*/) {
  return this.constructor(function() {});
};

Promise.prototype.inspectState = function() {
  return {
    isFulfilled: false,
    isRejected: false
  };
};

Promise.prototype.cancel = function() {};

// For `fork()` and `uncancellable()` we resolve the propagator with a
// thenable. Passing a promise would lead it to attempt to adopt state
// synchonously, and propagate cancellation to the current promise.
Promise.prototype.fork = function() {
  return new ResolutionPropagator(this.constructor, null, true).resolve(
    false, { then: this.then }
  ).promise();
};

Promise.prototype.uncancellable = function() {
  return new ResolutionPropagator(this.constructor, null, false).resolve(
    false, { then: this.then }
  ).promise();
};

Promise.prototype.to = function(constructor) {
  return constructor.from(this);
};

Promise.prototype.trace = function(/*label, meta*/) {
  return this;
};

Promise.prototype.traceFulfilled = function(/*label, meta*/) {
  return this;
};

Promise.prototype.traceRejected = function(/*label, meta*/) {
  return this;
};
