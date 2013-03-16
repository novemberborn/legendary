"use strict";

var Notifier = require("./Notifier");

function when(value, onFulfilled, onRejected){
  var notifier = new Notifier();
  var promise = notifier.settle(true, value);

  if(notifier.extractedThenMethod === null){
    if(typeof onFulfilled === "function"){
      try{
        return onFulfilled(value);
      }catch(error){
        return new Notifier().settle(false, error);
      }
    }else if(arguments.length <= 1){
      return promise;
    }else{
      return value;
    }
  }

  return promise.then(onFulfilled, onRejected);
}
module.exports = when;
