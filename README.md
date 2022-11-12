# Simple Promise Poller

A simple poller that allows you to perform sequential async operations with ease.

## Usage

Given one async operation, you could perform polling:

```Javascript
import Poller from 'simple-promise-poller'

const poller = Poller();

// Wrap your logic inside of a function that accepts `stopPolling` as the first parameter.
async function checkKitchenStatus(stopPolling) {
  // Your logic, e.g. send a GET request to a kitchen API
  const status = await fetch(...); // "prepare-ingredient" | "cooking" | "ready-to-serve".
  // Call stopPolling whenever you like.
  if(status === "ready-to-serve") stopPolling();
}

// Start polling until the status is "ready-to-serve". 
poller.poll(checkKitchenStatus);

// You could start another parallel task as you wish.
poller.poll(checkDeliveryStatus);

// `poller.clear` will cancel all the ongoing tasks of the same Poller instance.
// For example, `checkKitchenStatus` and `checkDeliveryStatus` will both be canceled.
// It comes in handy when you use this poller in a React.useEffect.
poller.clear();

```

### Sequential tasks

`poller.poll` function also returns a "master promise". Therefore you could run a series of tasks in a queue:

```Javascript

async function checkFoodDelivery() {
  await poller.add(checkKitchenStatus);
  await poller.add(checkDeliveryStatus);
  return "delivered!";
}
// Or with a more concise syntax
async function checkFoodDelivery() {
  await poller.pipe(
    checkKitchenStatus, 
    checkDeliveryStatus
  )();
  return "delivered!";
}

```

### Handle rejections

By default, the poller will retry 10 times if a task returns a rejection. 
In your task function, you could check retry count by calling the second parameter `getRetryCount`.

```Javascript
async function checkKitchenStatus(stopPolling, getRetryCount) {
  if(getRetryCount() > 3) stopPolling();
  const status = await fetch(...);
}
poller.poll(checkKitchenStatus)
```

### Master promise

By default, the resolved value of the master promise is the return value of your task function.

```Javascript
async function task(stopPolling, getRetryCount) {
  if(getRetryCount() > 3) stopPolling();
  return "hello world";
}

const value = await poller.poll(task)
console.log(value); // hello world

```

By default, `stopPolling` will resolve the master promise.
You could reject the master promise by passing `false` to `stopPolling`.

```Javascript
async function task(stopPolling, getRetryCount) {
  // Stop polling and reject the master promise by passing `false`.
  // You can pass any value as its second parameter as the caught error.
  if(getRetryCount() > 3) stopPolling(false, "has run more than three times!");
  ...
}

try {
  await poller.poll(task);
  console.log('Task done'); // Will not print.
}catch(error){
  console.log(error); // "has run more than three times!".
}

```

You could also overwrite the resolved value of the master promise with the second parameter of `stopPolling`.

```Javascript
async function task(stopPolling, getRetryCount) {
  // Stop polling and resolve the master promise with a specific value.
  if(getRetryCount() > 3) stopPolling(true, "Cool beans!"); 
  return "task resolved";
}


const result = await poller.poll(task)
console.log(result); // "Cool beans!"


```

## Configuration
