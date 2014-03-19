'use strict';

var Promise = require('../').Promise;
var blessObject = require('../').blessObject;
var extendConstructor = require('../').extendConstructor;

function SubPromise(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubPromise)) {
    return new SubPromise(executor);
  }

  if (executor !== blessObject) {
    blessObject(this, executor, true);
  }
}
extendConstructor(SubPromise, Promise);

describe('Promise.all(input)', function() {
  it('returns a promise of the same subclass', function() {
    assert.instanceOf(SubPromise.all([]), SubPromise);
  });

  it('rejects with a TypeError for non-array-non-object inputs', function() {
    return assert.isRejected(Promise.all(false), TypeError);
  });

  describe('for array inputs', function() {
    it('resolves for an empty array', function() {
      return assert.eventually.deepEqual(Promise.all([]), []);
    });

    it('resolves for a values array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(Promise.all(arr), arr);
    });

    it('resolves with a different array instance', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.notStrictEqual(Promise.all(arr), arr);
    });

    it('resolves for a promises array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(
        Promise.all(arr.map(Promise.from)), arr);
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[0] = sentinels.foo;
      arr[2] = sentinels.bar;
      return assert.eventually.matchingSentinels(Promise.all(arr), arr);
    });

    it('rejects if any promise rejects', function() {
      var arr = [
        1,
        Promise.rejected(sentinels.bar),
        3
      ];
      return assert.isRejected(Promise.all(arr), sentinels.Sentinel);
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(
        Promise.all(Promise.from(arr)), arr);
    });
  });

  describe('for object inputs', function() {
    it('resolves for an empty object', function() {
      return assert.eventually.deepEqual(Promise.all({}), {});
    });

    it('resolves for a values object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(Promise.all(obj), obj);
    });

    it('resolves with a different object instance', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.notStrictEqual(Promise.all(obj), obj);
    });

    it('resolves for a promises object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.all({
          foo: Promise.from(obj.foo),
          bar: Promise.from(obj.bar),
          baz: Promise.from(obj.baz)
        }),
        obj);
    });

    it('rejects if any promise rejects', function() {
      var obj = {
        one: 1,
        two: Promise.rejected(sentinels.bar),
        three: 3
      };
      return assert.isRejected(Promise.all(obj), sentinels.Sentinel);
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.all(Promise.from(obj)), obj);
    });
  });
});

describe('Promise.any(input)', function() {
  it('returns a promise of the same subclass', function() {
    assert.instanceOf(SubPromise.any([]), SubPromise);
  });

  it('rejects with a TypeError for non-array-non-object inputs', function() {
    return assert.isRejected(Promise.any(false), TypeError);
  });

  describe('for array inputs', function() {
    it('resolves to undefined for an empty array', function() {
      return assert.eventually.isUndefined(Promise.any([]));
    });

    it('resolves for a values array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(Promise.any(arr), arr[0]);
    });

    it('resolves for a promises array', function() {
      var arr = [new Promise(function() {}), Promise.from(sentinels.bar)];
      return assert.eventually.matchingSentinels(
        Promise.any(arr), sentinels.bar);
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[1] = sentinels.bar;
      return assert.eventually.matchingSentinels(
        Promise.any(arr), sentinels.bar);
    });

    it('resolves even if a promise rejects', function() {
      var arr = [Promise.rejected(sentinels.foo), Promise.from(sentinels.bar)];
      return assert.eventually.matchingSentinels(
        Promise.any(arr), sentinels.bar);
    });

    it('rejects if all promises reject', function() {
      var arr = sentinels.stubArray();
      var result = Promise.any(arr.map(function(s) {
        return Promise.rejected(s);
      }));
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.matchingSentinels(reasons, arr);
        });
      });
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(
        Promise.any(Promise.from(arr)), arr[0]);
    });
  });

  describe('for object inputs', function() {
    it('resolves to undefined for an empty object', function() {
      return assert.eventually.isUndefined(Promise.any({}));
    });

    it('resolves for a values object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.any(obj), obj.foo);
    });

    it('resolves for a promises object', function() {
      var obj = {
        one: new Promise(function() {}),
        two: Promise.from(sentinels.bar)
      };
      return assert.eventually.matchingSentinels(
        Promise.any(obj), sentinels.bar);
    });

    it('resolves even if a promise rejects', function() {
      var obj = {
        one: Promise.rejected(sentinels.foo),
        two: Promise.from(sentinels.bar)
      };
      return assert.eventually.matchingSentinels(
        Promise.any(obj), sentinels.bar);
    });

    it('rejects if all promises reject', function() {
      var obj = sentinels.stubObject();
      var result = Promise.any({
        foo: Promise.rejected(obj.foo),
        bar: Promise.rejected(obj.bar),
        baz: Promise.rejected(obj.baz)
      });
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.matchingSentinels(reasons, obj);
        });
      });
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.any(Promise.from(obj)), obj.foo);
    });
  });
});

