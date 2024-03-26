import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SUB_COL,
  Space,
  TangleRequestType,
  WEN_FUNC,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
    mockWalletReturnValue(helper.member, { uid: helper.space.uid });
    await testEnv.wrap(WEN_FUNC.joinSpace);

    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress!,
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
      const snap = await helper.guardianCreditQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const spaceDocRef = build5Db().doc(COL.SPACE, helper.space.uid);
    helper.space = <Space>await spaceDocRef.get();
    expect(helper.space.totalMembers).toBe(1);
    expect(helper.space.totalGuardians).toBe(1);

    const guardians = await build5Db()
      .collection(COL.SPACE, helper.space.uid, SUB_COL.GUARDIANS)
      .get();
    expect(guardians.length).toBe(1);

    const members = await build5Db().collection(COL.SPACE, helper.space.uid, SUB_COL.MEMBERS).get();
    expect(members.length).toBe(1);
  });
});
