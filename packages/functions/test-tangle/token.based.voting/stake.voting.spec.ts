import { COL, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { approveProposal } from '../../src/controls/proposal/approve.reject.proposal';
import { createProposal } from '../../src/controls/proposal/create.proposal';
import { mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { dummyProposal, Helper } from './Helper';

describe('Staked oken based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();

    const distributionDocRef = admin
      .firestore()
      .collection(COL.TOKEN)
      .doc(helper.tokenId)
      .collection(SUB_COL.DISTRIBUTION)
      .doc(helper.guardian);
    await distributionDocRef.create({});
  });

  it('Should vote with staked tokens', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(3, 'd'));
    const voteTransaction = await helper.voteOnProposal(1, true);
    expect(+voteTransaction.payload.weight.toFixed(0)).toBe(150);

    await helper.assertProposalWeights(150, 150);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 150, 1);
  });

  it('Should vote in the beginning and mid way ', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    let voteTransaction1 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction1.payload.weight.toFixed(2)).toBe(100);

    await helper.assertProposalWeights(100, 100);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction1.uid, dayjs().subtract(3, 'd'));

    const voteTransaction2 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction2.payload.weight.toFixed(2)).toBe(50);

    voteTransaction1 = await helper.getTransaction(voteTransaction1.uid);
    expect(+voteTransaction1.payload.weight.toFixed(2)).toBe(50);

    await helper.assertProposalWeights(100, 100);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1);
  });

  it('Should vote on 2 proposals', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));

    let proposal = dummyProposal(helper.space!.uid);
    mockWalletReturnValue(helper.walletSpy, helper.guardian, proposal);
    proposal = await testEnv.wrap(createProposal)({});
    mockWalletReturnValue(helper.walletSpy, helper.guardian, { uid: proposal!.uid });
    await testEnv.wrap(approveProposal)({});

    let voteTransaction1 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction1.payload.weight.toFixed(2)).toBe(100);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction1.uid, dayjs().subtract(3, 'd'));

    const voteTransaction2 = await helper.voteOnProposal(1, true, undefined, proposal.uid);
    expect(+voteTransaction2.payload.weight.toFixed(2)).toBe(100);
    await helper.assertProposalWeights(100, 100, proposal.uid);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1, proposal.uid);

    voteTransaction1 = await helper.getTransaction(voteTransaction1.uid);
    expect(+voteTransaction1.payload.weight.toFixed(2)).toBe(50);
    await helper.assertProposalWeights(50, 50);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 50, 1);
  });

  it('Should not be able to vote in parallel', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    const promises = [helper.voteOnProposal(1, true), helper.voteOnProposal(1, true)];
    await Promise.all(promises);

    await helper.assertProposalWeights(100, 100);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1);
  });
});
