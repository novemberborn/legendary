'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

var util = require('../lib/private/util');
var Promise = require('../').Promise;

describe('util.guardArray()', function() {
  it('results in the default value for a non-array', function() {
    var result = util.guardArray(Promise.from('string'), sentinels.one);
    return assert.eventually.strictEqual(result, sentinels.one);
  });

  it('results in the default value for an empty array', function() {
    var result = util.guardArray(Promise.from([]), sentinels.one);
    return assert.eventually.strictEqual(result, sentinels.one);
  });

  it('invokes the next method for a non-empty array', function() {
      var arr = [true];
      var promise = Promise.from(arr);
      var next = sinon.stub();
      next.returns(sentinels.one);
      var result = util.guardArray(promise, null, next);
      return assert.eventually.strictEqual(result, sentinels.one).then(
          function() {
            assert.calledOnce(next);
            assert.calledWithExactly(next, arr, promise);
          });
    });
});
