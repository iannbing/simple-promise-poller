import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { CancelTask, PollerConfig, AsyncTask, TaskOption } from './types';
import { RetryCounter } from './retry-counter';
import { isNonNegativeInteger } from './utils/number';
import {
  DEFAULT_CONFIG,
  DEFAULT_INTERVAL,
  DEFAULT_RETRY_LIMIT,
} from './consts';

/**
 * A factory that creates a Poller instance.
 * @param config {PollerConfig} configure `interval` and `retryLimit`.
 * @returns a poller instance, which you could add a task, clear all ongoing tasks, or check if there're any ongoing tasks.
 */
export const createPoller = (config: PollerConfig = {}) => {
  let pollerConfig = { ...DEFAULT_CONFIG, ...config };
  let taskCount = 0;
  const tasks = new Map<number, CancelablePromise<unknown>>();
  const taskEventMapping = new Map<number, number | NodeJS.Timer>();

  const poll = <T>(task: AsyncTask<T>, option?: TaskOption) => {
    const clearEvents = (taskId: number) => {
      if (taskEventMapping.has(taskId)) {
        const eventId = taskEventMapping.get(taskId);
        clearInterval(eventId);
        taskEventMapping.delete(taskId);
      }
    };

    taskCount += 1;
    const taskId = taskCount;
    let cachedValue: T | undefined | void;

    const retryCounter = RetryCounter();
    const masterPromise = makeCancelable(
      new Promise<T | undefined | void>(async (resolve, reject) => {
        const cancelTask: CancelTask<T> = (isResolved, value) => {
          clearEvents(taskId);
          tasks.delete(taskId);

          if (isResolved === undefined || isResolved) {
            resolve(value || cachedValue);
            return value || cachedValue;
          } else {
            reject(value || cachedValue || 'canceled');
          }
        };
        const runTask = async () => {
          try {
            cachedValue = await task(
              cancelTask,
              retryCounter.getValue,
              option?.initialValue
            );
            retryCounter.reset();
          } catch (error) {
            // Never abort the task if retryLimit is set as `null` on purpose.
            const retryLimit = getValidRetryLimit(
              option?.retryLimit !== undefined
                ? option?.retryLimit
                : pollerConfig.retryLimit
            );
            if (retryLimit === null) return;
            if (retryCounter.getValue() + 1 >= retryLimit) {
              clearEvents(taskId);
              tasks.delete(taskId);
              reject(error);
              return;
            }
            retryCounter.increment();
          }
        };
        if (option?.runOnStart || pollerConfig.runOnStart) runTask();
        const interval = getValidInterval(
          option?.interval ?? pollerConfig.interval
        );
        const eventId = setInterval(runTask, interval);
        taskEventMapping.set(taskId, eventId);
      })
    );

    tasks.set(taskId, masterPromise);
    return masterPromise.promise;
  };

  const pipe = <T, R extends T>(...tasks: AsyncTask<T>[]) => async (
    config?: TaskOption
  ) => {
    const { initialValue, ...pipeConfig } = config || {};
    const result = await tasks.reduce(async (prevTask, task) => {
      try {
        const previousResult = await prevTask;
        return poll<T>(
          (cancelTask, getRetryCount) =>
            task(cancelTask, getRetryCount, previousResult),
          pipeConfig
        );
      } catch (error) {
        throw error;
      }
    }, Promise.resolve(initialValue) as Promise<T | undefined | void>);
    return result as R;
  };

  const clear = () => {
    taskEventMapping.forEach((eventId, taskId) => {
      tasks.get(taskId)?.cancel();
      window.clearInterval(eventId);
    });
    taskEventMapping.clear();
    tasks.clear();
    taskCount = 0;
  };

  const isIdling = () => taskEventMapping.size === 0;

  const setConfig = (newConfig: PollerConfig) => {
    pollerConfig = { ...pollerConfig, ...newConfig };
  };

  return { poll, pipe, isIdling, clear, setConfig };
};

const getValidRetryLimit = (retryLimit: number | null | undefined) => {
  if (retryLimit === null) return null;
  if (!hasValue(retryLimit)) return DEFAULT_RETRY_LIMIT;
  if (isNonNegativeInteger(retryLimit)) return retryLimit;

  console.error(
    '`retryLimit` should be null or a non-negative integer. ' +
      `Use default value ${DEFAULT_RETRY_LIMIT} instead.`
  );
  return DEFAULT_RETRY_LIMIT;
};

const getValidInterval = (interval: number | undefined) => {
  if (!hasValue(interval)) return DEFAULT_INTERVAL;
  if (isNonNegativeInteger(interval)) return interval;

  console.error('Interval should be a non-negative integer.');
  return DEFAULT_INTERVAL;
};

export type PollerInstance = ReturnType<typeof createPoller>;
