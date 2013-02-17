"use strict";

var Promise = require("./promise/Promise");
var Notifier = require("./promise/_Notifier");
var when = require("./promise/when");

exports.Promise = Promise;

exports.fulfilled = function(value){
  return new Notifier().notifySync(true, value).promise;
};

exports.rejected = function(reason){
  return new Notifier().notifySync(false, reason, Notifier.unhandledRejection(reason)).promise;
};

exports.when = when;
