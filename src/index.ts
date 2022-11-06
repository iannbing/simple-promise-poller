import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { ResolvePromise, StopPollingFunction } from './types';

const DEFAULT_INTERVAL = 2000;
const DEFAULT_RETRY = 10;

const RetryCounter = () => {
  let retry = 0;
  return {
    getValue: () => retry,
    increment: () => {
      retry += 1;
      return retry;
    },
  };
};

export const Poller = (config?: {
  interval?: number;
  startImmediately?: boolean;
  retry?: number;
}) => {
  const {
    interval = DEFAULT_INTERVAL,
    retry = DEFAULT_RETRY,
    startImmediately = false,
  } = config || {};

  let promiseCount = 0;
  let cancelablePromises: Record<string, CancelablePromise<unknown>> = {};
  const eventRecords: Record<string, true> = {};
  const removeEvent = (intervalId: number) => {
    if (hasValue(eventRecords[intervalId])) {
      window.clearInterval(intervalId);
      delete eventRecords[intervalId];
    }
  };

  function poll(resolvePromise: ResolvePromise) {
    promiseCount += 1;
    const promiseKey = promiseCount;

    const clean = (intervalId: number) => {
      delete cancelablePromises[promiseKey];
      removeEvent(intervalId);
    };

    const retryCounter = RetryCounter();
    const masterPromise = makeCancelable(
      new Promise<void>(async (resolve, reject) => {
        const stopPolling: StopPollingFunction = (isResolved = true) => {
          clean(intervalId);
          if (isResolved) {
            resolve();
          } else {
            reject({ isCanceled: true });
          }
        };
        const runTask = async () => {
          try {
            await resolvePromise(stopPolling, retryCounter.getValue);
          } catch (error) {
            if (retryCounter.getValue() >= retry) {
              clean(intervalId);
              reject(error);
              return;
            }
            retryCounter.increment();
          }
        };
        if (startImmediately) runTask();
        const intervalId = window.setInterval(runTask, interval);
        eventRecords[intervalId] = true;
      })
    );

    cancelablePromises[promiseKey] = masterPromise;
    return masterPromise.promise;
  }

  return {
    add: (resolvePromise: ResolvePromise) => poll(resolvePromise),
    isIdling: () => Object.keys(eventRecords).length === 0,
    clean: async () => {
      Object.keys(eventRecords).forEach(intervalIdAsString => {
        const intervalId = Number(intervalIdAsString);
        removeEvent(Number(intervalId));
      });
      await Promise.allSettled(
        Object.values(cancelablePromises).map(promise => {
          promise.cancel();
          return promise.promise;
        })
      );
      cancelablePromises = {};
    },
  };
};
