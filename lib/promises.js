"use strict";

var legendary = require("./legendary");
var blessed = require("./blessed");
var ResolutionPropagator = require("./ResolutionPropagator");

function Promise(resolver){
  if(typeof resolver !== "function"){
    throw new TypeError();
  }

  if(!(this instanceof Promise)){
    return new Promise(resolver);
  }

  if(resolver !== blessed.be){
    blessed.be(this, resolver);
  }
}

exports.Promise = Promise;

Promise.from = function(value){
  return new ResolutionPropagator(this).resolve(false, value).promise();
};

Promise.rejected = function(reason){
  return new ResolutionPropagator(this).resolve(
    true, reason, legendary.unhandledRejection(reason)
  ).promise();
};

Promise.prototype.then = function(/*onFulfilled, onRejected*/){
  return this.constructor(function(){});
};

Promise.prototype.inspectState = function(){
  return {
    isFulfilled: false,
    isRejected: false
  };
};

Promise.prototype.to = function(constructor){
  return constructor.from(this);
};

Promise.prototype.trace = function(/*label, meta*/){
  return this;
};

Promise.prototype.traceFulfilled = function(/*label, meta*/){
  return this;
};

Promise.prototype.traceRejected = function(/*label, meta*/){
  return this;
};
