import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  SpaceMember,
  SUB_COL,
  TangleRequestType,
  Transaction,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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
      const snap = await helper.memberCreditQuery.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const snap = await helper.memberCreditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.response.status).toBe('success');

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${helper.space.uid}`);
    helper.space = <Space>(await spaceDocRef.get()).data();
    expect(helper.space.totalMembers).toBe(2);

    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(helper.member);
    const spaceMember = <SpaceMember | undefined>(await spaceMemberDocRef.get()).data();
    expect(spaceMember).toBeDefined();
  });
});
