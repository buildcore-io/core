import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  BaseProposalAnswerValue,
  COL,
  MediaStatus,
  Proposal,
  ProposalType,
  REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE,
  Space,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  TokenDistribution,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { set } from 'lodash';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { getStakeForType } from '../services/stake.service';
import { downloadMediaAndPackCar } from '../utils/car.utils';
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { spaceToIpfsMetadata } from '../utils/space.utils';
import { getTokenForSpace } from '../utils/token.utils';

export const onProposalUpdated = functions
  .runWith({
    minInstances: scale(WEN_FUNC.onProposalUpdated),
  })
  .firestore.document(COL.PROPOSAL + '/{proposalId}')
  .onWrite(async (change) => {
    const prev = <Proposal | undefined>change.before.data();
    const curr = <Proposal | undefined>change.after.data();
    if (!curr) {
      return;
    }

    if (
      isAddRemoveGuardianVote(curr) &&
      voteThresholdReached(prev, curr, ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE)
    ) {
      return await onAddRemoveGuardianProposalApproved(curr);
    }

    if (
      curr.type === ProposalType.EDIT_SPACE &&
      voteThresholdReached(prev, curr, UPDATE_SPACE_THRESHOLD_PERCENTAGE)
    ) {
      return await onEditSpaceProposalApproved(curr);
    }

    if (
      curr.type === ProposalType.REMOVE_STAKE_REWARD &&
      voteThresholdReached(prev, curr, REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE)
    ) {
      return await onRemoveStakeRewardApporved(curr);
    }
  });

const isAddRemoveGuardianVote = (curr: Proposal) =>
  [ProposalType.ADD_GUARDIAN, ProposalType.REMOVE_GUARDIAN].includes(curr.type);

const voteThresholdReached = (prev: Proposal | undefined, curr: Proposal, threshold: number) => {
  const prevAnsweredPercentage =
    ((prev?.results?.answers[BaseProposalAnswerValue.YES] || 0) * 100) /
    (prev?.results?.total || 1);
  const currAnsweredPercentage =
    ((curr.results?.answers[BaseProposalAnswerValue.YES] || 0) * 100) / (curr.results?.total || 1);
  return prevAnsweredPercentage <= threshold && currAnsweredPercentage > threshold;
};

const onAddRemoveGuardianProposalApproved = async (proposal: Proposal) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${proposal.space}`);
  const guardianDocRef = spaceDocRef
    .collection(SUB_COL.GUARDIANS)
    .doc(proposal.settings.addRemoveGuardian);
  const isAddGuardian = proposal.type === ProposalType.ADD_GUARDIAN;

  const batch = admin.firestore().batch();
  if (isAddGuardian) {
    batch.set(
      guardianDocRef,
      cOn({
        uid: proposal.settings.addRemoveGuardian,
        parentId: proposal.space,
        parentCol: COL.SPACE,
      }),
    );
  } else {
    batch.delete(guardianDocRef);
  }
  batch.update(spaceDocRef, uOn({ totalGuardians: inc(isAddGuardian ? 1 : -1) }));
  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.update(proposalDocRef, {
    'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's').toDate()),
  });
  await batch.commit();
};

const onEditSpaceProposalApproved = async (proposal: Proposal) => {
  const spaceUpdateData: Space = proposal.settings.spaceUpdateData;
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceUpdateData.uid}`);

  if (spaceUpdateData.bannerUrl) {
    const space = <Space>(await spaceDocRef.get()).data();
    const metadata = spaceToIpfsMetadata({ ...space, ...spaceUpdateData });
    const ipfs = await downloadMediaAndPackCar(space.uid, spaceUpdateData.bannerUrl, metadata);
    set(spaceUpdateData, 'ipfsMedia', ipfs.ipfsMedia);
    set(spaceUpdateData, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(spaceUpdateData, 'ipfsRoot', ipfs.ipfsRoot);
    set(spaceUpdateData, 'mediaStatus', MediaStatus.PENDING_UPLOAD);
  }

  if (spaceUpdateData.open) {
    const knockingMembersSnap = await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).get();
    const deleteKnockingMemberPromise = knockingMembersSnap.docs.map((d) => d.ref.delete());
    await Promise.all(deleteKnockingMemberPromise);
  }

  const { removedMembers, removedGuardians } =
    await removeMembersAndGuardiansThatDontHaveEnoughStakes(spaceUpdateData);
  const updateData = spaceUpdateData.open
    ? { ...spaceUpdateData, totalPendingMembers: 0 }
    : spaceUpdateData;
  await spaceDocRef.update(
    uOn({
      ...updateData,
      totalMembers: inc(-removedMembers),
      totalGuardians: inc(-removedGuardians),
    }),
  );
  await admin
    .firestore()
    .doc(`${COL.PROPOSAL}/${proposal.uid}`)
    .update({ 'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's').toDate()) });
};

const removeMembersAndGuardiansThatDontHaveEnoughStakes = async (updateData: Space) => {
  if (!updateData.tokenBased) {
    return { removedMembers: 0, removedGuardians: 0 };
  }
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${updateData.uid}`);
  const space = <Space>(await spaceDocRef.get()).data();
  const token = await getTokenForSpace(space.uid);

  let removedMembers = 0;
  let removedGuardians = 0;

  const membersSnap = await admin
    .firestore()
    .collection(`${COL.SPACE}/${space.uid}/${SUB_COL.MEMBERS}`)
    .get();

  for (const memberDoc of membersSnap.docs) {
    if (space.totalMembers - removedMembers === 1) {
      break;
    }
    const hasEnoughStaked = await memberHasEnoughStakedValues(
      token?.uid!,
      memberDoc.id,
      updateData.minStakedValue || 0,
    );
    if (!hasEnoughStaked) {
      removedMembers++;
      await memberDoc.ref.delete();
      const guardianDoc = await admin
        .firestore()
        .doc(`${COL.SPACE}/${space.uid}/${SUB_COL.GUARDIANS}/${memberDoc.id}`)
        .get();
      if (guardianDoc.exists) {
        await guardianDoc.ref.delete();
        removedGuardians++;
      }
    }
  }

  return { removedMembers, removedGuardians };
};

const memberHasEnoughStakedValues = async (token: string, member: string, minStaked: number) => {
  const distributionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
  const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
  const stakedValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return stakedValue > minStaked;
};

const onRemoveStakeRewardApporved = async (proposal: Proposal) => {
  const batch = admin.firestore().batch();

  const stakeRewardIds = proposal.settings.stakeRewardIds as string[];
  stakeRewardIds.forEach((rewardId) => {
    const docRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${rewardId}`);
    batch.update(docRef, uOn({ status: StakeRewardStatus.DELETED }));
  });

  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.update(
    proposalDocRef,
    uOn({ 'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's').toDate()) }),
  );

  await batch.commit();
};
