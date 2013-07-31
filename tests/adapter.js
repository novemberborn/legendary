'use strict';

var Promise = require('../').Promise;

exports.pending = function() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.fulfill = resolve;
    deferred.reject = reject;
  });
  return deferred;
};
exports.fulfilled = function(value) {
  return Promise.from(value);
};
exports.rejected = function(reason) {
  return Promise.rejected(reason);
};
