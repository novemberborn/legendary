'use strict';

var assert = require('chai').assert;
var sentinels = require('./sentinels');

var TimeoutError = require('../').TimeoutError;

describe('TimeoutError', function() {
  it('extends Error', function() {
    assert.instanceOf(new TimeoutError(), Error);
  });

  it('has the expected shape', function() {
    var err = new TimeoutError();
    assert.propertyVal(err, 'name', 'timeout');
    assert.propertyVal(err, 'stack', null);
    assert.isUndefined(err.message);
  });

  describe('TimeoutError#inspect()', function() {
    it('returns "[TimeoutError]"', function() {
      assert.equal(new TimeoutError().inspect(), '[TimeoutError]');
    });
  });

  it('can be given a message', function() {
    assert.strictEqual(new TimeoutError(sentinels.one).message, sentinels.one);
  });
});
