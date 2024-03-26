import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

  it('Should leave space via tangle request', async () => {
    mockWalletReturnValue(helper.member, { uid: helper.space.uid });
    await testEnv.wrap(WEN_FUNC.joinSpace);

    const spaceDocRef = build5Db().doc(COL.SPACE, helper.space.uid);
    helper.space = <Space>await spaceDocRef.get();
    expect(helper.space.totalMembers).toBe(2);

    await requestFundsFromFaucet(Network.RMS, helper.memberAddress.bech32, MIN_IOTA_AMOUNT);
    await helper.walletService.send(
      helper.memberAddress,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SPACE_LEAVE,
            uid: helper.space.uid,
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.memberCreditQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    let snap = await helper.memberCreditQuery.get();
    let credit = snap[0] as Transaction;
    expect(credit.payload.response!.status).toBe('success');

    helper.space = <Space>await spaceDocRef.get();
    expect(helper.space.totalMembers).toBe(1);
    expect(helper.space.totalPendingMembers).toBe(0);
  });
});
