'use strict';

var Promise = require('../../').Promise;

exports.deferred = function() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
};
exports.resolved = function(value) {
  return Promise.from(value);
};
exports.rejected = function(reason) {
  return Promise.rejected(reason);
};
