"use strict";

var Resolver = function(promise){
  // Work around circular dependency between Resolver and Promise.
  Resolver = require("./Resolver");
  return new Resolver(promise);
};

function Promise(perform){
  // Creates a non-frozen promise without a functioning `then()` method.

  if(!(this instanceof Promise)){
    return new Promise(perform);
  }

  if(typeof perform === "function"){
    // Only create a resolver for this promise if the `perform` function
    // is provided. Else a promise is created without a resolver, so the
    // calling will have to override the `then()` method.
    perform(new Resolver(this));
  }
}

module.exports = Promise;

Promise.prototype.then = function(onFulfilled, onRejected){
  return new Promise();
};
