/**
 * A simple function that checks if a variable is not undefined, nor null
 * @param variable any arbitrary variable
 * @returns boolean
 */
export const hasValue = <T>(variable: T | undefined | null): variable is T => {
  return variable !== undefined && variable !== null;
};
