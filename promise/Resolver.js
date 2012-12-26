"use strict";

var Notifier = require("./_Notifier");
var Promise = require("./Promise");

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

  resolver.fulfill = function(value){
    if(pending){
      fulfilled = true;
      result = value;

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notifySync(true, value);
      }
      pending = null;
    }
  };

  resolver.reject = function(reason){
    if(pending){
      result = reason;

      for(var i = 0, l = pending.length; i < l; i++){
        pending[i].notifySync(false, reason);
      }
      pending = null;
    }
  };

  function then(onFulfilled, onRejected){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
      // Return the original promise if no handlers are passed.
      return promise;
    }

    var notifier = new Notifier(onFulfilled, onRejected);
    if(pending){
      pending.push(notifier);
    }else{
      notifier.notify(fulfilled, result);
    }
    return notifier.promise;
  }
  resolver.then = then;
  promise.then = then;

}

module.exports = Resolver;

// Extend Resolver from Promise so it gets to reuse any sugar that's
// applied to the Promise prototype.
Resolver.prototype = new Promise();
Resolver.prototype.constructor = Resolver;