describe('Promise.some(input, winsRequired)', function() {
  it('returns a promise of the same subclass', function() {
    assert.instanceOf(SubPromise.some([], 1), SubPromise);
  });

  it('rejects with a TypeError for non-array-non-object inputs', function() {
    return assert.isRejected(Promise.some(false), TypeError);
  });

  describe('for array inputs', function() {
    it('resolves to undefined for an empty array', function() {
      return assert.eventually.isUndefined(Promise.some([], 1));
    });

    it('resolves for a values array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(
        Promise.some(arr, 2), arr.slice(0, 2));
    });

    it('resolves for a promises array', function() {
      var arr = [
        new Promise(function() {}),
        Promise.from(sentinels.bar),
        Promise.from(sentinels.baz)
      ];
      return assert.eventually.matchingSentinels(
        Promise.some(arr, 2), [sentinels.bar, sentinels.baz]);
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[1] = sentinels.bar;
      arr[3] = sentinels.baz;
      return assert.eventually.matchingSentinels(
        Promise.some(arr, 2), [sentinels.bar, sentinels.baz]);
    });

    it('resolves even if a promise rejects', function() {
      var arr = [
        Promise.rejected(sentinels.foo),
        Promise.from(sentinels.bar),
        sentinels.baz
      ];
      return assert.eventually.matchingSentinels(
        Promise.some(arr, 2), [sentinels.bar, sentinels.baz]);
    });

    it('rejects if too many promises reject', function() {
      var arr = [
        Promise.rejected(sentinels.foo),
        Promise.rejected(sentinels.bar),
        sentinels.baz
      ];
      var result = Promise.some(arr, 2);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.matchingSentinels(reasons, [sentinels.foo, sentinels.bar]);
        });
      });
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.stubArray();
      return assert.eventually.matchingSentinels(
        Promise.some(Promise.from(arr), 2), arr.slice(0, 2));
    });
  });

  describe('for object inputs', function() {
    it('resolves to undefined for an empty object', function() {
      return assert.eventually.isUndefined(Promise.some({}, 1));
    });

    it('resolves for a values object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.some(obj, 2), { foo: obj.foo, bar: obj.bar });
    });

    it('resolves for a promises object', function() {
      var obj = {
        one: new Promise(function() {}),
        two: Promise.from(sentinels.bar),
        three: Promise.from(sentinels.baz)
      };
      return assert.eventually.matchingSentinels(
          Promise.some(obj, 2), { two: sentinels.bar, three: sentinels.baz });
    });

    it('resolves even if a promise rejects', function() {
      var obj = {
        one: Promise.rejected(sentinels.foo),
        two: Promise.from(sentinels.bar),
        three: sentinels.baz
      };
      return assert.eventually.matchingSentinels(
        Promise.some(obj, 2), { two: sentinels.bar, three: sentinels.baz });
    });

    it('rejects if too many promises reject', function() {
      var obj = {
        one: Promise.rejected(sentinels.foo),
        two: Promise.rejected(sentinels.bar),
        three: sentinels.baz
      };
      var result = Promise.some(obj, 2);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.matchingSentinels(reasons, {
            one: sentinels.foo,
            two: sentinels.bar
          });
        });
      });
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.stubObject();
      return assert.eventually.matchingSentinels(
        Promise.some(Promise.from(obj), 2), { foo: obj.foo, bar: obj.bar });
    });
  });
});
