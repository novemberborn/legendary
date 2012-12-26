"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;

var sentinel = {}; // we want to be equal to this
var dummy = {};

describe("1.2.4: It returns a promise which is rejected with the first (non-`StopProgressPropagation`) exception thrown by the callbacks, if any.", function(){
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
