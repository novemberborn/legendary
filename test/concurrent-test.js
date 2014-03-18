'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var sentinels = require('./sentinels');

var Promise = require('../').Promise;
var Series = require('../').Series;
var concurrent = require('../').concurrent;

function thrice(callback) {
  var result = [];
  for (var i = 0; i < 3; i++) {
    result.push(callback());
  }
  return result;
}

describe('concurrent.sequence(arrayOfTasks)', function() {
  it('returns a Series instance', function() {
    assert.instanceOf(concurrent.sequence([]), Series);
  });

  it('executes tasks in order', function() {
    var spies = thrice(sinon.spy);
    return concurrent.sequence(spies).then(function() {
      assert.callOrder.apply(assert, spies);
    });
  });

  it('executes one task at a time', function() {
    var started = 0, finished = 0;
    var tasks = thrice(function() {
      return function() {
        started++;
        return new Promise(function(resolve) {
          process.nextTick(function() {
            finished++;
            resolve(started === finished);
          });
        });
      };
    });
    return assert.eventually.deepEqual(concurrent.sequence(tasks),
        [true, true, true]);
  });

  it('resolves to an empty array when no tasks are supplied', function() {
    return assert.eventually.deepEqual(concurrent.sequence(), []);
  });

  it('passes arguments to all tasks', function() {
    var spy = sinon.spy();
    return concurrent.sequence([spy, spy, spy], sentinels.one, sentinels.two)
        .then(function() {
          assert.alwaysCalledWithExactly(spy, sentinels.one, sentinels.two);
        });
  });

  it('accepts promises for arguments', function() {
    var spy = sinon.spy();
    return concurrent.sequence(
      [spy, spy, spy],
      Promise.from(sentinels.one),
      Promise.from(sentinels.two)
    ).then(function() {
      assert.alwaysCalledWithExactly(spy, sentinels.one, sentinels.two);
    });
  });

  it('promises an array of task results', function() {
    var tasks = sentinels.arr(function(s) {
      return function() {
        return s;
      };
    });
    return assert.eventually.deepEqual(concurrent.sequence(tasks),
        sentinels.arr());
  });

  it('rejects when a task throws', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() { throw sentinels.two; });
    return assert.isRejected(concurrent.sequence(spies), sentinels.Sentinel)
        .then(function() {
          assert.notCalled(spies[2]);
        });
  });

  it('rejects when a task returns a rejected promise', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() {
      return Promise.rejected(sentinels.two);
    });
    return assert.isRejected(concurrent.sequence(spies), sentinels.Sentinel)
        .then(function() {
          assert.notCalled(spies[2]);
        });
  });
});

describe('concurrent.pipeline(arrayOfTasks)', function() {
  it('returns a Promise instance', function() {
    assert.instanceOf(concurrent.pipeline([]), Promise);
  });

  it('executes tasks in order', function() {
    var spies = thrice(sinon.spy);
    return concurrent.pipeline(spies).then(function() {
      assert.callOrder.apply(assert, spies);
    });
  });

  it('resolves to undefined when no tasks are supplied', function() {
    return assert.eventually.isUndefined(
      concurrent.pipeline.apply(concurrent, [[]].concat(sentinels.arr()))
    );
  });

  it('resolves to undefined when no tasks or arguments are supplied',
      function() {
        return assert.eventually.isUndefined(concurrent.pipeline([]));
      });

  it('passes arguments to initial task', function() {
    var spies = thrice(sinon.spy);
    return concurrent.pipeline(spies, sentinels.one, sentinels.two)
        .then(function() {
          assert.calledWithExactly(spies[0], sentinels.one, sentinels.two);
          assert.neverCalledWith(spies[1], sentinels.one, sentinels.two);
          assert.neverCalledWith(spies[2], sentinels.one, sentinels.two);
        });
  });

  it('accepts promises for arguments', function() {
    var spy = sinon.spy();
    return concurrent.pipeline(
      [spy],
      Promise.from(sentinels.one),
      Promise.from(sentinels.two)
    ).then(function() {
      assert.calledWithExactly(spy, sentinels.one, sentinels.two);
    });
  });

  it('passes result of one task to the next', function() {
    var spies = sentinels.arr(function(s) {
      return sinon.spy(function() { return s; });
    });
    return concurrent.pipeline(spies).then(function(result) {
      assert.calledWithExactly(spies[1], sentinels.one);
      assert.calledWithExactly(spies[2], sentinels.two);
      assert.strictEqual(result, sentinels.three);
    });
  });

  it('rejects when a task throws', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() { throw sentinels.two; });
    return assert.isRejected(concurrent.pipeline(spies), sentinels.Sentinel)
        .then(function() {
          assert.notCalled(spies[2]);
        });
  });

  it('rejects when a task returns a rejected promise', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() {
      return Promise.rejected(sentinels.two);
    });
    return assert.isRejected(concurrent.pipeline(spies), sentinels.Sentinel)
        .then(function() {
          assert.notCalled(spies[2]);
        });
  });
});

describe('concurrent.parallel(arrayOfTasks)', function() {
  it('returns a Series instance', function() {
    assert.instanceOf(concurrent.parallel([]), Series);
  });

  it('executes all tasks in parallel', function() {
    var started = 0;
    var tasks = thrice(function() {
      return function() {
        started++;
        return new Promise(function(resolve) {
          process.nextTick(function() {
            resolve(started === 3);
          });
        });
      };
    });
    return assert.eventually.deepEqual(concurrent.parallel(tasks),
        [true, true, true]);
  });

  it('resolves to an empty array when no tasks are supplied', function() {
    return assert.eventually.deepEqual(concurrent.parallel(), []);
  });

  it('passes arguments to all tasks', function() {
    var spy = sinon.spy();
    return concurrent.parallel([spy, spy, spy], sentinels.one, sentinels.two)
        .then(function() {
          assert.alwaysCalledWithExactly(spy, sentinels.one, sentinels.two);
        });
  });

  it('accepts promises for arguments', function() {
    var spy = sinon.spy();
    return concurrent.parallel(
      [spy, spy, spy],
      Promise.from(sentinels.one),
      Promise.from(sentinels.two)
    ).then(function() {
      assert.alwaysCalledWithExactly(spy, sentinels.one, sentinels.two);
    });
  });

  it('promises an array of task results', function() {
    var tasks = sentinels.arr(function(s) {
      return function() {
        return s;
      };
    });
    return assert.eventually.deepEqual(concurrent.parallel(tasks),
        sentinels.arr());
  });

  it('rejects when a task throws', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() { throw sentinels.two; });
    return assert.isRejected(concurrent.parallel(spies), sentinels.Sentinel)
        .then(function() {
          assert.notCalled(spies[2]);
        });
  });

  it('rejects when a task returns a rejected promise', function() {
    var spies = thrice(sinon.spy);
    spies[1] = sinon.spy(function() {
      return Promise.rejected(sentinels.two);
    });
    return assert.isRejected(concurrent.parallel(spies), sentinels.Sentinel);
  });
});
