"use strict";

var Promise = require("./Promise");
var legendary = require("./legendary");
var nextTurn = require("./_scheduler").nextTurn;

var PropagationPromise = function(propagator){
  this.then = function(onFulfilled, onRejected){
    return propagator._then(onFulfilled, onRejected);
  };
};
PropagationPromise.prototype = new Promise(function(){});

function extractThenMethod(x){
  if(!x || typeof x !== "object" && typeof x !== "function"){
    return null;
  }

  var then = x.then;
  return typeof then === "function" ? then : null;
}

function adoptThenable(thenable, then){
  return new Promise(function(resolve, reject){
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
  return this._promise || (this._promise = new PropagationPromise(this));
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

  if(result instanceof Promise){
    this._then = result.then;
    state = DELEGATED;
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
    if(!(result instanceof Promise)){
      then = extractThenMethod(result);
    }
    return then ? adoptThenable(result, then) : result;
  }catch(exception){
    return ResolutionPropagator.rejected(exception);
  }
};

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

ResolutionPropagator.prototype._delegate = function(){
  var self = this;
  var promise = new Promise(function(resolve, reject){
    self._delegatedResolve = resolve;
    self._delegatedReject = reject;
  });

  this._then = promise.then;
  this._state = DELEGATED;

  return promise;
};

ResolutionPropagator.prototype._resolveThenable = function(){
  var promise = adoptThenable(this._result, this._resultThen);

  this._then = promise.then;
  this._state = DELEGATED;

  this._result = null;
  this._resultThen = null;

  return promise;
};
