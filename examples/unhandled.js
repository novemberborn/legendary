"use strict";

require("../debug").logUnhandled(1000);

var legendary = require("../");

// A handled rejection
legendary.Promise(function(resolver){
  resolver.reject(new Error("should've been handled"));
}).then(null, function(){});

// An unhandled rejection
legendary.Promise(function(resolver){
  resolver.reject(new Error("unhandled"));
});
