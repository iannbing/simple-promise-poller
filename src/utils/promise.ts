export type CancelablePromise<T = unknown> = {
  readonly promise: Promise<T | void>;
  readonly cancel: (shouldReject?: boolean, reason?: any) => void;
};

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with an Error with ,
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 */
export function makeCancelable<T>(
  original: Promise<T | void>
): CancelablePromise<T> {
  let status: 'RESOLVED' | 'REJECTED' | 'READY' = 'READY';
  let resolveRef: (value: T | void | PromiseLike<T>) => void;
  let rejectRef: (reason?: any) => void;
  let resolvedValue: T | void;

  const promise = new Promise<T | void>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
    original
      .then(result => {
        if (status === 'REJECTED') reject();
        status = 'RESOLVED';
        resolvedValue = result;
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
    cancel: (shouldReject = false, payload?: any) => {
      if (!shouldReject && resolveRef && status !== 'RESOLVED') {
        resolveRef(payload || resolvedValue);
        status = 'RESOLVED';
      }
      if (shouldReject && rejectRef && status !== 'REJECTED') {
        rejectRef(payload);
        status = 'REJECTED';
      }
    },
  };
}
