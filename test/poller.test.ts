import { Poller } from '../src';

const errorMessage = (count: number) =>
  `stop polling after retry ${count} times.`;

describe('Poller', () => {
  const poller = Poller({ interval: 1 });
  beforeEach(async () => {
    poller.clear();
    expect(poller.isIdling()).toBe(true);
  });

  it('should retry 10 times by default', async () => {
    const mockCallback = jest.fn(async (_, getRetryCount) => {
      throw new Error(errorMessage(getRetryCount() + 1));
    });

    try {
      await poller.add(mockCallback);
    } catch (error) {
      expect(String(error)).toEqual(`Error: ${errorMessage(10)}`);
    }
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });

  it('should stop polling and resolve the master promise when deleteTask is called without giving input.', async () => {
    const times = 8;

    let counter = 0;
    const mockCallback = jest.fn(async deleteTask => {
      counter += 1;
      if (counter >= times) deleteTask();
    });

    await poller.add(mockCallback);
    expect(mockCallback).toHaveBeenCalledTimes(times);
  });

  it('should stop polling and result in a rejection when deleteTask is called with false.', async () => {
    const times = 8;

    let counter = 0;
    const mockCallback = jest.fn(async deleteTask => {
      counter += 1;
      if (counter >= times) deleteTask(false);
    });

    try {
      await poller.add(mockCallback);
    } catch (error) {
      expect(mockCallback).toHaveBeenCalledTimes(times);
    }
  });

  it('should stop and delete all tasks when poller.clear is called.', async () => {
    const taskCount = 8;

    let counter = 0;
    const mockCallback = jest.fn(async () => {
      counter += 1;
      return counter;
    });

    window.setTimeout(() => {
      poller.clear();
      expect(poller.isIdling()).toBe(true);
    }, 3);

    await Promise.allSettled(
      [...Array(taskCount)].map(() => poller.add(mockCallback))
    );
  });
});
