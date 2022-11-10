import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import {
  CancelTask,
  PipeConfig,
  PipeTask,
  PollerConfig,
  ResolvePromise,
} from './types';
import { RetryCounter } from './retry-counter';
import { isNonNegativeInteger } from './utils/number';

/**
 * A factory that creates a Poller instance.
 * @param config {Object} configure `interval` and `retryLimit`.
 * @returns a poller instance, which you could add a task, clear all ongoing tasks, or check if there're any ongoing tasks.
 */
export const Poller = (config?: PollerConfig) => {
  const retryLimit = getValidRetryLimit(config);
  const interval = getValidInterval(config);

  let taskCount = 0;
  const tasks = new Map<number, CancelablePromise<unknown>>();
  const taskEventMapping = new Map<number, number>();

  const poll = <T>(resolvePromise: ResolvePromise<T>, runOnStart?: boolean) => {
    const clearEvents = (taskId: number) => {
      if (taskEventMapping.has(taskId)) {
        const eventId = taskEventMapping.get(taskId);
        window.clearInterval(eventId);
        taskEventMapping.delete(taskId);
      }
    };

    taskCount += 1;
    const taskId = taskCount;
    let cachedValue: T | undefined;

    const retryCounter = RetryCounter();
    const masterPromise = makeCancelable(
      new Promise<T | undefined>(async (resolve, reject) => {
        const cancelTask: CancelTask<T> = (isResolved, value) => {
          clearEvents(taskId);
          tasks.delete(taskId);

          if (isResolved === undefined || isResolved) {
            resolve(value || cachedValue);
          } else {
            reject('canceled');
          }
        };
        const runTask = async () => {
          try {
            cachedValue = await resolvePromise(
              cancelTask,
              retryCounter.getValue
            );
          } catch (error) {
            // Never abort the task if retryLimit is set as `null` on purpose.
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
        if (runOnStart) runTask();
        const eventId = window.setInterval(runTask, interval);
        taskEventMapping.set(taskId, eventId);
      })
    );

    tasks.set(taskId, masterPromise);
    return masterPromise.promise;
  };

  return {
    poll,
    add: poll,
    pipe: <T, R extends T>(...tasks: PipeTask<T>[]) => async (
      config?: PipeConfig
    ) => {
      const { runOnStart = false } = config || {};
      const result = await tasks.reduce(async (prevTask, task) => {
        const previousResult = await prevTask;
        return poll<T | undefined>(task(previousResult), runOnStart);
      }, Promise.resolve() as Promise<T | undefined>);
      return result as R;
    },
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

const DEFAULT_INTERVAL = 2000;
const DEFAULT_RETRY_LIMIT = 10;

const getValidRetryLimit = (config: PollerConfig | undefined) => {
  const retryLimit = config?.retryLimit;

  if (retryLimit === null) return null;
  if (!hasValue(retryLimit)) return DEFAULT_RETRY_LIMIT;
  if (isNonNegativeInteger(retryLimit)) return retryLimit;

  console.error(
    '`retryLimit` should be null or a non-negative integer. ' +
      `Use default value ${DEFAULT_RETRY_LIMIT} instead.`
  );
  return DEFAULT_RETRY_LIMIT;
};

const getValidInterval = (config: PollerConfig = {}) => {
  const intervalConfig = config?.interval;

  if (!hasValue(intervalConfig)) return DEFAULT_INTERVAL;
  if (isNonNegativeInteger(intervalConfig)) return intervalConfig;

  console.error('Interval should be a non-negative integer.');
  return DEFAULT_INTERVAL;
};

export type PollerInstance = ReturnType<typeof Poller>;
