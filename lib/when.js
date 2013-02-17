"use strict";

var Promise = require("./Promise");
var Notifier = require("./Notifier");
var isThenable = require("./isThenable");

function when(valueOrThenable, onFulfilled, onRejected){
  if(!isThenable(valueOrThenable)){
    if(typeof onFulfilled === "function"){
      try{
        return onFulfilled(valueOrThenable);
      }catch(error){
        return new Notifier().notifySync(false, error).promise;
      }
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
