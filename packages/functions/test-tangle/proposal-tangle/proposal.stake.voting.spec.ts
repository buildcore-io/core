import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TangleRequestType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(helper.guardian, { uid: proposalUid });
    await testEnv.wrap(WEN_FUNC.approveProposal);
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

    const snap = await helper.guardianCreditQuery.get();
    const credit = snap.find((c) => !isEmpty(c?.payload?.response?.voteTransaction))!;
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);

    const voteTransactionDocRef = database().doc(
      COL.TRANSACTION,
      credit.payload.response!.voteTransaction,
    );
    const voteTransaction = <Transaction>await voteTransactionDocRef.get();
    expect(+voteTransaction.payload.weight!.toFixed(0)).toBe(150);

    await helper.assertProposalWeights(150, 150);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 150, 1);
  });
});
