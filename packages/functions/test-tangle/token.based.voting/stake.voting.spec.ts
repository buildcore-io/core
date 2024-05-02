import { database } from '@buildcore/database';
import { COL, Proposal, ProposalMember, SUB_COL, WEN_FUNC } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { Helper, dummyProposal } from './Helper';

describe('Staked oken based voting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();

    const distributionDocRef = database().doc(
      COL.TOKEN,
      helper.tokenId,
      SUB_COL.DISTRIBUTION,
      helper.guardian,
    );
    await distributionDocRef.create({ parentId: helper.tokenId, parentCol: COL.TOKEN });
  });

  it('Should vote with staked tokens', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(3, 'd'));
    const voteTransaction = await helper.voteOnProposal(1, true);
    expect(Math.floor(voteTransaction.payload.weight!)).toBeGreaterThanOrEqual(149);
    expect(Math.floor(voteTransaction.payload.weight!)).toBeLessThanOrEqual(150);

    const proposalDocRef = database().doc(COL.PROPOSAL, helper.proposal!.uid);
    const proposal = <Proposal>await proposalDocRef.get();
    expect(Math.floor(proposal.results?.total)).toBeGreaterThanOrEqual(149);
    expect(Math.floor(proposal.results?.total)).toBeLessThanOrEqual(150);
    expect(Math.floor(proposal.results?.voted)).toBeGreaterThanOrEqual(149);
    expect(Math.floor(proposal.results?.voted)).toBeLessThanOrEqual(150);

    const proposalMemberDocRef = database().doc(
      COL.PROPOSAL,
      helper.proposal!.uid,
      SUB_COL.MEMBERS,
      helper.guardian,
    );
    const proposalMember = <ProposalMember>await proposalMemberDocRef.get();
    expect(Math.floor(proposalMember.weightPerAnswer![1])).toBeGreaterThanOrEqual(149);
    expect(Math.floor(proposalMember.weightPerAnswer![1])).toBeLessThanOrEqual(150);
  });

  it('Should vote in the beginning and mid way ', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));
    let voteTransaction1 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction1.payload.weight!.toFixed(2)).toBe(100);

    await helper.assertProposalWeights(100, 100);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction1.uid, dayjs().subtract(3, 'd'));

    const voteTransaction2 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction2.payload.weight!.toFixed(2)).toBe(50);

    voteTransaction1 = await helper.getTransaction(voteTransaction1.uid);
    expect(+voteTransaction1.payload.weight!.toFixed(2)).toBe(50);

    await helper.assertProposalWeights(100, 100);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1);
  });

  it('Should vote on 2 proposals', async () => {
    await helper.createStake(dayjs().subtract(2, 'd'), dayjs().add(1, 'y'));

    const { uid, completed, ...requestData } = dummyProposal(helper.space!.uid);
    set(requestData, 'settings.startDate', requestData.settings.startDate.toDate());
    set(requestData, 'settings.endDate', requestData.settings.endDate.toDate());
    mockWalletReturnValue(helper.guardian, requestData);

    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
    mockWalletReturnValue(helper.guardian, { uid: proposal!.uid });
    await testEnv.wrap(WEN_FUNC.approveProposal);

    let voteTransaction1 = await helper.voteOnProposal(1, true);
    expect(+voteTransaction1.payload.weight!.toFixed(2)).toBe(100);

    await helper.updatePropoasalDates(dayjs().subtract(2, 'd'), dayjs().add(2, 'd'));
    await helper.updateVoteTranCreatedOn(voteTransaction1.uid, dayjs().subtract(3, 'd'));

    const voteTransaction2 = await helper.voteOnProposal(1, true, undefined, proposal.uid);
    expect(+voteTransaction2.payload.weight!.toFixed(2)).toBe(100);
    await helper.assertProposalWeights(100, 100, proposal.uid);
    await helper.assertProposalMemberWeightsPerAnser(helper.guardian, 100, 1, proposal.uid);

    voteTransaction1 = await helper.getTransaction(voteTransaction1.uid);
    expect(+voteTransaction1.payload.weight!.toFixed(2)).toBe(50);
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
