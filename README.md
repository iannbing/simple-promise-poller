# Simple Promise Poller

A simple poller that allows you to perform sequential async operations with ease.

## Installation

```bash
npm install simple-promise-poller
# or
yarn add simple-promise-poller
```

## Usage

Wrap your logic inside of a task function that accepts `cancelTask` as its first parameters.
Then plug your task function to `poll` function to start polling.

You can configure these options per task (see configuration).

```Javascript
import { poll, pipe, clearAllTasks, setConfig } from 'simple-promise-poller';

// By default, polling interval is 2000 ms, and retryLimit is 10.
// You can optionally overwrite these options with `setConfig`.
setConfig({ interval: 1000, retryLimit: 3 });

// Wrap your logic inside of an async function.
async function checkKitchenStatus(cancelTask) {
  // Your logic, e.g. send a GET request to a kitchen API
  const status = await fetch(...); // "prepare-ingredient" | "cooking" | "ready-to-serve".
  // Stop polling however you like.
  if(status === "ready-to-serve") cancelTask();
}

// Start polling.
poll(checkKitchenStatus);

// You could start other tasks in parallel.
poll(task1);
poll(task2);
poll(task3);

// Every task returns a "master promise", so that you could run tasks sequentially.
await poll(task4);
await poll(task5);
await poll(task6);

// Or...why not chain your sequential tasks with the `pipe` function? 🎉
await pipe(task4, task5, task6)();

// In case you need to force cancel all ongoing polling tasks at once.
clearAllTasks();

```

### createPoller

Note that all the above functions are part of a Poller singleton and `clearAllTasks` will cancel
**all** tasks started by `poll` function. You might want to create multiple Poller instances to
separate the tasks, so that you could cancel tasks in groups.

```Javascript
import { createPoller } from 'simple-promise-poller'

const pollerA = createPoller();
const pollerB = createPoller();

pollerA.poll(taskA1);
pollerB.poll(taskB1);

// taskB1 is still running.
pollerA.clear();

```

### Retry count

Sometimes you might have some follow-up actions when a task results in a rejection, but you still
want to keep the task running. You might find `getRetryCount` quite handy.

```Javascript
// Given: default retryLimit is 10.
async function task(cancelTask, getRetryCount) {
  if(getRetryCount() > 3) log();
  if(getRetryCount() === 5) cancelTask(); // Cancel task early.
  await fetch(...);
}

poll(task);
```

### Resolve/reject the master promise

By default, `cancelTask` resolves the master promise, and the resolved value is the last return value of your task function.

```Javascript
let counter = 0;
async function task(cancelTask) {
  counter += 1;
  if(counter > 3) cancelTask(); // Cancel the task to resolve the master promise.
  return counter > 2 ? "hello world" : "running";
}

const value = await poll(task)
console.log(value); // hello world

```

You could reject the master promise by passing `false` to `cancelTask`.

```Javascript
async function task(cancelTask, getRetryCount) {
  // Stop polling and reject the master promise by passing `false`.
  // You can pass any value as its second parameter as the caught error.
  if(getRetryCount() > 3) cancelTask(false, "has tried more than three times!");
  ...
}

try {
  await poller.poll(task);
  console.log('Task done'); // Will not print.
}catch(error){
  console.log(error); // "has tried more than three times!".
}

```

You could also overwrite the resolved value of the master promise with the second parameter of `cancelTask`.

```Javascript
let counter = 0;
async function task(cancelTask, getRetryCount) {
  counter += 1;
  // Stop polling and overwrite the resolve the master promise with a specific value.
  if(counter > 3) cancelTask(true, "Cool beans!"); 
  return "task resolved";
}

const result = await poller.poll(task)
console.log(result); // "Cool beans!"

```

### Passing values between tasks in `pipe`

```Javascript
async function task1(cancelTask, getRetryCount, previousValue) {
  cancelTask(true, "bird"); 
}
async function task2(cancelTask, getRetryCount, previousValue) {
  console.log(previousValue); // "bird"
  cancelTask(true, "flower"); 
}
async function task3(cancelTask, getRetryCount, previousValue) {
  console.log(previousValue); // "flower"
  cancelTask(true, "water"); 
}

const result = await poller.pipe(task1, task2, task3)()
console.log(result); // "water"

```

If any of the task results in a rejection, the following tasks will not be executed.
And the rejection and its error will be bubbled up.

```Javascript
async function task1(cancelTask, getRetryCount, previousValue) {
  cancelTask(true, "bird"); 
}
async function task2(cancelTask, getRetryCount, previousValue) {
  console.log(previousValue); // "bird"
  // Cancel the task with a rejection with an error "flower"
  cancelTask(false, "flower"); 
}
async function task3(cancelTask, getRetryCount, previousValue) {
  console.log(previousValue); // Will not print;
  cancelTask(true, "water"); 
}

try {
  const result = await poller.pipe(task1, task2, task3)()
  console.log(result); // Will not print;
}catch(error){
  console.log(error); // "flower"
}

```

## Configuration
