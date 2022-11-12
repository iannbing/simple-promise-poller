import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import { CancelTask, PollerConfig, AsyncTask, TaskConfig } from './types';
import { RetryCounter } from './retry-counter';
import { isNonNegativeInteger } from './utils/number';
import { DEFAULT_INTERVAL, DEFAULT_RETRY_LIMIT } from './consts';

/**
 * A factory that creates a Poller instance.
 * @param config {PollerConfig} configure `interval` and `retryLimit`.
 * @returns a poller instance, which you could add a task, clear all ongoing tasks, or check if there're any ongoing tasks.
 */
export const Poller = (config?: PollerConfig) => {
  let taskCount = 0;
  const tasks = new Map<number, CancelablePromise<unknown>>();
  const taskEventMapping = new Map<number, number | NodeJS.Timer>();

  const poll = <T>(task: AsyncTask<T>, taskConfig?: TaskConfig) => {
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
              taskConfig?.initialValue
            );
            retryCounter.reset();
          } catch (error) {
            // Never abort the task if retryLimit is set as `null` on purpose.
            const retryLimit = getValidRetryLimit(
              taskConfig?.retryLimit !== undefined
                ? taskConfig?.retryLimit
                : config?.retryLimit
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
        if (taskConfig?.runOnStart || config?.runOnStart) runTask();
        const interval = getValidInterval(
          taskConfig?.interval ?? config?.interval
        );
        const eventId = setInterval(runTask, interval);
        taskEventMapping.set(taskId, eventId);
      })
    );

    tasks.set(taskId, masterPromise);
    return masterPromise.promise;
  };

  const pipe = <T, R extends T>(...tasks: AsyncTask<T>[]) => async (
    config?: TaskConfig
  ) => {
    const { initialValue, ...pipeConfig } = config || {};
    const result = await tasks.reduce(async (prevTask, task) => {
      const previousResult = await prevTask;
      return poll<T>(
        (cancelTask, getRetryCount) =>
          task(cancelTask, getRetryCount, previousResult),
        pipeConfig
      );
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

  return { poll, add: poll, pipe, isIdling, clear };
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

export type PollerInstance = ReturnType<typeof Poller>;
