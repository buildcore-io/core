import { MIN_IOTA_AMOUNT } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { voteOnProposal } from '../../src/controls/proposal/vote.on.proposal';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, MINTED_TOKEN_ID, VAULT_MNEMONIC } from '../token.based.voting/Helper';

describe('Token based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should vote full, then 50%', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    const voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await helper.sendTokensToVote(tmp.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return voteTransaction.payload.weight === 5;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeights(helper.guardian, 5, 1);
  });

  it('Should vote, spend and vote again', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    let voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    let credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    let voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(3, 'd'));

    await helper.sendTokensToVote(helper.guardianAddress!.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return voteTransaction.payload.weight === 5;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeights(helper.guardian, 5, 1);

    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(5);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 10, 1);
  });

  it('Should vote twice without spending', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    let voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    let credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    let voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 10, 1);

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

    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress, 10, tmp);
    credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(5);
    await helper.assertProposalWeights(15, 15);
    await helper.assertProposalMemberWeights(helper.guardian, 15, 1);
  });

  it('Should vote on both answers and spend both', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [1],
    });
    let voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 10, 1);

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

    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      values: [2],
    });
    voteTransactionOrder = await testEnv.wrap(voteOnProposal)({});
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress, 10, tmp);
    const credit2 = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );
    const voteTransaction2 = await helper.getVoteTransactionForCredit(credit2.uid);
    expect(voteTransaction2.payload.weight).toBe(5);
    await helper.assertProposalWeights(15, 15);
    await helper.assertProposalMemberWeights(helper.guardian, 5, 2);

    await helper.sendTokensToVote(helper.guardianAddress!.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return voteTransaction.payload.weight === 5;
    });
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeights(helper.guardian, 5, 1);

    await helper.sendTokensToVote(tmp.bech32, 10, tmp);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit2.uid);
      return voteTransaction.payload.weight === 0;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeights(helper.guardian, 0, 2);
  });
});
