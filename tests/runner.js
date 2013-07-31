#!/usr/bin/env node
'use strict';

var Mocha = require('mocha');
var path = require('path');
var glob = require('glob');

var mocha = new Mocha({
  reporter: 'spec',
  timeout: 200,
  slow: Infinity
});

var patterns = [
  './*-test.js'
];

patterns.reduce(function(paths, pattern) {
  return paths.concat(glob.sync(pattern, {
    cwd: __dirname
  }));
}, []).forEach(function(file) {
  mocha.addFile(path.join('tests', file));
});

global.adapter = require('./adapter');

mocha.run(function(failures) {
  process.exit(failures);
});
