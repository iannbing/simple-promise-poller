export type ResolvePromise = (
  stopPolling: StopPollingFunction,
  getRetryCount: () => number
) => Promise<unknown>;

export type StopPollingFunction = (isResolved: boolean) => void;
