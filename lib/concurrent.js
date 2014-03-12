'use strict';

var series = require('./series');
var promise = require('./promise');

var slice = [].slice;

// # concurrent
// Provides helper methods for orchestrating task execution.

// ## sequence(arrayOfTasks, ...args)
// Takes an array of functions ("tasks") to be invoked, in sequence. Returns
// a `Series` instance that'll be fulfilled with an array containing the
// (fulfilled) return value of each task. Tasks will be invoked with the other
// arguments that are passed.

// `arrayOfTasks` may be a promise for the actual array, and the other
// arguments may also be promises. However instead of invoking the tasks with
// the promises, they'll be invoked with the fulfillment values.

// If the `arrayOfTasks` promise or any other argument promise is rejected, the
// returned promise will be rejected with the same reason. If a task throws or
// returns a rejected promise, the promise returned by `sequence()` will be
// rejected with that error / reason, and no further tasks will be invoked.

// **Thenables returned by tasks are not assimilated, but instead are treated as
// objects.**
function sequence(arrayOfTasks) {
  return series.Series.all(slice.call(arguments, 1)).then(function(args) {
    return series.Series.from(arrayOfTasks).map(function(task) {
      return task.apply(undefined, args);
    });
  });
}

exports.sequence = sequence;

// ##pipeline(arrayOfTasks, ...firstArgs)
// Takes an array of functions ("tasks") to be invoked, in sequence. Each tasks
// will be invoked with the (fulfilled) return value of the previous task,
// except for the first task, which will be invoked with the arguments passed
// to `pipeline()`.

// Returns a `Promise` instance that'll be fulfilled with the return value of
// the last task. If `arrayOfTasks` is empty, the returned promise will be
// fulfilled with `undefined`.

// `arrayOfTasks` may be a promise for the actual array, and the other
// arguments may also be promises. However instead of invoking the first task
// with the promises, it'll be invoked with the fulfillment values.

// If the `arrayOfTasks` promise or any other argument promise is rejected, the
// returned promise will be rejected with the same reason. If a task throws or
// returns a rejected promise, the promise returned by `pipeline()` will be
// rejected with that error / reason, and no further tasks will be invoked.

// **Thenables returned by tasks are not assimilated, but instead are treated as
// objects.**
function pipeline(arrayOfTasks) {
  return promise.Promise.all(
    slice.call(arguments, 1)
  ).then(function(firstArgs) {
    var value;

    function perform(task) {
      var outcome;
      if (firstArgs) {
        outcome = task.apply(undefined, firstArgs);
        firstArgs = null;
      } else {
        outcome = task(value);
      }

      if (promise.Promise.isInstance(outcome)) {
        return outcome.then(function(outcome) {
          value = outcome;
        });
      } else {
        value = outcome;
      }
    }

    return series.Series.from(arrayOfTasks)
      .each(perform)
      .then(function() { return value; });
  });
}

exports.pipeline = pipeline;

// ##parallel(arrayOfTasks, ...args)
// Takes an array of functions ("tasks") to be invoked, in parallel. Returns
// a `Series` instance that'll be fulfilled with an array containing the
// (fulfilled) return value of each task. Tasks will be invoked with the other
// arguments that are passed.

// `arrayOfTasks` may be a promise for the actual array, and the other
// arguments may also be promises. However instead of invoking the tasks with
// the promises, they'll be invoked with the fulfillment values.

// If the `arrayOfTasks` promise or any other argument promise is rejected, the
// returned promise will be rejected with the same reason. If a task throws or
// returns a rejected promise, the promise returned by `parallel()` will be
// rejected with that error / reason. Since all tasks run in parallel, only when
// a task throws synchronously are no other tasks invoked, otherwise their
// return values or possible errors are discarded.

// **Thenables returned by tasks are not assimilated, but instead are treated as
// objects.**
function parallel(arrayOfTasks) {
  return series.Series.all(slice.call(arguments, 1)).then(function(args) {
    return series.Series.from(arrayOfTasks)
      .mapParallel(Infinity, function(task) {
        return task.apply(undefined, args);
      });
  });
}

exports.parallel = parallel;
