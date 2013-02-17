"use strict";

var Promise = require("./Promise");
var isThenable = require("./is");

// Promise subclass that does not execute a factory method, but takes a
// notifier instance instead.
var PromiseForNotifier = function(notifier){
  // Don't set to `notifier.then` as that method may be replaced, and we want
  // `promise.then` to be a free function.
  this.then = function(onFulfilled, onRejected){
    return notifier.then(onFulfilled, onRejected);
  };
};
PromiseForNotifier.prototype = new Promise(function(){});

// Maintain a queue of notifiers that need to be notified in a future turn.
var queue;
function exec(){
  var snapshot = queue;
  queue = null;
  for(var i = 0, l = snapshot.length; i < l; i += 4){
    snapshot[i].notifySync(snapshot[i + 1], snapshot[i + 2], snapshot[i + 3]);
  }
}
function enqueue(notifier, fulfilled, result, signalHandled){
  if(!queue){
    process.nextTick(exec);
    queue = [notifier, fulfilled, result, signalHandled];
  }else{
    queue.push(notifier, fulfilled, result, signalHandled);
  }
  return notifier;
}

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

Notifier.unhandledRejection = function(reason){
  // Callback for when a promise is about to be rejected. All rejections start
  // as unhandled. Should return a function that can be used to signal when
  // the rejection is handled.

  // No-op, implemented by `../debug/unhandled`.
};

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
  return enqueue(
    new Notifier([onFulfilled, onRejected]),
    this.fulfilled,
    this.result,
    this.signalHandled
  ).promise;
};

Notifier.prototype.notify = function(fulfilled, result, signalHandled){
  // Ensures the notifier is notified in a future turn.
  return enqueue(this, fulfilled, result, signalHandled);
};

Notifier.prototype.notifySync = function(fulfilled, result, signalHandled){
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
      this.signalHandled = Notifier.unhandledRejection(error);
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
