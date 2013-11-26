'use strict';

var collections = require('./collections');
var promises = require('./promises');

var slice = [].slice;

function sequence(arrayOfTasks) {
  return promises.Promise.all(slice.call(arguments, 1)).then(function(args) {
    return collections.Collection.from(arrayOfTasks).mapSeries(function(task) {
      return task.apply(undefined, args);
    });
  });
}

exports.sequence = sequence;

function pipeline(arrayOfTasks) {
  return promises.Promise.all(
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

      if (promises.Promise.isInstance(outcome)) {
        return outcome.then(function(outcome) {
          value = outcome;
        });
      } else {
        value = outcome;
      }
    }

    return collections.Collection.from(arrayOfTasks)
        .eachSeries(perform)
        .then(function() {
          return value;
        });
  });
}

exports.pipeline = pipeline;

function parallel(arrayOfTasks) {
  return promises.Promise.all(slice.call(arguments, 1)).then(function(args) {
    return collections.Collection.from(arrayOfTasks).map(function(task) {
      return task.apply(undefined, args);
    });
  });
}

exports.parallel = parallel;
