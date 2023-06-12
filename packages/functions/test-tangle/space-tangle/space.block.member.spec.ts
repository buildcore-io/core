import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
    mockWalletReturnValue(helper.walletSpy, helper.member, { uid: helper.space.uid });
    await testEnv.wrap(joinSpace)({});

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SPACE_BLOCK_MEMBER,
            uid: helper.space.uid,
            member: helper.member,
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${helper.space.uid}`);
    helper.space = <Space>await spaceDocRef.get();
    expect(helper.space.totalMembers).toBe(1);
  });
});
