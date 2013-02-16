"use strict";

var assert = require("assert");

var adapter = global.adapter;
var pending = adapter.pending;
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;

var when = require("../../promise/when");
var isPromise = require("../../promise/is");
var Promise = require("../../promise/Promise");

var sentinel = {};

describe("when() taking a non-promise value", function(){
  specify("passes it to the `onFulfilled` callback", function(done){
    when(sentinel, function(value){
      assert.strictEqual(value, sentinel);
      done();
    });
  });

  specify("without other arguments returns a promise for the value", function(done){
    var promise = when(sentinel);
    assert(isPromise(promise));
    promise.then(function(value){
      assert.strictEqual(value, sentinel);
      done();
    });
  });

  specify("with only an `onRejected` callback returns the value", function(){
    assert.strictEqual(when(sentinel, null, function(){}), sentinel);
  });
});

describe("when() taking a foreign promise value", function(){
  specify("converts to a Legendary promise", function(){
    var foreign = { then: function(){} };
    var converted = when(foreign);
    assert(isPromise(converted));
    assert(converted instanceof Promise);
  });

  specify("hooks up `onFulfilled` and returns a promise for its return value", function(done){
    when({
      then: function(onFulfilled){
        setTimeout(function(){
          onFulfilled(2);
        }, 10);
      }
    }, function(value){
      return value * 2;
    }).then(function(value){
      assert.equal(value, 4);
      done();
    });
  });

  specify("hooks up `onRejected` and returns a promise for its return value", function(done){
    when({
      then: function(onFulfilled, onRejected){
        setTimeout(function(){
          onRejected(2);
        }, 10);
      }
    }, null, function(value){
      return value * 2;
    }).then(function(value){
      assert.equal(value, 4);
      done();
    });
  });
});

describe("when() taking a Legendary promise value", function(){
  specify("hooks up `onFulfilled` and returns a promise for its return value", function(done){
    when(fulfilled(2), function(value){
      return value * 2;
    }).then(function(value){
      assert.equal(value, 4);
      done();
    });
  });

  specify("hooks up `onRejected` and returns a promise for its return value", function(done){
    when(rejected(2), null, function(value){
      return value * 2;
    }).then(function(value){
      assert.equal(value, 4);
      done();
    });
  });
});
