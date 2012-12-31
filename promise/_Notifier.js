"use strict";

var Promise = require("./Promise");
var isPromise = require("./is");
var when = require("./when");

var Resolver = function(promise){
  // Work around circular dependency between Resolver and Notifier.
  Resolver = require("./Resolver");
  return new Resolver(promise);
};

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

var STOP_PROGRESS_PROPAGATION = "StopProgressPropagation";
function stopProgressPropagation(error){
  if(error && error.name === STOP_PROGRESS_PROPAGATION){
    return;
  }

  throw error;
}

function Notifier(onFulfilled, onRejected, onProgress){
  // Notifiers are created whenever a `then` is called. They will invoke
  // the appropriate callback and manage the promise for the return value
  // of the callbacks.

  this.onFulfilled = onFulfilled;
  this.onRejected = onRejected;
  this.onProgress = onProgress;

  this.pending = true;
  this.fulfilled = false;
  // Non-promise result of the callback
  this.result = null;
  // Callback for when unhandled rejections are handled.
  this.signalHandled = null;
  // Promise result of the callback
  this.returnedPromise = null;

  // The promise for the return value of the callbacks.
  this.promise = new Promise();

  // Set up the `then` method of the notifier.
  var self = this;
  this.promise.then = function(onFulfilled, onRejected, onProgress){
    return self._promiseThen(onFulfilled, onRejected, onProgress);
  };
}

module.exports = Notifier;

Notifier.unhandledRejection = function(reason){
  // Callback for when a promise is about to be rejected. All rejections start
  // as unhandled. Should return a function that can be used to signal when
  // the rejection is handled.

  // No-op, implemented by `../debug/unhandled`.
};

Notifier.prototype._promiseThen = function(onFulfilled, onRejected, onProgress){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function" && typeof onProgress !== "function"){
    // Return the original promise if no callbacks are passed.
    return this.promise;
  }

  if(this.pending && !this.resolver || this.returnedPromise){
    // We create a resolver for the notifier if `then` is called while the
    // notifier is pending, or if a callback returned a promise.

    var resolver = new Resolver(this.promise);

    // Note that the resolver has replaced the `then` method on
    // the promise. However the methods we set up in our constructor may have
    // been handed out already. Point our methods to the resolver as well.
    this._promiseThen = resolver.then;

    if(this.returnedPromise){
      // Forward the resolution of the returned promise to the resolver.
      this.returnedPromise.then(resolver.fulfill, resolver.reject, resolver.progress);
      // We can remove the reference, since all calls to `then`
      // will go to the resolver.
      this.returnedPromise = null;
    }

    this.resolver = resolver;

    // Add the callbacks to the resolver.
    return resolver.then(onFulfilled, onRejected, onProgress);
  }

  if(!this.pending && typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    // Return the original promise if we're no longer pending but no callbacks
    // are passed. If a progress callback happens to be passed it'll never
    // be called anyway.
    return this.promise;
  }

  // Set up a new notifier for the callbacks that is notified with the
  // appropriate state in a future turn.
  return enqueue(
    new Notifier(onFulfilled, onRejected),
    this.fulfilled,
    this.result,
    this.signalHandled
  ).promise;
};

Notifier.prototype.progress = function(value){
  if(this.onProgress){
    try{
      value = this.onProgress(value);
    }catch(error){
      if(error && error.name === STOP_PROGRESS_PROPAGATION){
        return;
      }
      return new Notifier().notifySync(false, error, Notifier.unhandledRejection(error)).promise;
    }
  }

  return when(value, this.resolver && this.resolver.progress, stopProgressPropagation);
};

Notifier.prototype.notify = function(fulfilled, result, signalHandled){
  // Ensures the notifier is notified in a future turn.
  return enqueue(this, fulfilled, result, signalHandled);
};

Notifier.prototype.notifySync = function(fulfilled, result, signalHandled){
  // Invoke the appropriate callback with the result received from the
  // resolver or promise.

  var callback = fulfilled ? this.onFulfilled : this.onRejected;
  var hasCallback = typeof callback === "function";
  var callbackReturnedPromise = false;

  if(hasCallback){
    if(signalHandled && !fulfilled){
      signalHandled();
    }

    try{
      result = callback(result);
      callbackReturnedPromise = isPromise(result);
      fulfilled = true;
    }catch(error){
      result = error;
      fulfilled = false;
      this.signalHandled = Notifier.unhandledRejection(error);
    }
  }else{
    this.signalHandled = signalHandled;
  }

  this.onFulfilled = this.onRejected = this.onProgress = null;

  // At this point `fulfilled` depends on the execution result of
  // the callback.
  this.pending = false;
  this.fulfilled = fulfilled;

  // *After* the callback is invoked, get a reference to a resolver for
  // the notifier's promise.
  var resolver = this.resolver;

  if(resolver){
    // If there is a resolver, make sure it's fulfilled or rejected
    // as appropriate.

    if(callbackReturnedPromise){
      try{
        result.then(resolver.fulfill, resolver.reject, resolver.progress);
      }catch(error){
        resolver.reject(error);
      }
    }else if(fulfilled){
      resolver.fulfill(result);
    }else{
      resolver.reject(result);
    }
  }else{
    // Store the execution result such that we can use it if `then` is
    // called on the notifier's promise.
    if(callbackReturnedPromise){
      this.returnedPromise = result;
    }else{
      this.result = result;
    }
  }

  return this;
};
