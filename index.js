"use strict";

exports = module.exports = require("./lib/legendary");

exports.Promise = require("./lib/promises").Promise;
exports.when = require("./lib/when");

var ResolutionPropagator = require("./lib/ResolutionPropagator");
exports.rejected = function(reason){
  return ResolutionPropagator.rejected(reason, exports.unhandledRejection(reason));
};
