var Resolver = require("./promise/Resolver"),
    Pendable = require("./promise/Pendable");

exports.pending = function(){
  return new Pendable();
};

exports.fulfilled = function(value){
  return new Resolver().fulfill(value).promise;
};

exports.rejected = function(reason){
  return new Resolver().reject(reason).promise;
};
