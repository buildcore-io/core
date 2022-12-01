import { AppCheck, Network } from '@soonaverse/interfaces';
import test from 'firebase-functions-test';
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
  'https://images-wen.soonaverse.com/0x0275dfc7c2624c0111d441a0819dccfd5e947c89%2F6stvhnutvg%2Ftoken_introductionary';

const setup = async () => {
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
