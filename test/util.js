'use strict';

var assert = require('chai').assert;

var blessed = require('../lib/private/blessed');

exports.testConstructor = function(Constructor) {
  it('throws a TypeError if not called with an executor function', function() {
    assert.throws(function() {
      /*jshint nonew:false*/
      new Constructor(null);
    }, TypeError);
  });

  it('returns an instance when called without new', function() {
    /*jshint newcap:false*/
    assert.instanceOf(Constructor(function() {}), Constructor);
  });

  it('isn’t blessed when `blessed.be` is used as the executor', function() {
    var instance = new Constructor(blessed.be);
    assert.strictEqual(instance.then, Constructor.prototype.then);
  });
};
