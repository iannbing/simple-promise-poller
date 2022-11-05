export type PollerCallbackProps<T, E = Error> =
  | {
      status: 'fulfilled';
      data: T;
    }
  | {
      status: 'rejected';
      error: E;
    };

export type PollerCallback<T, E = Error> = (
  props: PollerCallbackProps<T, E>
) => boolean | undefined;

export type Poll<T, E = Error> = (
  promise: Promise<T> | (() => Promise<T>),
  callback?: PollerCallback<T, E> | number,
  interval?: number
) => Promise<T>;
