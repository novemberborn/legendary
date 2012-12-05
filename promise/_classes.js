var isPromise = require("./is");

var FULFILLED = 1;
var REJECTED = 2;

function signal(resolvers, state, input){
  process.nextTick(function(){
    for(var i = 0, l = resolvers.length; i < l; i++){
      resolvers[i]._resolve(state, input);
    }
  });
}

function enqueue(resolver, state, input){
  process.nextTick(function(){
    resolver._resolve(state, input);
  });
}

exports.Promise = Promise;
function Promise(then){
  this.then = then;
}

exports.Pendable = Pendable;
function Pendable(){
  var pending = [];
  var fulfilled = false;
  var fulfillmentValue, rejectionReason;

  this.fulfill = function(value){
    if(pending){
      fulfilled = true;
      fulfillmentValue = value;

      signal(pending, FULFILLED, value);
      pending = null;
    }
    return this;
  };
  
  this.reject = function(reason){
    if(pending){
      rejectionReason = reason;

      signal(pending, REJECTED, reason);
      pending = null;
    }
    return this;
  };

  this.then = function(onFulfilled, onRejected){
    var resolver = new Resolver(onFulfilled, onRejected);
    if(pending){
      pending.push(resolver);
    }else if(fulfilled){
      enqueue(resolver, FULFILLED, fulfillmentValue);
    }else{
      enqueue(resolver, REJECTED, rejectionReason);
    }
    return resolver.promise;
  };
}

Pendable.prototype = new Promise();

Pendable.prototype.promise = function(){
  return new Promise(this.then);
};

exports.Resolver = Resolver;
function Resolver(onFulfilled, onRejected){
  this[FULFILLED] = onFulfilled;
  this[REJECTED] = onRejected;

  this.pending = true;
  this.fulfilled = false;
  this.pendable = null;
  this.result = null;

  var resolver = this;
  this.promise = new Promise(function(onFulfilled, onRejected){
    return resolver.then(onFulfilled, onRejected);
  });
}

Resolver.prototype.fulfill = function(value){
  return this._resolve(FULFILLED, value);
};

Resolver.prototype.reject = function(reason){
  return this._resolve(REJECTED, reason);
};

Resolver.prototype.then = function(onFulfilled, onRejected){
  if(this.pending && !this.pendable){
    this.pendable = new Pendable();
  }
 
  if(this.pendable){
    return this.pendable.then(onFulfilled, onRejected);
  }

  var resolver = this;
  if(this.fulfilled && onFulfilled){
    resolver = new Resolver(onFulfilled);
    enqueue(resolver, FULFILLED, this.result);
  }else if(!this.fulfilled && onRejected){
    resolver = new Resolver(null, onRejected);
    enqueue(resolver, REJECTED, this.result);
  }

  return resolver.promise;
};

Resolver.prototype._resolve = function(state, input){
  var hasHandler = this[state];
  if(hasHandler){
    var isFulfilled;
    try{
      this.result = this[state](input);
      isFulfilled = true;
    }catch(error){
      this.result = error;
    }

    this.pending = false;
    this.fulfilled = isFulfilled;
  }else if(state === FULFILLED){
    this.pending = false;
    this.fulfilled = true;
    this.result = input;
  }else if(state === REJECTED){
    this.pending = false;
    this.result = input;
  }

  var returnedPromise;
  if(hasHandler && this.fulfilled && isPromise(this.result)){
    returnedPromise = this.result;
    if(!this.pendable){
      this.pendable = new Pendable();
    }
  }

  if(!this.pending && this.pendable){
    if(this.fulfilled){
      if(returnedPromise){
        try{
          this.result.then(this.pendable.fulfill, this.pendable.reject);
        }catch(error){
          this.pendable.reject(error);
        }
      }else{
        this.pendable.fulfill(this.result);
      }
    }else{
      this.pendable.reject(this.result);
    }
  }

  return this;
};
