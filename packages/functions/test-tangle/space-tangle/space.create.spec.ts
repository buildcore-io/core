import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
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
      helper.tangleOrder.payload.targetAddress!,
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
      const snap = await helper.memberCreditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await helper.memberCreditQuery.get();
    const credit = snap[0] as Transaction;
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${credit.payload.response!.space}`);
    const space = <Space>await spaceDocRef.get();
    expect(space.name).toBe('Space A');
  });
});
