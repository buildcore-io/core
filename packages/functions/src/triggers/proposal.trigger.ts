import { database, PgProposal, removeNulls } from '@buildcore/database';
import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  BaseProposalAnswerValue,
  COL,
  MediaStatus,
  ProposalType,
  REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { get, head, set } from 'lodash';
import { getStakeForType } from '../services/stake.service';
import { downloadMediaAndPackCar } from '../utils/car.utils';
import { spaceToIpfsMetadata } from '../utils/space.utils';
import { getTokenForSpace } from '../utils/token.utils';
import { PgDocEvent } from './common';

export const onProposalWrite = async (event: PgDocEvent<PgProposal>) => {
  const { prev, curr } = event;

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
};

const isAddRemoveGuardianVote = (curr: PgProposal) =>
  [ProposalType.ADD_GUARDIAN, ProposalType.REMOVE_GUARDIAN].includes(curr.type!);

const voteThresholdReached = (
  prev: PgProposal | undefined,
  curr: PgProposal,
  threshold: number,
) => {
  const prevAnswers = prev?.results?.answers as Record<string, number> | undefined;
  const prevAnsweredPercentage =
    ((prevAnswers?.[BaseProposalAnswerValue.YES] || 0) * 100) / Number(prev?.results?.total || 1);

  const currAnswers = curr.results?.answers as Record<string, number> | undefined;
  const currAnsweredPercentage =
    ((currAnswers?.[BaseProposalAnswerValue.YES] || 0) * 100) / Number(curr.results?.total || 1);
  return prevAnsweredPercentage <= threshold && currAnsweredPercentage > threshold;
};

const onAddRemoveGuardianProposalApproved = async (proposal: PgProposal) => {
  const spaceDocRef = database().doc(COL.SPACE, proposal.space!);
  const guardianDocRef = database().doc(
    COL.SPACE,
    proposal.space!,
    SUB_COL.GUARDIANS,
    proposal.settings_addRemoveGuardian!,
  );
  const isAddGuardian = proposal.type === ProposalType.ADD_GUARDIAN;

  const batch = database().batch();
  if (isAddGuardian) {
    batch.upsert(guardianDocRef, {
      parentId: proposal.space,
    });
  } else {
    batch.delete(guardianDocRef);
  }
  batch.update(spaceDocRef, { totalGuardians: database().inc(isAddGuardian ? 1 : -1) });
  const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
  batch.update(proposalDocRef, {
    settings_endDate: dayjs().subtract(1, 's').toDate(),
    completed: true,
  });
  await batch.commit();
};

const onEditSpaceProposalApproved = async (proposal: PgProposal) => {
  const spaceUpdateData = proposal.settings_spaceUpdateData!;
  const spaceId = spaceUpdateData.uid! as string;
  const spaceDocRef = database().doc(COL.SPACE, spaceId);

  if (spaceUpdateData.bannerUrl) {
    const space = (await spaceDocRef.get())!;
    const metadata = spaceToIpfsMetadata({ ...space, ...spaceUpdateData });
    const ipfs = await downloadMediaAndPackCar(
      space.uid,
      spaceUpdateData.bannerUrl as string,
      metadata,
    );
    set(spaceUpdateData, 'ipfsMedia', ipfs.ipfsMedia);
    set(spaceUpdateData, 'ipfsMetadata', ipfs.ipfsMetadata);
    set(spaceUpdateData, 'ipfsRoot', ipfs.ipfsRoot);
    set(spaceUpdateData, 'mediaStatus', MediaStatus.PENDING_UPLOAD);
  }

  if (spaceUpdateData.open) {
    const knockingMembersSnap = await database()
      .collection(COL.SPACE, spaceId, SUB_COL.KNOCKING_MEMBERS)
      .get();
    const deleteKnockingMemberPromise = knockingMembersSnap.map((kMember) =>
      database().doc(COL.SPACE, spaceId, SUB_COL.KNOCKING_MEMBERS, kMember.uid).delete(),
    );
    await Promise.all(deleteKnockingMemberPromise);
  }

  const { removedMembers, removedGuardians } =
    await removeMembersAndGuardiansThatDontHaveEnoughStakes(spaceUpdateData);

  const updateData = removeNulls(
    spaceDocRef.converter.toPg(
      spaceUpdateData.open
        ? { ...spaceUpdateData, totalPendingMembers: 0 }
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (spaceUpdateData as any),
    ),
  );
  const prevValidatedAddress = head(get(updateData, 'prevValidatedAddresses', []));
  if (prevValidatedAddress) {
    set(updateData, 'prevValidatedAddresses', database().arrayUnion(prevValidatedAddress));
  } else {
    delete updateData.prevValidatedAddresses;
  }

  await spaceDocRef.upsert({
    ...updateData,
    totalMembers: database().inc(-removedMembers),
    totalGuardians: database().inc(-removedGuardians),
  });

  await database()
    .doc(COL.PROPOSAL, proposal.uid)
    .update({
      settings_endDate: dayjs().subtract(1, 's').toDate(),
      completed: true,
    });
};

const removeMembersAndGuardiansThatDontHaveEnoughStakes = async (
  updateData: Record<string, unknown>,
) => {
  if (!updateData.tokenBased) {
    return { removedMembers: 0, removedGuardians: 0 };
  }
  const spaceDocRef = database().doc(COL.SPACE, updateData.uid! as string);
  const space = (await spaceDocRef.get())!;
  const token = await getTokenForSpace(space.uid);

  let removedMembers = 0;
  let removedGuardians = 0;

  const membersSnap = await database()
    .collection(COL.SPACE, updateData.uid! as string, SUB_COL.MEMBERS)
    .get();

  for (const member of membersSnap) {
    if (space.totalMembers - removedMembers === 1) {
      break;
    }
    const hasEnoughStaked = await memberHasEnoughStakedValues(
      token?.uid!,
      member.uid,
      (updateData.minStakedValue as number) || 0,
    );
    if (!hasEnoughStaked) {
      removedMembers++;
      await database()
        .doc(COL.SPACE, updateData.uid! as string, SUB_COL.MEMBERS, member.uid)
        .delete();
      const guardianDocRef = database().doc(
        COL.SPACE,
        updateData.uid! as string,
        SUB_COL.GUARDIANS,
        member.uid,
      );
      const guardian = await guardianDocRef.get();
      if (guardian) {
        await guardianDocRef.delete();
        removedGuardians++;
      }
    }
  }

  return { removedMembers, removedGuardians };
};

const memberHasEnoughStakedValues = async (token: string, member: string, minStaked: number) => {
  const distributionDocRef = database().doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member);
  const distribution = await distributionDocRef.get();
  const stakedValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return stakedValue > minStaked;
};

const onRemoveStakeRewardApporved = async (proposal: PgProposal) => {
  const batch = database().batch();

  const stakeRewardIds = proposal.settings_stakeRewardIds || [];
  for (const rewardId of stakeRewardIds) {
    const docRef = database().doc(COL.STAKE_REWARD, rewardId);
    batch.update(docRef, { status: StakeRewardStatus.DELETED });
  }

  const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
  batch.update(proposalDocRef, {
    settings_endDate: dayjs().subtract(1, 's').toDate(),
    completed: true,
  });

  await batch.commit();
};
