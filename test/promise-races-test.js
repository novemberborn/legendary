'use strict';

var assert = require('chai').assert;
var sentinels = require('./sentinels');

var Promise = require('../').Promise;

var main = require('../');
function SubPromise(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError();
  }

  if (!(this instanceof SubPromise)) {
    return new SubPromise(executor);
  }

  if (executor !== main.blessObject) {
    main.blessObject(this, executor, true);
  }
}
main.extendConstructor(SubPromise, Promise);

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
      var arr = sentinels.arr();
      return assert.eventually.deepEqual(Promise.all(arr), arr);
    });

    it('resolves with a different array instance', function() {
      var arr = sentinels.arr();
      return assert.eventually.notStrictEqual(Promise.all(arr), arr);
    });

    it('resolves for a promises array', function() {
      var arr = sentinels.arr(function(s) { return Promise.from(s); });
      return assert.eventually.deepEqual(Promise.all(arr), sentinels.arr());
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[0] = sentinels.one;
      arr[2] = sentinels.two;
      return assert.eventually.deepEqual(Promise.all(arr), arr);
    });

    it('rejects if any promise rejects', function() {
      var arr = [
        1,
        Promise.rejected(sentinels.two),
        3
      ];
      return assert.isRejected(Promise.all(arr), sentinels.Sentinel);
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.arr();
      return assert.eventually.deepEqual(Promise.all(Promise.from(arr)), arr);
    });
  });

  describe('for object inputs', function() {
    it('resolves for an empty object', function() {
      return assert.eventually.deepEqual(Promise.all({}), {});
    });

    it('resolves for a values object', function() {
      var obj = sentinels.obj();
      return assert.eventually.deepEqual(Promise.all(obj), obj);
    });

    it('resolves with a different object instance', function() {
      var obj = sentinels.obj();
      return assert.eventually.notStrictEqual(Promise.all(obj), obj);
    });

    it('resolves for a promises object', function() {
      var obj = sentinels.obj(function(s) { return Promise.from(s); });
      return assert.eventually.deepEqual(Promise.all(obj), sentinels.obj());
    });

    it('rejects if any promise rejects', function() {
      var obj = {
        one: 1,
        two: Promise.rejected(sentinels.two),
        three: 3
      };
      return assert.isRejected(Promise.all(obj), sentinels.Sentinel);
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.obj();
      return assert.eventually.deepEqual(Promise.all(Promise.from(obj)), obj);
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
      var arr = sentinels.arr();
      return Promise.any(arr).then(function(result) {
        assert.include(arr, result);
      });
    });

    it('resolves for a promises array', function() {
      var arr = [new Promise(function() {}), Promise.from(sentinels.two)];
      return assert.eventually.strictEqual(Promise.any(arr), sentinels.two);
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[1] = sentinels.two;
      return assert.eventually.strictEqual(Promise.any(arr), sentinels.two);
    });

    it('resolves even if a promise rejects', function() {
      var arr = [Promise.rejected(sentinels.one), Promise.from(sentinels.two)];
      return assert.eventually.strictEqual(Promise.any(arr), sentinels.two);
    });

    it('rejects if all promises reject', function() {
      var arr = sentinels.arr(function(s) { return Promise.rejected(s); });
      var result = Promise.any(arr);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.deepEqual(reasons, sentinels.arr());
        });
      });
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.arr();
      return Promise.any(Promise.from(arr)).then(function(result) {
        assert.include(arr, result);
      });
    });
  });

  describe('for object inputs', function() {
    it('resolves to undefined for an empty object', function() {
      return assert.eventually.isUndefined(Promise.any({}));
    });

    it('resolves for a values object', function() {
      var obj = sentinels.obj();
      var values = Object.keys(obj).map(function(key) {
        return obj[key];
      });
      return Promise.any(obj).then(function(result) {
        assert.include(values, result);
      });
    });

    it('resolves for a promises object', function() {
      var obj = {
        one: new Promise(function() {}),
        two: Promise.from(sentinels.two)
      };
      return assert.eventually.strictEqual(Promise.any(obj), sentinels.two);
    });

    it('resolves even if a promise rejects', function() {
      var obj = {
        one: Promise.rejected(sentinels.one),
        two: Promise.from(sentinels.two)
      };
      return assert.eventually.strictEqual(Promise.any(obj), sentinels.two);
    });

    it('rejects if all promises reject', function() {
      var obj = sentinels.obj(function(s) { return Promise.rejected(s); });
      var result = Promise.any(obj);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.deepEqual(reasons, sentinels.obj());
        });
      });
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.obj();
      var values = Object.keys(obj).map(function(key) {
        return obj[key];
      });
      return Promise.any(Promise.from(obj)).then(function(result) {
        assert.include(values, result);
      });
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
      var arr = sentinels.arr();
      return Promise.some(arr, 2).then(function(result) {
        assert.includeMembers(arr, result);
      });
    });

    it('resolves for a promises array', function() {
      var arr = [
        new Promise(function() {}),
        Promise.from(sentinels.two),
        Promise.from(sentinels.three)
      ];
      return assert.eventually.deepEqual(Promise.some(arr, 2),
          [sentinels.two, sentinels.three]);
    });

    it('resolves for a sparse array', function() {
      var arr = [];
      arr[1] = sentinels.two;
      arr[3] = sentinels.three;
      return assert.eventually.deepEqual(Promise.some(arr, 2),
          [sentinels.two, sentinels.three]);
    });

    it('resolves even if a promise rejects', function() {
      var arr = [
        Promise.rejected(sentinels.one),
        Promise.from(sentinels.two),
        sentinels.three
      ];
      return assert.eventually.deepEqual(Promise.some(arr, 2),
          [sentinels.two, sentinels.three]);
    });

    it('rejects if too many promises reject', function() {
      var arr = [
        Promise.rejected(sentinels.one),
        Promise.rejected(sentinels.two),
        sentinels.three
      ];
      var result = Promise.some(arr, 2);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.deepEqual(reasons, [sentinels.one, sentinels.two]);
        });
      });
    });

    it('accepts a promise for an array', function() {
      var arr = sentinels.arr();
      return Promise.some(Promise.from(arr), 2).then(function(result) {
        assert.includeMembers(arr, result);
      });
    });
  });

  describe('for object inputs', function() {
    function assertProperSubset(value, superset) {
      assert.includeMembers(Object.keys(superset), Object.keys(value));
      Object.keys(value).forEach(function(key) {
        assert.strictEqual(value[key], superset[key]);
      });
    }

    it('resolves to undefined for an empty object', function() {
      return assert.eventually.isUndefined(Promise.some({}, 1));
    });

    it('resolves for a values object', function() {
      var obj = sentinels.obj();
      return Promise.some(obj, 2).then(function(result) {
        assertProperSubset(result, obj);
      });
    });

    it('resolves for a promises object', function() {
      var obj = {
        one: new Promise(function() {}),
        two: Promise.from(sentinels.two),
        three: Promise.from(sentinels.three)
      };
      return assert.eventually.deepEqual(Promise.some(obj, 2),
          { two: sentinels.two, three: sentinels.three });
    });

    it('resolves even if a promise rejects', function() {
      var obj = {
        one: Promise.rejected(sentinels.one),
        two: Promise.from(sentinels.two),
        three: sentinels.three
      };
      return assert.eventually.deepEqual(Promise.some(obj, 2),
          { two: sentinels.two, three: sentinels.three });
    });

    it('rejects if too many promises reject', function() {
      var obj = {
        one: Promise.rejected(sentinels.one),
        two: Promise.rejected(sentinels.two),
        three: sentinels.three
      };
      var result = Promise.some(obj, 2);
      return assert.isRejected(result).then(function() {
        return result.then(null, function(reasons) {
          assert.deepEqual(reasons,
              { one: sentinels.one, two: sentinels.two });
        });
      });
    });

    it('accepts a promise for an object', function() {
      var obj = sentinels.obj();
      return Promise.some(Promise.from(obj), 2).then(function(result) {
        assertProperSubset(result, obj);
      });
    });
  });
});
