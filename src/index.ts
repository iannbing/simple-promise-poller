import { PollerCallback } from './types';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { hasValue } from './utils/variable';

// export const sum = (a: number, b: number) => {
//   if ('development' === process.env.NODE_ENV) {
//     console.log('boop');
//   }
//   return a + b;
// };

let promiseCount = 0;
let promises: Record<string, CancelablePromise<any>> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
const eventRecords: Record<string, true> = {};
const removeEvent = (intervalId: number) => {
  if (hasValue(eventRecords[intervalId])) {
    window.clearInterval(intervalId);
    delete eventRecords[intervalId];
  }
};

async function delayedResolve<T, E>(
  getPromise: Promise<T> | (() => Promise<T>),
  callback: PollerCallback<T, E> | undefined,
  interval: number,
  retry: number
) {
  const promise = getPromise instanceof Function ? getPromise() : getPromise;

  promiseCount += 1;
  const promiseKey = promiseCount;

  const clean = (intervalId: number) => {
    delete promises[promiseKey];
    removeEvent(intervalId);
  };

  let hasRetried = 0;
  const masterPromise = makeCancelable(
    new Promise<T>(async (resolve, reject: (error: E) => void) => {
      const executeOperation = async () => {
        try {
          const resolved = await promise;
          if (callback) {
            const shouldContinue = callback({
              status: 'fulfilled',
              data: resolved,
            });
            if (shouldContinue === false) {
              clean(intervalId);
              resolve(resolved);
            }
          }
        } catch (error) {
          if (callback) {
            const shouldContinue = callback({
              status: 'rejected',
              error: error as E,
            });
            if (shouldContinue === false) {
              clean(intervalId);
              reject(error as E);
            }
          }
          if (hasRetried >= retry) {
            clean(intervalId);
            reject(error as E);
            return;
          }
          hasRetried += 1;
        }
      };
      const intervalId = window.setInterval(executeOperation, interval);
      eventRecords[intervalId] = true;
    })
  );

  promises[promiseKey] = masterPromise;
  return masterPromise;
}

function hasCallback<T, E>(
  callback: PollerCallback<T, E> | number | undefined
): callback is PollerCallback<T, E> {
  return callback instanceof Function;
}

export function poll<T, E = Error>(
  promise: Promise<T> | (() => Promise<T>),
  callback?: PollerCallback<T, E> | number,
  interval = 1000,
  retry = 10
) {
  return hasCallback(callback)
    ? delayedResolve(
        promise,
        hasCallback(callback) ? callback : undefined,
        interval,
        retry
      )
    : delayedResolve(promise, undefined, callback || interval, retry);
}
