'use strict';

var Promise = require('../../').Promise;
var blessObject = require('../../').blessObject;

module.exports = function(chai, utils) {
  var Assertion = chai.Assertion;
  var assert = chai.assert;

  Assertion.addProperty('promiseConstructor', function() {
    if (utils.flag(this, 'negate')) {
      return this.assert(
        true,
        '', 'can’t negate promiseConstructor assertion'
      );
    }

    var Constructor = this._obj;
    new Assertion(
      function() {
        return new Constructor(null);
      },
      'called without an executor function'
    ).to.throw(TypeError);

    new Assertion(
      this._obj(function() {}),
      'called without new'
    ).to.be.instanceOf(this._obj);

    new Assertion(
      new this._obj(function() {}),
      'instantiated correctly'
    ).to.be.instanceOf(Promise);

    new Assertion(
      new this._obj(blessObject).then,
      'passed `blessObject` as the executor'
    ).to.equal(this._obj.prototype.then);
  });

  assert.isPromiseConstructor = function(actual, message) {
    return new Assertion(actual, message).to.be.a.promiseConstructor;
  };
};
