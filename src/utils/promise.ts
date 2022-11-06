export type CancelablePromise<T = unknown> = {
  readonly promise: Promise<T>;
  readonly cancel: () => void;
};

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with an Error with { isCanceled: true },
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 */
export function makeCancelable<T>(original: Promise<T>): CancelablePromise<T> {
  let isCanceled = false;

  const promise = new Promise<T>((resolve, reject) => {
    original
      .then(result => (isCanceled ? reject({ isCanceled }) : resolve(result)))
      .catch(error => (isCanceled ? reject({ isCanceled }) : reject(error)));
  });

  return {
    promise,
    cancel: () => {
      isCanceled = true;
    },
  };
}
