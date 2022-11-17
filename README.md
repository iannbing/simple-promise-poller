# Simple Promise Poller

A simple poller that allows you to perform sequential async operations with ease.

## Installation

```bash
npm install simple-promise-poller
# or
yarn add simple-promise-poller
```

## Basic usage

Wrap your logic inside of a task function that accepts `cancelTask` as its first parameter.
Then plug your task function to `poll` function to start polling.

By default, the polling interval is 1000 ms, and retry limit is 10, and the first task run will be triggered after the first interval.
You can change these configurations whenever you need (see [configuration](#configuration)).

```Javascript
import { 
  poll, 
  pipe, 
  clearAllTasks, 
  setConfig 
} from 'simple-promise-poller';

// Wrap your logic inside of an async function.
async function checkKitchenStatus(cancelTask) {
  // Your logic, e.g. send a GET request to a kitchen API,
  // which returns status: 
  // - "prepare-ingredient"
  // - "cooking"
  // - "ready-to-serve".
  const status = await fetch(...); 
  // Stop polling when the condition meets.
  if(status === "ready-to-serve") cancelTask();
}

// Start polling. 
poll(checkKitchenStatus);

// You could start other tasks in parallel.
poll(task1);
poll(task2);
poll(task3);

// Every task returns a "master promise", 
// so that you could run tasks sequentially.
await poll(task4);
await poll(task5);
await poll(task6);

// Or...why not chain your sequential tasks with the `pipe` function? 🎉
await pipe(task4, task5, task6)();

// In case you need to force cancel all ongoing polling tasks at once.
clearAllTasks();

```

### Create a poller instance

Note that all the above functions are part of a Poller singleton and `clearAllTasks` will cancel
**all** tasks started by `poll` function. You might want to create multiple Poller instances to
separate the tasks, so that you could cancel tasks in groups.

```Javascript
import { createPoller } from 'simple-promise-poller'

const pollerA = createPoller();
const pollerB = createPoller();

pollerA.poll(taskA1);
pollerA.poll(taskA2);

pollerB.poll(taskB1);
pollerB.poll(taskB2);

// taskA1 and taskA2 will be canceled, 
// but taskB1 and taskB2 are still running.
pollerA.clear();

```

### Stop polling

There are two ways to stop polling:

1. Stop one polling task by calling `cancelTask` in your task function.
2. Stop all polling tasks by calling `clearAllTasks` (or `poller.clear` of your poller).

## Retry

`poll` will retry if the task function results in a rejection. Default retry limit is 10.
To continue polling regardless rejections, set retryLimit to `null`.

```Javascript
// Given that default retryLimit is 10.
async function task(cancelTask, getRetryCount) {
  cancelTask(false);
}
poll(task);                       // Will stop polling after retrying 10 times.
poll(task, { retryLimit: 3 });    // Will stop polling after retrying 3 times.
poll(task, { retryLimit: null }); // Will continue polling indefinitely.
```

### Get retry count

Sometimes you might have some follow-up actions when a task results in a rejection, but you still
want to keep the task running. Call `getRetryCount` to get the retry count.

```Javascript
// Given that default retryLimit is 10.
async function task(cancelTask, getRetryCount) {
  // Start logging since the 4th consecutive attempts.
  if(getRetryCount() > 3) log(); 
  await fetch(...);
}

poll(task); 
```

## Master promise

By default, `cancelTask` resolves the master promise, and the resolved value is the last return value of your task function.

```Javascript
let counter = 0;
async function task(cancelTask) {
  counter += 1;
  if(counter > 3) cancelTask(); // Resolve master promise
  return counter > 2 ? "hello world" : "running";
}

const value = await poll(task)
console.log(value); // hello world

```

You could reject the master promise by passing `false` to `cancelTask`.

```Javascript
async function task(cancelTask, getRetryCount) {
  if(getRetryCount() > 3) {
    cancelTask(false, "has tried more than three times!");
  }
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
  if(counter > 3) cancelTask(true, "Cool beans!"); 
  return "task resolved";
}

const result = await poller.poll(task)
console.log(result); // "Cool beans!"

```

### Passing values between tasks in `pipe`

When running in `pipe`, the task function could get the resolved value from the previous task.

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

### Time out the hanging promise

If a task run results in a hanging promise, it will be timed out when the next polling starts.
You could time out your task earlier than the next polling by tweaking the config (see [configuration](#configuration)).
Note that the custom value of `timeout` will be ignore if it is greater than `interval`.

```Javascript
// Given the default interval 1000ms, retry 10 times.
const hangingTask = async () => {
  await new Promise(resolve => setTimeout(resolve, 10000000));
};

try {
  await poll(hangingTask);
  console.log("resolved"); // Will not print.
} catch (error) {
  console.error(error); // "Timed out after 1000ms"
}

```

## Configuration

You could overwrite the config of the poller instance using `setConfig`.
Note that the changes of the config won't apply to your running tasks.

If you wish to reset it to default with only the changes you give, pass `true` as the second parameter.

`timeout` goes together with `interval` if not set.
You could make `timeout` less than `interval`, but not greater.

```javascript
import { poll, setConfig, createPoller } from 'simple-promise-poller';

// Default config:
// - interval: 1000 (timeout: 1000)
// - retryLimit: 10 
// - First execution is in 1000ms
poll(task1); 

// Same as default config, but interval 2000 (timeout: 2000)
setConfig({ interval: 2000 });
poll(task2); 

// Overwrite all options.
setConfig({ 
  interval: 2000, 
  timeout: 500, 
  retryLimit: 3, 
  runOnStart: true // The first execution will be triggered immediately
});
poll(task3); 

// Still using the above options, with the following changes:
// - interval: 3000 
// - timeout: ignored 50000, fallback to 3000
setConfig({ interval: 3000, timeout: 50000 });
poll(task4); 

// Reset config to default with the additional changes.
// - Interval 2000 
// - Timeout: 1000
// - retryLimit: 10 (default config)
// - First execution is in 1000ms  (default config)
setConfig({ interval: 2000, timeout: 1000 }, true);
poll(task5); 

```

You could specify its config when creating a new poller:

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

To set the configurations back to default, simply call `setConfig` without any input.

```Javascript
import { poll, setConfig, createPoller } from 'simple-promise-poller';

setConfig({interval: 3000});
poll(task1); // Poll per 3000 ms.

setConfig(); 
poll(task2); // Poll per 1000 ms.
```
