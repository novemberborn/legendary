'use strict';

var legendary = require('./legendary');
var sameTurn = require('./trampoline').sameTurn;
var nextTurn = require('./trampoline').nextTurn;
var promises = require('./promises');
var ResolutionPropagator = require('./ResolutionPropagator');
var CancellationError = require('./CancellationError');

function adoptState(value, asFulfilled, asRejected) {
  var cancelAdoption;

  if (!value || typeof value !== 'object' && typeof value !== 'function') {
    asFulfilled(value);
  } else if (promises.Promise.isInstance(value)) {
    var state = value.inspectState();
    if (state.isFulfilled) {
      asFulfilled(state.value);
    } else if (state.isRejected) {
      asRejected(state.reason);
    } else {
      cancelAdoption = value.then(function(value) {
        adoptState(value, asFulfilled, asRejected);
      }, asRejected).cancel;
    }
  } else {
    var called = false;
    try {
      var then = value.then;
      if (typeof then !== 'function') {
        asFulfilled(value);
      } else {
        then.call(value, function(value) {
          if (!called) {
            called = true;
            adoptState(value, asFulfilled, asRejected);
          }
        }, function(reason) {
          if (!called) {
            called = true;
            asRejected(reason);
          }
        });

        cancelAdoption = function() {
          if (!called) {
            called = true;
            asRejected(new CancellationError());
          }
        };
      }
    } catch (exception) {
      if (!called) {
        called = true;
        asRejected(exception);
      }
    }
  }

  return cancelAdoption;
}

function be(promise, resolver, cancellable) {
  var constructor = promise.constructor;
  var pending = [];
  var resolved = false, fulfilled = false;
  var result, signalHandled, cancelAdoption, onCancelled;

  var cancel = promise.cancel;

  function markFulfilled(value) {
    fulfilled = true;
    result = value;
    cancelAdoption = null;
    var propagators = pending;
    pending = null;
    for (var i = 0, l = propagators.length; i < l; i++) {
      sameTurn(propagators[i], false, value);
    }
  }

  function markRejected(reason) {
    result = reason;
    signalHandled = legendary.unhandledRejection(reason);
    cancelAdoption = null;
    var propagators = pending;
    pending = null;
    for (var i = 0, l = propagators.length; i < l; i++) {
      sameTurn(propagators[i], true, reason, signalHandled);
    }
  }

  function resolve(value) {
    if (!resolved) {
      resolved = true;
      onCancelled = null;
      cancelAdoption = adoptState(value, markFulfilled, markRejected);
    }
  }

  function reject(reason) {
    if (!resolved) {
      resolved = true;
      onCancelled = null;
      markRejected(reason);
    }
  }

  function then(onFulfilled, onRejected) {
    if (typeof onFulfilled !== 'function' && typeof onRejected !== 'function') {
      return promise;
    }

    var propagator = new ResolutionPropagator(
        constructor, [onFulfilled, onRejected],
        cancellable, resolved ? null : cancel);
    if (pending) {
      pending.push(propagator);
    } else {
      nextTurn(propagator, !fulfilled, result, signalHandled);
    }
    return propagator.promise();
  }

  function inspectState() {
    if (pending) {
      return {
        isFulfilled: false,
        isRejected: false
      };
    } else if (fulfilled) {
      return {
        isFulfilled: true,
        isRejected: false,
        value: result
      };
    } else {
      return {
        isFulfilled: false,
        isRejected: true,
        reason: result
      };
    }
  }

  if (cancellable) {
    cancel = promise.cancel = function() {
      if (!resolved) {
        if (typeof onCancelled === 'function') {
          try {
            onCancelled();
          } catch (exception) {
            reject(exception);
          }
        }
        reject(new CancellationError());
      } else if (pending) {
        cancelAdoption();
      }
    };
  }

  promise.then = then;
  promise.inspectState = inspectState;

  try {
    onCancelled = resolver(resolve, reject);
  } catch (exception) {
    reject(exception);
  }
}

exports.be = be;


function extended(constructor, Base) {
  if (!Base) {
    Base = promises.Promise;
  }
  constructor.prototype = new Base(be);
  constructor.prototype.constructor = constructor;

  constructor.isInstance = function(x) { return x instanceof constructor; };
  constructor.from = promises.Promise.from;
  constructor.rejected = promises.Promise.rejected;
  constructor.all = promises.Promise.all;
  constructor.any = promises.Promise.any;
  constructor.some = promises.Promise.some;
  constructor.join = promises.Promise.join;

  return constructor;
}

exports.extended = extended;
