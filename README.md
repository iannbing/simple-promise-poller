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

By default, the polling interval is 1000 ms, and retry limit is 10, and first run will be triggered after the first interval.
You can change these configurations whenever you need (see #configuration).

```Javascript
import { poll, pipe, clearAllTasks, setConfig } from 'simple-promise-poller';

// Wrap your logic inside of an async function.
async function checkKitchenStatus(cancelTask) {
  // Your logic, e.g. send a GET request to a kitchen API
  const status = await fetch(...); // "prepare-ingredient" | "cooking" | "ready-to-serve".
  // Stop polling when the condition meets.
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

### Create poller

Note that all the above functions are part of a Poller singleton and `clearAllTasks` will cancel
**all** tasks started by `poll` function. You might want to create multiple Poller instances to
separate the tasks, so that you could cancel tasks in groups.

```Javascript
import { createPoller } from 'simple-promise-poller'

const pollerA = createPoller();
const pollerB = createPoller();

pollerA.poll(taskA1);
pollerB.poll(taskB1);

// taskA1 will be canceled, but taskB1 is still running.
pollerA.clear();

```

### Get retry count

Sometimes you might have some follow-up actions when a task results in a rejection, but you still
want to keep the task running. Call `getRetryCount` to get the retry count.

```Javascript
// Given: default retryLimit is 10.
async function task(cancelTask, getRetryCount) {
  if(getRetryCount() > 3) log();
  if(getRetryCount() === 5) cancelTask(); // Cancel task early.
  await fetch(...);
}

poll(task);
```

### Resolve or reject the master promise

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
  // Cancel the task with a rejection with an error "error!"
  cancelTask(false, "error!"); 
}
async function task3(cancelTask, getRetryCount, previousValue) {
  console.log(previousValue); // Will not print;
  cancelTask(true, "water"); 
}

try {
  const result = await poller.pipe(task1, task2, task3)()
  console.log(result); // Will not print;
}catch(error){
  console.log(error); // "error!"
}

```

## Configuration

You could overwrite the config of the poller instance using `setConfig`.
Note that the changes of the config won't apply to your running tasks.

```javascript
import { poll, setConfig, createPoller } from 'simple-promise-poller';

// Default: interval 1000; retryLimit: 10. First execution is in 1000ms.
poll(task1); 

// interval 2000; retryLimit: 3
// The first execution will be triggered immediately because runOnStart was set as true.
setConfig({ interval: 2000, retryLimit: 3, runOnStart: true });
poll(task2); 

```

You could specify the config when creating a new poller:

```javascript
const poller = createPoller({interval: 7000}); // Initial config.
poller.poll(task3); // interval: 7000
poller.setConfig({interval: 3000});
poller.poll(task4); // interval: 3000
```

Yet, you could specify the options per task if really needed.

```javascript

poll(task1, {interval: 2000}); 

pipe(
  task2, 
  task3, 
  task4
)({interval: 4000})

poll(task5); // Still default interval 1000.

```
