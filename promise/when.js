"use strict";

var isThenable = require("./is");
var Promise = require("./Promise");

var Notifier = function(){
  // Work around circular dependency between Notifier and when.
  Notifier = require("./_Notifier");
  return new Notifier();
};

function when(valueOrThenable, onFulfilled, onRejected){
  if(!isThenable(valueOrThenable)){
    if(typeof onFulfilled === "function"){
      return onFulfilled(valueOrThenable);
    }else if(arguments.length <= 1){
      return new Notifier().notifySync(true, valueOrThenable).promise;
    }else{
      return valueOrThenable;
    }
  }

  return (
    valueOrThenable instanceof Promise ? valueOrThenable : Promise.from(valueOrThenable)
  ).then(onFulfilled, onRejected);
}
module.exports = when;
