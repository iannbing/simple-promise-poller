import { hasValue } from './utils/variable';
import { CancelablePromise, makeCancelable } from './utils/promise';
import {
  CancelTask,
  PipeConfig,
  PipeTask,
  PollerConfig,
  PollerInstance,
  ResolvePromise,
} from './types';
import { RetryCounter } from './retry-counter';
import { isInteger, isNonNegativeInteger } from './utils/number';

/**
 * A factory that creates a Poller instance.
 * @param config {Object} configure `interval`, `retry`, or `runOnStart`.
 * @returns a poller instance, which you could add a task, clear all ongoing tasks, or check if there're any ongoing tasks.
 */
export const Poller = (config?: PollerConfig): PollerInstance => {
  const retryLimit = getValidRetryLimit(config);
  const interval = getValidInterval(config);

  if (retryLimit !== null && (!isInteger(retryLimit) || retryLimit < 0))
    throw new Error('Retry must be a positive Integer.');

  let taskCount = 0;
  const tasks = new Map<number, CancelablePromise<unknown>>();
  const taskEventMapping = new Map<number, number>();

  function poll<T>(resolvePromise: ResolvePromise<T>, runOnStart?: boolean) {
    const clearEvents = (taskId: number) => {
      if (taskEventMapping.has(taskId)) {
        const eventId = taskEventMapping.get(taskId);
        window.clearInterval(eventId);
        taskEventMapping.delete(taskId);
      }
    };

    taskCount += 1;
    const taskId = taskCount;
    let cachedValue: void | Awaited<T> | undefined;

    const retryCounter = RetryCounter();
    const masterPromise = makeCancelable(
      new Promise<T | undefined | void>(async (resolve, reject) => {
        const deleteTask: CancelTask<T> = (isResolved, value) => {
          clearEvents(taskId);
          tasks.delete(taskId);

          if (isResolved) {
            resolve(value || cachedValue);
          } else {
            reject('canceled');
          }
        };
        const runTask = async () => {
          try {
            cachedValue = await resolvePromise(
              deleteTask,
              retryCounter.getValue
            );
          } catch (error) {
            // Never abort the task if retry is set as `null` on purpose.
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
  }

  return {
    add: <T = void>(task: ResolvePromise<T>): Promise<T | undefined | void> =>
      poll<T>(task),
    pipe: async <T = void, R = T>(...tasks: (PipeConfig | PipeTask<T>)[]) => {
      const [{ runOnStart }, actualTasks] = processPipeArgs(tasks);
      const result = await actualTasks.reduce(async (prevTask, task) => {
        const previousResult = await prevTask;
        return poll<any>(task(previousResult), runOnStart);
      }, Promise.resolve() as Promise<T>);
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

const processPipeArgs = <T>(
  tasks: (PipeConfig | PipeTask<T>)[]
): [PipeConfig, PipeTask<T>[]] => {
  // Only the first one could be PipeConfig.
  if (tasks[0] instanceof Function) {
    return [{ runOnStart: false }, tasks as PipeTask<T>[]];
  } else {
    const [config, ...actualTasks] = tasks;
    return [config, actualTasks as PipeTask<T>[]];
  }
};
