'use strict';

var legendary = require('./legendary');
var blessed = require('./blessed');
var ResolutionPropagator = require('./ResolutionPropagator');
var CancellationError = require('./CancellationError');

var slice = [].slice;

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

function invokeCancel(promise) {
  promise.cancel();
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

Promise.join = function() {
  return this.all(slice.call(arguments));
};

Promise.prototype.then = function(/*onFulfilled, onRejected*/) {
  return new Promise(function() {});
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

Promise.prototype.yield = function(value) {
  return this.then(function() {
    return value;
  });
};

Promise.prototype.yieldReason = function(reason) {
  return this.then(function() {
    throw reason;
  });
};

Promise.prototype.otherwise = function(onRejected) {
  return this.then(null, onRejected);
};

Promise.prototype.ensure = function(onFulfilledOrRejected) {
  var handler = function() {
    return onFulfilledOrRejected();
  };

  return this.then(handler, handler).yield(this);
};

Promise.prototype.tap = function(onFulfilledSideEffect, onRejectedSideEffect) {
  return this.then(onFulfilledSideEffect, onRejectedSideEffect).yield(this);
};

Promise.prototype.spread = function(variadicOnFulfilled) {
  return this.constructor.all(this).then(function(args) {
    if (!Array.isArray(args)) {
      throw new TypeError('Can\'t spread non-array value');
    }

    return variadicOnFulfilled.apply(undefined, args);
  });
};

Promise.prototype.nodeify = function(callback) {
  if (typeof callback !== 'function') {
    return this;
  }

  this.then(function(value) {
    callback(null, value);
  }, callback);
};

Promise.prototype.cancelAfter = function(milliseconds) {
  setTimeout(this.cancel, milliseconds);
  return this;
};

Promise.prototype.alsoCancels = function(other) {
  var promises;
  if (Promise.isInstance(other)) {
    promises = [other];
  } else if (Array.isArray(other)) {
    promises = other.filter(Promise.isInstance);
  } else if (other && typeof other === 'object') {
    promises = Object.keys(other).reduce(function(promises, key) {
      var promiseOrValue = other[key];
      if (Promise.isInstance(promiseOrValue)) {
        promises.push(promiseOrValue);
      }
      return promises;
    }, []);
  }

  if (promises && promises.length > 0) {
    this.then(null, function(reason) {
      if (reason instanceof CancellationError) {
        promises.forEach(invokeCancel);
      }
    });
  }

  return this;
};

Promise.prototype.send = function(methodName) {
  var args = slice.call(arguments, 1);
  return this.then(function(value) {
    return value[methodName].apply(value, args);
  });
};

Promise.prototype.prop = function(name) {
  return this.then(function(value) {
    return value[name];
  });
};
