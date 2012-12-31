"use strict";

// Fast-low progress emission, copied from <http://jsfiddle.net/cLtNS/1/> with
// discussion at <https://github.com/kriskowal/q/pull/114#issuecomment-8739693>.

var legendary = require("../");

function fast(){
  return new legendary.Promise(function(resolver){
    setTimeout(function(){
      resolver.progress(1);
    }, 200);
    setTimeout(function(){
      resolver.progress(2);
    }, 400);
    setTimeout(function(){
      resolver.progress(3);
    }, 600);
    setTimeout(function(){
      resolver.progress(4);
    }, 800);
    setTimeout(function(){
      resolver.progress(5);
      resolver.fulfill();
    }, 1000);
  });
}

function slow(){
  return new legendary.Promise(function(resolver){
    setTimeout(function(){
      resolver.progress(11);
    }, 500);
    setTimeout(function(){
      resolver.progress(22);
    }, 1000);
    setTimeout(function(){
      resolver.progress(33);
    }, 1500);
    setTimeout(function(){
      resolver.progress(44);
    }, 2000);
    setTimeout(function(){
      resolver.progress(55);
      resolver.fulfill();
    }, 2500);
  });
}

var a = fast();
var b = slow();

a.then(function(){
  return b;
}).then(null, null, console.log);
