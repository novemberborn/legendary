'use strict';

var nextTurn = require('./trampoline').nextTurn;
var blessed = require('./blessed');

var main = require('../main');
var promise = require('../promise');
var CancellationError = require('../CancellationError');

function extractThenMethod(x) {
  if (!x || typeof x !== 'object' && typeof x !== 'function') {
    return null;
  }

  var then = x.then;
  return typeof then === 'function' ? then : null;
}

function adoptThenableResult(propagator) {
  var promise = propagator._constructor(blessed.be);
  blessed.be(promise, function(resolve, reject) {
    try {
      propagator._resultThen.call(propagator._result, resolve, reject);
    } catch (reason) {
      reject(reason);
    }
  }, propagator._cancellable);
  return promise;
}

function delegateResolution(propagator) {
  var promise = propagator._constructor(blessed.be);
  blessed.be(promise, function(resolve, reject) {
    propagator._delegatedResolve = resolve;
    propagator._delegatedReject = reject;
    // The propagator could unset `_signalCancelled`, but in those scenarios
    // this promise should no longer be cancellable so it'll be all right.
    return propagator._signalCancelled;
  }, propagator._cancellable);
  return promise;
}

// States of resolution propagation:
//
// INITIALIZED: The propagator was instantiated but nothing has happened to it.
// DELEGATED:   Propagation has been delegated to an actual promise.
// PENDING:     The propagator has been resolved but the state of its value is
//              still pending.
// FULFILLED:   The propagator has been resolved with a fulfillment value.
// REJECTED:    The propagator has been resolved with a rejection reason.
var INITIALIZED = 0;
var DELEGATED = 1;
var PENDING = 2;
var FULFILLED = 3;
var REJECTED = 4;

// Propagators propagate the state of a promise to added callbacks, optionally
// transforming it first.
//
// The transformation may result in a thenable. The propagator will only
// attempt to resolve the state of the thenable when callbacks are added.
function Propagator(
    constructor, transforms,
    cancellable, signalCancelled) {
  this._constructor = constructor || promise.Promise;
  this._transforms = transforms;
  this._cancellable = cancellable === true;
  this._signalCancelled = signalCancelled;

  this._state = INITIALIZED;
  this._resolved = false;
  this._cancelled = false;
  this._delegatedResolve = null;
  this._delegatedReject = null;

  this._result = null;
  this._resultThen = null;
  this._handledRejection = null;

  this._promise = null;
}

exports.Propagator = Propagator;

Propagator.prototype.promise = function() {
  if (this._promise) {
    return this._promise;
  }

  var self = this;
  var promise = this._promise = new this._constructor(blessed.be);
  promise.then = function(onFulfilled, onRejected) {
    return self._then(onFulfilled, onRejected);
  };
  promise.inspectState = function() {
    return self._inspectState();
  };
  promise.cancel = function() {
    return self._cancel();
  };
  return promise;
};

Propagator.prototype.resolve = function(rejected, result,
    handledRejection) {
  if (this._resolved) {
    throw new Error('Propagator is already resolved.');
  }
  this._resolved = true;
  this._signalCancelled = null;

  var state = rejected ? REJECTED : PENDING;

  var transform = this._transforms && this._transforms[rejected ? 1 : 0];
  if (typeof transform === 'function') {
    if (rejected && handledRejection) {
      handledRejection();
    }
    handledRejection = null;

    try {
      result = transform(result);
      if (this._promise && result === this._promise) {
        result = new TypeError('Promise cannot adopt state of itself.');
        state = REJECTED;
      } else {
        state = PENDING;
      }
    } catch (exception) {
      result = exception;
      state = REJECTED;
    }
  }
  this._transforms = null;

  if (this._cancelled) {
    // FIXME: Any error thrown by the transform is masked by the cancellation
    state = REJECTED;
    result = new CancellationError();
  }

  if (this._delegatedResolve) {
    if (state === REJECTED) {
      this._delegatedReject(result);
    } else {
      this._delegatedResolve(result);
    }

    return this;
  }

  var resultThen = null;

  if (promise.Promise.isInstance(result)) {
    var stateOfResult = result.inspectState();
    if (stateOfResult.isFulfilled) {
      result = stateOfResult.value;
      state = FULFILLED;
    } else if (stateOfResult.isRejected) {
      result = stateOfResult.reason;
      state = REJECTED;
    } else {
      if (this._constructor === result.constructor) {
        this._then = result.then;
        this._inspectState = result.inspectState;
        if (this._cancellable) {
          this._cancel = result.cancel;
        }
      } else {
        this._delegate();
        this._delegatedResolve(result);
      }
      state = DELEGATED;
    }
  } else if (state === PENDING) {
    try {
      resultThen = extractThenMethod(result);
      if (!resultThen) {
        state = FULFILLED;
      }
    } catch (exception) {
      result = exception;
      state = REJECTED;
    }
  }

  this._state = state;
  if (state !== DELEGATED) {
    this._result = result;
  }
  if (state === REJECTED) {
    this._handledRejection = handledRejection ||
        main.unhandledRejection(result);
  } else if (state === PENDING) {
    this._resultThen = resultThen;
  }

  return this;
};

