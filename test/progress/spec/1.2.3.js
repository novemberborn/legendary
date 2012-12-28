"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;

var sentinel = {}; // we want to be equal to this

describe("1.2.3: `progress` returns a promise.", function(){
  describe("1.2.3.1: If value was a promise that got rejected, the returned promise is rejected with the rejection reason of that promise.", function(){
    specify("Already rejected, without `onProgress` callbacks", function(done){
      pending().progress(rejected(sentinel)).then(null, function(error){
        assert.strictEqual(error, sentinel);
        done();
      });
    });

    specify("Already rejected, with `onProgress` callbacks", function(done){
      var resolver = pending();
      resolver.promise.then(null, null, function(){});
      resolver.progress(rejected(sentinel)).then(null, function(error){
        assert.strictEqual(error, sentinel);
        done();
      });
    });
  });

  describe("1.2.3.2: The returned promise is fulfilled with undefined once all progress callbacks are complete,", function(){
    specify("A promise is returned", function(){
      var promise = pending().progress();
      assert(typeof promise === "object" || typeof promise === "function");
      assert(typeof promise.then === "function");
    });

    specify("Without registered callbacks, the promise is fulfilled with `undefined`", function(done){
      pending().progress().then(function(value){
        assert.strictEqual(value, undefined);
        done();
      });
    });

    specify("With registered callbacks, the promise is fulfilled with `undefined`", function(done){
      var resolver = pending();
      resolver.promise.then(null, null, function(){});
      resolver.progress().then(function(value){
        assert.strictEqual(value, undefined);
        done();
      });
    });

    specify("For a fulfilled resolver, the promise is fulfilled with `undefined`", function(done){
      var resolver = pending();
      resolver.fulfill();
      resolver.progress().then(function(value){
        assert.strictEqual(value, undefined);
        done();
      });
    });

    specify("For a rejected resolver, the promise is fulfilled with `undefined`", function(done){
      var resolver = pending();
      resolver.reject();
      resolver.progress().then(function(value){
        assert.strictEqual(value, undefined);
        done();
      });
    });

    specify("With a promise as the progress value, and no callbacks.", function(done){
      pending().progress(fulfilled(sentinel)).then(function(value){
        assert.strictEqual(value, undefined);
        done();
      });
    });
  });

  describe("1.2.3.3: The returned promise is rejected with the first (non-`StopProgressPropagation`) exception thrown by the callbacks, if any.", function(){
    specify("Without propagation, race to the first error", function(done){
      var resolver = pending();

      resolver.promise.then(null, null, function(){
        var error = new Error();
        error.name = "StopProgressPropagation";
        throw error;
      });
      resolver.promise.then(null, null, function(){
        throw sentinel;
      });
      resolver.promise.then(null, null, function(){
        throw dummy;
      });

      resolver.progress().then(null, function(error){
        assert.strictEqual(error, sentinel);
        done();
      });
    });

    specify("Propagated errors bubble to the `.progress()` method", function(done){
      function propagate(value){
        return value;
      }

      var resolver = pending();

      resolver.promise.then(null, null, propagate).then(null, null, function(){
        var error = new Error();
        error.name = "StopProgressPropagation";
        throw error;
      });
      resolver.promise.then(null, null, propagate).then(null, null, function(){
        throw sentinel;
      });
      resolver.promise.then(null, null, propagate).then(null, null, function(){
        throw dummy;
      });

      resolver.progress().then(null, function(error){
        assert.strictEqual(error, sentinel);
        done();
      });
    });
  });
});
