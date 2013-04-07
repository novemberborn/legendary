"use strict";

var assert = require("assert");

var blessed = require("../lib/blessed");
var Promise = require("../").Promise;

function SubPromise(resolver){
  if(typeof resolver !== "function"){
    throw new TypeError();
  }

  if(!(this instanceof SubPromise)){
    return new SubPromise(resolver);
  }

  blessed.be(this, resolver);
}
SubPromise.prototype = new Promise(blessed.be);
SubPromise.prototype.constructor = SubPromise;

function defer(constructor){
  var deferred = {};
  deferred.promise = constructor(function(resolve, reject){
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

function identity(x){
  return x;
}

var sentinel = {};

describe("Subclassing", function(){
  describe("1: then() on subclassed promise always returns a promise of the same subclass", function(){
    specify("1.1: Called on promise itself", function(){
      var promise = defer(SubPromise).promise;
      var result = promise.then(identity);
      assert(result instanceof SubPromise);
    });

    specify("1.2: Called on initialized propagator", function(){
      // Note that the propagator transitions to the delegated state, which
      // should create a subclassed promise. `then()` is called on *that*
      // promise, so this is the same behavior as (1.1).
      var promise = defer(SubPromise).promise;
      var propagator = promise.then(identity);
      var result = propagator.then(identity);
      assert(result instanceof SubPromise);
    });

    describe("1.3: Called on fulfilled propagator", function(){
      specify("1.3.1: With transform to the same value", function(done){
        var dfd = defer(SubPromise);
        dfd.resolve(sentinel);
        dfd.promise.then(function(){
          // Note that the original promise is now fulfilled. Invoking `then()`
          // creates a propagator that is fulfilled because the transform returns
          // a value. When `then()` is called on this new propagator it should
          // return a subclassed promise.
          var propagator = dfd.promise.then(identity);
          setImmediate(function(){
            var result = propagator.then(identity);
            assert(result instanceof SubPromise);
            done();
          });
        });
      });

      specify("1.3.2: With transform to a non-subclassed promise", function(done){
        var dfd = defer(SubPromise);
        dfd.resolve(sentinel);
        dfd.promise.then(function(){
          // Note that the original promise is now fulfilled. Invoking `then()`
          // creates a propagator that is delegated because the transform returns
          // a pending promise. When `then()` is called on this new propagator it
          // should return a subclassed promise.
          var propagator = dfd.promise.then(function(){
            return defer(Promise).promise;
          });
          setImmediate(function(){
            var result = propagator.then(identity);
            assert(result instanceof SubPromise);
            done();
          });
        });
      });
    });
  });

  describe("2: resolve() synchronously adopts the state of any promise", function(){
    specify("2.1: resolving a subclassed promise with another of the same subclass", function(){
      var dfd1 = defer(SubPromise);
      var dfd2 = defer(SubPromise);
      dfd2.resolve(sentinel);
      dfd1.resolve(dfd2.promise);
      var state = dfd1.promise.inspectState();
      assert(state.isFulfilled);
      assert.deepEqual(state.value, sentinel);
    });

    specify("2.1: resolving a subclassed promise with another, not subclassed", function(){
      var dfd1 = defer(SubPromise);
      var dfd2 = defer(Promise);
      dfd2.resolve(sentinel);
      dfd1.resolve(dfd2.promise);
      var state = dfd1.promise.inspectState();
      assert(state.isFulfilled);
      assert.deepEqual(state.value, sentinel);
    });
  });
});
