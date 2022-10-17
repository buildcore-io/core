import { listenerAtoi, listenerRMS } from './set-up';

const teardown = async () => {
  await listenerRMS!.cancel();
  await listenerAtoi!.cancel();
};

export default teardown;
