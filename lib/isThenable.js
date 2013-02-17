"use strict";

module.exports = function(obj){
  return obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function";
};
