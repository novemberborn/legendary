"use strict";

var Promise = require("./Promise");
var legendary = require("./legendary");
var sameTurn = require("./_scheduler").sameTurn;
var nextTurn = require("./_scheduler").nextTurn;

var PromiseByProxy = function(notifier){
  this.then = function(onFulfilled, onRejected){
    return notifier.proxyThen(onFulfilled, onRejected);
  };
};
PromiseByProxy.prototype = new Promise(function(){});

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

// Notifiers are created whenever a `then` is called. They will invoke
// the appropriate callback and manage the promise for the return value
// of the callbacks.
function Notifier(callbacks){
  this.callbacks = callbacks;

  this.pending = true;
  this.fulfilled = false;
  this.result = null;
  this.extractedThenMethod = null;
  this.signalHandled = null;

  this.promise = new PromiseByProxy(this);
  this.resolve = null;
  this.reject = null;
}

module.exports = Notifier;

Notifier.prototype.proxyThen = function(onFulfilled, onRejected){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    return this.promise;
  }

  if(this.pending){
    return this.proxyPending(onFulfilled, onRejected);
  }

  if(this.extractedThenMethod){
    return this.proxyThenable(onFulfilled, onRejected);
  }

  return nextTurn(
    new Notifier([onFulfilled, onRejected]),
    this.fulfilled,
    this.result,
    this.signalHandled
  ).promise;
};

Notifier.prototype.proxyPending = function(onFulfilled, onRejected){
  var self = this;
  var promise = new Promise(function(resolve, reject){
    self.resolve = resolve;
    self.reject = reject;
  });
  this.proxyThen = promise.then;
  return promise.then(onFulfilled, onRejected);
};

Notifier.prototype.proxyThenable = function(onFulfilled, onRejected){
  var thenable = this.result;
  var then = this.extractedThenMethod;
  this.result = this.extractedThenMethod = null;

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

  this.proxyThen = promise.then;
  return promise.then(onFulfilled, onRejected);
};

Notifier.prototype.nextTurn = function(fulfilled, result, signalHandled){
  return nextTurn(this, fulfilled, result, signalHandled);
};

Notifier.prototype.sameTurn = function(fulfilled, result, signalHandled){
  return sameTurn(this, fulfilled, result, signalHandled);
};

Notifier.prototype.settle = function(fulfilled, result, signalHandled){
  var callback = this.callbacks && this.callbacks[fulfilled ? 0 : 1];
  var hasCallback = typeof callback === "function";

  if(hasCallback){
    if(signalHandled && !fulfilled){
      signalHandled();
    }

    try{
      result = callback(result);
      fulfilled = true;
    }catch(error){
      result = error;
      fulfilled = false;
      this.signalHandled = legendary.unhandledRejection(error);
    }
  }else{
    this.signalHandled = signalHandled;
  }

  this.callbacks = null;
  this.pending = false;
  this.fulfilled = fulfilled;

  if(this.resolve){
    if(fulfilled){
      this.resolve(result);
    }else{
      this.reject(result);
    }
  }else{
    this.result = result;
    this.extractedThenMethod = extractThenMethod(result);
  }

  return this.promise;
};
