"use strict";

var Notifier = require("./_Notifier");
var Promise = require("./Promise");
var isPromise = require("./is");
var when = require("./when");

function undef(){
  return undefined;
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
  // Callback for when unhandled rejections are handled.
  var signalHandled;

  function fulfill(value){
    if(pending){
      fulfilled = true;
      result = value;

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notify(true, value);
      }
      pending = null;
    }
  }

  function reject(reason){
    if(pending){
      result = reason;
      signalHandled = Notifier.unhandledRejection(reason);

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notify(false, reason, signalHandled);
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

  resolver.fulfill = fulfill;
  resolver.reject = reject;

  resolver.then = then;
  promise.then = then;
}

module.exports = Resolver;

// Extend Resolver from Promise so it gets to reuse any sugar that's
// applied to the Promise prototype.
Resolver.prototype = new Promise();
Resolver.prototype.constructor = Resolver;
