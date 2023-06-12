import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  SpaceMember,
  SUB_COL,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Join space', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should join space via tangle request', async () => {
    await requestFundsFromFaucet(Network.RMS, helper.memberAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.memberAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SPACE_JOIN,
            uid: helper.space.uid,
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
    expect(credit.payload.response.status).toBe('success');

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${helper.space.uid}`);
    helper.space = <Space>await spaceDocRef.get();
    expect(helper.space.totalMembers).toBe(2);

    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(helper.member);
    const spaceMember = <SpaceMember | undefined>await spaceMemberDocRef.get();
    expect(spaceMember).toBeDefined();
  });
});
