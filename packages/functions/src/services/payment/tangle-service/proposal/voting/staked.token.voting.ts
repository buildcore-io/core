import {
  COL,
  Proposal,
  Stake,
  SUB_COL,
  TokenDistribution,
  Transaction,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin, { inc } from '../../../../../admin.config';
import { cOn, serverTime, uOn } from '../../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../../utils/error.utils';
import { getTokenVoteMultiplier } from '../../../voting-service';
import { createVoteTransaction } from './ProposalVoteService';

export const voteWithStakedTokens = async (
  transaction: admin.firestore.Transaction,
  member: string,
  proposal: Proposal,
  values: number[],
) => {
  const distributionDocRef = admin
    .firestore()
    .collection(COL.TOKEN)
    .doc(proposal.token!)
    .collection(SUB_COL.DISTRIBUTION)
    .doc(member);
  const distribution = <TokenDistribution>(await transaction.get(distributionDocRef)).data();
  if (distribution.stakeVoteTransactionId) {
    await expireStakeVoteTransaction(transaction, proposal, distribution.stakeVoteTransactionId);
  }

  const stakes = await getActiveStakes(member, proposal.token!);
  const weight = getWeightForStakes(
    proposal,
    dayjs(),
    stakes,
    dayjs(proposal.settings.endDate.toDate()),
  );

  if (!weight) {
    throw throwInvalidArgument(WenError.not_enough_staked_tokens);
  }

  const voteTransaction = createVoteTransaction(
    proposal,
    member,
    weight,
    values,
    stakes.map((s) => s.uid),
  );
  const voteTransactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
  transaction.create(voteTransactionDocRef, cOn(voteTransaction));

  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
  transaction.set(
    proposalMemberDocRef,
    uOn({
      voted: true,
      voteTransactions: inc(1),
      tranId: voteTransaction.uid,
      weightPerAnswer: { [values[0]]: inc(weight) },
      values: admin.firestore.FieldValue.arrayUnion({
        [values[0]]: weight,
        voteTransaction: voteTransaction.uid,
      }),
    }),
    { merge: true },
  );

  const proposalData = {
    results: {
      total: inc(weight),
      voted: inc(weight),
      answers: { [`${values[0]}`]: inc(weight) },
    },
  };
  transaction.set(proposalDocRef, uOn(proposalData), { merge: true });

  transaction.update(distributionDocRef, uOn({ stakeVoteTransactionId: voteTransaction.uid }));

  return voteTransaction;
};

const expireStakeVoteTransaction = async (
  transaction: admin.firestore.Transaction,
  currentProposal: Proposal,
  voteTransactionId: string,
) => {
  const voteTransactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransactionId}`);
  const voteTransaction = <Transaction>(await transaction.get(voteTransactionDocRef)).data();
  let proposal = currentProposal;
  let proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${currentProposal.uid}`);
  if (voteTransaction.payload.proposalId !== currentProposal.uid) {
    proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${voteTransaction.payload.proposalId}`);
    proposal = <Proposal>(await proposalDocRef.get()).data();
  }

  if (dayjs().isAfter(dayjs(proposal.settings.endDate.toDate()))) {
    return;
  }
  const proposalMemberDocRef = proposalDocRef
    .collection(SUB_COL.MEMBERS)
    .doc(voteTransaction.member!);

  const stakes = await getStakesById(voteTransaction.payload.stakes);
  const weight = getWeightForStakes(
    proposal,
    dayjs(voteTransaction.createdOn!.toDate()),
    stakes,
    dayjs(),
  );

  transaction.update(
    voteTransactionDocRef,
    uOn({
      'payload.weight': weight,
      'payload.outputConsumed': true,
      'payload.outputConsumedOn': serverTime(),
    }),
  );

  const prevWeight = voteTransaction.payload.weight;
  const prevValue = voteTransaction.payload.values[0];

  transaction.set(
    proposalMemberDocRef,
    uOn({
      values: admin.firestore.FieldValue.arrayRemove({
        [prevValue]: prevWeight,
        voteTransaction: voteTransaction.uid,
      }),
      voteTransactions: inc(-1),
      weightPerAnswer: { [prevValue]: inc(-prevWeight + weight) },
    }),
    { merge: true },
  );
  transaction.update(proposalMemberDocRef, {
    values: admin.firestore.FieldValue.arrayUnion({
      [prevValue]: weight,
      voteTransaction: voteTransaction.uid,
    }),
  });

  const data = {
    results: {
      total: inc(-prevWeight + weight),
      voted: inc(-prevWeight + weight),
      answers: { [prevValue]: inc(-prevWeight + weight) },
    },
  };
  transaction.set(proposalDocRef, uOn(data), { merge: true });
};

const getStakesById = (stakeIds: string[]) => {
  const promises = stakeIds.map(async (uid) => {
    const docRef = admin.firestore().doc(`${COL.STAKE}/${uid}`);
    return <Stake>(await docRef.get()).data();
  });
  return Promise.all(promises);
};

const getWeightForStakes = (
  proposal: Proposal,
  voteCreatedOn: dayjs.Dayjs,
  stakes: Stake[],
  consumedOn: dayjs.Dayjs,
) =>
  stakes.reduce((sum, stake) => {
    const expiresAt = dayjs(stake.expiresAt.toDate());
    const multiplier = getTokenVoteMultiplier(
      proposal,
      voteCreatedOn,
      expiresAt.isBefore(consumedOn) ? expiresAt : consumedOn,
    );
    return sum + stake.amount * multiplier;
  }, 0);

const getActiveStakes = async (member: string, token: string) => {
  const snap = await admin
    .firestore()
    .collection(COL.STAKE)
    .where('member', '==', member)
    .where('token', '==', token)
    .where('expiresAt', '>=', dayjs().toDate())
    .get();
  return snap.docs.map((d) => <Stake>d.data());
};
