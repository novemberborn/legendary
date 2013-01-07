"use strict";

var Resolver = function(promise){
  // Work around circular dependency between Resolver and Promise.
  Resolver = require("./Resolver");
  return new Resolver(promise);
};

function Promise(start){
  // Creates a non-frozen promise without a functioning `then` method.

  if(!(this instanceof Promise)){
    return new Promise(start);
  }

  if(typeof start === "function"){
    // Only create a resolver for this promise if the `start` function
    // is provided. Otherwise a promise is created without a resolver,
    // leaving it to the caller to override the `then` method.
    start(new Resolver(this));
  }
}

module.exports = Promise;

Promise.prototype.then = function(onFulfilled, onRejected, onProgress){
  return new Promise();
};

Promise.prototype.trace = function(label, meta){
  return this;
};

Promise.prototype.traceFulfilled = function(label, meta){
  return this;
};

Promise.prototype.traceRejected = function(label, meta){
  return this;
};

Promise.prototype.traceProgress = function(label, meta){
  return this;
};
