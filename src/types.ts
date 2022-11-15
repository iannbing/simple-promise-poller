export type CancelTask<T = void> = (
  isResolved?: boolean,
  value?: T
) => T | void | undefined;

export type AsyncTask<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number,
  initialValue?: any
) => Promise<T | undefined | void>;

export type TaskOption = {
  interval?: number;
  retryLimit?: number | null;
  runOnStart?: boolean;
  initialValue?: any;
};

export type PollerConfig = Omit<TaskOption, 'initialValue'>;
