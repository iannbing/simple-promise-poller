export type Resolved<T> = {
  status: 'fulfilled';
  data: T;
};

export type Rejected<E> = {
  status: 'rejected';
  error: E;
};

export type PollerCallbackProps<T, E = Error> = Resolved<T> | Rejected<E>;

export type PollerCallback<T, E = Error> = (
  props: PollerCallbackProps<T, E>
) => boolean | undefined;

export type Poll<T, E = Error> = (
  promise: Promise<T> | (() => Promise<T>),
  callback?: PollerCallback<T, E> | number,
  interval?: number
) => Promise<T>;
