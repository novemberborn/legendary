'use strict';

var blessed = require('./blessed');
var promises = require('./promises');
var guards = require('./guards');
var helpers = require('./_helpers');
var trampoline = require('./trampoline');

function Collection(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof Collection)) {
    return new Collection(resolver);
  }

  if (resolver !== blessed.be) {
    blessed.be(this, resolver, true);
  }
}

exports.Collection = blessed.extended(Collection);

function nextTurn(func, value) {
  trampoline.nextTurn({
    resolve: function() {
      func(value);
    }
  });
}

function produceValue(promiseOrValue) {
  if (promises.Promise.isInstance(promiseOrValue)) {
    return promiseOrValue.inspectState().value;
  } else {
    return promiseOrValue;
  }
}

function invokeCancel(promiseOrValue) {
  if (promises.Promise.isInstance(promiseOrValue)) {
    promiseOrValue.cancel();
  }
}

function filterTruthy(arr) {
  return arr.filter(helpers.identity);
}

function filterOutTruthy(arr) {
  return arr.filter(helpers.negateIdentity);
}

function prepForSort(iterator) {
  var index = 0;
  return function(item) {
    var wrapped = { sourceIndex: index++ };

    var result = iterator(item);
    if (promises.Promise.isInstance(result)) {
      return result.then(function(sortValue) {
        wrapped.sortValue = sortValue;
        return wrapped;
      });
    } else {
      wrapped.sortValue = result;
      return wrapped;
    }
  };
}

function sortInstructions(a, b) {
  return a.sortValue < b.sortValue ? -1 : 1;
}

// All other iterator methods build on mapLimited, hence it being first in
// this file.
Collection.prototype.mapLimited = function(maxConcurrent, iterator) {
  return guards.array(this, [], function(arr) {
    if (typeof maxConcurrent !== 'number') {
      throw new TypeError('Missing max concurrency number.');
    }
    if (typeof iterator !== 'function') {
      throw new TypeError('Missing iterator function.');
    }

    return new Collection(function(resolve, reject) {
      var index = 0, stopAt = arr.length;
      var acc = new Array(stopAt);

      var reachedEnd = false;
      var running = 0;
      function oneCompleted() {
        running--;
        runConcurrent();
      }
      function oneFailed(reason) {
        reachedEnd = true;
        running = -1;
        reject(reason);
      }
      function runConcurrent() {
        if (reachedEnd) {
          if (running === 0) {
            resolve(acc.map(produceValue));
          }
          return;
        }

        if (running >= maxConcurrent) {
          return;
        }

        try {
          running++;
          var result = acc[index] = iterator(arr[index]);
          index++;
          reachedEnd = reachedEnd || index === stopAt;
          if (promises.Promise.isInstance(result)) {
            result.then(oneCompleted, oneFailed);
          } else {
            oneCompleted();
          }
          runConcurrent();
        } catch (error) {
          oneFailed(error);
        }
      }

      nextTurn(runConcurrent);

      return function() {
        reachedEnd = true;
        running = -1;
        acc.forEach(invokeCancel);
      };
    });
  });
};

Collection.prototype.each = function(iterator) {
  return this.mapLimited(Infinity, iterator)
      .then(helpers.makeUndefined).to(promises.Promise);
};

Collection.prototype.eachSeries = function(iterator) {
  return this.mapLimited(1, iterator)
      .then(helpers.makeUndefined).to(promises.Promise);
};

Collection.prototype.eachLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, iterator)
      .then(helpers.makeUndefined).to(promises.Promise);
};

Collection.prototype.map = function(iterator) {
  return this.mapLimited(Infinity, iterator);
};

Collection.prototype.mapSeries = function(iterator) {
  return this.mapLimited(1, iterator);
};

Collection.prototype.filter = function(iterator) {
  return this.mapLimited(Infinity, iterator).then(filterTruthy);
};

Collection.prototype.filterSeries = function(iterator) {
  return this.mapLimited(1, iterator).then(filterTruthy);
};

Collection.prototype.filterLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, iterator).then(filterTruthy);
};

Collection.prototype.filterOut = function(iterator) {
  return this.mapLimited(Infinity, iterator).then(filterOutTruthy);
};

Collection.prototype.filterOutSeries = function(iterator) {
  return this.mapLimited(1, iterator).then(filterOutTruthy);
};

