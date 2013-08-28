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

var patterns = [];
if (process.argv[2]) {
  patterns.push(process.argv[2]);
} else {
  patterns.push('**/*-test.js');
}

var path = require('path');
var glob = require('glob');
patterns.reduce(function(paths, pattern) {
  return paths.concat(glob.sync(pattern, {
    cwd: __dirname
  }));
}, []).forEach(function(file) {
  mocha.addFile(path.join('test', file));
});

mocha.run(function(failures) {
  process.exit(failures);
});
