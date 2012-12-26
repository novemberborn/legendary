"use strict";

var assert = require("assert");
var sinon = require("sinon");

var adapter = global.adapter;
var pending = adapter.pending;

var sentinel = {}; // we want to be equal to this

describe("1.2.1: The resolver has a `.progress(value)` method.", function(){
  specify("Method is present", function(){
    assert.equal(typeof pending().progress, "function");
  });
});
