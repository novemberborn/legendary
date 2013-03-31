"use strict";

var assert = require("assert");

var adapter = global.adapter;
var pending = adapter.pending;
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;

var Promise = require("../").Promise;
var when = require("../").when;

var sentinel = {};

function makeThenable(value){
  return {
    then: function(resolve){
      setImmediate(resolve, value);
    }
  };
}

function makeRejectingThenable(value){
  return {
    then: function(_, reject){
      setImmediate(reject, value);
    }
  };
}

function square(value){
  return value * value;
}

describe("No callbacks are passed", function(){
  specify("If a promise was received, it's returned as-is.", function(){
    var promise = fulfilled(sentinel);
    var result = when(promise);
    assert.equal(promise, result);
  });

  specify("If a thenable was received, a promise adopting its state is returned.", function(done){
    var result = when(makeThenable(sentinel));
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, sentinel);
      done();
    });
  });

  specify("If a value was received, a promise fulfilled with that value is returned.", function(done){
    var result = when(sentinel);
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, sentinel);
      done();
    });
  });
});

describe("If (at least) the `onFulfilled` callback is passed:", function(){
  specify("If a pending promise was received, the result of passing the `onFulfilled` callback to its then() method is returned", function(done){
    var unsettled = pending();
    var result = when(unsettled.promise, square);
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, 4);
      done();
    });
    unsettled.fulfill(2);
  });

  specify("If a rejected promise was received, and no `onRejected` callback is passed, a promise adopting its state is returned instead.", function(done){
    var promise = rejected(sentinel);
    var result = when(promise, square);
    assert.notEqual(result, promise);
    result.then(null, function(value){
      assert.equal(value, sentinel);
      done();
    })
  });

  describe("If a fulfilled promise was received, its value is passed to the `onFulfilled` callback.", function(){
    specify("If the callback throws, a rejected promise is returned with the thrown error as rejection reason.", function(done){
      var result = when(fulfilled(sentinel), function(value){
        throw value;
      });
      assert(result instanceof Promise);
      result.then(null, function(value){
        assert.equal(value, sentinel);
        done();
      });
    });

    specify("If the callback returns a value, this result is returned as-is.", function(){
      var result = when(fulfilled(2), square);
      assert.equal(result, 4);
    });

    specify("If the callback returns a pending promise, this result is returned as-is.", function(){
      var promise = pending(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a rejected promise, this result is returned as-is.", function(){
      var promise = rejected(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a fulfilled promise, its value is returned instead.", function(){
      var promise = fulfilled(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, sentinel);
    });

    specify("If the callback returns a thenable, a promise adopting its state is returned instead.", function(done){
      var result = when(fulfilled(sentinel), function(value){
        return makeThenable(value);
      });
      assert(result instanceof Promise);
      result.then(function(value){
        assert.equal(value, sentinel);
        done();
      });
    });
  });

  specify("If a thenable was received, its state is adopted into a promise, and the result of passing the `onFulfilled` callback to the promise's then() method is returned.", function(done){
    var result = when(makeThenable(2), square);
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, 4);
      done();
    });
  });

  describe("If a non-thenable was received, it's passed to the `onFulfilled` callback.", function(){
    specify("If the callback throws, a rejected promise is returned with the thrown exception as rejection reason.", function(done){
      var result = when(true, function(){
        throw sentinel;
      });
      assert(result instanceof Promise);
      result.then(null, function(value){
        assert.equal(value, sentinel);
        done();
      });
    });

    specify("If the callback returns a value, this result is returned as-is.", function(){
      var result = when(true, function(){
        return sentinel;
      });
      assert.equal(result, sentinel);
    });

    specify("If the callback returns a pending promise, this result is returned as-is.", function(){
      var promise = pending(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a rejected promise, this result is returned as-is.", function(){
      var promise = rejected(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a fulfilled promise, its value is returned instead.", function(){
      var promise = fulfilled(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, sentinel);
    });

    specify("If the callback returns a thenable, a promise adopting its state is returned instead.", function(done){
      var result = when(true, function(){
        return makeThenable(sentinel);
      });
      assert(result instanceof Promise);
      result.then(function(value){
        assert.equal(value, sentinel);
        done();
      });
    });
  });
});

describe("If (at least) the `onRejected` callback is passed:", function(){
  specify("If a pending promise was received, the result of passing the `onRejected` callback to its then() method is returned", function(done){
    var unsettled = pending();
    var result = when(unsettled.promise, null, square);
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, 4);
      done();
    });
    unsettled.reject(2);
  });

  specify("If a fulfilled promise was received, and no `onFulfilled` callback is passed, its fulfillment value is returned.", function(){
    var result = when(fulfilled(sentinel), null, square);
    assert.equal(result, sentinel);
  });

  describe("If a rejected promise was received, its reason is passed to the `onRejected` callback.", function(){
    specify("If the callback throws, a rejected promise is returned with the thrown error as rejection reason.", function(done){
      var result = when(rejected(sentinel), null, function(value){
        throw value;
      });
      assert(result instanceof Promise);
      result.then(null, function(value){
        assert.equal(value, sentinel);
        done();
      });
    });

    specify("If the callback returns a value, this result is returned as-is.", function(){
      var result = when(rejected(2), null, square);
      assert.equal(result, 4);
    });

    specify("If the callback returns a pending promise, this result is returned as-is.", function(){
      var promise = pending(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a rejected promise, this result is returned as-is.", function(){
      var promise = rejected(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, promise);
    });

    specify("If the callback returns a fulfilled promise, its value is returned instead.", function(){
      var promise = fulfilled(sentinel);
      var result = when(fulfilled(sentinel), function(){
        return promise;
      });
      assert.equal(result, sentinel);
    });

    specify("If the callback returns a thenable, a promise adopting its state is returned instead.", function(done){
      var result = when(rejected(sentinel), null, function(value){
        return makeThenable(value);
      });
      assert(result instanceof Promise);
      result.then(function(value){
        assert.equal(value, sentinel);
        done();
      });
    });
  });

  specify("If a thenable was received, its state is adopted into a promise, and the result of passing the `onRejected` callback to the promise's then() method is returned.", function(done){
    var result = when(makeRejectingThenable(2), null, square);
    assert(result instanceof Promise);
    result.then(function(value){
      assert.equal(value, 4);
      done();
    });
  });
});

describe("If the `onFulfilled` callback is not passed, but `onRejected` callback is", function(){
  specify("If a non-thenable was received, it's returned as-is.", function(){
    var result = when(sentinel, null, square);
    assert.equal(result, sentinel);
  });
});
