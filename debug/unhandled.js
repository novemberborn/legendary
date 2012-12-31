"use strict";

var EventEmitter = require("events").EventEmitter;
var Notifier = require("../promise/_Notifier");

var emitter = module.exports = new EventEmitter();

Notifier.unhandledRejection = function(reason){
  var tracked = {
    reason: reason,
    timestamp: Date.now()
  };

  emitter.emit("unhandled", tracked);

  return function(){
    if(tracked){
      tracked.handled = true;
      emitter.emit("handled", tracked);
      tracked = null;
    }
  };
};
