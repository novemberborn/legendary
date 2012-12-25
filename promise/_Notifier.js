"use strict";

var isPromise = require("./is");
var Promise = require("./Promise");

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
  for(var i = 0, l = snapshot.length; i < l; i += 3){
    snapshot[i].notifySync(snapshot[i + 1], snapshot[i + 2]);
  }
}
function enqueue(notifier, fulfilled, result){
  if(!queue){
    process.nextTick(exec);
    queue = [notifier, fulfilled, result];
  }else{
    queue.push(notifier, fulfilled, result);
  }
  return notifier;
}

function Notifier(onFulfilled, onRejected){
  // Notifiers are created whenever a `then()` is called. They will invoke
  // the appropriate handler and manage the promise for the return value
  // of the handlers.

  this.onFulfilled = onFulfilled;
  this.onRejected = onRejected;

  this.pending = true;
  this.fulfilled = false;
  this.result = null;
  this.returnedPromise = null;

  var self = this;
  // The promise for the return value of the handlers.
  this.promise = new Promise();
  // Set up the `then()` method of the notifier.
  this.promise.then = function(onFulfilled, onRejected){
    return self._promiseThen(onFulfilled, onRejected);
  };
}

module.exports = Notifier;

Notifier.prototype._promiseThen = function(onFulfilled, onRejected){
  if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
    // Return the original promise if no handlers are passed.
    return this.promise;
  }

  if(this.pending && !this.resolver || this.returnedPromise){
    // We create a resolver for the notifier if `then()` is called while the
    // notifier is pending, or if a handler returned a promise.

    this.resolver = new Resolver(this.promise);
    // Note that from here on out, all calls to `then()` go to the resolver.
    this._promiseThen = this.resolver.then;

    if(this.returnedPromise){
      // Forward the resolution of the returned promise to the resolver.
      this.returnedPromise.then(this.resolver.fulfill, this.resolver.reject);
      // We can remove the reference, since all calls to `then()` will
      // go to the resolver.
      this.returnedPromise = null;
    }

    // Add the handlers to the resolver.
    return this.resolver.then(onFulfilled, onRejected);
  }

  // Set up a new notifier for the handlers that is notified with the
  // appropriate state in a future turn.
  return enqueue(
    new Notifier(onFulfilled, onRejected),
    this.fulfilled,
    this.result
  ).promise;
};

Notifier.prototype.notify = function(fulfilled, result){
  // Ensures the notifier is notified in a future turn.
  return enqueue(this, fulfilled, result);
};

Notifier.prototype.notifySync = function(fulfilled, result){
  // Invoke the appropriate handler with the result received from the
  // resolver or promise.

  var handler = fulfilled ? this.onFulfilled : this.onRejected;
  var hasHandler = typeof handler === "function";
  var handlerReturnedPromise = false;

  if(hasHandler){
    try{
      result = handler(result);
      handlerReturnedPromise = isPromise(result);
      fulfilled = true;
    }catch(error){
      result = error;
      fulfilled = false;
    }
  }

  this.onFulfilled = this.onRejected = null;

  // At this point `fulfilled` depends on the execution result of
  // the handler.
  this.pending = false;
  this.fulfilled = fulfilled;

  // *After* the handler is invoked, get a reference to a resolver for
  // the notifier's promise.
  var resolver = this.resolver;

  if(resolver){
    // If there is a resolver, make sure it's fulfilled or rejected
    // as appropriate.

    if(handlerReturnedPromise){
      try{
        result.then(resolver.fulfill, resolver.reject);
      }catch(error){
        resolver.reject(error);
      }
    }else if(fulfilled){
      resolver.fulfill(result);
    }else{
      resolver.reject(result);
    }
  }else{
    // Store the execution result such that we can use it if `then()` is
    // called on the notifier's promise.
    if(handlerReturnedPromise){
      this.returnedPromise = result;
    }else{
      this.result = result;
    }
  }

  return this;
};
