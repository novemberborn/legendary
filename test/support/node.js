'use strict';

var chai = require('chai');
var sinon = require('sinon');
var sentinels = require('chai-sentinels');

chai.use(sentinels);
chai.use(require('./assertions'));
chai.use(require('chai-as-promised'));

sinon.assert.expose(chai.assert, { prefix: '' });

global.assert = chai.assert;
global.sentinels = sentinels;
