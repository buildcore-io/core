import { COL, Member, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { voteOnProposal } from '../../src/runtime/firebase/proposal';
import { getAddress } from '../../src/utils/address.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
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

  it('Should throw, can only vote 24 hours before', async () => {
    await helper.updatePropoasalDates(dayjs().add(3, 'd'), dayjs().add(5, 'd'));
    mockWalletReturnValue(helper.walletSpy, helper.guardian, {
      uid: helper.proposal!.uid,
      value: 1,
    });
    await expectThrow(testEnv.wrap(voteOnProposal)({}), WenError.vote_is_no_longer_active.key);
  });

  it('Should vote, spend, other person votes with it', async () => {
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

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${helper.member}`);
    const member = <Member>await memberDocRef.get();
    const memberAddress = await helper.walletService!.getAddressDetails(
      getAddress(member, helper.network),
    );
    await helper.sendTokensToVote(memberAddress.bech32);
    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return +voteTransaction.payload.weight!.toFixed(2) === 5;
    });
    await helper.assertProposalWeights(5, 5);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 5, 1);

    voteTransactionOrder = await helper.voteOnProposal(1, false, helper.member);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress, 10, memberAddress);
    credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(+voteTransaction.payload.weight!.toFixed(2)).toBe(5);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.member, 5, 1);
  });

  it('Should not reduce weight when voting after end date', async () => {
    const voteTransactionOrder = await helper.voteOnProposal(1);
    await helper.sendTokensToVote(voteTransactionOrder.payload.targetAddress);
    const credit = await helper.awaitVoteTransactionCreditIsConfirmed(
      voteTransactionOrder.payload.targetAddress,
    );

    let voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
    await helper.assertProposalWeights(10, 10);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 10, 1);

    await helper.updatePropoasalDates(dayjs().subtract(4, 'd'), dayjs().subtract(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction.uid, dayjs().subtract(5, 'd'));

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await helper.sendTokensToVote(tmp.bech32);

    await wait(async () => {
      const voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
      return voteTransaction.payload.outputConsumed;
    });
    voteTransaction = await helper.getVoteTransactionForCredit(credit.uid);
    expect(voteTransaction.payload.weight).toBe(10);
  });
});