// _then() should only be called from the PropagationPromise. Its behavior
// depends on the propagator state:
//
// * INITIALIZED: Delegate propagation to an actual promise.
// * PENDING: Resolve the thenable and delegate propagation to the promise
//   adopting its state.
// * FULFILLED: Propagate the value in a next turn.
// * REJECTED: Propagate the reason in a next turn.
//
// Note that _then() should never be called when the propagator is in the
// DELEGATED state. Also note that delegation replaces the _then() on
// the propagator.
Propagator.prototype._then = function(onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && typeof onRejected !== 'function') {
    return this.promise();
  }

  if (this._state === INITIALIZED) {
    return this._delegate().then(onFulfilled, onRejected);
  }

  if (this._state === PENDING) {
    return this._resolveThenable().then(onFulfilled, onRejected);
  }

  var propagator = new Propagator(
      this._constructor, [onFulfilled, onRejected],
      this._cancellable);
  nextTurn(propagator, this._state === REJECTED, this._result,
      this._handledRejection);
  return propagator.promise();
};

// _cancel() should only be called from the PropagationPromise. Its behavior
// depends on the propagator state:
//
// * INITIALIZED: If possible, forward the cancellation upstream, assuming
//   the propagator is resolved synchronously. If no forwarding is possible,
//   transition to a rejected state, but only applying the transforms in a
//   next turn. This should only occur when invoking then() on a settled
//   promise and cancelling the returned promise in the same turn.
// * PENDING: Forget about the thenable and transition to a rejected state.
// * FULFILLED: No-op
// * REJECTED: No-op
//
// Note that _cancel() should never be called when the propagator is in the
// DELEGATED state. Also note that delegation replaces _cancel() on
// the propagator.
Propagator.prototype._cancel = function() {
  if (!this._cancellable) {
    return;
  }

  if (this._state === PENDING) {
    this._state = REJECTED;
    this._result = new CancellationError();
    this._resultThen = null;
  } else if (this._state === INITIALIZED) {
    if (this._signalCancelled) {
      this._signalCancelled();
    } else {
      this._cancelled = true;
    }
  }
};

Propagator.prototype._inspectState = function() {
  if (this._state === FULFILLED) {
    return {
      isFulfilled: true,
      isRejected: false,
      value: this._result
    };
  } else if (this._state === REJECTED) {
    return {
      isFulfilled: false,
      isRejected: true,
      reason: this._result
    };
  } else {
    return {
      isFulfilled: false,
      isRejected: false
    };
  }
};

Propagator.prototype._delegate = function() {
  var promise = delegateResolution(this);

  this._then = promise.then;
  this._inspectState = promise.inspectState;
  this._cancel = promise.cancel;
  this._state = DELEGATED;

  this._signalCancelled = null;

  return promise;
};

Propagator.prototype._resolveThenable = function() {
  var promise = adoptThenableResult(this);

  this._then = promise.then;
  this._inspectState = promise.inspectState;
  this._cancel = promise.cancel;
  this._state = DELEGATED;

  this._result = null;
  this._resultThen = null;

  return promise;
};
