export type CancelablePromise<T = unknown> = {
  readonly promise: Promise<T | 'canceled' | void>;
  readonly cancel: (shouldReject?: boolean, reason?: any) => void;
};

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with an Error with 'canceled',
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 */
export function makeCancelable<T>(
  original: Promise<T | void>
): CancelablePromise<T> {
  let status: 'RESOLVED' | 'REJECTED' | 'READY' = 'READY';
  let resolveRef: (value: T | 'canceled' | void | PromiseLike<T>) => void;
  let rejectRef: (reason?: any) => void;

  const promise = new Promise<T | 'canceled' | void>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
    original
      .then(result => {
        if (status === 'REJECTED') reject();
        status = 'RESOLVED';
        resolve(result);
      })
      .catch(error => {
        if (status === 'REJECTED') reject();
        status = 'REJECTED';
        reject(error);
      });
  });

  return {
    promise,
    cancel: (shouldReject = false, reason?: any) => {
      // Only call reject if the promise is not yet resolved / rejected.
      if (!shouldReject && resolveRef && status === 'READY') {
        resolveRef('canceled');
      }
      if (shouldReject && rejectRef && status === 'READY') {
        rejectRef(reason);
      }
      status = 'REJECTED';
    },
  };
}
