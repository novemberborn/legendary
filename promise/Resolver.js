"use strict";

var Notifier = require("./_Notifier");
var Promise = require("./Promise");
var isPromise = require("./is");
var when = require("./when");

function undef(){
  return undefined;
}

function emitProgress(pending, value){
  if(!pending || !pending.length){
    if(isPromise(value)){
      return when(value, undef);
    }

    return new Notifier().notifySync(true, undefined).promise;
  }

  return when(value, function(value){
    return new Promise(function(resolver){
      var remaining = pending.length;
      function notified(){
        if(--remaining === 0){
          resolver.fulfill(undefined);
        }
      }

      for(var i = 0, l = remaining; i < l; i++){
        var result = pending[i].progress(value);
        if(result){
          result.then(notified, resolver.reject);
        }else{
          remaining--;
        }
      }

      if(remaining === 0){
        resolver.fulfill(undefined);
      }
    });
  });
}

function Resolver(promise){
  // Sets up a resolver for the promise.

  var resolver = this;
  resolver.promise = promise;

  // List of pending notifiers. It's truthiness indicates the resolver
  // is still pending.
  var pending = [];
  // Whether the resolver was fulfilled. The resolver was rejected if it's
  // not `pending` and not `fulfilled`.
  var fulfilled = false;
  // Stores the fulfillment value or rejection reason.
  var result;

  function fulfill(value){
    if(pending){
      fulfilled = true;
      result = value;

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notifySync(true, value);
      }
      pending = null;
    }
  }

  function reject(reason){
    if(pending){
      result = reason;

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notifySync(false, reason);
      }
      pending = null;
    }
  }

  function progress(value){
    return emitProgress(pending, value);
  }

  function then(onFulfilled, onRejected, onProgress){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function" && typeof onProgress !== "function"){
      // Return the original promise if no handlers are passed.
      return promise;
    }

    var notifier = new Notifier(onFulfilled, onRejected, onProgress);
    if(pending){
      pending.push(notifier);
    }else{
      notifier.notify(fulfilled, result);
    }
    return notifier.promise;
  }

  resolver.fulfill = fulfill;
  resolver.reject = reject;
  resolver.progress = progress;

  resolver.then = then;
  promise.then = then;
}

module.exports = Resolver;

// Extend Resolver from Promise so it gets to reuse any sugar that's
// applied to the Promise prototype.
Resolver.prototype = new Promise();
Resolver.prototype.constructor = Resolver;
