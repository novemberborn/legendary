"use strict";

var assert = require("assert");
var sinon = require("sinon");

var Promise = require("../").Promise;

var sentinel = {};

describe("Promise.from()", function(){
  specify("returns a promise that is an instance of Promise", function(){
    var promise = Promise.from(sentinel);
    assert(promise instanceof Promise);
  });

  specify("when passed a non-thenable-non-promise-value, returns a new promise that is fulfilled with this value", function(done){
    var promise = Promise.from(sentinel);
    promise.then(function(value){
      assert.deepEqual(value, sentinel);
      done();
    });
  });

  specify("when passed a promise, returns a new promise that adopts its state", function(done){
    var promise = Promise.from(new Promise(function(resolve){
      setImmediate(resolve, sentinel);
    }));
    promise.then(function(value){
      assert.deepEqual(value, sentinel);
      done();
    });
  });
});

describe("Promise.rejected()", function(){
  specify("returns a promise that is an instance of Promise", function(){
    var promise = Promise.rejected(sentinel);
    assert(promise instanceof Promise);
  });

  specify("returns a rejected promise", function(done){
    var promise = Promise.rejected(sentinel);
    promise.then(done, function(value){
      assert.deepEqual(value, sentinel);
      done();
    });
  });
});

describe("Promise#to()", function(){
  specify("Creates a new promise by calling 'from' on the passed constructor", function(){
    var constructor = function(){};
    constructor.from = function(){
      return sentinel;
    };
    var spy = sinon.spy(constructor, "from");

    var promise = Promise.from();
    var result = promise.to(constructor);

    assert.deepEqual(result, sentinel);
    assert(spy.calledOnce);
    assert(spy.calledWithExactly(promise));
  });
});
