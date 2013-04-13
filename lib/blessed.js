"use strict";

var legendary = require("./legendary");
var sameTurn = require("./trampoline").sameTurn;
var nextTurn = require("./trampoline").nextTurn;
var promises = require("./promises");
var ResolutionPropagator = require("./ResolutionPropagator");

function adoptState(value, asFulfilled, asRejected){
  if(!value || typeof value !== "object" && typeof value !== "function"){
    asFulfilled(value);
  }else if(value instanceof promises.Promise){
    var state = value.inspectState();
    if(state.isFulfilled){
      asFulfilled(state.value);
    }else if(state.isRejected){
      asRejected(state.reason);
    }else{
      value.then(function(value){
        adoptState(value, asFulfilled, asRejected);
      }, asRejected);
    }
  }else{
    var called = false;
    try{
      var then = value.then;
      if(typeof then !== "function"){
        asFulfilled(value);
      }else{
        then.call(value, function(value){
          if(!called){
            called = true;
            adoptState(value, asFulfilled, asRejected);
          }
        }, function(reason){
          if(!called){
            called = true;
            asRejected(reason);
          }
        });
      }
    }catch(exception){
      if(!called){
        called = true;
        asRejected(exception);
      }
    }
  }
}

function be(promise, resolver){
  var constructor = promise.constructor;
  var pending = [];
  var resolved = false, fulfilled = false;
  var result, signalHandled;

  function markFulfilled(value){
    fulfilled = true;
    result = value;
    var propagators = pending;
    pending = null;
    for(var i = 0, l = propagators.length; i < l; i++){
      sameTurn(propagators[i], false, value);
    }
  }

  function markRejected(reason){
    result = reason;
    signalHandled = legendary.unhandledRejection(reason);
    var propagators = pending;
    pending = null;
    for(var i = 0, l = propagators.length; i < l; i++){
      sameTurn(propagators[i], true, reason, signalHandled);
    }
  }

  function resolve(value){
    if(!resolved){
      resolved = true;
      adoptState(value, markFulfilled, markRejected);
    }
  }

  function reject(reason){
    if(!resolved){
      resolved = true;
      markRejected(reason);
    }
  }

  function then(onFulfilled, onRejected){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
      return promise;
    }

    var propagator = new ResolutionPropagator(constructor, [onFulfilled, onRejected]);
    if(pending){
      pending.push(propagator);
    }else{
      nextTurn(propagator, !fulfilled, result, signalHandled);
    }
    return propagator.promise();
  }

  function inspectState(){
    if(pending){
      return {
        isFulfilled: false,
        isRejected: false
      };
    }else if(fulfilled){
      return {
        isFulfilled: true,
        isRejected: false,
        value: result
      };
    }else{
      return {
        isFulfilled: false,
        isRejected: true,
        reason: result
      };
    }
  }

  promise.then = then;
  promise.inspectState = inspectState;

  try{
    resolver(resolve, reject);
  }catch(exception){
    reject(exception);
  }
}

exports.be = be;
