import { MIN_IOTA_AMOUNT } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { wait } from '../../test/controls/common';
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

  it('Should vote, spend and vote again', async () => {
    let voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    let credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    let voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));

    await helper.sendTokensToVote(helper.guardianAddress!.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return +voteTransaction.payload.weight!.toFixed(2) === 5;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 5, 1);

    voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(+voteTransaction.payload.weight!.toFixed(2)).toBe(5);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);
  });

  it('Should vote twice without spending', async () => {
    let voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    let credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    let voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
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

    voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress, 10, tmp);
    credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(+voteTransaction.payload.weight!.toFixed(2)).toBe(5);
    await helper.assertProposalWeights(15, 15);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 15, 1);
  });
});
