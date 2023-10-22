import { build5Db, ITransaction } from '@build-5/database';
import {
  COL,
  Proposal,
  Stake,
  SUB_COL,
  TokenDistribution,
  Transaction,
  WenError,
} from '@build-5/interfaces';
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
  const distributionDocRef = build5Db()
    .collection(COL.TOKEN)
    .doc(proposal.token!)
    .collection(SUB_COL.DISTRIBUTION)
    .doc(member);
  const distribution = (await transaction.get<TokenDistribution>(distributionDocRef))!;
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
  const voteTransactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
  transaction.create(voteTransactionDocRef, voteTransaction);

  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(member);
  transaction.set(
    proposalMemberDocRef,
    {
      voted: true,
      voteTransactions: build5Db().inc(1),
      tranId: voteTransaction.uid,
      weightPerAnswer: { [values[0]]: build5Db().inc(weight) },
      values: build5Db().arrayUnion({
        [values[0]]: weight,
        voteTransaction: voteTransaction.uid,
      }),
    },
    true,
  );

  const proposalData = {
    results: {
      total: build5Db().inc(weight),
      voted: build5Db().inc(weight),
      answers: { [`${values[0]}`]: build5Db().inc(weight) },
    },
  };
  transaction.set(proposalDocRef, proposalData, true);

  transaction.update(distributionDocRef, { stakeVoteTransactionId: voteTransaction.uid });

  return voteTransaction;
};

const expireStakeVoteTransaction = async (
  transaction: ITransaction,
  currentProposal: Proposal,
  voteTransactionId: string,
) => {
  const voteTransactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${voteTransactionId}`);
  const voteTransaction = (await transaction.get<Transaction>(voteTransactionDocRef))!;
  let proposal = currentProposal;
  let proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${currentProposal.uid}`);
  if (voteTransaction.payload.proposalId !== currentProposal.uid) {
    proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${voteTransaction.payload.proposalId}`);
    proposal = (await proposalDocRef.get<Proposal>())!;
  }

  if (dayjs().isAfter(dayjs(proposal.settings.endDate.toDate()))) {
    return;
  }
  const proposalMemberDocRef = proposalDocRef
    .collection(SUB_COL.MEMBERS)
    .doc(voteTransaction.member!);

  const stakes = await getStakesById(voteTransaction.payload.stakes!);
  const weight = getWeightForStakes(
    proposal,
    dayjs(voteTransaction.createdOn!.toDate()),
    stakes,
    dayjs(),
  );

  transaction.update(voteTransactionDocRef, {
    'payload.weight': weight,
    'payload.outputConsumed': true,
    'payload.outputConsumedOn': dayjs().toDate(),
  });

  const prevWeight = voteTransaction.payload.weight!;
  const prevValue = voteTransaction.payload.values![0];

  transaction.set(
    proposalMemberDocRef,
    {
      values: build5Db().arrayRemove({
        [prevValue]: prevWeight,
        voteTransaction: voteTransaction.uid,
      }),
      voteTransactions: build5Db().inc(-1),
      weightPerAnswer: { [prevValue]: build5Db().inc(-prevWeight + weight) },
    },
    true,
  );
  transaction.update(proposalMemberDocRef, {
    values: build5Db().arrayUnion({
      [prevValue]: weight,
      voteTransaction: voteTransaction.uid,
    }),
  });

  const data = {
    results: {
      total: build5Db().inc(-prevWeight + weight),
      voted: build5Db().inc(-prevWeight + weight),
      answers: { [prevValue]: build5Db().inc(-prevWeight + weight) },
    },
  };
  transaction.set(proposalDocRef, data, true);
};

const getStakesById = (stakeIds: string[]) => {
  const promises = stakeIds.map(async (uid) => {
    const docRef = build5Db().doc(`${COL.STAKE}/${uid}`);
    return (await docRef.get<Stake>())!;
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

const getActiveStakes = (member: string, token: string) =>
  build5Db()
    .collection(COL.STAKE)
    .where('member', '==', member)
    .where('token', '==', token)
    .where('expiresAt', '>=', dayjs().toDate())
    .get<Stake>();
