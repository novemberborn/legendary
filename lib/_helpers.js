'use strict';

var promises = require('./promises');

exports.makeUndefined = function() {
  return undefined;
};

exports.makeTrue = function() {
  return true;
};

exports.strictlyTrue = function(x) {
  return x === true;
};

exports.identity = function(x) {
  return x;
};

exports.negateIdentity = function(x) {
  return !x;
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
    if (promises.Promise.isInstance(result)) {
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
    if (promises.Promise.isInstance(result)) {
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
    if (promises.Promise.isInstance(result)) {
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
