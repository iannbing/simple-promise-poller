import { Poller } from './poller';
import { ResolvePromise, StopPollingFunction } from './types';

export { Poller, ResolvePromise, StopPollingFunction };
export default Poller;

// const poller = Poller();

// const rollDice = async () => {
//   try {
//     await poller.add(async (stop, getRetryCount) => {
//       if (getRetryCount() === 5) stop(false);
//       // Logic
//       const value = Math.ceil(Math.random() * 6);
//       if (value === 6) {
//         stop(true);
//       } else {
//         throw new Error(`Got ${value}. Did not win.`);
//       }
//     });
//     console.log('You won!');
//   } catch (error) {
//     console.error('You have tried 5 times. You lost.');
//   }
// };
