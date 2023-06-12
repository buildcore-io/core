import { Network } from '@build-5/interfaces';
import dotenv from 'dotenv';
import express from 'express';
import test from 'firebase-functions-test';
import * as functions from 'firebase-functions/v2';
import { isEmpty } from 'lodash';
import { IotaWallet } from '../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { WalletService } from '../src/services/wallet/wallet';

dotenv.config({ path: '.env.local' });

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

export const sentOnRequest =
  (func: (req: functions.https.Request, response: express.Response<any>) => void | Promise<void>) =>
  async (data: any) => {
    const req = { ip: '127.0.0.1', body: { data }, headers: { origin: true } } as any;
    let error = false;
    let response: any = undefined;
    const res = {
      status: (code: number) => {
        if (code !== 200) {
          error = true;
        }
      },
      send: (res: any) => {
        response = res.data;
      },
      setHeader: (key: any, value: any) => {},
      getHeader: (key: any) => {},
    } as any;
    await func(req, res);

    for (let attempt = 0; attempt < 5000; ++attempt) {
      if (response !== undefined) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (error) {
      throw response;
    }
    return isEmpty(response) ? undefined : response;
  };

export const testEnv = {
  config: process.env.LOCAL_TEST
    ? test(getConfig())
    : test(getConfig(), './test-service-account-key.json'),
  wrap: sentOnRequest,
};

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
