export type ResolvePromise<T = unknown> = (
  stopPolling: StopPollingFunction,
  getRetryCount: () => number
) => Promise<T>;

export type StopPollingFunction = (isResolved: boolean) => void;
