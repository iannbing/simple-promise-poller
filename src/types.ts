export type CancelTask<T = unknown, E = Error> = (
  isResolved?: boolean,
  value?: T | E
) => T | void | undefined;

export type AsyncTask<T = unknown, E = Error> = (
  cancelTask: CancelTask<T, E>,
  getRetryCount: () => number,
  initialValue?: any
) => Promise<T | void | undefined>;

export type TaskOption = {
  interval?: number;
  timeout?: number;
  retryLimit?: number | null;
  runOnStart?: boolean;
  initialValue?: any;
};

export type PollerConfig = Omit<TaskOption, 'initialValue'>;
