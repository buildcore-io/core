import { AppCheck, Bucket, Network } from '@soonaverse/interfaces';
import test from 'firebase-functions-test';
import admin from '../src/admin.config';
import { IotaWallet } from '../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { WalletService } from '../src/services/wallet/wallet';

AppCheck.enabled = false;
export const projectId = 'soonaverse-dev';
process.env.GCLOUD_PROJECT = projectId;

export const getConfig = () => {
  if (process.env.LOCAL_TEST) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
    return {
      projectId,
      storageBucket: 'soonaverse-dev.appspot.com',
    };
  }
  return {
    databaseURL: `https://${projectId}.firebaseio.com`,
    projectId,
    storageBucket: 'soonaverse-dev.appspot.com',
  };
};

export const testEnv = process.env.LOCAL_TEST
  ? test(getConfig())
  : test(getConfig(), './test-service-account-key.json');

export const MEDIA =
  `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/` +
  'nft%2Ftest%2Fimage.jpeg?alt=media&token=c32478ea-0321-41d3-a6d0-e594a16545ed';

const setup = async () => {
  if (process.env.LOCAL_TEST) {
    const bucket = admin.storage().bucket(Bucket.DEV);
    const destination = 'nft/test/image.jpeg';
    await bucket.upload('./test/puppy.jpeg', {
      destination,
      metadata: {
        contentType: 'image/jpeg',
      },
    });
  }
  console.log('Setup env');
};

const wallets: { [key: string]: IotaWallet | SmrWallet } = {};

export const getWallet = async (network: Network) => {
  const wallet = wallets[network];
  if (!wallet) {
    wallets[network] = await WalletService.newWallet(network);
  }
  return wallets[network];
};

export default setup;
