"use strict";

var assert = require("assert");

var adapter = global.adapter;

var promise = adapter.pending().promise;

describe("Tracing is a no-op, returning the same promise", function(){
  specify("trace()", function(){
    assert.strictEqual(promise.trace(), promise);
  });

  specify("traceFulfilled()", function(){
    assert.strictEqual(promise.traceFulfilled(), promise);
  });

  specify("traceRejected()", function(){
    assert.strictEqual(promise.traceRejected(), promise);
  });
});
