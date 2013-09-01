'use strict';

exports.array = function(promise, defaultValue, next) {
  return promise.then(function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return defaultValue;
    }
    return next(arr, promise);
  });
};
