import { COL, MIN_IOTA_AMOUNT, Network, Space, TangleRequestType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { joinSpace } from '../../src/runtime/firebase/space';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Block space member', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should block member', async () => {
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${helper.space.uid}`);
    await spaceDocRef.update({ open: false });

    mockWalletReturnValue(helper.walletSpy, helper.member, { uid: helper.space.uid });
    await testEnv.wrap(joinSpace)({});

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
            requestType: TangleRequestType.SPACE_DECLINE_MEMBER,
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

    helper.space = <Space>(await spaceDocRef.get()).data();
    expect(helper.space.totalMembers).toBe(1);
    expect(helper.space.totalPendingMembers).toBe(0);
  });
});
