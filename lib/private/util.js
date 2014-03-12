'use strict';

var promise = require('../promise');

exports.makeUndefined = function() {
  return undefined;
};

exports.makeTrue = function() {
  return true;
};

exports.strictlyTrue = function(x) {
  return x === true;
};

var SKIP_MARKER = exports.SKIP_MARKER = {};

exports.skipIfFalsy = function(iterator) {
  return function(item) {
    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(result) {
        return result ? item : SKIP_MARKER;
      });
    } else {
      return result ? item : SKIP_MARKER;
    }
  };
};

exports.skipIfTruthy = function(iterator) {
  return function(item) {
    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(result) {
        return result ? SKIP_MARKER : item;
      });
    } else {
      return result ? SKIP_MARKER : item;
    }
  };
};

function testNotSkipped(item) {
  return item !== SKIP_MARKER;
}

exports.removeSkipped = function(arr) {
  return arr.filter(testNotSkipped);
};

exports.flatten = function(arr) {
  return Array.prototype.concat.apply([], arr);
};

function Shortcut(value) {
  this.value = value;
}
exports.Shortcut = Shortcut;

var TRUE_SHORTCUT = exports.TRUE_SHORTCUT = new Shortcut(true);
var FALSE_SHORTCUT = exports.FALSE_SHORTCUT = new Shortcut(false);

exports.shortcutDetect = function(iterator) {
  return function(item) {
    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(result) {
        if (result) {
          throw new Shortcut(item);
        }
      });
    } else if (result) {
      throw new Shortcut(item);
    }
  };
};

exports.shortcutSome = function(iterator) {
  return function(item) {
    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(result) {
        if (result) {
          throw TRUE_SHORTCUT;
        }
      });
    } else if (result) {
      throw TRUE_SHORTCUT;
    }
  };
};

exports.shortcutNotEvery = function(iterator) {
  return function(item) {
    var result = iterator(item);
    if (promise.Promise.isInstance(result)) {
      return result.then(function(result) {
        if (!result) {
          throw FALSE_SHORTCUT;
        }
      });
    } else if (!result) {
      throw FALSE_SHORTCUT;
    }
  };
};

exports.extractShortcutValue = function(reason) {
  if (reason instanceof Shortcut) {
    return reason.value;
  }
  throw reason;
};

exports.guardArray = function(promise, defaultValue, next) {
  return promise.then(function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return defaultValue;
    }
    return next(arr, promise);
  });
};
