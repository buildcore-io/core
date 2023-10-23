import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, TangleRequestType, Transaction } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { approveProposal } from '../../src/runtime/firebase/proposal';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Create proposal via tangle request', () => {
  const helper = new Helper();
  let proposalUid = '';

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();

    proposalUid = await helper.sendCreateProposalRequest();

    mockWalletReturnValue(helper.walletSpy, helper.guardian, { uid: proposalUid });
    await testEnv.wrap(approveProposal)({});
  });

  it('Should create proposal and vote with staked tokens', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(3, 'd'));

    await helper.walletService.send(
      helper.guardianAddress,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.PROPOSAL_VOTE,
            uid: proposalUid,
            value: 1,
            voteWithStakedTokes: true,
          },
        },
      },
    );

    await wait(async () => {
      const snap = await helper.guardianCreditQuery.get();
      return snap.length === 2;
    });

    const snap = await helper.guardianCreditQuery.get<Transaction>();
    const credit = snap.find((c) => !isEmpty(c?.payload?.response?.voteTransaction))!;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);

    const voteTransactionDocRef = build5Db().doc(
      `${COL.TRANSACTION}/${credit.payload.response!.voteTransaction}`,
    );
    const voteTransaction = <Transaction>await voteTransactionDocRef.get();
    expect(+voteTransaction.payload.weight!.toFixed(0)).toBe(150);

    await helper.assertProposalWeights(150, 150);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 150, 1);
  });
});
