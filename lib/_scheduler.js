"use strict";

// Scheduling mechanism for same-turn or next-turn propagation.

var queue, index, stack;

// Adds the queue to an existing trampoline, or starts a new one to process
// the queue.
function trampoline(queue){
  if(stack){
    var last = index.length - 1;
    if(index[last] === -1){
      stack[last] = stack[last].concat(queue);
    }else{
      index.push(-1);
      stack.push(queue);
    }
    return;
  }

  index = [0];
  stack = [queue];

  var queueIndex, queueLength;

  var stackIndex = 1; // 1-indexed!
  var stackLength = stack.length;
  var topOfStack = true;
  while(stackIndex){
    queue = stack[stackIndex - 1];
    queueIndex = index[stackIndex - 1];
    if(queueIndex === -1){
      queueIndex = index[stackIndex - 1] = 0;
    }
    queueLength = queue.length;

    while(queueIndex < queueLength && topOfStack){
      queue[queueIndex].settle(queue[queueIndex + 1], queue[queueIndex + 2], queue[queueIndex + 3]);

      queueIndex += 4;
      stackLength = stack.length;
      topOfStack = stackLength === stackIndex;
    }

    if(!topOfStack){
      index[stackIndex - 1] = queueIndex;
      stackIndex = stackLength;
      topOfStack = true;
    }else{
      index.pop();
      stack.pop();
      stackIndex--;
    }
  }
  stack = index = null;
}

// Once we have entered a turn we can keep executing propagations without
// waiting for another tick. Start a trampoline to process the current queue.
function enterTurn(){
  var snapshot;
  while((snapshot = queue).length){
    queue = [];
    trampoline(snapshot);
  }
  queue = null;
}

// Schedule execution within the same turn. Starts a trampoline or adds
// if already running.
exports.sameTurn = function(propagator, fulfilled, value, handledRejection){
  trampoline([propagator, fulfilled, value, handledRejection]);
};

// Schedule execution in a future turn. Requests a tick or adds to an
// existing queue.
exports.nextTurn = function(propagator, fulfilled, value, handledRejection){
  if(!queue){
    process.nextTick(enterTurn);
    queue = [propagator, fulfilled, value, handledRejection];
  }else{
    queue.push(propagator, fulfilled, value, handledRejection);
  }
};
