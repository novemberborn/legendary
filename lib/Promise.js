"use strict";

var legendary = require("./legendary");
var isThenable = require("./isThenable");

// Work around circular dependency between Promise and Notifier
var Notifier = function(callbacks){
  Notifier = require("./Notifier");
  return new Notifier(callbacks);
};

function assimilate(thenable, resolve, reject){
  var isFirstCall = true;
  try{
    thenable.then(function(value){
      if(isFirstCall){
        isFirstCall = false;
        resolve(value);
      }
    }, function(reason){
      if(isFirstCall){
        isFirstCall = false;
        reject(reason);
      }
    });
  }catch(error){
    isFirstCall = false;
    reject(error);
  }
}

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
      assimilate(value, resolve, reject);
      return;
    }

    fulfilled = true;
    result = value;

    var notifiers = pending;
    pending = null;
    for(var i = 0, l = notifiers.length; i < l; i++){
      notifiers[i].notifySync(true, value);
    }
  }

  function reject(reason){
    if(pending){
      result = reason;
      signalHandled = legendary.unhandledRejection(reason);

      var notifiers = pending;
      pending = null;
      for(var i = 0, l = notifiers.length; i < l; i++){
        notifiers[i].notifySync(false, reason, signalHandled);
      }
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
  return new Promise(function(resolve){
    resolve(thenable);
  });
};

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
