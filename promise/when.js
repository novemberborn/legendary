"use strict";

var isPromise = require("./is");
var Promise = require("./Promise");

var Notifier = function(){
  // Work around circular dependency between Notifier and when.
  Notifier = require("./_Notifier");
  return new Notifier();
};

function when(valueOrPromise, onFulfilled, onRejected){
  var receivedPromise = isPromise(valueOrPromise);
  var nativePromise = receivedPromise && valueOrPromise instanceof Promise;

  if(!receivedPromise){
    if(typeof onFulfilled === "function"){
      return onFulfilled(valueOrPromise);
    }else if(arguments.length <= 1){
      return new Notifier().notifySync(true, valueOrPromise).promise;
    }else{
      return valueOrPromise;
    }
  }else if(!nativePromise){
    valueOrPromise = new Promise(function(resolver){
      valueOrPromise.then(resolver.fulfill, resolver.reject);
    });
  }

  return valueOrPromise.then(onFulfilled, onRejected);
}
module.exports = when;
