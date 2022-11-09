import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { ResolvePromise } from './types';
import { RetryCounter } from './retry-counter';
import { isInteger, isNonNegativeInteger } from './utils/number';

const DEFAULT_INTERVAL = 2000;
const DEFAULT_RETRY_LIMIT = 10;

const getValidRetryLimit = (config: PollerConfig | undefined) => {
  const retryLimit = config?.retryLimit;

  if (retryLimit === null) return null;
  if (!hasValue(retryLimit)) return DEFAULT_RETRY_LIMIT;
  if (isNonNegativeInteger(retryLimit)) return retryLimit;

  console.error('Retry should be a non-negative integer.');
  return DEFAULT_RETRY_LIMIT;
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
  retryLimit?: number | null;
  runOnStart?: boolean;
};

export type PollerInstance = {
  add: <T = void>(resolvePromise: ResolvePromise<T>) => Promise<T>;
  isIdling: () => boolean;
  clear: () => void;
};

/**
 * A factory that creates a Poller instance.
 * @param config {Object} configure `interval`, `retry`, or `runOnStart`.
 * @returns a poller instance, which you could add a task, clear all ongoing tasks, or check if there're any ongoing tasks.
 */
export const Poller = (config?: PollerConfig): PollerInstance => {
  const runOnStart = Boolean(config?.runOnStart);
  const retryLimit = getValidRetryLimit(config);
  const interval = getValidInterval(config);

  if (retryLimit !== null && (!isInteger(retryLimit) || retryLimit < 0))
    throw new Error('Retry must be a positive Integer.');

  let taskCount = 0;
  const tasks = new Map<number, CancelablePromise<unknown>>();
  const taskEventMapping = new Map<number, number>();

  function poll<T>(resolvePromise: ResolvePromise<T>) {
    const removeAllEvents = (taskId: number) => {
      if (taskEventMapping.has(taskId)) {
        const eventId = taskEventMapping.get(taskId);
        window.clearInterval(eventId);
        taskEventMapping.delete(taskId);
      }
    };

    taskCount += 1;
    const taskId = taskCount;

    const retryCounter = RetryCounter();
    const masterPromise = makeCancelable(
      new Promise<T>(async (resolve, reject) => {
        const deleteTask = (isResolved = true, resolvedValue: T) => {
          removeAllEvents(taskId);
          tasks.delete(taskId);

          if (isResolved) {
            resolve(resolvedValue);
          } else {
            reject('canceled');
          }
        };
        const runTask = async () => {
          try {
            await resolvePromise(deleteTask, retryCounter.getValue);
          } catch (error) {
            // Never abort the task if retry is set as `null` on purpose.
            if (retryLimit === null) return;
            if (retryCounter.getValue() + 1 >= retryLimit) {
              removeAllEvents(taskId);
              tasks.delete(taskId);
              reject(error);
              return;
            }
            retryCounter.increment();
          }
        };
        if (runOnStart) runTask();
        const eventId = window.setInterval(runTask, interval);
        taskEventMapping.set(taskId, eventId);
      })
    );

    tasks.set(taskId, masterPromise);
    return masterPromise.promise;
  }

  return {
    add: <T>(resolvePromise: ResolvePromise<T>): Promise<T> =>
      poll<T>(resolvePromise),
    isIdling: () => Object.keys(taskEventMapping).length === 0,
    clear: () => {
      taskEventMapping.forEach((eventId, taskId) => {
        tasks.get(taskId)?.cancel();
        window.clearInterval(eventId);
      });
      taskEventMapping.clear();
      tasks.clear();
      taskCount = 0;
    },
  };
};
