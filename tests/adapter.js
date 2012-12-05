"use strict";

var legendary = require("../legendary");

exports.fulfilled = legendary.fulfilled;
exports.rejected = legendary.rejected;

exports.pending = function () {
  var pendable = legendary.pending();

  return {
    promise: pendable.promise(),
    fulfill: pendable.fulfill,
    reject: pendable.reject
  };
};
