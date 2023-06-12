import { MIN_IOTA_AMOUNT, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { voteOnProposal } from '../../src/runtime/firebase/proposal';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID, VAULT_MNEMONIC } from './Helper';

describe('Token based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    await helper.requestFunds();
  });

  it('Should vote on both answers and spend both', async () => {
    let voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(helper.network, tmp.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      tmp,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );

    voteTransactionOrder = await helper.voteOnProposal(2);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress, 10, tmp);
    const credit2 = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    const voteTransaction2 = await helper.getVoteTransactionForCredit(credit2.uid);
    expect(+voteTransaction2.payload.weight.toFixed(2)).toBe(5);
    await helper.assertProposalWeights(15, 15);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 5, 2);

    await helper.sendTokensToVote(helper.guardianAddress!.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return +voteTransaction.payload.weight.toFixed(2) === 5;
    });
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 5, 1);

    await helper.sendTokensToVote(tmp.bech32, 10, tmp);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit2.uid);
      return +voteTransaction.payload.weight.toFixed(2) === 0;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 0, 2);
  });

  it('Should throw, can not vote after end date', async () => {
    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().subtract(1, 'd'));
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    await expectThrow(testEnv.wrap(voteOnProposal)({}), WenError.vote_is_no_longer_active.key);
  });
});
