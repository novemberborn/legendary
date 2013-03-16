"use strict";

// Scheduling mechanism for same-turn or next-turn execution.

var queue, index, stack;

// Adds the queue to an existing trampoline, or starts a new one to process
// the queue.
function trampoline(queue){
  if(stack){
    index.push(0);
    stack.push(queue);
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

// Once we have entered a turn we can keep executing notifiers without
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
exports.sameTurn = function(notifier, fulfilled, result, signalHandled){
  trampoline([notifier, fulfilled, result, signalHandled]);
};

// Schedule execution in a future turn. Requests a tick or adds to an
// existing queue.
exports.nextTurn = function(notifier, fulfilled, result, signalHandled){
  if(!queue){
    process.nextTick(enterTurn);
    queue = [notifier, fulfilled, result, signalHandled];
  }else{
    queue.push(notifier, fulfilled, result, signalHandled);
  }
  return notifier;
};
