"use strict";

var assert = require("assert");

var adapter = global.adapter;
var pending = adapter.pending;

describe("1.1.1: `onProgress` is an optional argument.", function(){
  describe("1.1.1.1: If `onProgress` is not a function, it must be ignored.", function(){
    function testNonFunction(nonFunction, stringRepresentation){
      specify("`onProgress` is " + stringRepresentation, function(done){
        var resolver = pending();
        resolver.promise.then(null, null, nonFunction);
        resolver.progress().then(function(){
          assert(true);
          done();
        });
      });
    }

    testNonFunction(undefined, "`undefined`");
    testNonFunction(null, "`null`");
    testNonFunction(false, "`false`");
    testNonFunction(5, "`5`");
    testNonFunction({}, "an object");
  })
});
