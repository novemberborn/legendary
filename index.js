"use strict";

exports = module.exports = require("./lib/legendary");

exports.Promise = require("./lib/Promise");

exports.when = require("./lib/when");

var Notifier = require("./lib/Notifier");
exports.fulfilled = function(value){
  return new Notifier().settle(true, value);
};

exports.rejected = function(reason){
  return new Notifier().settle(false, reason, exports.unhandledRejection(reason));
};
