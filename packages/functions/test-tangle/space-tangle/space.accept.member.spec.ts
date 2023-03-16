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

describe('Join space', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should join space via tangle request', async () => {
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${helper.space.uid}`);
    await spaceDocRef.update({ open: false });

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
    let snap = await helper.memberCreditQuery.get();
    let credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.response.status).toBe('success');

    helper.space = <Space>(await spaceDocRef.get()).data();
    expect(helper.space.totalMembers).toBe(1);
    expect(helper.space.totalPendingMembers).toBe(1);

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SPACE_ACCEPT_MEMBER,
            uid: helper.space.uid,
            member: helper.member,
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    snap = await helper.guardianCreditQuery.get();
    credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.response.status).toBe('success');

    helper.space = <Space>(await spaceDocRef.get()).data();
    expect(helper.space.totalMembers).toBe(2);
    expect(helper.space.totalPendingMembers).toBe(0);
  });
});
