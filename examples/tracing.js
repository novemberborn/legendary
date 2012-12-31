"use strict";

require("../debug").logTraces();

var legendary = require("../");

legendary.fulfilled(42).trace("already fulfilled", { foo: "bar" });

legendary.rejected(new Error()).traceRejected();

legendary.Promise(function(resolver){
  setTimeout(function(){
    resolver.progress(3);
  }, 0);
  setTimeout(function(){
    resolver.progress(2);
  }, 2000);
  setTimeout(function(){
    resolver.progress(1);
  }, 3000);
  setTimeout(function(){
    resolver.fulfill(0);
  }, 4000);
}).traceProgress("countdown").traceFulfilled("countdown");
