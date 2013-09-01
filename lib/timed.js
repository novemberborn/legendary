'use strict';

var promises = require('./promises');
var TimeoutError = require('./TimeoutError');

function timer(ms, func) {
  var ref;
  if (ms) {
    ref = setTimeout(func, ms);
  } else {
    ref = setImmediate(func);
  }
  return function abortTimer() {
    if (ms) {
      clearTimeout(ref);
    } else {
      clearImmediate(ref);
    }
  };
}

function delay(milliseconds, promiseOrValue) {
  if (promises.Promise.isInstance(promiseOrValue)) {
    return promiseOrValue.then(function(value) {
      return delay(milliseconds, value);
    });
  }

  return new promises.Promise(function(resolve) {
    return timer(milliseconds, function() {
      resolve(promiseOrValue);
    });
  });
}

exports.delay = delay;

function timeout(milliseconds, promiseOrValue) {
  return new promises.Promise(function(resolve, reject) {
    if (!promises.Promise.isInstance(promiseOrValue)) {
      resolve(promiseOrValue);
    }

    var abort = timer(milliseconds, function() {
      reject(new TimeoutError('Timed out after ' + milliseconds + 'ms'));
    });

    promiseOrValue.then(resolve, reject);
    promiseOrValue.ensure(abort);

    return abort;
  });
}

exports.timeout = timeout;
