export const RetryCounter = () => {
  let retry = 0;
  return {
    getValue: () => retry,
    reset: () => {
      retry = 0;
    },
    increment: () => {
      retry += 1;
      return retry;
    },
  };
};
