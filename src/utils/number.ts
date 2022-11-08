import { hasValue } from './variable';

export const isInteger = (num: number | undefined): num is number =>
  hasValue(num) && Number.isInteger(num);

export const isNonNegativeInteger = (num: number | undefined): num is number =>
  isInteger(num) && num >= 0;
