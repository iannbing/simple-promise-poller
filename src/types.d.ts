export type CancelTask<T> = (isResolved?: boolean, value?: T) => void;

export type ResolvePromise<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number
) => Promise<T | undefined | void>;
