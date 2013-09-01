'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

var guards = require('../lib/guards');
var Promise = require('../').Promise;

describe('guards', function() {
  describe('array()', function() {
    it('results in the default value for a non-array', function() {
      var result = guards.array(Promise.from('string'), sentinels.one);
      return assert.eventually.strictEqual(result, sentinels.one);
    });

    it('results in the default value for an empty array', function() {
      var result = guards.array(Promise.from([]), sentinels.one);
      return assert.eventually.strictEqual(result, sentinels.one);
    });

    it('invokes the next method for a non-empty array', function() {
        var arr = [true];
        var promise = Promise.from(arr);
        var next = sinon.stub();
        next.returns(sentinels.one);
        var result = guards.array(promise, null, next);
        return assert.eventually.strictEqual(result, sentinels.one).then(
            function() {
              assert.calledOnce(next);
              assert.calledWithExactly(next, arr, promise);
            });
      });
  });
});
