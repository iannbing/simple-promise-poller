export type CancelablePromise<T = unknown> = {
  readonly promise: Promise<T>;
  readonly cancel: () => void;
};

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with an Error with 'canceled',
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 */
export function makeCancelable<T>(original: Promise<T>): CancelablePromise<T> {
  let isCanceled = false;
  let rejectRef: (reason?: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    rejectRef = reject;
    original
      .then(result => (isCanceled ? reject('canceled') : resolve(result)))
      .catch(error => (isCanceled ? reject('canceled') : reject(error)));
  });

  return {
    promise,
    cancel: () => {
      isCanceled = true;
      if (rejectRef) rejectRef('canceled');
    },
  };
}
