'use strict';

var sinon = require('sinon');

var util = require('../lib/private/util');
var Promise = require('../').Promise;

describe('util.guardArray()', function() {
  it('results in the default value for a non-array', function() {
    var result = util.guardArray(Promise.from('string'), sentinels.foo);
    return assert.eventually.matchingSentinels(result, sentinels.foo);
  });

  it('results in the default value for an empty array', function() {
    var result = util.guardArray(Promise.from([]), sentinels.foo);
    return assert.eventually.matchingSentinels(result, sentinels.foo);
  });

  it('invokes the next method for a non-empty array', function() {
      var arr = [true];
      var promise = Promise.from(arr);
      var next = sinon.stub();
      next.returns(sentinels.foo);
      var result = util.guardArray(promise, null, next);
      return assert.eventually.matchingSentinels(result, sentinels.foo).then(
          function() {
            assert.calledOnce(next);
            assert.calledWithExactly(next, arr, promise);
          });
    });
});
