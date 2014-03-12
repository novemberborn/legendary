'use strict';

// Scheduling mechanism for same-turn or next-turn propagation.

var queue, index, stack;

// Starts a trampoline to process the queue.
function trampoline(queue) {
  index = [0];
  stack = [queue];

  var queueIndex, queueLength;

  var stackIndex = 1; // 1-indexed!
  var stackLength = stack.length;
  var topOfStack = true;
  while (stackIndex) {
    queue = stack[stackIndex - 1];
    queueIndex = index[stackIndex - 1];
    if (queueIndex === -1) {
      queueIndex = index[stackIndex - 1] = 0;
    }
    queueLength = queue.length;

    while (queueIndex < queueLength && topOfStack) {
      queue[queueIndex].resolve(
          queue[queueIndex + 1],
          queue[queueIndex + 2],
          queue[queueIndex + 3]);

      queueIndex += 4;
      stackLength = stack.length;
      topOfStack = stackLength === stackIndex;
    }

    if (!topOfStack) {
      index[stackIndex - 1] = queueIndex;
      stackIndex = stackLength;
      topOfStack = true;
    } else {
      index.pop();
      stack.pop();
      stackIndex--;
    }
  }
  stack = index = null;
}

// Once we have entered a turn we can keep executing propagations without
// waiting for another tick. Start a trampoline to process the current queue.
function enterTurn() {
  var snapshot;
  while ((snapshot = queue).length) {
    queue = [];
    trampoline(snapshot);
  }
  queue = null;
}

// Schedule execution in a future turn. Requests a tick or adds to an
// existing queue.
exports.nextTurn = function(propagator, rejected, result, handledRejection) {
  if (!queue) {
    process.nextTick(enterTurn);
    queue = [propagator, rejected, result, handledRejection];
  } else {
    queue.push(propagator, rejected, result, handledRejection);
  }
};
