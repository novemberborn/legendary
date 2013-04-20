"use strict";

var blessed = require("./blessed");

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

Promise.prototype.then = function(/*onFulfilled, onRejected*/){
  return this.constructor(function(){});
};

Promise.prototype.inspectState = function(){
  return {
    isFulfilled: false,
    isRejected: false
  };
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
