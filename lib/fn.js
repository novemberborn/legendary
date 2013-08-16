'use strict';

var promises = require('./promises');
var concurrent = require('./concurrent');

var slice = [].slice;

function exec(func, thisArg, args) {
  return promises.Promise.all(args).then(function(args) {
    return func.apply(thisArg, args);
  });
}

function call(normalFunction) {
  /*jshint validthis:true*/
  return exec(normalFunction, this, slice.call(arguments, 1));
}

exports.call = call;

function apply(normalFunction, args) {
  /*jshint validthis:true*/
  return exec(normalFunction, this, args);
}

exports.apply = apply;

function lift(normalFunction) {
  var args = slice.call(arguments, 1);
  var resolvedArgs = args.length === 0;

  var invoke = function() {
    var thisArg = this;
    var additionalArgs = slice.call(arguments);

    if (!resolvedArgs) {
      return promises.Promise.all(args).then(function(resolved) {
        args = resolved;
        resolvedArgs = true;
        return invoke.apply(thisArg, additionalArgs);
      });
    }

    return promises.Promise.all(additionalArgs).then(function(additionalArgs) {
      return normalFunction.apply(thisArg, args.concat(additionalArgs));
    });
  };

  return invoke;
}

exports.lift = lift;

function compose() {
  var funcs = slice.call(arguments);

  return function() {
    var thisArg = this;
    var boundFuncs = funcs.map(function(func) {
      return function() {
        return func.apply(thisArg, arguments);
      };
    });

    var args = slice.call(arguments);
    args.unshift(boundFuncs);

    return concurrent.pipeline.apply(concurrent, args);
  };
}

exports.compose = compose;
