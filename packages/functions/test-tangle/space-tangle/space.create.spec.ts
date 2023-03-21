import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Create space', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create space via tangle request', async () => {
    await requestFundsFromFaucet(Network.RMS, helper.memberAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.memberAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SPACE_CREATE,
            name: 'Space A',
            bannerUrl:
              'https://ipfs.io/ipfs/bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4',
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.memberCreditQuery.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const snap = await helper.memberCreditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${credit.payload.response.space}`);
    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.name).toBe('Space A');
  });
});