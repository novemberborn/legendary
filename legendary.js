"use strict";

var Notifier = require("./promise/_Notifier");
var Resolver = require("./promise/Resolver");
var Promise = require("./promise/Promise");
var when = require("./promise/when");

exports.Resolver = Resolver;
exports.Promise = Promise;

exports.defer = function(){
  return new Resolver(new Promise());
};

exports.fulfilled = function(value){
  return new Notifier().notifySync(true, value).promise;
};

exports.rejected = function(reason){
  return new Notifier().notifySync(false, reason).promise;
};

exports.when = when;
