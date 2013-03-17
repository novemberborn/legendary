"use strict";

var Promise = require("./Promise");
var legendary = require("./legendary");
var nextTurn = require("./_scheduler").nextTurn;

var PropagationPromise = function(propagator){
  this.then = function(onFulfilled, onRejected){
    return propagator.then(onFulfilled, onRejected);
  };
};
PropagationPromise.prototype = new Promise(function(){});

function extractThenMethod(x){
  if(!x || typeof x !== "object" && typeof x !== "function"){
    return null;
  }

  var then;
  try{
    then = x.then;
  }catch(_){}

  return typeof then === "function" ? then : null;
}

// ResolutionPropagators propagate the state of a promise, via optional
// transformation methods.
//
// A propagator can be "settled", meaning it has received a value to
// propagate. When settled, if also "fulfilled" the promise being
// propagated is considered fulfilled, otherwise it's considered rejected.
//
// Transformation methods may return a thenable. The propagator will only
// attempt to resolve the state of the thenable if callbacks are added.
function ResolutionPropagator(transforms){
  this._transforms = transforms;

  this._settled = false;
  this._fulfilled = false;
  this.value = null;
  this._valueThen = null;
  this._handledRejection = null;

  this.promise = new PropagationPromise(this);
  this._resolvePromise = null;
  this._rejectPromise = null;
}

module.exports = ResolutionPropagator;

ResolutionPropagator.valueOrPromise = function(value){
  var then = extractThenMethod(value);
  if(!then || value instanceof Promise){
    return value;
  }

  var propagator = new ResolutionPropagator();
  propagator._settled = true;
  propagator._fulfilled = true;
  propagator.value = value;
  propagator._valueThen = then;
  return propagator.promise;
};

ResolutionPropagator.prototype._propagateValue = function(onFulfilled, onRejected){
  var self = this;
  var promise = new Promise(function(resolve, reject){
    self._resolvePromise = resolve;
    self._rejectPromise = reject;
  });
  this.then = promise.then;
  return promise.then(onFulfilled, onRejected);
};

ResolutionPropagator.prototype._resolveThenable = function(onFulfilled, onRejected){
  var thenable = this.value;
  var then = this._valueThen;

  var promise = new Promise(function(resolve, reject){
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

  this.then = promise.then;
  return promise.then(onFulfilled, onRejected);
};

ResolutionPropagator.prototype.settle = function(fulfilled, value, handledRejection){
  var transform = this._transforms && this._transforms[fulfilled ? 0 : 1];

  if(typeof transform === "function"){
    if(!fulfilled && handledRejection){
      handledRejection();
    }
    handledRejection = null;

    try{
      value = transform(value);
      fulfilled = true;
    }catch(error){
      value = error;
      fulfilled = false;
    }
  }

  this._transforms = null;
  this._settled = true;
  this._fulfilled = fulfilled;

  if(this._resolvePromise){
    if(fulfilled){
      this._resolvePromise(value);
    }else{
      this._rejectPromise(value);
    }
  }else{
    this.value = value;
    if(fulfilled){
      this._valueThen = extractThenMethod(value);
    }else{
      this._handledRejection = handledRejection || legendary.unhandledRejection(value);
    }
  }

  return this;
};

ResolutionPropagator.prototype.then = function(onFulfilled, onRejected){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    return this.promise;
  }

  if(!this._settled){
    return this._propagateValue(onFulfilled, onRejected);
  }

  if(this._valueThen){
    return this._resolveThenable(onFulfilled, onRejected);
  }

  var propagator = new ResolutionPropagator([onFulfilled, onRejected]);
  nextTurn(propagator, this._fulfilled, this.value, this._handledRejection);
  return propagator.promise;
};

ResolutionPropagator.prototype.hasThenable = function(){
  return !!this._valueThen;
};
