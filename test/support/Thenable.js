'use strict';

var blessObject = require('../../').blessObject;

function Thenable(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Thenable)) {
    return new Thenable(executor);
  }

  blessObject(this, executor, false);
}
module.exports = Thenable;

Thenable.defer = function() {
  var deferred = {};
  deferred.it = new Thenable(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
};
