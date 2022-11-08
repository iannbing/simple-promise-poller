import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { ResolvePromise, StopPollingFunction } from './types';
import { RetryCounter } from './retry-counter';
import { isInteger, isNonNegativeInteger } from './utils/number';

const DEFAULT_INTERVAL = 2000;
const DEFAULT_RETRY = 10;

const getValidRetry = (config: PollerConfig | undefined) => {
  const retryConfig = config?.retry;

  if (!hasValue(retryConfig)) return DEFAULT_RETRY;
  if (isNonNegativeInteger(retryConfig)) return retryConfig;

  console.error('Retry should be a non-negative integer.');
  return DEFAULT_RETRY;
};

const getValidInterval = (config: PollerConfig = {}) => {
  const intervalConfig = config?.interval;

  if (!hasValue(intervalConfig)) return DEFAULT_INTERVAL;
  if (isNonNegativeInteger(intervalConfig)) return intervalConfig;

  console.error('Interval should be a non-negative integer.');
  return DEFAULT_INTERVAL;
};

type PollerConfig = {
  interval?: number;
  retry?: number;
  runOnStart?: boolean;
};

export const Poller = (config?: PollerConfig) => {
  const runOnStart = Boolean(config?.runOnStart);
  const retry = getValidRetry(config);
  const interval = getValidInterval(config);

  if (!isInteger(retry) || retry < 0)
    throw new Error('Retry must be a positive Integer.');

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
            if (retryCounter.getValue() + 1 >= retry) {
              clean(intervalId);
              reject(error);
              return;
            }
            retryCounter.increment();
          }
        };
        if (runOnStart) runTask();
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
