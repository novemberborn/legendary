#!/usr/bin/env node
'use strict';

var Mocha = require('mocha');
require('mocha-as-promised')(Mocha);

var chai = require('chai');
chai.use(require('chai-as-promised'));
require('sinon').assert.expose(chai.assert, { prefix: '' });

var mocha = new Mocha({
  reporter: 'spec',
  timeout: 200,
  slow: Infinity
});

var patterns = [
  './*-test.js'
];

var path = require('path');
var glob = require('glob');
patterns.reduce(function(paths, pattern) {
  return paths.concat(glob.sync(pattern, {
    cwd: __dirname
  }));
}, []).forEach(function(file) {
  mocha.addFile(path.join('test', file));
});

global.adapter = require('./adapter');

mocha.run(function(failures) {
  process.exit(failures);
});
