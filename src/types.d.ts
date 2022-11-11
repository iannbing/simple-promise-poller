export type CancelTask<T = void> = (
  isResolved?: boolean,
  value?: T
) => T | void | undefined;

export type AsyncTask<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number,
  initialValue?: any
) => Promise<T | undefined | void>;

export type PollerConfig = {
  interval?: number;
  retryLimit?: number | null;
};

export type PipeConfig = { runOnStart?: boolean; initialValue?: any };
