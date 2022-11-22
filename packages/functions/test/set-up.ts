import { AppCheck, Network } from '@soonaverse/interfaces';
import test from 'firebase-functions-test';
import admin from '../src/admin.config';
import { IotaWallet } from '../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { WalletService } from '../src/services/wallet/wallet';

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

export const MEDIA =
  'https://firebasestorage.googleapis.com/v0/b/soonaverse-dev.appspot.com/o/nft%2Ftest%2Fimage.jpeg?alt=media&token=045e4ed5-6178-4a2f-8b5f-70607e73dac1';

const setup = async () => {
  if (process.env.LOCAL_TEST) {
    const config = getConfig();
    const bucket = admin.storage().bucket(config.storageBucket);
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

const getPublicUrl = (network: Network) => {
  switch (network) {
    case Network.RMS:
      return 'https://api.testnet.shimmer.network';
    case Network.ATOI:
      return 'https://api.lb-0.h.chrysalis-devnet.iota.cafe/';
    default:
      throw Error('No public api');
  }
};

export const getWallet = async (network: Network, publicUrl?: boolean) => {
  const key = network + (publicUrl ? `_${publicUrl}` : '');
  const wallet = wallets[key];
  if (!wallet) {
    const url = publicUrl ? getPublicUrl(network) : undefined;
    wallets[key] = await WalletService.newWallet(network, url);
  }
  return wallets[key];
};

export default setup;
