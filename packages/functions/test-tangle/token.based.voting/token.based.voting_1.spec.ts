import dayjs from 'dayjs';
import { wait } from '../../test/controls/common';
import { Helper } from '../token.based.voting/Helper';

describe('Token based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    await helper.requestFunds();
  });

  it('Should vote full, then 50%', async () => {
    const voteTransactionOrder = await helper.voteOnProposal(1);

    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress!);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress!,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await helper.sendTokensToVote(tmp.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return +voteTransaction.payload.weight!.toFixed(2) === 5;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 5, 1);
  });

  it('Should vote full, storage return', async () => {
    const voteTransactionOrder = await helper.voteOnProposal(1);

    await helper.sendTokensToVote(
      voteTransactionOrder.payload.targetAddress!,
      10,
      undefined,
      voteTransactionOrder.payload.amount,
    );
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress!,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);
  });
});
