"use strict";

var EventEmitter = require("events").EventEmitter;
var Notifier = require("../promise/_Notifier");

var emitter = module.exports = new EventEmitter();
var list = [];

Notifier.unhandledRejection = function(reason){
  var tracked = {
    reason: reason,
    timestamp: Date.now()
  };

  list.push(tracked);
  emitter.emit("unhandled", tracked);

  return function(){
    if(tracked){
      tracked.handled = true;
      list.splice(list.indexOf(tracked), 1);
      emitter.emit("handled", tracked);
      tracked = null;
    }
  };
};
