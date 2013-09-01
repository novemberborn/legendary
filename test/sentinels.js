'use strict';

var count = 0;
function Sentinel() {
  this.id = ++count;
}

Sentinel.prototype.noop = function() {};

exports.Sentinel = Sentinel;
exports.one = new Sentinel();
exports.two = new Sentinel();
exports.three = new Sentinel();

function identity(x) {
  return x;
}

exports.arr = function(transform) {
  transform = transform || identity;
  return [
    transform(exports.one),
    transform(exports.two),
    transform(exports.three)
  ];
};

exports.obj = function(transform) {
  transform = transform || identity;
  return {
    one: transform(exports.one),
    two: transform(exports.two),
    three: transform(exports.three)
  };
};
