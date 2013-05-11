"use strict";

var assert = require("assert");

var Promise = require("../").Promise;
var NeverCancellable = require("../").NeverCancellable;

var adapter = require("./adapter");
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;
var pending = adapter.pending;

var sentinel = {};

function noop(){}

describe("Cancellation", function(){
  describe("Calling cancel()", function(){
    specify("No-op on a fulfilled promise", function(done){
      var promise = fulfilled(sentinel);
      promise.cancel();
      promise.then(function(value){
        assert.strictEqual(value, sentinel);
      }).then(done, done);
    });

    specify("No-op on a rejected promise", function(done){
      var promise = rejected(sentinel);
      promise.cancel();
      promise.then(null, function(reason){
        assert.strictEqual(reason, sentinel);
      }).then(done, done);
    });

    specify("Rejects a pending promise with a CancelError", function(done){
      var promise = pending().promise;
      promise.cancel();
      promise.then(null, function(reason){
        assert(reason instanceof Error);
        assert.equal(reason.name, "cancel");
      }).then(done, done);
    });
  });

  describe("onCancelled callback", function(){
    specify("Not called when cancelling a fulfilled promise", function(){
      var called = false;
      new Promise(function(resolve){
        resolve();
        return function(){ called = true; };
      }).cancel();
      assert.equal(called, false);
    });

    specify("Not called when cancelling a rejected promise", function(){
      var called = false;
      new Promise(function(_, reject){
        reject();
        return function(){ called = true; };
      }).cancel();
      assert.equal(called, false);
    });

    specify("Called when cancelling a pending promise", function(done){
      var called = false;
      var promise = new Promise(function(){
        return function(){ called = true; };
      });
      promise.cancel();
      assert.equal(called, true);
      promise.then(null, function(reason){
        assert.equal(reason.name, "cancel");
      }).then(done, done);
    });

    specify("Rejects pending promise when throwing", function(done){
      var promise = new Promise(function(){
        return function(){ throw sentinel; };
      });
      promise.cancel();
      promise.then(null, function(reason){
        assert.strictEqual(reason, sentinel);
      }).then(done, done);
    });
  });

  describe("Propagation", function(){
    specify("Cancel derived promise", function(done){
      var called = false;
      var promise = new Promise(function(){
        return function(){ called = true; };
      });
      var derived = promise.then(noop);
      derived.cancel();
      assert(called);
      promise.then(null, function(reason){
        assert.equal(reason.name, "cancel");
        return derived.then(null, function(reason){
          assert.equal(reason.name, "cancel");
        });
      }).then(done, done);
    });

    specify("Cancel enqueued callback execution", function(done){
      var called = false;
      var derived = fulfilled().then(function(){ called = true; });
      derived.cancel();
      derived.then(null, function(reason){
        assert(called);
        assert.equal(reason.name, "cancel");
      }).then(done, done);
    });

    specify("Cancel state-adoption of inner promise", function(done){
      var called = false;
      var inner = new Promise(function(){
        return function(){ called = true; };
      });
      var derived = fulfilled().then(function(){ return inner; });
      setImmediate(function(){
        derived.cancel();
        assert(called);
        inner.then(null, function(reason){
          assert.equal(reason.name, "cancel");
          return derived.then(null, function(reason){
            assert.equal(reason.name, "cancel");
          });
        }).then(done, done);
      });
    });

    specify("Ignore thenable assimilation when cancelled", function(done){
      var resolveThenable;
      var thenable = { then: function(resolvePromise){ resolveThenable = resolvePromise; } };
      var derived = fulfilled().then(function(){ return thenable; }).then(noop);
      setImmediate(function(){
        derived.cancel();
        resolveThenable();
        derived.then(null, function(reason){
          assert.equal(reason.name, "cancel");
        }).then(done, done);
      });
    });

    specify("Cancel state adoption when resolving with promise", function(done){
      var called = false;
      var inner = new Promise(function(){ return function(){ called = true; }; });
      var outer = new Promise(function(resolve){ resolve(inner); });
      outer.cancel();
      assert(called);
      outer.then(null, function(reason){
        assert.equal(reason.name, "cancel");
      }).then(done, done);
    });

    specify("Ignore thenable assimilation when resolving with thenable", function(done){
      var resolveThenable;
      var thenable = { then: function(resolvePromise){ resolveThenable = resolvePromise; } };
      var outer = new Promise(function(resolve){ resolve(thenable); });
      outer.cancel();
      resolveThenable();
      outer.then(null, function(reason){
        assert.equal(reason.name, "cancel");
      }).then(done, done);
    });
  });
});

describe("Promise#fork()", function(){
  specify("Creates a new promise that assumes the same state", function(done){
    var promise = fulfilled(sentinel);
    var forked = promise.fork();
    forked.then(function(result){
      assert.strictEqual(result, sentinel);
    }).then(done, done);
  });

  specify("Creates a new promise that does not propagate cancellation to its origin", function(done){
    var called = false;
    var promise = new Promise(function(){
      return function(){ called = true; };
    });
    var forked = promise.fork();
    forked.cancel();
    forked.then(null, function(reason){
      assert(!called);
      assert.equal(reason.name, "cancel");
    }).then(done, done);
  });
});

describe("Promise#uncancellable", function(){
  specify("Creates a new promise that assumes the same state", function(done){
    var promise = fulfilled(sentinel);
    var uncancellable = promise.uncancellable();
    uncancellable.then(function(result){
      assert.strictEqual(result, sentinel);
    }).then(done, done);
  });

  specify("Creates a new promise that cannot be cancelled", function(done){
    var resolvePromise;
    var promise = new Promise(function(resolve){
      resolvePromise = resolve;
    });
    var uncancellable = promise.uncancellable();
    uncancellable.cancel();
    resolvePromise(sentinel);
    uncancellable.then(function(value){
      assert.strictEqual(value, sentinel);
    }).then(done, done);
  });

  specify("Creates a new promise that does not propagate cancellation to its origin", function(done){
    var called = false;
    var resolvePromise;
    var promise = new Promise(function(resolve){
      resolvePromise = resolve;
      return function(){ called = true; };
    });

    var uncancellable = promise.uncancellable();
    uncancellable.cancel();
    resolvePromise(sentinel);

    uncancellable.then(function(){
      assert(!called);
    }).then(done, done);
  });

  specify("Creates a new promise, of which derived promises can be cancelled, without cancelling the uncancellable promise", function(done){
    var resolvePromise;
    var promise = new Promise(function(resolve){
      resolvePromise = resolve;
    });

    var uncancellable = promise.uncancellable();
    var derived = uncancellable.then(noop);

    derived.cancel();
    resolvePromise(sentinel);

    derived.then(null, function(reason){
      assert(reason.name, "cancel");
      console.log(uncancellable.inspectState())
      return uncancellable.then(function(value){
        assert.strictEqual(vale, sentinel);
      });
    }).then(done, done);
  });
});
