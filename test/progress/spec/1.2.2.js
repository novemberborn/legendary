"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;

var sentinel = {}; // we want to be equal to this

describe("1.2.2: This triggers all `onProgress` callbacks.", function(){
  specify("Multiple callbacks before progress is emitted", function(){
    var spy = sinon.spy();

    var resolver = pending();
    resolver.promise.then(null, null, spy);
    resolver.promise.then(null, null, spy);
    resolver.promise.then(null, null, spy);

    resolver.progress(sentinel).then(function(){
      assert.equal(spy.callCount, 3);
      assert(spy.alwaysCalledWithExactly(sentinel));
      done();
    });
  });

  specify("Multiple callbacks added between progress emissions", function(){
    var spy = sinon.spy();

    var resolver = pending();
    resolver.progress(sentinel).then(function(){
      resolver.promise.then(null, null, spy);
      resolver.promise.then(null, null, spy);
      resolver.promise.then(null, null, spy);

      resolver.progress(sentinel).then(function(){
        assert.equal(spy.callCount, 3);
        assert(spy.alwaysCalledWithExactly(sentinel));
        done();
      });
    });
  });

  specify("Multiple callbacks, one of which stops propagation", function(){
    var spy = sinon.spy();

    var resolver = pending();
    resolver.promise.then(null, null, spy);
    resolver.promise.then(null, null, function(){
      var error = new Error();
      error.name = "StopProgressPropagation";
      throw error;
    });
    resolver.promise.then(null, null, spy);

    resolver.progress(sentinel).then(function(){
      assert.equal(spy.callCount, 2);
      assert(spy.alwaysCalledWithExactly(sentinel));
      done();
    });
  });
});
