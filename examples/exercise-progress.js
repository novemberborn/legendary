"use strict";

var legendary = require("../");

var deferred = legendary.defer();

var stopPropagationError = new Error();
stopPropagationError.name = "StopProgressPropagation";

deferred.then(null, null, function(value){
  console.log("handled", value);
  return value * 2;
}).then(function(){
  // add another promise that itself doesn't have an onProgress handler
}).then(null, null, function(doubleValue){
  console.log("doubled", doubleValue);
  throw stopPropagationError;
}).then(null, null, function(){
  console.log("NEVER CALLED");
});

function emitter(value){
  return function(){
    deferred.progress(value).then(function(){
      console.log("emitted", value);
    }, function(reason){
      console.log("error", value, reason);
    });
  };
}

setTimeout(emitter(1), 1000);
setTimeout(emitter(2), 2000);

setTimeout(function(){
  deferred.then(null, null, function(){
    throw new Error("Oops");
  });

  emitter(3)();
}, 3000);

setTimeout(function(){
  deferred.fulfill();
  console.log("no 'handled' after");
  emitter(4)();
}, 4000);
