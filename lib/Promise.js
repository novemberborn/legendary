"use strict";

var legendary = require("./legendary");

// Work around circular dependency between Promise and Notifier
var Notifier = function(callbacks){
  Notifier = require("./Notifier");
  return new Notifier(callbacks);
};

function Promise(resolver){
  if(typeof resolver !== "function"){
    throw new TypeError();
  }

  if(!(this instanceof Promise)){
    return new Promise(resolver);
  }

  var promise = this;
  var pending = [];
  var resolved = false, fulfilled = false;
  var result, signalHandled;

  function adoptState(value){
    if(!value || typeof value !== "object" && typeof value !== "function"){
      adoptFulfilledState(value);
      return;
    }

    if(value instanceof Promise){
      value.then(adoptState, adoptRejectedState);
      return;
    }

    var then;
    try{
      then = value.then;
    }catch(_){}

    if(typeof then !== "function"){
      adoptFulfilledState(value);
      return;
    }

    var called = false;
    try{
      then.call(value, function(value){
        if(!called){
          called = true;
          adoptState(value);
        }
      }, function(reason){
        if(!called){
          called = true;
          adoptRejectedState(reason);
        }
      });
    }catch(reason){
      if(!called){
        called = true;
        adoptRejectedState(reason);
      }
    }
  }

  function adoptFulfilledState(value){
    fulfilled = true;
    result = value;
    var notifiers = pending;
    pending = null;
    for(var i = 0, l = notifiers.length; i < l; i++){
      notifiers[i].sameTurn(true, value);
    }
  }

  function adoptRejectedState(reason){
    result = reason;
    signalHandled = legendary.unhandledRejection(reason);
    var notifiers = pending;
    pending = null;
    for(var i = 0, l = notifiers.length; i < l; i++){
      notifiers[i].sameTurn(false, reason, signalHandled);
    }
  }

  function resolve(value){
    if(!resolved){
      resolved = true;
      adoptState(value);
    }
  }

  function reject(reason){
    if(!resolved){
      resolved = true;
      adoptRejectedState(reason);
    }
  }

  function then(onFulfilled, onRejected){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
      return promise;
    }

    var notifier = new Notifier([onFulfilled, onRejected]);
    if(pending){
      pending.push(notifier);
    }else{
      notifier.nextTurn(fulfilled, result, signalHandled);
    }
    return notifier.promise;
  }

  promise.then = then;

  try{
    resolver(resolve, reject);
  }catch(error){
    reject(error);
  }
}

module.exports = Promise;

Promise.prototype.then = function(/*onFulfilled, onRejected*/){
  return new Promise(function(){});
};

Promise.prototype.trace = function(/*label, meta*/){
  return this;
};

Promise.prototype.traceFulfilled = function(/*label, meta*/){
  return this;
};

Promise.prototype.traceRejected = function(/*label, meta*/){
  return this;
};
