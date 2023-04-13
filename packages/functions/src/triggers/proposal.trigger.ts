import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  BaseProposalAnswerValue,
  COL,
  MediaStatus,
  Member,
  Proposal,
  ProposalType,
  REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE,
  Space,
  SpaceGuardian,
  SpaceMember,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  TokenDistribution,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WEN_FUNC_TRIGGER,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { set } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { getStakeForType } from '../services/stake.service';
import { downloadMediaAndPackCar } from '../utils/car.utils';
import { dateToTimestamp } from '../utils/dateTime.utils';
import { spaceToIpfsMetadata } from '../utils/space.utils';
import { getTokenForSpace } from '../utils/token.utils';

export const onProposalUpdated = functions
  .runWith({
    minInstances: scale(WEN_FUNC_TRIGGER.onProposalUpdated),
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
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${proposal.space}`);
  const guardianDocRef = spaceDocRef
    .collection(SUB_COL.GUARDIANS)
    .doc(proposal.settings.addRemoveGuardian);
  const isAddGuardian = proposal.type === ProposalType.ADD_GUARDIAN;

  const batch = soonDb().batch();
  if (isAddGuardian) {
    batch.set(guardianDocRef, {
      uid: proposal.settings.addRemoveGuardian,
      parentId: proposal.space,
      parentCol: COL.SPACE,
    });
  } else {
    batch.delete(guardianDocRef);
  }
  batch.update(spaceDocRef, { totalGuardians: soonDb().inc(isAddGuardian ? 1 : -1) });
  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.update(proposalDocRef, {
    'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's')),
    completed: true,
  });
  await batch.commit();
};

const onEditSpaceProposalApproved = async (proposal: Proposal) => {
  const spaceUpdateData: Space = proposal.settings.spaceUpdateData;
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceUpdateData.uid}`);

  if (spaceUpdateData.bannerUrl) {
    const space = (await spaceDocRef.get<Space>())!;
    const metadata = spaceToIpfsMetadata({ ...space, ...spaceUpdateData });
    const ipfs = await downloadMediaAndPackCar(space.uid, spaceUpdateData.bannerUrl, metadata);
    set(spaceUpdateData, 'ipfsMedia', ipfs.ipfsMedia);
    set(spaceUpdateData, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(spaceUpdateData, 'ipfsRoot', ipfs.ipfsRoot);
    set(spaceUpdateData, 'mediaStatus', MediaStatus.PENDING_UPLOAD);
  }

  if (spaceUpdateData.open) {
    const knockingMembersSnap = await spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .get<SpaceMember>();
    const deleteKnockingMemberPromise = knockingMembersSnap.map((kMember) =>
      spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(kMember.uid).delete(),
    );
    await Promise.all(deleteKnockingMemberPromise);
  }

  const { removedMembers, removedGuardians } =
    await removeMembersAndGuardiansThatDontHaveEnoughStakes(spaceUpdateData);
  const updateData = spaceUpdateData.open
    ? { ...spaceUpdateData, totalPendingMembers: 0 }
    : spaceUpdateData;
  await spaceDocRef.update({
    ...updateData,
    totalMembers: soonDb().inc(-removedMembers),
    totalGuardians: soonDb().inc(-removedGuardians),
  });
  await soonDb()
    .doc(`${COL.PROPOSAL}/${proposal.uid}`)
    .update({
      'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's')),
      completed: true,
    });
};

const removeMembersAndGuardiansThatDontHaveEnoughStakes = async (updateData: Space) => {
  if (!updateData.tokenBased) {
    return { removedMembers: 0, removedGuardians: 0 };
  }
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${updateData.uid}`);
  const space = (await spaceDocRef.get<Space>())!;
  const token = await getTokenForSpace(space.uid);

  let removedMembers = 0;
  let removedGuardians = 0;

  const membersSnap = await spaceDocRef.collection(SUB_COL.MEMBERS).get<Member>();

  for (const member of membersSnap) {
    if (space.totalMembers - removedMembers === 1) {
      break;
    }
    const hasEnoughStaked = await memberHasEnoughStakedValues(
      token?.uid!,
      member.uid,
      updateData.minStakedValue || 0,
    );
    if (!hasEnoughStaked) {
      removedMembers++;
      await spaceDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).delete();
      const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member.uid);
      const guardian = await guardianDocRef.get<SpaceGuardian>();
      if (guardian) {
        await guardianDocRef.delete();
        removedGuardians++;
      }
    }
  }

  return { removedMembers, removedGuardians };
};

const memberHasEnoughStakedValues = async (token: string, member: string, minStaked: number) => {
  const distributionDocRef = soonDb().doc(
    `${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`,
  );
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakedValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return stakedValue > minStaked;
};

const onRemoveStakeRewardApporved = async (proposal: Proposal) => {
  const batch = soonDb().batch();

  const stakeRewardIds = proposal.settings.stakeRewardIds as string[];
  stakeRewardIds.forEach((rewardId) => {
    const docRef = soonDb().doc(`${COL.STAKE_REWARD}/${rewardId}`);
    batch.update(docRef, { status: StakeRewardStatus.DELETED });
  });

  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.update(proposalDocRef, {
    'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's')),
    completed: true,
  });

  await batch.commit();
};
