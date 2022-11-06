import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';

export type ResolvePromise<T> = (
  stopPolling: StopPollingFunction,
  getHasRetryCount: GetHasRetryCount
) => Promise<T>;

export type StopPollingFunction = (
  isResolved: boolean,
  hasRetried: number
) => void;

export type GetHasRetryCount = () => number;

const DEFAULT_INTERVAL = 2000;
const DEFAULT_RETRY = 10;

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
  let promises: Record<string, CancelablePromise<unknown>> = {};
  const eventRecords: Record<string, true> = {};
  const removeEvent = (intervalId: number) => {
    if (hasValue(eventRecords[intervalId])) {
      window.clearInterval(intervalId);
      delete eventRecords[intervalId];
    }
  };

  function poll<T = any>(resolvePromise: ResolvePromise<T>) {
    promiseCount += 1;
    const promiseKey = promiseCount;

    const clean = (intervalId: number) => {
      delete promises[promiseKey];
      removeEvent(intervalId);
    };

    let hasRetried = 0;
    const getHasRetryCount = () => hasRetried;
    const masterPromise = makeCancelable(
      new Promise(async (resolve, reject) => {
        const stopPolling = (isResolved = true) => {
          clean(intervalId);
          if (isResolved) {
            resolve(undefined);
          } else {
            reject();
          }
        };
        const runTask = async () => {
          try {
            await resolvePromise(stopPolling, getHasRetryCount);
          } catch (error) {
            if (hasRetried >= retry) {
              clean(intervalId);
              reject();
              return;
            }
            hasRetried += 1;
          }
        };
        if (startImmediately) runTask();
        const intervalId = window.setInterval(runTask, interval);
        eventRecords[intervalId] = true;
      })
    );

    promises[promiseKey] = masterPromise;
    return masterPromise;
  }

  return {
    add: <T>(resolvePromise: ResolvePromise<T>) => poll(resolvePromise),
    isIdling: () => Object.keys(eventRecords).length === 0,
    clean: (remainingTimeouts?: number[]) => {
      Object.keys(eventRecords).forEach(intervalIdAsString => {
        const intervalId = Number(intervalIdAsString);
        if (!remainingTimeouts?.includes(intervalId)) {
          window.clearInterval(Number(intervalId));
          delete eventRecords[intervalIdAsString];
        }
      });
      Object.values(promises).forEach(promise => promise.cancel());
      promises = {};
    },
  };
};
