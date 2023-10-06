import { wallets } from './set-up';

afterAll(async () => {
  const promises = Object.values(wallets).map((w) => w.client.destroy());
  await Promise.all(promises);
});
