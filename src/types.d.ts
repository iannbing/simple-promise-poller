export type CancelTask<T = void> = (isResolved?: boolean, value?: T) => void;

export type ResolvePromise<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number,
  initialValue?: any
) => Promise<T | undefined>;

export type PollFunction = <T = void>(
  task: ResolvePromise<T>,
  runOnStart?: boolean
) => Promise<void | T | undefined>;

export type PollerConfig = {
  interval?: number;
  retryLimit?: number | null;
};

export type PipeConfig = { runOnStart: boolean; initialValue?: any };
