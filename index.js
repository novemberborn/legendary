'use strict';

exports = module.exports = require('./lib/legendary');

exports.Promise = require('./lib/promises').Promise;
exports.Collection = require('./lib/collections').Collection;
exports.CancellationError = require('./lib/CancellationError');
