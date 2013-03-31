"use strict";

var legendary = require("../");

exports.pending = function(){
  var deferred = {};
  deferred.promise = new legendary.Promise(function(resolve, reject){
    deferred.fulfill = resolve;
    deferred.reject = reject;
  });
  return deferred;
};
exports.fulfilled = legendary.when;
exports.rejected = legendary.rejected;
