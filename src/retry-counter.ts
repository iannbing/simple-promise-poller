export const RetryCounter = () => {
  let retry = 0;
  return {
    getValue: () => retry,
    increment: () => {
      retry += 1;
      return retry;
    },
  };
};
