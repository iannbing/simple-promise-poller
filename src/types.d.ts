export type CancelTask<T> = (isResolved?: boolean, value?: T) => void;

export type ResolvePromise<T = unknown> = (
  cancelTask: CancelTask<T>,
  getRetryCount: () => number
) => Promise<T | undefined | void>;

export type PollerInstance = {
  add: <T = void>(task: ResolvePromise<T>) => Promise<void | T | undefined>;
  pipe: <T = void, R = T>(
    ...tasks: (PipeConfig | PipeTask<T>)[]
  ) => Promise<R | undefined>;
  isIdling: () => boolean;
  clear: () => void;
};

export type PollerConfig = {
  interval?: number;
  retryLimit?: number | null;
};

export type PipeConfig = { runOnStart: boolean };
export type PipeTask<T> = (result: any) => ResolvePromise<T>;
