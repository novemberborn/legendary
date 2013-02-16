"use strict";

var argv = require("optimist").argv;
var inspect = require("eyes").inspector(
  JSON.parse(argv["legendary-inspect-opts"] || "{}")
);

exports.enableTracer = function(){
  return require("./debug/tracer");
};

exports.logTraces = function(){
  var tracer = exports.enableTracer();
  ["fulfilled", "rejected"].forEach(function(type){
    tracer.on(type, function(value, label, meta){
      if(label){
        label += " (" + type + ")";
      }else{
        label = type;
      }

      inspect(value, label);
      if(typeof meta !== "undefined"){
        inspect(meta, label + " (meta)");
      }
    });
  });
};

if(argv["legendary-tracer"] === true){
  exports.logTraces();
}

exports.catchUnhandled = function(){
  return require("./debug/unhandled");
};

exports.logUnhandled = function(delay){
  if(!delay){
    exports.catchUnhandled().on("unhandled", function(tracked){
      inspect(tracked.reason, "unhandled rejection");
    });
  }else{
    exports.catchUnhandled().on("unhandled", function(tracked){
      setTimeout(function(){
        if(!tracked.handled){
          inspect(tracked.reason, "unhandled rejection @ " + new Date(tracked.timestamp).toISOString());
        }
      }, delay);
    });
  }
};

if(argv.hasOwnProperty("legendary-unhandled")){
  exports.logUnhandled(typeof argv["legendary-unhandled"] === "number" ? argv["legendary-unhandled"] : 1000);
}
