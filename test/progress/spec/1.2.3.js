"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;

var sentinel = {}; // we want to be equal to this

describe("1.2.3: It returns a promise which is fulfilled with `undefined` once all progress callbacks are complete.", function(){
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
});
