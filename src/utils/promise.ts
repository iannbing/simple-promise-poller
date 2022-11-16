export type CancelablePromise<T = unknown> = {
  readonly promise: Promise<T>;
  readonly cancel: (reason?: any) => void;
};

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with an Error with 'canceled',
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 */
export function makeCancelable<T>(original: Promise<T>): CancelablePromise<T> {
  let status: 'RESOLVED' | 'REJECTED' | 'READY' = 'READY';
  let rejectRef: (reason?: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    rejectRef = reject;
    original
      .then(result => {
        if (status === 'REJECTED') reject('canceled');
        status = 'RESOLVED';
        resolve(result);
      })
      .catch(error => {
        if (status === 'REJECTED') reject('canceled');
        status = 'REJECTED';
        reject(error);
      });
  });

  return {
    promise,
    cancel: (reason: any) => {
      // Only call reject if the promise is not yet resolved / rejected.
      if (rejectRef && status === 'READY') rejectRef(reason ?? 'canceled');
      status = 'REJECTED';
    },
  };
}
