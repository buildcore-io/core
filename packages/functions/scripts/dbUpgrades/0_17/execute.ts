import { initializeApp } from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import serviceAccount from '../../serviceAccountKeyTest.json';
import { migrateAirdropOrders } from './airdrop.order.roll';
import { migrateAirdrops } from './airdrop.roll';

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

export const execute = async () => {
  await migrateAirdrops(app);
  await migrateAirdropOrders(app);
};
