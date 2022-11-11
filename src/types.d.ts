export type CancelTask<T = void> = (isResolved?: boolean, value?: T) => void;

export type AsyncTask<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number,
  initialValue?: any
) => Promise<T | undefined>;

export type PollerConfig = {
  interval?: number;
  retryLimit?: number | null;
};

export type PipeConfig = { runOnStart: boolean; initialValue?: any };
