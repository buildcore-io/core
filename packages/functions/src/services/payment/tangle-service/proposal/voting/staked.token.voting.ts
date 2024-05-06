import { database, ITransaction } from '@buildcore/database';
import { COL, Proposal, Stake, SUB_COL, WenError } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { invalidArgument } from '../../../../../utils/error.utils';
import { getTokenVoteMultiplier } from '../../../voting-service';
import { createVoteTransaction } from './ProposalVoteService';

export const voteWithStakedTokens = async (
  project: string,
  transaction: ITransaction,
  member: string,
  proposal: Proposal,
  values: number[],
) => {
  const distributionDocRef = database().doc(
    COL.TOKEN,
    proposal.token!,
    SUB_COL.DISTRIBUTION,
    member,
  );
  const distribution = (await transaction.get(distributionDocRef))!;
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
    throw invalidArgument(WenError.not_enough_staked_tokens);
  }

  const voteTransaction = createVoteTransaction(
    project,
    proposal,
    member,
    weight,
    values,
    stakes.map((s) => s.uid),
  );
  const voteTransactionDocRef = database().doc(COL.TRANSACTION, voteTransaction.uid);
  await transaction.create(voteTransactionDocRef, voteTransaction);

  const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
  const proposalMemberDocRef = database().doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, member);

  const value = values[0].toString();
  await transaction.update(proposalDocRef, {
    results: {
      total: database().inc(weight),
      voted: database().inc(weight),
      answers: { [value]: database().inc(weight) },
    },
  });

  await transaction.upsert(proposalMemberDocRef, {
    voted: true,
    tranId: voteTransaction.uid,
    weight: database().inc(weight),
    values: { [voteTransaction.uid]: { value, weight: database().inc(weight) } },
  });

  await transaction.update(distributionDocRef, { stakeVoteTransactionId: voteTransaction.uid });

  return voteTransaction;
};

const expireStakeVoteTransaction = async (
  transaction: ITransaction,
  currentProposal: Proposal,
  voteTransactionId: string,
) => {
  const voteTransactionDocRef = database().doc(COL.TRANSACTION, voteTransactionId);
  const voteTransaction = (await transaction.get(voteTransactionDocRef))!;
  let proposal = currentProposal;
  let proposalDocRef = database().doc(COL.PROPOSAL, currentProposal.uid);
  if (voteTransaction.payload.proposalId !== currentProposal.uid) {
    proposalDocRef = database().doc(COL.PROPOSAL, voteTransaction.payload.proposalId!);
    proposal = (await proposalDocRef.get())!;
  }

  if (dayjs().isAfter(dayjs(proposal.settings.endDate.toDate()))) {
    return;
  }

  const stakes = await getStakesById(voteTransaction.payload.stakes!);
  const weight = getWeightForStakes(
    proposal,
    dayjs(voteTransaction.createdOn!.toDate()),
    stakes,
    dayjs(),
  );

  await transaction.update(voteTransactionDocRef, {
    payload_weight: weight,
    payload_outputConsumed: true,
    payload_outputConsumedOn: dayjs().toDate(),
  });

  const prevWeight = voteTransaction.payload.weight!;
  const prevValue = voteTransaction.payload.values![0].toString();

  const proposalMemberDocRef = database().doc(
    COL.PROPOSAL,
    proposal.uid,
    SUB_COL.MEMBERS,
    voteTransaction.member!,
  );
  await transaction.update(proposalMemberDocRef, { values: { [voteTransaction.uid]: { weight } } });

  const data = {
    results: {
      total: database().inc(-prevWeight + weight),
      voted: database().inc(-prevWeight + weight),
      answers: { [prevValue]: database().inc(-prevWeight + weight) },
    },
  };
  await transaction.update(proposalDocRef, data);
};

const getStakesById = (stakeIds: string[]) => {
  const promises = stakeIds.map(async (uid) => {
    const docRef = database().doc(COL.STAKE, uid);
    return (await docRef.get())!;
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
  const stakes = await database()
    .collection(COL.STAKE)
    .where('member', '==', member)
    .where('token', '==', token)
    .where('expirationProcessed', '==', false)
    .get();
  return stakes.filter((s) => dayjs(s.expiresAt.toDate()).isAfter(dayjs()));
};
