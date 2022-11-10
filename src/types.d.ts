export type CancelTask<T> = (isResolved?: boolean, value?: T) => void;

export type ResolvePromise<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number
) => Promise<T | undefined | void>;

export type PollFunction = <T = void>(
  task: ResolvePromise<T>,
  runOnStart?: boolean
) => Promise<void | T | undefined>;

export type PollerConfig = {
  interval?: number;
  retryLimit?: number | null;
};

export type PipeConfig = { runOnStart: boolean };
export type PipeTask<T> = (result: any) => ResolvePromise<T>;
