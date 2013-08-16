'use strict';

var assert = require('chai').assert;

var blessed = require('../lib/blessed');

exports.testConstructor = function(Constructor) {
  it('throws a TypeError if not called with a resolver function', function() {
    assert.throws(function() {
      /*jshint nonew:false*/
      new Constructor(null);
    }, TypeError);
  });

  it('returns an instance when called without new', function() {
    /*jshint newcap:false*/
    assert.instanceOf(Constructor(function() {}), Constructor);
  });

  it('isn’t blessed when `blessed.be` is used as the resolver', function() {
    var instance = new Constructor(blessed.be);
    assert.strictEqual(instance.then, Constructor.prototype.then);
  });
};
