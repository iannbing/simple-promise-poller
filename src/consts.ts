import { PollerConfig } from './types';

export const DEFAULT_INTERVAL = 1000;
export const DEFAULT_RETRY_LIMIT = 10;

export const DEFAULT_CONFIG: PollerConfig = {
  interval: DEFAULT_INTERVAL,
  retryLimit: DEFAULT_RETRY_LIMIT,
  runOnStart: false,
};
