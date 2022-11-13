import { createPoller, PollerInstance } from './poller';
import { AsyncTask, CancelTask, PollerConfig, TaskConfig } from './types';

const {
  poll,
  pipe,
  clear: clearTasks,
  isIdling: isPollerIdling,
} = createPoller();

export {
  createPoller,
  AsyncTask,
  CancelTask,
  PollerInstance,
  PollerConfig,
  TaskConfig,
  poll,
  pipe,
  clearTasks,
  isPollerIdling,
};
export default createPoller;
