import test from 'firebase-functions-test';
import { Network } from '../interfaces/models';
import admin from '../src/admin.config';
import { Wallet, WalletService } from '../src/services/wallet/wallet';
import { MilestoneListener } from '../test-tangle/db-sync.utils';
import { AppCheck } from './../interfaces/config';

AppCheck.enabled = false;
export const projectId = 'soonaverse-dev';
process.env.GCLOUD_PROJECT = projectId;

const getConfig = () => {
  if (process.env.LOCAL_TEST) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
    return {
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    };
  }
  return {
    databaseURL: `https://${projectId}.firebaseio.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
  };
};

export const testEnv = process.env.LOCAL_TEST
  ? test(getConfig())
  : test(getConfig(), './test-service-account-key.json');

export const MEDIA = `https://firebasestorage.googleapis.com/v0/b/soonaverse-dev.appspot.com/o/nft%2Ftest%2Fimage?alt=media&token=722123be-45bb-466f-8ec3-28d759d79002`;

const wallets: { [network: string]: Wallet<any> } = {};

export const getWallet = async (network: Network) => {
  if (wallets[network]) {
    return wallets[network];
  }
  wallets[network] = await WalletService.newWallet(network);
  return wallets[network];
};

export let listenerRMS: MilestoneListener | undefined = undefined;
export let listenerAtoi: MilestoneListener | undefined = undefined;

const setup = async () => {
  if (process.env.LOCAL_TEST) {
    const config = getConfig();
    const bucket = admin.storage().bucket(config.storageBucket);
    const destination = 'nft/test/image';
    await bucket.upload('./test/puppy', {
      destination,
      metadata: {
        contentType: 'image/jpg',
      },
    });
  }
  listenerRMS = new MilestoneListener(Network.RMS);
  listenerAtoi = new MilestoneListener(Network.ATOI);
  console.log('Setup env');
};

export default setup;
