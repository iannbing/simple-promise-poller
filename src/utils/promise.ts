export type CancelablePromise<T = unknown> = Promise<T> & {
  readonly isCanceled: () => boolean;
  readonly cancel: (message?: string) => void;
};

export class PromiseCanceledError extends Error {
  readonly name = 'PromiseCanceledError';
  readonly isCanceled = true;

  constructor(message = 'The promise was canceled.') {
    super(message);
  }
}

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with a `PromiseCanceledError`,
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 * @param onEnd Called immediately when the promise is resolved, rejected, or canceled.
 */
export function makeCancelable<T>(
  original: Promise<T>,
  onEnd?: () => void
): CancelablePromise<T> {
  let cancelMessage: string | undefined = undefined;

  const promise = new Promise<T>((resolve, reject) => {
    original
      .then(result => (cancelMessage ? reject(cancelMessage) : resolve(result)))
      .catch(error => (cancelMessage ? reject(cancelMessage) : reject(error)))
      .finally(() => onEnd?.());
  });

  return Object.assign(promise, {
    isCanceled: () => Boolean(cancelMessage),
    cancel: (message?: string) => {
      cancelMessage = message;
      onEnd?.();
    },
  });
}

export const isCancelable = <T>(
  promise: Promise<T>
): promise is CancelablePromise<T> =>
  typeof (promise as CancelablePromise).cancel === 'function' &&
  typeof (promise as CancelablePromise).isCanceled === 'function';
