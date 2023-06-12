import { COL, TokenStatus } from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
      uid: getRandomEthAddress(),
      space: helper.space!.uid,
      status: TokenStatus.PRE_MINTED,
      approved: false,
    };
    await soonDb().doc(`${COL.TOKEN}/${falseToken}`).create(falseToken);

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
