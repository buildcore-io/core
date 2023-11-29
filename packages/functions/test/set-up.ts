import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  ProjectAdmin,
  ProjectBilling,
  SOON_PROJECT_ID,
  SUB_COL,
  WenRequest,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import express from 'express';
import test from 'firebase-functions-test';
import * as functions from 'firebase-functions/v2';
import { isEmpty } from 'lodash';
import { Wallet, WalletParams } from '../src/services/wallet/wallet';
import {
  AddressDetails,
  SendToManyTargets,
  WalletService,
} from '../src/services/wallet/wallet.service';
import { dateToTimestamp } from '../src/utils/dateTime.utils';

dotenv.config({ path: '.env.local' });

export const projectId = 'soonaverse-dev';
process.env.GCLOUD_PROJECT = projectId;

export const getConfig = () => {
  if (process.env.LOCAL_TEST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
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

export const PROJECT_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk5MjgyMTQxfQ.Bd0IZNdtc3ne--CC1Bk5qDgWl4NojAsX64K1rCj-5Co';

export const sendOnRequest =
  (func: (req: functions.https.Request, response: express.Response<any>) => void | Promise<void>) =>
  async (body: any, address = '', customToken = '') => {
    const wenReq: WenRequest<any> = { address, customToken, projectApiKey: PROJECT_API_KEY, body };
    const req = {
      ip: '127.0.0.1',
      body: { data: wenReq },
      headers: { origin: true },
    } as any;
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
  wrap: sendOnRequest,
};

export const MEDIA =
  'https://images-wen.soonaverse.com/0x0275dfc7c2624c0111d441a0819dccfd5e947c89%2F6stvhnutvg%2Ftoken_introductionary';

export const SOON_PROJ_GUARDIAN = '0x3d5d0b3f40c9438871b1c43d6b70117eeff77ad8';

export const soonTokenId = '0xa381bfccaf121e38e31362d85b5ad30cd7fc0d06';

const setup = async () => {
  await build5Db().doc(`${COL.TOKEN}/${soonTokenId}`).set({
    project: SOON_PROJECT_ID,
    uid: soonTokenId,
    symbol: 'SOON',
  });

  const soonProject = {
    uid: SOON_PROJECT_ID,
    name: 'Soonaverse',
    createdBy: SOON_PROJ_GUARDIAN,
    deactivated: false,
    config: {
      billing: ProjectBilling.TOKEN_BASE,
      tiers: [0, 0, 0, 0, 0].map((v) => v * MIN_IOTA_AMOUNT),
      tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
      nativeTokenSymbol: 'SOON',
      nativeTokenUid: soonTokenId,
    },
  };
  const soonProjDocRef = build5Db().doc(`${COL.PROJECT}/${soonProject.uid}`);
  await soonProjDocRef.set(soonProject);

  const adminDocRef = soonProjDocRef.collection(SUB_COL.ADMINS).doc(SOON_PROJ_GUARDIAN);
  const admin: ProjectAdmin = {
    uid: SOON_PROJ_GUARDIAN,
    createdOn: dateToTimestamp(dayjs()),
    parentCol: COL.PROJECT,
    parentId: SOON_PROJECT_ID,
  };
  await adminDocRef.set(admin);

  console.log('Setup env');
};

export const wallets: { [key: string]: Wallet } = {};

class TestWallet extends Wallet {
  constructor(private readonly wallet: Wallet) {
    super(wallet.client, wallet.info, wallet.nodeIndex, wallet.nodeUrl, wallet.network);
  }

  public getBalance = this.wallet.getBalance;
  public getNewIotaAddressDetails = this.wallet.getNewIotaAddressDetails;
  public getIotaAddressDetails = this.wallet.getIotaAddressDetails;
  public getAddressDetails = this.wallet.getAddressDetails;

  public bechAddressFromOutput = this.wallet.bechAddressFromOutput;
  public getOutputs = this.wallet.getOutputs;
  public creditLocked = this.wallet.creditLocked;

  public send = async (
    from: AddressDetails,
    toAddress: string,
    amount: number,
    params: WalletParams,
    outputToConsume?: string | undefined,
  ) => {
    const blockId = await this.wallet.send(from, toAddress, amount, params, outputToConsume);
    await build5Db().doc(`blocks/${blockId}`).create({ blockId });
    return blockId;
  };
  public sendToMany = async (
    from: AddressDetails,
    targets: SendToManyTargets[],
    params: WalletParams,
  ) => {
    const blockId = await this.wallet.sendToMany(from, targets, params);
    await build5Db().doc(`blocks/${blockId}`).create({ blockId });
    return blockId;
  };
}

export const getWallet = async (network: Network) => {
  const wallet = wallets[network];
  if (!wallet) {
    const baseWallet = await WalletService.newWallet(network);
    wallets[network] = new TestWallet(baseWallet);
  }
  return wallets[network];
};

export default setup;
