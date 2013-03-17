"use strict";

exports = module.exports = require("./lib/legendary");

exports.Promise = require("./lib/Promise");

exports.when = require("./lib/when");

var ResolutionPropagator = require("./lib/ResolutionPropagator");
exports.fulfilled = function(value){
  return new ResolutionPropagator().settle(true, value).promise;
};

exports.rejected = function(reason){
  return new ResolutionPropagator().settle(false, reason, exports.unhandledRejection(reason)).promise;
};
