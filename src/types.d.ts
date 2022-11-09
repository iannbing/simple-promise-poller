export type ResolvePromise<T = unknown> = (
  deleteTask: (isResolved?: boolean, resolvedValue: T) => void,
  getRetryCount: () => number
) => Promise<T>;
