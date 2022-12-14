import {
  CancelTask,
  clearAllTasks,
  isPollerIdling,
  setConfig,
  poll,
  pipe,
} from '../src';

const errorMessage = (count: number) =>
  `stop polling after retry ${count} times.`;

const getRandomNumber = (min = 5, max = 9) =>
  Math.floor(min + Math.random() * (max - min + 1));

describe('Poller', () => {
  setConfig({ interval: 10 });
  beforeEach(async () => {
    clearAllTasks();
    expect(isPollerIdling()).toBe(true);
  });

  it('should retry 10 times by default', async () => {
    const mockCallback = jest.fn(async (_, getRetryCount) => {
      throw new Error(errorMessage(getRetryCount() + 1));
    });

    try {
      await poll(mockCallback);
    } catch (error) {
      expect(String(error)).toEqual(`Error: ${errorMessage(10)}`);
    }
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });

  it('should reset retry count if one task promise is resolved.', async () => {
    const resetAtCount = getRandomNumber();
    let shouldResolve = true;
    const mockCallback = jest.fn(async (_, getRetryCount) => {
      if (getRetryCount() === resetAtCount && shouldResolve) {
        shouldResolve = false;
        return;
      }
      throw new Error(errorMessage(getRetryCount() + 1));
    });

    try {
      await poll(mockCallback);
    } catch (error) {
      expect(String(error)).toEqual(`Error: ${errorMessage(10)}`);
    }
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(10 + resetAtCount + 1);
  });

  it('should time out if the promise is still hanging right before the next polling', async () => {
    const mockCallback = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10000000));
    });

    try {
      await poll(mockCallback);
    } catch (error) {
      expect(String(error)).toEqual(`Timed out after ${10} ms`);
    }
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });

  it('should time out early if timeout is given', async () => {
    const mockCallback = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10000000));
    });

    try {
      await poll(mockCallback, { timeout: 3 });
    } catch (error) {
      expect(String(error)).toEqual(`Timed out after ${3} ms`);
    }
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });

  it('should ignore given timeout if timeout is greater than interval', async () => {
    const mockCallback = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10000000));
    });

    try {
      await poll(mockCallback, { timeout: 20 });
    } catch (error) {
      expect(String(error)).toEqual(`Timed out after ${10} ms`);
    }
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });

  it('should stop polling and resolve the master promise when cancelTask is called without any input.', async () => {
    const times = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(
      async (cancelTask: CancelTask<{ value: number }>) => {
        counter.value += 1;
        return counter.value >= times ? cancelTask() : counter;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    const resolvedValue = await poll(mockCallback);
    expect(isPollerIdling()).toBe(true);
    expect(resolvedValue).toEqual({ value: times });
    expect(mockCallback).toHaveBeenCalledTimes(times);
  });

  it('should stop polling and result in a rejection when cancelTask is called with false.', async () => {
    const times = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(
      async (cancelTask: CancelTask<string | { value: number }>) => {
        counter.value += 1;
        return counter.value >= times
          ? cancelTask(false, 'task failed')
          : counter;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    try {
      await poll(mockCallback);
    } catch (error) {
      expect(error).toEqual('task failed');
    }
    expect(mockCallback).toHaveBeenCalledTimes(times);
  });

  it('should stop and clear all tasks when `poller.clear` is called.', async () => {
    const taskCount = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(async () => {
      counter.value += 1;
      return counter;
    });

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
      clearAllTasks();
      expect(isPollerIdling()).toBe(true);
    }, 100);

    await Promise.allSettled(
      [...Array(taskCount)].map(() => poll(mockCallback))
    );
  });

  it('should return the last resolved value if stopTask did not pass any value.', async () => {
    const times = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(
      async (cancelTask: CancelTask<{ value: number }>) => {
        counter.value += 1;
        return counter.value >= times ? cancelTask() : counter;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    const value = await poll(mockCallback);
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(times);
    expect(value).toEqual({ value: times });
  });

  it('should return the value passed to cancelTask, if isResolved is true.', async () => {
    const times = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(
      async (cancelTask: CancelTask<{ value: number }>) => {
        counter.value += 1;
        return counter.value >= times
          ? cancelTask(true, { value: 100 })
          : counter;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    const value = await poll(mockCallback);
    expect(isPollerIdling()).toBe(true);
    expect(mockCallback).toHaveBeenCalledTimes(times);
    expect(value).toEqual({ value: 100 });
  });

  it('should reject the master promise, if isResolved is false.', async () => {
    const times = getRandomNumber();

    const counter = { value: 0 };
    const mockCallback = jest.fn(
      async (cancelTask: CancelTask<{ value: number }>) => {
        counter.value += 1;
        return counter.value >= times ? cancelTask(false) : counter;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    let value: any;
    try {
      value = await poll(mockCallback);
    } catch (error) {
      expect(mockCallback).toHaveBeenCalledTimes(times);
      expect(error).toEqual({ value: times });
    }
    expect(isPollerIdling()).toBe(true);
    expect(value).toBeUndefined();
  });

  it('pipe should execute the tasks sequentially.', async () => {
    const times1 = getRandomNumber();

    let counter1 = 0;
    let result1 = 0;
    const mockCallback1 = jest.fn(
      async (cancelTask: CancelTask<number>, _, initialValue) => {
        counter1 += 1;
        if (counter1 >= times1) {
          result1 = getRandomNumber();
          cancelTask(true, initialValue + result1);
        }
        return counter1;
      }
    );

    const times2 = getRandomNumber();

    let counter2 = 0;
    let result2 = 0;
    const mockCallback2 = jest.fn(
      async (cancelTask: CancelTask<number>, _, initialValue) => {
        counter2 += 1;
        if (counter2 >= times2) {
          result2 = getRandomNumber();
          cancelTask(true, initialValue + result2);
        }
        return counter2;
      }
    );

    setTimeout(() => {
      expect(isPollerIdling()).toBe(false);
    }, 1);

    const initialValue = getRandomNumber();
    const value = await pipe(mockCallback1, mockCallback2)({ initialValue });

    expect(isPollerIdling()).toBe(true);

    expect(mockCallback1).toHaveBeenCalledTimes(times1);
    expect(mockCallback2).toHaveBeenCalledTimes(times2);
    expect(value).toEqual(initialValue + result1 + result2);
  });
  it('pipe should bubble up the error', async () => {
    const mockCallback1 = jest.fn(async (cancelTask: CancelTask<string>) => {
      return cancelTask(true, 'bird');
    });
    const mockCallback2 = jest.fn(async (cancelTask: CancelTask<string>) => {
      return cancelTask(false, 'flower');
    });
    const mockCallback3 = jest.fn(async (cancelTask: CancelTask<string>) => {
      return cancelTask(true, 'water');
    });

    try {
      const result = await pipe(mockCallback1, mockCallback2, mockCallback3)();
      console.log(result); // Will not print;
    } catch (error) {
      expect(error).toEqual('flower');
    }
    expect(mockCallback1).toHaveBeenCalledTimes(1);
    expect(mockCallback2).toHaveBeenCalledTimes(1);
    expect(mockCallback3).toHaveBeenCalledTimes(0);

    expect(isPollerIdling()).toBe(true);
  });
  it('clearAllTasks should not result in task rejections, but resolve all tasks with their last resolved value respectively', async () => {
    const mockCallback1 = jest.fn(async () => ({}));
    const mockCallback2 = jest.fn(async () => 123);
    const mockCallback3 = jest.fn(async () => 'value');

    const [result1, result2, result3] = await Promise.all([
      poll(mockCallback1),
      poll(mockCallback2),
      poll(mockCallback3),
      new Promise<void>(resolve =>
        setTimeout(() => {
          clearAllTasks();
          resolve();
        }, 100)
      ),
    ]);

    expect(mockCallback1).toHaveBeenCalled();
    expect(mockCallback2).toHaveBeenCalled();
    expect(mockCallback3).toHaveBeenCalled();
    expect(result1).toEqual({});
    expect(result2).toEqual(123);
    expect(result3).toEqual('value');
    expect(isPollerIdling()).toBe(true);
  });
});
