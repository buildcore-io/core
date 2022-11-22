import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  COL,
  Proposal,
  ProposalType,
  SUB_COL,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';

export const onProposalUpdated = functions
  .runWith({
    minInstances: scale(WEN_FUNC.onProposalUpdated),
  })
  .firestore.document(COL.PROPOSAL + '/{proposalId}')
  .onUpdate(async (change) => {
    const prev = <Proposal>change.before.data();
    const curr = <Proposal | undefined>change.after.data();
    if (!curr) {
      return;
    }

    if (
      isAddRemoveGuardianVote(curr) &&
      voteThresholdReached(prev, curr, ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE)
    ) {
      await onAddRemoveGuardianProposalApproved(curr);
    }

    if (
      curr.type === ProposalType.EDIT_SPACE &&
      voteThresholdReached(prev, curr, UPDATE_SPACE_THRESHOLD_PERCENTAGE)
    ) {
      await onEditSpaceProposalApproved(curr);
    }
  });

const isAddRemoveGuardianVote = (curr: Proposal) =>
  [ProposalType.ADD_GUARDIAN, ProposalType.REMOVE_GUARDIAN].includes(curr.type);

const voteThresholdReached = (prev: Proposal, curr: Proposal, threshold: number) => {
  const prevAnsweredPercentage = ((prev.results?.voted || 0) * 100) / (prev.results?.total || 0);
  const currAnsweredPercentage = ((curr.results?.voted || 0) * 100) / (curr.results?.total || 0);
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
  const spaceUpdateData = proposal.settings.spaceUpdateData;
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceUpdateData.uid}`);

  if (spaceUpdateData.open) {
    const knockingMembersSnap = await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).get();
    const deleteKnockingMemberPromise = knockingMembersSnap.docs.map((d) => d.ref.delete());
    await Promise.all(deleteKnockingMemberPromise);
  }
  const updateData = spaceUpdateData.open
    ? { ...spaceUpdateData, totalPendingMembers: 0 }
    : spaceUpdateData;
  await spaceDocRef.update(uOn(updateData));
  await admin
    .firestore()
    .doc(`${COL.PROPOSAL}/${proposal.uid}`)
    .update({ 'settings.endDate': dateToTimestamp(dayjs().subtract(1, 's').toDate()) });
};
