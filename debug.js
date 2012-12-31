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
  ["fulfilled", "rejected", "progress"].forEach(function(type){
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
