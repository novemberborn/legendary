"use strict";

var legendary = require("./legendary");
var sameTurn = require("./_scheduler").sameTurn;
var nextTurn = require("./_scheduler").nextTurn;
var promises = require("./promises");
var ResolutionPropagator = require("./ResolutionPropagator");

function be(promise, resolver){
  var pending = [];
  var resolved = false, fulfilled = false;
  var result, signalHandled;

  function adoptState(value){
    if(!value || typeof value !== "object" && typeof value !== "function"){
      adoptFulfilledState(value);
      return;
    }

    if(value instanceof promises.Promise){
      var state = value.inspectState();
      if(state.isFulfilled){
        adoptFulfilledState(state.value);
      }else if(state.isRejected){
        adoptRejectedState(state.reason);
      }else{
        value.then(adoptState, adoptRejectedState);
      }
      return;
    }

    var then;
    try{
      then = value.then;
    }catch(exception){
      adoptRejectedState(exception);
      return;
    }

    if(typeof then !== "function"){
      adoptFulfilledState(value);
      return;
    }

    var called = false;
    try{
      then.call(value, function(value){
        if(!called){
          called = true;
          adoptState(value);
        }
      }, function(reason){
        if(!called){
          called = true;
          adoptRejectedState(reason);
        }
      });
    }catch(exception){
      if(!called){
        called = true;
        adoptRejectedState(exception);
      }
    }
  }

  function adoptFulfilledState(value){
    fulfilled = true;
    result = value;
    var propagators = pending;
    pending = null;
    for(var i = 0, l = propagators.length; i < l; i++){
      sameTurn(propagators[i], false, value);
    }
  }

  function adoptRejectedState(reason){
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
      adoptState(value);
    }
  }

  function reject(reason){
    if(!resolved){
      resolved = true;
      adoptRejectedState(reason);
    }
  }

  function then(onFulfilled, onRejected){
    if(typeof onFulfilled !== "function" && typeof onRejected !== "function"){
      return promise;
    }

    var propagator = new ResolutionPropagator([onFulfilled, onRejected]);
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
