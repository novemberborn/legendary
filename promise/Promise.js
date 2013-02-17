"use strict";

var isThenable = require("./is");

// Work around circular dependency between Promise and Notifier
var Notifier = function(callbacks){
  Notifier = require("./_Notifier");
  return new Notifier(callbacks);
};
Notifier.unhandledRejection = function(reason){
  Notifier = require("./_Notifier");
  return Notifier.unhandledRejection(reason);
};

function Promise(factory){
  if(typeof factory !== "function"){
    throw new TypeError();
  }

  if(!(this instanceof Promise)){
    return new Promise(factory);
  }

  makeResolver(this, factory);
}

module.exports = Promise;

Promise.from = function(thenable){
  if(!isThenable(thenable)){
    throw new TypeError();
  }
  return new Promise(thenable.then);
};

Promise.prototype.then = function(onFulfilled, onRejected){
  return new Promise(function(){});
};

Promise.prototype.trace = function(label, meta){
  return this;
};

Promise.prototype.traceFulfilled = function(label, meta){
  return this;
};

Promise.prototype.traceRejected = function(label, meta){
  return this;
};

function makeResolver(promise, factory){
  // List of pending notifiers. It's truthiness indicates the resolver
  // is still pending.
  var pending = [];
  // Whether the resolver was fulfilled. The resolver was rejected if it's
  // not `pending` and not `fulfilled`.
  var fulfilled = false;
  // Stores the fulfillment value or rejection reason.
  var result;
  // Callback for when unhandled rejections are handled.
  var signalHandled;

  function resolve(value){
    if(!pending){
      return;
    }

    if(isThenable(value)){
      adoptState(value, resolve, reject);
      return;
    }

    fulfilled = true;
    result = value;

    for(var i = 0, l = pending.length; i < l; i++){
      pending[i].notifySync(true, value);
    }
    pending = null;
  }

  function reject(reason){
    if(pending){
      result = reason;
      signalHandled = Notifier.unhandledRejection(reason);

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notifySync(false, reason, signalHandled);
      }
      pending = null;
    }
  }

  function then(onFulfilled, onRejected){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
      // Return the original promise if no handlers are passed.
      return promise;
    }

    var notifier = new Notifier([onFulfilled, onRejected]);
    if(pending){
      pending.push(notifier);
    }else{
      notifier.notify(fulfilled, result, signalHandled);
    }
    return notifier.promise;
  }

  promise.then = then;
  factory(resolve, reject);
}

function adoptState(thenable, resolve, reject){
  try{
    thenable.then(resolve, reject);
  }catch(error){
    reject(error);
  }
}
