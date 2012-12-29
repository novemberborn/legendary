"use strict";

var Resolver = function(promise){
  // Work around circular dependency between Resolver and Promise.
  Resolver = require("./Resolver");
  return new Resolver(promise);
};

function Promise(perform){
  // Creates a non-frozen promise without a functioning `then` method.

  if(!(this instanceof Promise)){
    return new Promise(perform);
  }

  if(typeof perform === "function"){
    // Only create a resolver for this promise if the `perform` function
    // is provided. Otherwise a promise is created without a resolver,
    // leaving it to the caller to override the `then` method.
    perform(new Resolver(this));
  }
}

module.exports = Promise;

Promise.prototype.then = function(onFulfilled, onRejected, onProgress){
  return new Promise();
};
