"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;

var sentinel = {}; // we want to be equal to this

describe("1.2.1: The resolver has a `progress` method.", function(){
  describe("1.2.1.1: It accepts a single `value` argument, which is the progress value.", function(){
    specify("Method is present", function(){
      assert.equal(typeof pending().progress, "function");
    });
  });

  describe("1.2.1.2: If `value` is a promise, the progress value is the fulfillment value of the progress, and the `onProgress` callbacks are only triggered when the promise is fulfilled.", function(){
    specify("Fulfill later", function(done){
      var spy = sinon.spy();

      var resolver = pending();
      var valueResolver = pending();

      resolver.promise.then(null, null, spy);
      var emitted = resolver.progress(valueResolver.promise);

      assert(!spy.called);
      valueResolver.fulfill(sentinel);

      emitted.then(function(){
        assert(spy.calledWithExactly(sentinel));
        done();
      });
    });
  });
});
