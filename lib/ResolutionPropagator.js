"use strict";

var legendary = require("./legendary");
var nextTurn = require("./_scheduler").nextTurn;
var blessed = require("./blessed");
var promises = require("./promises");

function extractThenMethod(x){
  if(!x || typeof x !== "object" && typeof x !== "function"){
    return null;
  }

  var then = x.then;
  return typeof then === "function" ? then : null;
}

function adoptThenable(thenable, then){
  return new promises.Promise(function(resolve, reject){
    var called = false;
    try{
      then.call(thenable, function(value){
        if(!called){
          called = true;
          resolve(value);
        }
      }, function(reason){
        if(!called){
          called = true;
          reject(reason);
        }
      });
    }catch(reason){
      if(!called){
        called = true;
        reject(reason);
      }
    }
  });
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

// ResolutionPropagators propagate the state of a promise to added callbacks,
// optionally transforming it first.
//
// The transformation may result in a thenable. The propagator will only
// attempt to resolve the state of the thenable when callbacks are added.
function ResolutionPropagator(transforms){
  this._transforms = transforms;

  this._state = INITIALIZED;
  this._resolved = false;
  this._delegatedResolve = null;
  this._delegatedReject = null;

  this._result = null;
  this._resultThen = null;
  this._handledRejection = null;

  this._promise = null;
}

module.exports = ResolutionPropagator;

ResolutionPropagator.rejected = function(reason, handledRejection){
  return new ResolutionPropagator().resolve(true, reason, handledRejection).promise();
};

ResolutionPropagator.prototype.promise = function(){
  if(this._promise){
    return this._promise;
  }

  var self = this;
  var promise = this._promise = new promises.Promise(blessed.be);
  promise.then = function(onFulfilled, onRejected){
    return self._then(onFulfilled, onRejected);
  };
  promise.inspectState = function(){
    return self._inspectState();
  };
  return promise;
};

ResolutionPropagator.prototype.resolve = function(rejected, result, handledRejection){
  if(this._resolved){
    throw new Error("Propagator is already resolved.");
  }
  this._resolved = true;

  var state = rejected ? REJECTED : PENDING;

  var transform = this._transforms && this._transforms[rejected ? 1 : 0];
  if(typeof transform === "function"){
    if(rejected && handledRejection){
      handledRejection();
    }
    handledRejection = null;

    try{
      result = transform(result);
      state = PENDING;
    }catch(exception){
      result = exception;
      state = REJECTED;
    }
  }
  this._transforms = null;

  if(this._delegatedResolve){
    if(state === REJECTED){
      this._delegatedReject(result);
    }else{
      this._delegatedResolve(result);
    }

    return this;
  }

  var resultThen = null;

  if(result instanceof promises.Promise){
    var stateOfResult = result.inspectState();
    if(stateOfResult.isFulfilled){
      result = stateOfResult.value;
      state = FULFILLED;
    }else if(stateOfResult.isRejected){
      result = stateOfResult.reason;
      state = REJECTED;
    }else{
      this._then = result.then;
      this._inspectState = result.inspectState;
      state = DELEGATED;
    }
  }else if(state === PENDING){
    try{
      resultThen = extractThenMethod(result);
      if(!resultThen){
        state = FULFILLED;
      }
    }catch(exception){
      result = exception;
      state = REJECTED;
    }
  }

  this._state = state;
  if(state !== DELEGATED){
    this._result = result;
  }
  if(state === REJECTED){
    this._handledRejection = handledRejection || legendary.unhandledRejection(result);
  }else if(state === PENDING){
    this._resultThen = resultThen;
  }

  return this;
};

ResolutionPropagator.prototype.transformSync = function(onFulfilled, onRejected){
  var isFulfilled = this._state === FULFILLED;
  if(!isFulfilled && this._state !== REJECTED){
    return this._then(onFulfilled, onRejected);
  }

  var transform = isFulfilled ? onFulfilled : onRejected;
  if(typeof transform !== "function"){
    return isFulfilled ? this._result : this.promise();
  }

  try{
    var result = transform(this._result);
    var then;
    if(result instanceof promises.Promise){
      var stateOfResult = result.inspectState();
      if(stateOfResult.isFulfilled){
        result = stateOfResult.value;
      }
    }else{
      then = extractThenMethod(result);
    }
    return then ? adoptThenable(result, then) : result;
  }catch(exception){
    return ResolutionPropagator.rejected(exception);
  }
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
ResolutionPropagator.prototype._then = function(onFulfilled, onRejected){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    return this.promise();
  }

  if(this._state === INITIALIZED){
    return this._delegate().then(onFulfilled, onRejected);
  }

  if(this._state === PENDING){
    return this._resolveThenable().then(onFulfilled, onRejected);
  }

  var propagator = new ResolutionPropagator([onFulfilled, onRejected]);
  nextTurn(propagator, this._state === REJECTED, this._result, this._handledRejection);
  return propagator.promise();
};

ResolutionPropagator.prototype._inspectState = function(){
  if(this._state === FULFILLED){
    return {
      isFulfilled: true,
      isRejected: false,
      value: this._result
    };
  }else if(this._state === REJECTED){
    return {
      isFulfilled: false,
      isRejected: true,
      reason: this._result
    };
  }else{
    return {
      isFulfilled: false,
      isRejected: false
    };
  }
};

ResolutionPropagator.prototype._delegate = function(){
  var self = this;
  var promise = new promises.Promise(function(resolve, reject){
    self._delegatedResolve = resolve;
    self._delegatedReject = reject;
  });

  this._then = promise.then;
  this._inspectState = promise.inspectState;
  this._state = DELEGATED;

  return promise;
};

ResolutionPropagator.prototype._resolveThenable = function(){
  var promise = adoptThenable(this._result, this._resultThen);

  this._then = promise.then;
  this._inspectState = promise.inspectState;
  this._state = DELEGATED;

  this._result = null;
  this._resultThen = null;

  return promise;
};
