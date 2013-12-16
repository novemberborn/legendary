'use strict';

exports.Promise = require('./promises').Promise;
exports.Collection = require('./collections').Collection;

exports.CancellationError = require('./CancellationError');
exports.TimeoutError = require('./TimeoutError');

exports.timed = require('./timed');
exports.concurrent = require('./concurrent');
exports.fn = require('./fn');

exports.unhandledRejection = function() {};
