import { createPoller, PollerInstance } from './poller';
import { AsyncTask, CancelTask, PollerConfig, TaskOption } from './types';

const {
  poll,
  pipe,
  clear: clearAllTasks,
  isIdling: isPollerIdling,
  setConfig,
} = createPoller();

export {
  createPoller,
  AsyncTask,
  CancelTask,
  PollerInstance,
  PollerConfig,
  TaskOption,
  poll,
  pipe,
  clearAllTasks,
  isPollerIdling,
  setConfig,
};
export default createPoller;
