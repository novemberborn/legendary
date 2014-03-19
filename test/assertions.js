'use strict';

var expect = require('chai').expect;

var Promise = require('../').Promise;
var blessObject = require('../').blessObject;
var extendConstructor = require('../').extendConstructor;

describe('Assertion extensions:', function() {
  describe('.to.not.be.a.promiseConstructor', function() {
    it('always fails', function() {
      assert.throws(function() {
        return expect(function() {}).to.not.be.a.promiseConstructor;
      }, 'can’t negate promiseConstructor assertion');
    });
  });

  describe('.to.be.a.promiseConstructor', function() {
    it('passes with Promise', function() {
      assert.ok(expect(Promise).to.be.a.promiseConstructor);
    });

    it('fails if constructor does not complain about missing executor',
      function() {
        assert.throws(
          function() {
            return expect(function() {}).to.be.a.promiseConstructor;
          },
          /called without an executor function: expected .+ to throw TypeError/
        );
      });

    it('fails if constructor cannot be called without new',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }
            }
            return expect(Constructor).to.be.a.promiseConstructor;
          },
          /called without new: expected .+ to be an instance of Constructor/);
      });

    it('fails if constructor does not extend Promise',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }

              if (!(this instanceof Constructor)) {
                return new Constructor(executor);
              }
            }
            return expect(Constructor).to.be.a.promiseConstructor;
          },
          /instantiated correctly: expected .+ to be an instance of Promise/
        );
      });

    it('fails if constructor blesses the instance even when ' +
      '`blesObject` is passed',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }

              if (!(this instanceof Constructor)) {
                return new Constructor(executor);
              }

              blessObject(this);
            }
            extendConstructor(Constructor);
            return expect(Constructor).to.be.a.promiseConstructor;
          },
          /passed `blessObject` as the executor: expected .+ to equal .+/
        );
      });
  });

  describe('assert.isPromiseConstructor()', function() {
    it('passes with Promise', function() {
      assert.ok(assert.isPromiseConstructor(Promise));
    });

    it('fails if constructor does not complain about missing executor',
      function() {
        assert.throws(
          function() {
            return assert.isPromiseConstructor(function() {});
          },
          /called without an executor function: expected .+ to throw TypeError/
        );
      });

    it('fails if constructor cannot be called without new',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }
            }
            return assert.isPromiseConstructor(Constructor);
          },
          /called without new: expected .+ to be an instance of Constructor/);
      });

    it('fails if constructor does not extend Promise',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }

              if (!(this instanceof Constructor)) {
                return new Constructor(executor);
              }
            }
            return assert.isPromiseConstructor(Constructor);
          },
          /instantiated correctly: expected .+ to be an instance of Promise/
        );
      });

    it('fails if constructor blesses the instance even when ' +
      '`blesObject` is passed',
      function() {
        assert.throws(
          function() {
            function Constructor(executor) {
              if (typeof executor !== 'function') {
                throw new TypeError();
              }

              if (!(this instanceof Constructor)) {
                return new Constructor(executor);
              }

              blessObject(this);
            }
            extendConstructor(Constructor);
            return assert.isPromiseConstructor(Constructor);
          },
          /passed `blessObject` as the executor: expected .+ to equal .+/
        );
      });
  });
});
