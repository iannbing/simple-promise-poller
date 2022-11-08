import { Poller } from '../src';

const errorMessage = (count: number) =>
  `stop polling after retry ${count} times.`;

const getTimes = () => Math.floor(Math.random() * 10);

describe('Poller', () => {
  const poller = Poller({ interval: 0 });
  beforeEach(async () => {
    await poller.clean();
    expect(poller.isIdling()).toBe(true);
  });
  it('should retry 10 times by default', async () => {
    const mockCallback = jest.fn();
    mockCallback.mockImplementation(async (_, getRetryCount) => {
      throw new Error(errorMessage(getRetryCount() + 1));
    });
    try {
      await poller.add(mockCallback);
    } catch (error) {
      expect(String(error)).toEqual(`Error: ${errorMessage(10)}`);
    }
    expect(mockCallback).toHaveBeenCalledTimes(10);
  });
  it('should stop polling and resolve the master promise when stopPolling is called without giving input.', async () => {
    const times = getTimes();
    const mockCallback = jest.fn();
    let counter = 0;
    mockCallback.mockImplementation(async stopPolling => {
      counter += 1;
      if (counter === times) stopPolling();
    });
    await poller.add(mockCallback);
    expect(mockCallback).toHaveBeenCalledTimes(times);
  });

  it('should stop polling and result in a rejection when stopPolling is called with false.', async () => {
    const times = getTimes();
    const mockCallback = jest.fn();
    let counter = 0;
    mockCallback.mockImplementation(async stopPolling => {
      counter += 1;
      if (counter === times) stopPolling(false);
    });
    try {
      await poller.add(mockCallback);
    } catch (error) {
      expect(mockCallback).toHaveBeenCalledTimes(times);
    }
  });
});
