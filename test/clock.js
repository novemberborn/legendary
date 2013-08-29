'use strict';

var sinon = require('sinon');

sinon.clock.setImmediate = function(callback) {
  return this.setTimeout(callback, -Infinity);
};

sinon.clock.clearImmediate = function(timerId) {
  return this.clearTimeout(timerId);
};

sinon.clock.immediate = function() {
  var timer = this.firstTimerInRange(-Infinity, -Infinity);

  var firstException;
  while (timer) {
    if (this.timeouts[timer.id]) {
        try {
          this.callTimer(timer);
        } catch (e) {
          firstException = firstException || e;
        }
    }

    timer = this.firstTimerInRange(-Infinity, -Infinity);
  }

  if (firstException) {
    throw firstException;
  }
};

var methods = [
  'Date', 'setTimeout', 'setInterval', 'setImmediate', 'clearImmediate',
  'clearTimeout', 'clearInterval'
];

exports.tick = null;
exports.immediate = null;

exports.use = function() {
  var clock;
  beforeEach(function() {
    clock = sinon.useFakeTimers.apply(sinon, methods);
    exports.tick = function(ms) {
      clock.immediate();
      clock.tick(ms);
    };
    exports.immediate = function() {
      clock.immediate();
    };
  });
  afterEach(function() {
    clock.restore();
    exports.tick = null;
    exports.immediate = null;
  });
};