Collection.prototype.filterOutLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, iterator).then(filterOutTruthy);
};

Collection.prototype.concat = function(iterator) {
  return this.mapLimited(Infinity, iterator).then(helpers.flatten);
};

Collection.prototype.concatSeries = function(iterator) {
  return this.mapLimited(1, iterator).then(helpers.flatten);
};

Collection.prototype.concatLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, iterator).then(helpers.flatten);
};

Collection.prototype.foldl = function(memo, iterator) {
  return guards.array(this, memo, function(arr) {
    return new promises.Promise(function(resolve, reject) {
      var index = 0, stopAt = arr.length;
      var reachedEnd = false;
      var currentPromise;

      function applyIterator(value) {
        if (reachedEnd) {
          resolve(value);
          return;
        }

        try {
          value = iterator(value, arr[index]);
          index++;
          reachedEnd = reachedEnd || index === stopAt;
          if (promises.Promise.isInstance(value)) {
            currentPromise = value;
            value.then(applyIterator, reject);
          } else {
            applyIterator(value);
          }
        } catch (error) {
          reject(error);
        }
      }

      if (promises.Promise.isInstance(memo)) {
        currentPromise = memo.then(applyIterator, reject);
      } else {
        nextTurn(applyIterator, memo);
      }

      return function() {
        if (currentPromise) {
          currentPromise.cancel();
        }
        reachedEnd = true;
      };
    });
  }).to(promises.Promise);
};

Collection.prototype.foldr = function(memo, iterator) {
  return guards.array(this, memo, function(arr) {
    return new promises.Promise(function(resolve, reject) {
      var index = arr.length - 1;
      var reachedEnd = false;
      var currentPromise;

      function applyIterator(value) {
        if (reachedEnd) {
          resolve(value);
          return;
        }
        try {
          value = iterator(value, arr[index]);
          index--;
          reachedEnd = reachedEnd || index < 0;
          if (promises.Promise.isInstance(value)) {
            currentPromise = value;
            value.then(applyIterator, reject);
          } else {
            applyIterator(value);
          }
        } catch (error) {
          reject(error);
        }
      }

      if (promises.Promise.isInstance(memo)) {
        currentPromise = memo.then(applyIterator, reject);
      } else {
        nextTurn(applyIterator, memo);
      }

      return function() {
        if (currentPromise) {
          currentPromise.cancel();
        }
        reachedEnd = true;
      };
    });
  }).to(promises.Promise);
};

Collection.prototype.detectLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, helpers.shortcutDetect(iterator))
      .to(promises.Promise)
      .then(helpers.makeUndefined, helpers.extractShortcutValue);
};

Collection.prototype.detect = function(iterator) {
  return this.detectLimited(Infinity, iterator);
};

Collection.prototype.detectSeries = function(iterator) {
  return this.detectLimited(1, iterator);
};

Collection.prototype.someLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, helpers.shortcutSome(iterator))
      .to(promises.Promise)
      .then(helpers.strictlyTrue, helpers.extractShortcutValue);
};

Collection.prototype.some = function(iterator) {
  return this.someLimited(Infinity, iterator);
};

Collection.prototype.someSeries = function(iterator) {
  return this.someLimited(1, iterator);
};

Collection.prototype.everyLimited = function(maxConcurrent, iterator) {
  return this.mapLimited(maxConcurrent, helpers.shortcutNotEvery(iterator))
      .to(promises.Promise)
      .then(helpers.makeTrue, helpers.extractShortcutValue);
};

Collection.prototype.every = function(iterator) {
  return this.everyLimited(Infinity, iterator);
};

Collection.prototype.everySeries = function(iterator) {
  return this.everyLimited(1, iterator);
};

Collection.prototype.sortByLimited = function(maxConcurrent, iterator) {
  var self = this;
  return self.then(function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return arr;
    }

    return self.mapLimited(maxConcurrent, prepForSort(iterator))
        .then(function(instructions) {
          instructions.sort(sortInstructions);
          var copy = arr.slice();
          for (var i = 0, l = arr.length; i < l; i++) {
            arr[i] = copy[instructions[i].sourceIndex];
          }
          return arr;
        });
  });
};

Collection.prototype.sortBy = function(iterator) {
  return this.sortByLimited(Infinity, iterator);
};

Collection.prototype.sortBySeries = function(iterator) {
  return this.sortByLimited(1, iterator);
};
