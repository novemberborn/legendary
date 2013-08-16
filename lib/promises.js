'use strict';

var legendary = require('./legendary');
var blessed = require('./blessed');
var ResolutionPropagator = require('./ResolutionPropagator');

function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }

  if (resolver !== blessed.be) {
    blessed.be(this, resolver, true);
  }
}

exports.Promise = Promise;

function prepRace(Constructor, retry, input, race) {
  if (Promise.isInstance(input)) {
    return input.then(function(input) {
      return retry.call(Constructor, input);
    });
  }

  var queue, result;
  var size = 0;
  if (Array.isArray(input)) {
    result = [];
    queue = input.map(function(item, index) {
      size++;
      return {
        value: item,
        key: index
      };
    });
  } else if (input && typeof input === 'object') {
    var keys = Object.keys(input);
    result = {};
    size = keys.length;
    queue = keys.map(function(key) {
      return {
        value: input[key],
        key: key
      };
    });
  } else {
    return Constructor.rejected(
        new TypeError('Can\'t get values of non-object or array'));
  }

  return new Constructor(function(resolve, reject) {
    race(queue, size, result, resolve, reject);
  });
}

function ttrue() {
  return true;
}

Promise.isInstance = function(x) {
  return x instanceof Promise;
};

Promise.from = function(value) {
  return new ResolutionPropagator(this, null, true).resolve(
      false, value
  ).promise();
};

Promise.rejected = function(reason) {
  return new ResolutionPropagator(this, null, true).resolve(
      true, reason, legendary.unhandledRejection(reason)
  ).promise();
};

Promise.all = function(input) {
  return prepRace(this, this.all, input,
      function(queue, winsRequired, result, resolve, lose) {
        if (winsRequired === 0) {
          return resolve(result);
        }

        function win(key, value) {
          result[key] = value;
          if (--winsRequired === 0) {
            resolve(result);
          }
        }

        queue.forEach(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(function(value) {
              win(descriptor.key, value);
            }, lose);
          } else {
            win(descriptor.key, descriptor.value);
          }
        });
      });
};

Promise.any = function(input) {
  return prepRace(this, this.any, input,
      function(queue, lossesNeeded, reasons, resolve, reject) {
        if (lossesNeeded === 0) {
          return resolve(undefined);
        }

        var isWon = false;
        function win(value) {
          if (!isWon) {
            isWon = true;
            resolve(value);
          }
        }
        function lose(key, reason) {
          reasons[key] = reason;
          if (!isWon && --lossesNeeded === 0) {
            reject(reasons);
          }
        }

        queue.some(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(win, function(reason) {
              lose(descriptor.key, reason);
            });
          } else {
            win(descriptor.value);
          }
          return isWon;
        });
      });
};

Promise.some = function(input, winsRequired) {
  return prepRace(
      this,
      function(input) {
        return this.some(input, winsRequired);
      },
      input,
      function(queue, queueSize, result, resolve, reject) {
        if (queueSize === 0) {
          return resolve(undefined);
        }

        var lossesNeeded = queueSize - winsRequired + 1;
        var reasons = Array.isArray(result) ? [] : {};
        function win(key, value) {
          result[key] = value;
          if (--winsRequired === 0) {
            if (Array.isArray(result)) {
              resolve(result.filter(ttrue));
            } else {
              resolve(result);
            }
          }
        }
        function lose(key, reason) {
          reasons[key] = reason;
          if (--lossesNeeded === 0) {
            if (Array.isArray(reasons)) {
              reject(reasons.filter(ttrue));
            } else {
              reject(reasons);
            }
          }
        }

        queue.some(function(descriptor) {
          if (Promise.isInstance(descriptor.value)) {
            descriptor.value.then(function(value) {
              win(descriptor.key, value);
            }, function(reason) {
              lose(descriptor.key, reason);
            });
          } else {
            win(descriptor.key, descriptor.value);
          }
          return winsRequired === 0;
        });
      });
};

Promise.prototype.then = function(/*onFulfilled, onRejected*/) {
  return this.constructor(function() {});
};

Promise.prototype.inspectState = function() {
  return {
    isFulfilled: false,
    isRejected: false
  };
};

Promise.prototype.cancel = function() {};

// For `fork()` and `uncancellable()` we resolve the propagator with a
// thenable. Passing a promise would lead it to attempt to adopt state
// synchonously, and propagate cancellation to the current promise.
Promise.prototype.fork = function() {
  return new ResolutionPropagator(this.constructor, null, true).resolve(
    false, { then: this.then }
  ).promise();
};

Promise.prototype.uncancellable = function() {
  return new ResolutionPropagator(this.constructor, null, false).resolve(
    false, { then: this.then }
  ).promise();
};

Promise.prototype.to = function(constructor) {
  return constructor.from(this);
};

Promise.prototype.trace = function(/*label, meta*/) {
  return this;
};

Promise.prototype.traceFulfilled = function(/*label, meta*/) {
  return this;
};

Promise.prototype.traceRejected = function(/*label, meta*/) {
  return this;
};
