import { build5Db } from '@build-5/database';
import { COL, SOON_PROJECT_ID, TokenStatus } from '@build-5/interfaces';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { Helper } from './Helper';

describe('Token based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    await helper.requestFunds();
  });

  it('Should vote full, space has two tokens', async () => {
    const falseToken = {
      project: SOON_PROJECT_ID,
      uid: getRandomEthAddress(),
      space: helper.space!.uid,
      status: TokenStatus.PRE_MINTED,
      approved: false,
    };
    await build5Db().doc(`${COL.TOKEN}/${falseToken.uid}`).create(falseToken);

    const voteTransactionOrder = await helper.voteOnProposal(1);

    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);
  });
});
