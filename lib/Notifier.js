"use strict";

var Promise = require("./Promise");
var legendary = require("./legendary");
var isThenable = require("./isThenable");
var sameTurn = require("./_scheduler").sameTurn;
var nextTurn = require("./_scheduler").nextTurn;

// Promise subclass that does not execute a factory method, but takes a
// notifier instance instead.
var PromiseForNotifier = function(notifier){
  // Don't set to `notifier.then` as that method may be replaced, and we want
  // `promise.then` to be a free function.
  this.then = function(onFulfilled, onRejected){
    return notifier.then(onFulfilled, onRejected);
  };
};

function Notifier(callbacks){
  // Notifiers are created whenever a `then` is called. They will invoke
  // the appropriate callback and manage the promise for the return value
  // of the callbacks.

  this.callbacks = callbacks;

  this.pending = true;
  this.fulfilled = false;
  // Non-promise result of the callback
  this.result = null;
  // Callback for when unhandled rejections are handled.
  this.signalHandled = null;
  // Promise result of the callback
  this.returnedThenable = null;

  // The promise for the return value of the callbacks.
  this.promise = new PromiseForNotifier(this);
  // Resolver methods, to be defined if then() is called while the notifier
  // is pending.
  this.resolve = null;
  this.reject = null;
}

module.exports = Notifier;

Notifier.prototype.then = function(onFulfilled, onRejected){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    // Return the original promise if no callbacks are passed.
    return this.promise;
  }

  if(this.pending && !this.resolve){
    // The notifier is still pending, create a resolver to manage the new
    // callbacks.
    var self = this;
    this.then = new Promise(function(resolve, reject){
      self.resolve = resolve;
      self.reject = reject;
    }).then;
    return this.then(onFulfilled, onRejected);
  }

  if(this.returnedThenable){
    // The notifier is fulfilled with a thenable, ensure a Legendary promise
    // to manage the new callbacks.
    var thenable = this.returnedThenable instanceof Promise ? this.returnedThenable : Promise.from(this.returnedThenable);
    this.then = thenable.then;
    this.returnedThenable = null;
    return this.then(onFulfilled, onRejected);
  }

  // The notifier is no longer pending, create a new notifier to invoke the
  // appropriate callback in a future turn.
  return nextTurn(
    new Notifier([onFulfilled, onRejected]),
    this.fulfilled,
    this.result,
    this.signalHandled
  ).promise;
};

Notifier.prototype.nextTurn = function(fulfilled, result, signalHandled){
  // Ensures the notifier is notified in a future turn.
  return nextTurn(this, fulfilled, result, signalHandled);
};

Notifier.prototype.sameTurn = function(fulfilled, result, signalHandled){
  return sameTurn(this, fulfilled, result, signalHandled);
};

Notifier.prototype.now = function(fulfilled, result, signalHandled){
  // Invoke the appropriate callback with the result received from the
  // resolver or promise.

  var callback = this.callbacks && this.callbacks[fulfilled ? 0 : 1];
  var hasCallback = typeof callback === "function";
  var callbackReturnedThenable = false;

  if(hasCallback){
    if(signalHandled && !fulfilled){
      signalHandled();
    }

    try{
      result = callback(result);
      callbackReturnedThenable = isThenable(result);
      fulfilled = true;
    }catch(error){
      result = error;
      fulfilled = false;
      this.signalHandled = legendary.unhandledRejection(error);
    }
  }else{
    this.signalHandled = signalHandled;
  }

  // Unset callbacks since they'll no longer be called.
  this.callbacks = null;

  // At this point `fulfilled` depends on the execution result of
  // the callback.
  this.pending = false;
  this.fulfilled = fulfilled;

  if(this.resolve){
    // If there is a resolver, make sure it's fulfilled or rejected
    // appropriately.

    if(fulfilled){
      this.resolve(result);
    }else{
      this.reject(result);
    }
  }else{
    // Store the execution result such that we can use it if `then` is
    // called on the notifier's promise.
    if(callbackReturnedThenable){
      this.returnedThenable = result;
    }else{
      this.result = result;
    }
  }

  return this;
};
